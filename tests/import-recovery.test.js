import test from 'node:test';import assert from 'node:assert/strict';import {Readable,Writable} from 'node:stream';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {handleImport} from '../lib/imports.js';
test('uploaded source bytes and stable media ID survive a new Node process',async()=>{
  const bytes=Buffer.alloc(1200,71),req=Readable.from([bytes]);req.url='/api/import/upload';req.method='POST';req.headers={'x-video-duration':'2','x-video-name':'recovery-fixture.mp4','content-type':'video/mp4','content-length':String(bytes.length)};let job;
  await handleImport(req,{},(_,status,data)=>{assert.equal(status,201);job=data});assert.equal(job.status,'ready');
  const script=`import {Readable,Writable} from 'node:stream';import {handleImport} from './lib/imports.js';const req=Readable.from([]);req.url=${JSON.stringify(job.mediaUrl)};req.method='GET';req.headers={range:'bytes=20-35'};let status,parts=[];const res=new Writable({write(c,_,cb){parts.push(c);cb()}});res.writeHead=(code)=>{status=code};res.on('finish',()=>console.log(JSON.stringify({status,bytes:Buffer.concat(parts).toString('base64')})));await handleImport(req,res,(_,code,data)=>{console.log(JSON.stringify({code,data}))});`;
  const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),env:process.env});const result=JSON.parse(stdout.trim());assert.equal(result.status,206);assert.equal(Buffer.from(result.bytes,'base64').compare(bytes.subarray(20,36)),0);
});
test('missing source relink verifies original bytes and keeps project edits on mismatch',async()=>{
  const fs=await import('node:fs/promises'),{studioStore}=await import('../lib/store.js'),store=studioStore(),bytes=Buffer.alloc(1600,42);
  const request=async(url,method,body=Buffer.alloc(0),headers={})=>{const req=Readable.from(body.length?[body]:[]);Object.assign(req,{url,method,headers});let result;await handleImport(req,{},(_,status,data)=>result={status,data});return result};
  const uploaded=await request('/api/import/upload','POST',bytes,{'x-video-duration':'3','x-video-name':'relink-fixture.mp4','content-type':'video/mp4','content-length':'1600'}),id=uploaded.data.id;
  store.saveProject(id,{moments:[],settings:{speechLanguage:'Arabic'}},0,{title:'Keep these edits'});const record=store.getRecord('source',id),file=store.sourceDirectory(id)+'/'+record.fileName;await fs.rename(file,file+'.qa-moved');
  assert.equal((await request('/api/import/'+id,'GET')).data.status,'missing');const headers={'x-video-duration':'3','content-type':'video/mp4'};
  const wrong=await request('/api/import/'+id+'/relink','POST',Buffer.alloc(1600,43),headers);assert.equal(wrong.status,400);assert.match(wrong.data.error,/do not match/);assert.equal(store.getProject(id).title,'Keep these edits');
  const restored=await request('/api/import/'+id+'/relink','POST',bytes,headers);assert.equal(restored.status,200);assert.equal(restored.data.status,'ready');assert.equal(Buffer.compare(await fs.readFile(file),bytes),0);assert.equal(store.getProject(id).state.settings.speechLanguage,'Arabic');
});
