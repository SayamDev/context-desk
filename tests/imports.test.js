import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {validateImportUrl} from '../lib/imports.js';
test('allows public links only on supported platform hosts',()=>{
  for(const url of ['https://www.youtube.com/watch?v=example','https://youtu.be/example','https://www.twitch.tv/videos/123','https://vimeo.com/123'])assert.equal(validateImportUrl(url),url);
});
test('rejects private endpoints, credentials, custom ports and lookalike domains',()=>{
  for(const url of ['http://youtube.com/watch?v=example','https://127.0.0.1/video.mp4','https://localhost/video.mp4','file:///tmp/video.mp4','https://user:secret@youtube.com/watch?v=example','https://youtube.com:8443/watch?v=example','https://youtube.com.evil.example/video','https://evil-youtube.com/video','https://youtube.com@evil.example/video'])assert.throws(()=>validateImportUrl(url),undefined,url);
});
import {validateDuration,validateSegment,wavRms} from '../lib/imports.js';
test('accepts full-length recordings through six hours and rejects over-limit media',()=>{
  assert.equal(validateDuration(1900),1900);assert.equal(validateDuration(21600),21600);
  for(const value of [0,-1,NaN,Infinity,21601])assert.throws(()=>validateDuration(value));
});
test('audio ranges remain bounded even near the end of a long recording',()=>{
  assert.deepEqual(validateSegment(21540,21600,21600),{start:21540,end:21600});
  for(const [a,b]of [[-1,5],[20,20],[0,61],[21590,21601],[NaN,4]])assert.throws(()=>validateSegment(a,b,21600));
});
test('WAV level reader handles metadata chunks before audio',()=>{
  const wav=Buffer.alloc(58);wav.write('RIFF',0);wav.write('WAVE',8);wav.write('JUNK',12);wav.writeUInt32LE(2,16);wav.write('fmt ',22);wav.writeUInt32LE(16,26);wav.write('data',46);wav.writeUInt32LE(4,50);wav.writeInt16LE(16384,54);wav.writeInt16LE(-16384,56);assert.equal(wavRms(wav),.5);
});
import {mediaRange} from '../lib/imports.js';
import {chooseDownloadFormat,workingSetTooLarge,metadataTemplate} from '../lib/imports.js';
test('metadata projection discards multi-megabyte format URLs before printing',{skip:!existsSync('.runtime/yt_dlp')},()=>{
  const script=`from yt_dlp import YoutubeDL
import os
info={'title':'Episode','duration':7555,'is_live':False,'live_status':'not_live','formats':[{'format_id':'137','height':1080,'ext':'mp4','vcodec':'h264','acodec':'none','tbr':3000,'url':'x'*9000000}]}
with YoutubeDL({'quiet':True}) as ydl: print(ydl.evaluate_outtmpl(os.environ['METADATA_TEST_TEMPLATE'],info))`;
  const result=spawnSync('python3',['-c',script],{env:{...process.env,PYTHONPATH:'.runtime',METADATA_TEST_TEMPLATE:metadataTemplate},encoding:'utf8',timeout:10000});
  assert.equal(result.status,0,result.stderr);assert.ok(result.stdout.length<1000);const data=JSON.parse(result.stdout);assert.equal(data.title,'Episode');assert.equal(data.duration,7555);assert.equal(data.formats[0].format_id,'137');assert.equal(data.formats[0].url,undefined);
});
test('long episodes automatically choose a quality that fits including the audio',()=>{
  const GiB=1024**3,info={duration:7555,formats:[
    {format_id:'a',ext:'m4a',vcodec:'none',acodec:'aac',filesize:.2*GiB,tbr:128},
    {format_id:'v1',ext:'mp4',vcodec:'h264',acodec:'none',height:1080,filesize:4.1*GiB,tbr:5000},
    {format_id:'v2',ext:'mp4',vcodec:'h264',acodec:'none',height:720,filesize:2*GiB,tbr:2500},
    {format_id:'v3',ext:'mp4',vcodec:'h264',acodec:'none',height:480,filesize:GiB,tbr:1200}
  ]};
  assert.equal(chooseDownloadFormat(info).format,'v2+a');assert.equal(chooseDownloadFormat(info,480).format,'v3+a');
  assert.throws(()=>chooseDownloadFormat({duration:7555,formats:[]}),/compatible/);
});
test('merge temporary files do not count twice against the final recording limit',()=>{
  const GiB=1024**3;
  assert.equal(workingSetTooLarge([2.7*GiB,.2*GiB,2.9*GiB]),false);
  assert.equal(workingSetTooLarge([4.5*GiB]),true);
});
test('multi-gigabyte sources support seek and tail ranges without downloading the full file',()=>{
  const size=4*1024*1024*1024;
  assert.deepEqual(mediaRange('bytes=-1024',size),{start:size-1024,end:size-1,partial:true});
  assert.deepEqual(mediaRange('bytes=3000000000-3000001023',size),{start:3000000000,end:3000001023,partial:true});
  for(const range of ['bytes=-','bytes=7-3','bytes=9999999999-','bytes=0-1,4-5'])assert.throws(()=>mediaRange(range,size));
});
