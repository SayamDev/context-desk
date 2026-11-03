import test from 'node:test';import assert from 'node:assert/strict';import {Readable} from 'node:stream';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {randomUUID} from 'node:crypto';
import {handleImport,sourceKey} from '../lib/imports.js';import {studioStore} from '../lib/store.js';
const request=async(url,method,body=Buffer.alloc(0),headers={})=>{const req=Readable.from(body.length?[body]:[]);Object.assign(req,{url,method,headers});let result;await handleImport(req,{},(_,status,data)=>result={status,data});return result};
const json=value=>Buffer.from(JSON.stringify(value));
// The same fingerprint the page computes with Blob and crypto.subtle before it uploads anything.
async function browserPrint(bytes){const part=Math.min(bytes.length,1<<20),blob=new Blob([String(bytes.length),bytes.subarray(0,part),bytes.subarray(bytes.length-part)]);return Buffer.from(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())).toString('hex')}

test('every way of sharing one YouTube video is the same source; other videos are not',()=>{
  const key=sourceKey('https://www.youtube.com/watch?v=iaFhyFxo49I');
  for(const url of ['https://youtu.be/iaFhyFxo49I?si=0tmNemEcAkE4Kj9M','https://m.youtube.com/watch?v=iaFhyFxo49I&t=90s','https://youtube.com/watch?feature=share&v=iaFhyFxo49I','https://www.youtube.com/shorts/iaFhyFxo49I','https://www.youtube.com/live/iaFhyFxo49I?si=x'])assert.equal(sourceKey(url),key,url);
  assert.notEqual(sourceKey('https://youtu.be/otherVideo1'),key);
  assert.equal(sourceKey('https://www.twitch.tv/videos/123?t=1h2m&utm_source=x'),sourceKey('https://twitch.tv/videos/123/'));
  assert.notEqual(sourceKey('https://vimeo.com/123'),sourceKey('https://vimeo.com/124'));
});

test('a local file already in the Library is found before copying, and a trashed one comes back',async()=>{
  const store=studioStore(),bytes=Buffer.alloc(3*1024*1024);for(let i=0;i<bytes.length;i++)bytes[i]=(i*7+i%251)&255;
  const uploaded=await request('/api/import/upload','POST',bytes,{'x-video-duration':'42','x-video-name':'episode.mp4','content-type':'video/mp4','content-length':String(bytes.length)});assert.equal(uploaded.status,201);
  const check=body=>request('/api/import/check','POST',json(body));
  const same=await check({size:bytes.length,duration:42,print:await browserPrint(bytes)});assert.equal(same.status,200);assert.equal(same.data.duplicate,true);assert.equal(same.data.id,uploaded.data.id);assert.equal(same.data.restored,false);assert.ok(same.data.mediaUrl);
  const other=Buffer.from(bytes);other[other.length-1]^=1;assert.equal((await check({size:other.length,duration:42,print:await browserPrint(other)})).data.duplicate,false);
  assert.equal((await check({size:bytes.length,duration:90,print:await browserPrint(bytes)})).data.duplicate,false,'a different length is a different recording');
  store.trashProject(uploaded.data.id,true);
  const back=await check({size:bytes.length,duration:42,print:await browserPrint(bytes)});assert.equal(back.data.restored,true);assert.equal(store.isTrashed(uploaded.data.id),false);
  assert.equal((await check({size:'x',print:'nope'})).status,400);
});

test('pasting a shared link to an imported video reopens it instead of downloading again',async()=>{
  const store=studioStore(),id=randomUUID(),fs=await import('node:fs/promises');await fs.mkdir(store.sourceDirectory(id),{recursive:true});await fs.writeFile(store.sourceDirectory(id)+'/source.mp4',Buffer.alloc(2000,1));
  store.putRecord('source',id,{id,status:'ready',title:'Episode 32',duration:7670,size:2000,mime:'video/mp4',created:Date.now(),sourceUrl:'https://www.youtube.com/watch?v=iaFhyFxo49I',fileName:'source.mp4'});store.createProject({id,title:'Episode 32',sourceId:id});
  // A fresh process loads saved sources at start, as the app does after a restart.
  const script=`import {Readable} from 'node:stream';import {handleImport} from './lib/imports.js';const req=Readable.from([Buffer.from(JSON.stringify({url:'https://youtu.be/iaFhyFxo49I?si=0tmNemEcAkE4Kj9M'}))]);Object.assign(req,{url:'/api/import',method:'POST',headers:{}});await handleImport(req,{},(_,status,data)=>console.log(JSON.stringify({status,data})));`;
  const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),env:process.env}),{status,data}=JSON.parse(stdout.trim());
  assert.equal(status,200);assert.equal(data.duplicate,true);assert.equal(data.id,id);assert.equal(data.status,'ready');
  assert.equal(store.listRecords('source').filter(r=>r.sourceUrl&&sourceKey(r.sourceUrl)===sourceKey(data.sourceUrl)).length,1,'no second copy was started');
});

import {livePlayerUrl} from '../lib/imports.js';
test('a live link maps to the platform player page, which shows only the video',()=>{
  assert.equal(livePlayerUrl({extractor_key:'Youtube',id:'aPxWXFjcYXg'}),'https://www.youtube.com/embed/aPxWXFjcYXg?autoplay=1&playsinline=1&rel=0&vq=hd1080');
  assert.equal(livePlayerUrl({extractor_key:'TwitchStream',id:'123',uploader_id:'Kai_Cenat'}),'https://player.twitch.tv/?channel=kai_cenat&parent=localhost&autoplay=true');
  assert.equal(livePlayerUrl({extractor_key:'Kick',channel:'xqc'}),'https://player.kick.com/xqc');
  for(const info of [{extractor_key:'Youtube',id:'bad id'},{extractor_key:'Vimeo',id:'1'},{extractor_key:'Twitch',uploader_id:'<script>'},null])assert.equal(livePlayerUrl(info),'');
});
