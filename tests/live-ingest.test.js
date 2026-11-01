import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {openStore} from '../lib/store.js';
import {probeMedia} from '../lib/exports.js';
import {createLiveIngestService,liveReceiverArgs,parseLiveManifest,spawnLiveReceiver,LIVE_INGEST_LIMITS} from '../lib/live-ingest.js';

const enoughSpace=async()=>({bavail:10000000,bsize:4096}),media=Buffer.alloc(1500,7),image=Buffer.alloc(120,5),mediaInfo={duration:24,width:320,height:180,audio:true,fps:30};
async function until(check){for(let i=0;i<100;i++){const value=check();if(value)return value;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Live receiver did not settle.');}
async function fixture(run){const root=await fs.mkdtemp(path.join(os.tmpdir(),'live-ingest-')),store=openStore(root),services=[];const deps={store,allocatePort:async()=>19350,statfs:enoughSpace,probe:async file=>{const rows=parseLiveManifest(await fs.readFile(path.join(path.dirname(file),'segments.csv'),'utf8')),entry=rows.find(row=>row.name===path.basename(file));return {...mediaInfo,duration:entry.end-entry.start};},frame:async()=>image,pollMs:20,stopGraceMs:50};try{await run({store,root,deps,service(options={}){const value=createLiveIngestService({...deps,...options});services.push(value);return value;}});}finally{await Promise.all(services.map(s=>s.shutdown()));await Promise.all(services.map(s=>s.waitForCallbacks()));store.close();await fs.rm(root,{recursive:true,force:true});}}
function processes(){const calls=[];return {calls,spawn(file,args,options){const child=new EventEmitter();child.stderr=new PassThrough();child.kill=signal=>{child.signal=signal;queueMicrotask(()=>child.emit('close',0));return true;};calls.push({file,args,options,child});return child;}};}
async function windowFile(call,{index=0,start=0,end=24,bytes=media,partial=false}={}){await fs.writeFile(path.join(call.options.cwd,`window-${String(index).padStart(5,'0')}.mp4`),bytes);await fs.appendFile(path.join(call.options.cwd,'segments.csv'),`window-${String(index).padStart(5,'0')}.mp4,${start},${end}${partial?'':'\n'}`);}

test('RTMP args are fixed loopback-only, bounded, segmented and retain optional audio',()=>{
  const args=liveReceiverArgs({streamUrl:'rtmp://127.0.0.1:19350/live/'+'a'.repeat(48),remainingSeconds:100,dir:'/tmp/local-recording'});assert.deepEqual(args.slice(args.indexOf('-map'),args.indexOf('-map')+4),['-map','0:v:0','-map','0:a:0?']);assert.equal(args[args.indexOf('-listen')+1],'1');assert.equal(args[args.indexOf('-segment_time')+1],'24');assert.equal(args[args.indexOf('-reset_timestamps')+1],'1');assert.ok(args.includes('expr:gte(t,n_forced*24)'));assert.equal(args[args.indexOf('-t')+1],'100');
  for(const url of ['https://example.com/video','rtmp://0.0.0.0:19350/live/'+'a'.repeat(48),'rtmp://remote.test:19350/live/'+'a'.repeat(48)])assert.throws(()=>liveReceiverArgs({streamUrl:url,remainingSeconds:100,dir:'/tmp'}),/localhost/);
  assert.deepEqual(parseLiveManifest('window-00000.mp4,0,24\nwindow-00001.mp4,24,25'),[{name:'window-00000.mp4',start:0,end:24}]);assert.throws(()=>parseLiveManifest('../secrets,0,24\n'),/invalid/);assert.throws(()=>parseLiveManifest('window-00000.mp4,0,100\n'),/clock/);
});

test('finalized video and original-project moment are durable before a failing callback',()=>fixture(async({store,service})=>{
  const p=store.createProject(),other=store.createProject(),fake=processes();let calls=0;
  const receiver=service({spawnReceiver:fake.spawn,onWindow:async value=>{calls++;assert.equal(value.projectId,p.id);assert.ok(store.assetPath(value.asset.id));assert.equal(store.getProject(p.id).state.moments[0].id,value.moment.id);throw Error('AI unavailable');}}),started=await receiver.start({projectId:p.id});
  assert.match(started.connection.serverUrl,/^rtmp:\/\/127\.0\.0\.1:/);assert.equal(started.connection.streamKey.length,48);assert.equal(receiver.list()[0].connection,undefined);assert.doesNotMatch(JSON.stringify(store.listRecords('live_ingest')),new RegExp(started.connection.streamKey));
  await windowFile(fake.calls[0]);await until(()=>receiver.get(started.id).windowCount===1);await receiver.waitForCallbacks();const done=await receiver.stop(started.id);assert.equal(done.status,'stopped');assert.equal(done.windows[0].callbackStatus,'error');assert.equal(done.windows[0].audio,true);assert.equal(calls,1);assert.equal(store.getProject(other.id).state.moments.length,0);
  const moment=store.getProject(p.id).state.moments[0];assert.equal(moment.start,0);assert.equal(moment.end,24);assert.equal(moment.mediaStart,0);assert.equal(moment.manual,false);assert.equal(moment.status,'captured');assert.equal(moment.cleanCapture,true);assert.equal(moment.sourcePixels.audioTracks,1);assert.deepEqual(await fs.readFile(store.assetPath(done.windows[0].asset.id).file),media);assert.throws(()=>receiver.connection(started.id),/Resume/);
}));

test('only manifest-finalized windows are saved and stop retains final short window',()=>fixture(async({store,service})=>{
  const p=store.createProject(),fake=processes(),receiver=service({spawnReceiver:fake.spawn}),job=await receiver.start({projectId:p.id});await windowFile(fake.calls[0],{partial:true});await new Promise(resolve=>setTimeout(resolve,40));assert.equal(receiver.get(job.id).windowCount,0);
  await fs.appendFile(path.join(fake.calls[0].options.cwd,'segments.csv'),'\n');await until(()=>receiver.get(job.id).windowCount===1);await windowFile(fake.calls[0],{index:1,start:24,end:27});const done=await receiver.stop(job.id);assert.equal(done.windowCount,2);assert.equal(done.windows[1].duration,3);assert.equal(done.elapsedSeconds,27);assert.equal(store.getProject(p.id).state.moments[1].mediaStart,0);assert.equal(done.status,'stopped');
}));

test('receiver rejects arbitrary URLs, imported projects, wrong owners and overlapping sessions',()=>fixture(async({store,service})=>{
  const p=store.createProject(),other=store.createProject(),imported=store.createProject({sourceId:'recording'}),fake=processes(),receiver=service({spawnReceiver:fake.spawn,getActiveProjectId:()=>p.id});
  await assert.rejects(receiver.start({projectId:p.id,url:'https://youtube.com/watch?v=anything'}),/source URLs/);await assert.rejects(receiver.start({projectId:imported.id}),/new live project/);await assert.rejects(receiver.start({projectId:other.id}),/owning live project/);await assert.rejects(receiver.start({projectId:p.id,maxSeconds:21601}),/duration/);await assert.rejects(receiver.start({projectId:p.id,maxBytes:LIVE_INGEST_LIMITS.bytes+1}),/budget/);
  const job=await receiver.start({projectId:p.id});await assert.rejects(receiver.start({projectId:other.id}),/active live receiver/);await assert.rejects(receiver.command(job.id,'stop',{projectId:other.id}),/another project/);assert.equal(fake.calls.length,1);await receiver.command(job.id,'cancel',{projectId:p.id});assert.equal(receiver.get(job.id).status,'cancelled');
}));

test('storage precheck prevents spawning, and running storage failure preserves earlier windows',()=>fixture(async({store,service})=>{
  const p=store.createProject(),fake=processes();let free=true;const receiver=service({spawnReceiver:fake.spawn,statfs:async()=>free?enoughSpace():({bavail:1,bsize:4096})});free=false;await assert.rejects(receiver.start({projectId:p.id}),/disk space/);assert.equal(fake.calls.length,0);free=true;
  const job=await receiver.start({projectId:p.id,maxBytes:3000});await windowFile(fake.calls[0]);await until(()=>receiver.get(job.id).windowCount===1);free=false;await until(()=>receiver.get(job.id).status==='error');assert.equal(receiver.get(job.id).windowCount,1);assert.equal(store.getProject(p.id).state.moments.length,1);
}));

test('restart requires explicit resume, recovers finalized windows, rotates address and extends captured clock',()=>fixture(async({store,root,service})=>{
  const p=store.createProject(),id=randomUUID(),runId=randomUUID(),dir=path.join(root,'live-ingest',id,runId);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'window-00000.mp4'),media);await fs.writeFile(path.join(dir,'segments.csv'),'window-00000.mp4,0,24\n');store.putRecord('live_ingest',id,{id,projectId:p.id,title:'Interrupted local source',status:'recording',createdAt:1,updatedAt:1,maxSeconds:21600,maxBytes:LIVE_INGEST_LIMITS.bytes,elapsedSeconds:0,bytes:0,windowIds:[],runs:[{id:runId,offset:0,cleaned:false}]});
  const fake=processes(),receiver=service({spawnReceiver:fake.spawn});assert.equal(receiver.get(id).status,'interrupted');assert.equal(fake.calls.length,0);const resumed=await receiver.command(id,'resume');assert.equal(resumed.windowCount,1);assert.equal(resumed.elapsedSeconds,24);assert.match(resumed.connection.streamUrl,/127\.0\.0\.1/);await windowFile(fake.calls[0],{start:0,end:3});const done=await receiver.stop(id);assert.equal(done.windows[1].start,24);assert.equal(done.windows[1].end,27);assert.equal(done.bytes,3000);assert.equal(store.getProject(p.id).state.moments.length,2);
}));

test('process errors expose no encoder credentials or stderr and retain saved windows',()=>fixture(async({store,service})=>{
  const p=store.createProject(),fake=processes(),receiver=service({spawnReceiver:fake.spawn}),job=await receiver.start({projectId:p.id});await windowFile(fake.calls[0]);await until(()=>receiver.get(job.id).windowCount===1);fake.calls[0].child.stderr.write(job.connection.streamKey+' private low-level error');fake.calls[0].child.emit('error',Error(job.connection.streamUrl));await until(()=>receiver.get(job.id).status==='interrupted');assert.doesNotMatch(JSON.stringify(receiver.get(job.id)),new RegExp(job.connection.streamKey));assert.equal(receiver.get(job.id).windowCount,1);assert.equal(receiver.get(job.id).requiresResume,true);
}));

test('real FFmpeg localhost synthetic RTMP reception saves video, audio and source clocks',{skip:process.env.LIVE_INGEST_REAL!=='1',timeout:60000},async()=>{
  const executable=process.env.FFMPEG_PATH||path.resolve('.runtime/bin/ffmpeg');await fs.access(executable);const root=await fs.mkdtemp(path.join(os.tmpdir(),'live-rtmp-real-')),store=openStore(root),receiver=createLiveIngestService({store,pollMs:100});let sender;
  try{const project=store.createProject({title:'Synthetic localhost RTMP QA'}),job=await receiver.start({projectId:project.id,maxSeconds:35});await new Promise(resolve=>setTimeout(resolve,300));
    sender=spawn(executable,['-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=30','-f','lavfi','-i','sine=frequency=600:sample_rate=48000','-t','27','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-g','30','-c:a','aac','-f','flv',job.connection.streamUrl],{stdio:['ignore','ignore','pipe']});sender.stderr.resume();const code=await new Promise((resolve,reject)=>{sender.once('error',reject);sender.once('close',resolve);});assert.equal(code,0,'Synthetic sender must connect and finish');
    const done=await until(()=>{const value=receiver.get(job.id);return ['stopped','interrupted','error'].includes(value.status)&&value;});assert.ok(done.windowCount>=2,JSON.stringify({status:done.status,error:done.error,count:done.windowCount}));assert.ok(done.elapsedSeconds>=26.8&&done.elapsedSeconds<=27.3);assert.ok(Math.abs(done.windows[0].duration-24)<.2);
    for(const window of done.windows){const info=await probeMedia(store.assetPath(window.asset.id).file);assert.equal(info.audio,true);assert.equal(info.width,320);assert.equal(info.height,180);assert.ok(info.duration>.2);}
    assert.equal(store.getProject(project.id).state.moments.length,done.windowCount);
  }finally{sender?.kill('SIGTERM');await receiver.shutdown();store.close();await fs.rm(root,{recursive:true,force:true});}
});

test('real supervisor closes FFmpeg when the application liveness pipe ends',{skip:process.env.LIVE_INGEST_REAL!=='1',timeout:10000},async()=>{
  const executable=process.env.FFMPEG_PATH||path.resolve('.runtime/bin/ffmpeg'),root=await fs.mkdtemp(path.join(os.tmpdir(),'live-supervisor-')),output=path.join(root,'partial.mp4');let child;
  try{child=spawnLiveReceiver(executable,['-v','error','-y','-re','-f','lavfi','-i','testsrc2=size=160x90:rate=10','-t','60','-c:v','libx264','-preset','ultrafast',output],{cwd:root});child.stderr.resume();await new Promise(resolve=>setTimeout(resolve,350));child.stdin.end();const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});assert.equal(code,255);const info=await probeMedia(output);assert.ok(info.duration>0&&info.duration<10,'EOF should stop the encoder rather than leave a 60-second orphan');}
  finally{child?.kill('SIGKILL');await fs.rm(root,{recursive:true,force:true});}
});
