import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {probeMedia} from './exports.js';
import {captureFrame} from './media-worker.js';

export const LIVE_INGEST_LIMITS=Object.freeze({segmentSeconds:24,durationSeconds:21600,bytes:20*1024**3,segmentBytes:64*1024**2,reserveBytes:512*1024**2,manifestBytes:512*1024,sessions:100,runs:64});
const executable=()=>process.env.FFMPEG_PATH||path.resolve(import.meta.dirname,'../.runtime/bin/ffmpeg');
const activeStatuses=new Set(['starting','waiting','recording','stopping']);
// A Node parent exiting does not automatically kill FFmpeg on macOS. A small
// supervisor watches a pipe held open by the application; EOF triggers graceful
// termination, then a bounded hard kill. No shell or external install is used.
const supervisor=`
const {spawn}=require('node:child_process');
const child=spawn(process.argv[1],JSON.parse(process.argv[2]),{stdio:['ignore','ignore',2]});
let stopping=false,timer;
const stop=()=>{if(stopping)return;stopping=true;child.kill('SIGTERM');timer=setTimeout(()=>child.kill('SIGKILL'),1500);};
process.stdin.resume();process.stdin.on('end',stop);process.stdin.on('error',stop);
process.on('SIGTERM',stop);process.on('SIGINT',stop);
child.on('error',()=>process.exit(1));child.on('close',code=>{clearTimeout(timer);process.exit(code===null?1:code);});
`;
export function spawnLiveReceiver(file,args,options){return spawn(process.execPath,['-e',supervisor,file,JSON.stringify(args)],{...options,stdio:['pipe','ignore','pipe']});}
async function loopbackPort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',()=>reject(Error('Local RTMP sockets are unavailable.')));server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(error=>error?reject(Error('Local RTMP port allocation failed.')):resolve(port));});});}
function boundedNumber(value,fallback,max,name){const n=value===undefined?fallback:Number(value);if(!Number.isSafeInteger(n)||n<1||n>max)throw Error(`Choose a valid ${name} (maximum ${max}).`);return n;}

// Fixed loopback input only. Keyframes are forced at segment boundaries because
// segment_time alone is a target, not an exact-cut guarantee.
// https://ffmpeg.org/ffmpeg-formats.html#segment
export function liveReceiverArgs({streamUrl,remainingSeconds,dir}){
  const url=new URL(streamUrl);if(url.protocol!=='rtmp:'||url.hostname!=='127.0.0.1'||!/^\d+$/.test(url.port)||!/^\/live\/[a-f0-9]{48}$/.test(url.pathname)||url.search||url.username||url.password)throw Error('The receiver accepts only its generated localhost RTMP address.');
  if(!Number.isFinite(remainingSeconds)||remainingSeconds<=0||remainingSeconds>LIVE_INGEST_LIMITS.durationSeconds)throw Error('The live duration limit has been reached.');
  return ['-hide_banner','-loglevel','error','-nostdin','-y','-protocol_whitelist','rtmp,tcp','-listen','1','-timeout','120','-rw_timeout','15000000','-i',streamUrl,'-t',String(remainingSeconds),'-map','0:v:0','-map','0:a:0?','-vf',"scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",'-r','30','-c:v','libx264','-preset','veryfast','-b:v','4000k','-maxrate','6000k','-bufsize','12000k','-pix_fmt','yuv420p','-force_key_frames','expr:gte(t,n_forced*24)','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-map_metadata','-1','-f','segment','-segment_time','24','-segment_time_delta','0.016667','-reset_timestamps','1','-segment_format','mp4','-segment_format_options','movflags=+faststart','-segment_list_type','csv','-segment_list_size','0','-segment_list',path.join(dir,'segments.csv'),path.join(dir,'window-%05d.mp4')];
}
export function parseLiveManifest(raw){
  if(Buffer.byteLength(raw)>LIVE_INGEST_LIMITS.manifestBytes)throw Error('The live segment manifest is too large.');
  const rows=[];
  // The writer uses fixed basenames without commas/quotes. Incomplete final CSV
  // lines are deliberately ignored until the segmenter appends the newline.
  for(const line of raw.split('\n').slice(0,-1)){
    if(!line.trim())continue;const match=line.trim().match(/^(window-\d{5}\.mp4),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/);if(!match)throw Error('The local segment manifest is invalid.');
    const start=Number(match[2]),end=Number(match[3]),previous=rows.at(-1);if(!Number.isFinite(end)||end<=start||end-start>26||end>LIVE_INGEST_LIMITS.durationSeconds+.2||previous&&(start<previous.end-.05||match[1]<=previous.name))throw Error('The local segment clock is invalid.');rows.push({name:match[1],start,end});
  }return rows;
}

export function createLiveIngestService({store,spawnReceiver=spawnLiveReceiver,allocatePort=loopbackPort,probe=probeMedia,frame=captureFrame,onWindow=null,getActiveProjectId=()=>null,statfs=fs.statfs,pollMs=500,stopGraceMs=4000,now=Date.now}={}){
  if(!store)throw Error('Live ingestion requires a local store.');
  const sessions=new Map(),runtimes=new Map(),callbacks=new Set(),starting=new Set();let closing=false;
  const save=j=>store.putRecord('live_ingest',j.id,JSON.parse(JSON.stringify(j)));
  for(const saved of store.listRecords('live_ingest')){const j={...saved};if(activeStatuses.has(j.status)){j.status='interrupted';j.error='Live reception was interrupted. Saved windows are retained. Resume explicitly and reconnect the encoder with the new address.';save(j);}sessions.set(j.id,j);}
  const get=id=>{const j=sessions.get(id);if(!j)throw Error('Live session not found.');return j;};
  const snapshot=j=>({id:j.id,kind:'live-ingest',projectId:j.projectId,title:j.title,status:j.status,phase:j.phase,error:j.error||'',createdAt:j.createdAt,updatedAt:j.updatedAt,elapsedSeconds:j.elapsedSeconds||0,bytes:j.bytes||0,maxSeconds:j.maxSeconds,maxBytes:j.maxBytes,windowCount:j.windowIds.length,windows:j.windowIds.map(id=>store.getRecord('live_window',id)).filter(Boolean),connectionAvailable:runtimes.has(j.id),localOnly:true,requiresResume:j.status==='interrupted'});
  function projectFor(j){const p=store.getProject(j.projectId);if(p.trashed)throw Error('Restore this live project before receiving more footage.');if(p.sourceId)throw Error('Use a new live project rather than an imported recording.');return p;}
  async function space(){const disk=await statfs(store.root);if(Number(disk.bavail)*Number(disk.bsize)<LIVE_INGEST_LIMITS.reserveBytes+LIVE_INGEST_LIMITS.segmentBytes)throw Error('Not enough free local disk space for another live window.');}
  const runDirectory=(j,run)=>{if(!/^[a-f0-9-]{36}$/.test(j.id)||!/^[a-f0-9-]{36}$/.test(run.id))throw Error('Invalid local live-session path.');return path.join(store.root,'live-ingest',j.id,run.id);};
  function notify(j,window,moment){
    if(typeof onWindow!=='function')return;
    // Persist before calling external/AI processing. Ambiguous callbacks are not
    // replayed on restart or resume; the parent may explicitly reprocess media.
    window.callbackStatus='running';store.putRecord('live_window',window.id,window);
    const task=Promise.resolve().then(()=>onWindow({sessionId:j.id,projectId:j.projectId,window:structuredClone(window),moment:structuredClone(moment),asset:structuredClone(window.asset)})).then(()=>{window.callbackStatus='complete';},()=>{window.callbackStatus='error';window.callbackError='Optional window processing failed. The saved recording is retained.';}).then(()=>{try{store.putRecord('live_window',window.id,window);}catch{/* Media/moment were saved before callback; do not crash the receiver. */}}).finally(()=>callbacks.delete(task));callbacks.add(task);
  }
  async function stage(j,run){
    const dir=runDirectory(j,run);let raw;
    try{const stat=await fs.stat(path.join(dir,'segments.csv'));if(stat.size>LIVE_INGEST_LIMITS.manifestBytes)throw Error('The live segment manifest is too large.');raw=await fs.readFile(path.join(dir,'segments.csv'),'utf8');}catch(error){if(error.code==='ENOENT')return;throw error;}
    for(const entry of parseLiveManifest(raw)){
      const id=j.id+'-'+run.id+'-'+entry.name.slice(7,12),existing=store.getRecord('live_window',id);
      if(existing){store.assetPath(existing.asset.id);if(!j.windowIds.includes(id))j.windowIds.push(id);j.elapsedSeconds=Math.max(j.elapsedSeconds,existing.end);j.bytes=j.windowIds.reduce((total,key)=>total+(store.getRecord('live_window',key)?.asset.size||0),0);await fs.rm(path.join(dir,entry.name),{force:true});continue;}
      const file=path.join(dir,entry.name),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size<100||stat.size>LIVE_INGEST_LIMITS.segmentBytes)throw Error('A finalized live window has an unsupported size or type.');
      if(j.bytes+stat.size>j.maxBytes)throw Error('The local live storage budget has been reached.');
      projectFor(j);const info=await probe(file);if(!Number.isFinite(info.duration)||info.duration<.2||Math.abs(info.duration-(entry.end-entry.start))>.5||!Number.isFinite(info.width)||!Number.isFinite(info.height))throw Error('A finalized live window could not be decoded or its source clock did not match.');
      const start=run.offset+entry.start,end=Math.min(j.maxSeconds,run.offset+entry.end);if(end-start<.2)continue;
      const asset=store.putAsset(await fs.readFile(file),'video/mp4');let frames=[];try{const pixels=await frame(file,Math.min(.3,info.duration/2));frames=[store.putAsset(pixels,'image/jpeg').url];}catch{/* Preview is optional; the saved video remains usable. */}
      const moment={id,url:asset.url,persistedUrl:asset.url,blob:{size:asset.size,type:asset.type,name:j.title},frames,start,end,mediaStart:0,sourceName:j.title,sourceType:'screen',cleanCapture:true,sourceLink:'',sourcePixels:{width:info.width,height:info.height,frameRate:info.fps||30,frameRateKnown:true,audioTracks:info.audio?1:0},manual:false,status:'captured',analysis:null,transcript:'',trimIn:0,trimOut:end-start,hook:'',alternateHook:'',frameMode:'fit',zoom:1,focusX:50,focusY:50,showHook:false,captionLanguage:'Original',autoCaptionLanguage:'Original',captionStyle:'punch',captionCues:{Original:[]},captionReviewed:{},showCaptions:false,captionOffset:0,createdAt:now()};
      const window={id,sessionId:j.id,projectId:j.projectId,runId:run.id,start,end,duration:end-start,asset,audio:Boolean(info.audio),callbackStatus:typeof onWindow==='function'?'pending':'not-requested',createdAt:now(),clock:'captured-media'};
      // Deterministic IDs make replay after a partial local checkpoint safe.
      store.putMoment(j.projectId,moment);store.putRecord('live_window',id,window);j.windowIds.push(id);j.bytes+=asset.size;j.elapsedSeconds=Math.max(j.elapsedSeconds,end);j.status=j.status==='stopping'?'stopping':'recording';j.phase=info.audio?'Receiving encoder video and audio':'Receiving encoder video · no audio track';j.updatedAt=now();save(j);
      await fs.rm(file,{force:true});notify(j,window,moment);
    }save(j);
  }
  async function pendingBytes(j,run){let bytes=0;for(const name of await fs.readdir(runDirectory(j,run))){if(!/^window-\d{5}\.mp4$/.test(name))continue;const stat=await fs.lstat(path.join(runDirectory(j,run),name));if(stat.isSymbolicLink()||!stat.isFile()||stat.size>LIVE_INGEST_LIMITS.segmentBytes)throw Error('A live window exceeded the local recording limit.');bytes+=stat.size;}if(bytes+j.bytes>j.maxBytes)throw Error('The local live storage budget has been reached.');}
  async function drain(j,runtime){if(runtime.draining)return runtime.draining;runtime.draining=(async()=>{await stage(j,runtime.run);await space();await pendingBytes(j,runtime.run);})().finally(()=>{runtime.draining=null;});return runtime.draining;}
  function signalStop(j,runtime,reason,status='stopped'){
    if(runtime.stopping)return;runtime.stopping=true;runtime.finalStatus=status;j.status='stopping';j.phase=reason;try{save(j);}catch{j.error='The live checkpoint could not be saved. Earlier finalized windows are retained.';}clearInterval(runtime.poll);clearTimeout(runtime.limit);
    try{runtime.child.kill('SIGTERM');}catch{}
    runtime.kill=setTimeout(()=>{try{runtime.child.kill('SIGKILL');}catch{}},Math.max(100,stopGraceMs));runtime.kill.unref?.();
  }
  async function finalize(j,runtime,code,error=false){
    if(runtime.finalizing)return runtime.done;runtime.finalizing=true;clearInterval(runtime.poll);clearTimeout(runtime.limit);clearTimeout(runtime.kill);
    try{if(runtime.draining)await runtime.draining.catch(()=>{});await stage(j,runtime.run);runtime.run.finalized=true;await fs.rm(runDirectory(j,runtime.run),{recursive:true,force:true});runtime.run.cleaned=true;}
    catch{j.error='A local window could not be finalized. Earlier saved windows are retained; resume explicitly to recover completed segments.';runtime.finalStatus='error';}
    runtimes.delete(j.id);j.status=runtime.finalStatus||(error||code!==0?'interrupted':'stopped');j.phase=j.status==='stopped'?'Encoder stopped · saved windows retained':j.status==='cancelled'?'Receiver cancelled · saved windows retained':'Reception stopped · resume required';
    if(!j.error&&j.status==='interrupted')j.error='The encoder disconnected or the receiver stopped unexpectedly. Saved windows are retained. Resume explicitly to reconnect.';j.updatedAt=now();try{save(j);}catch{j.status='error';j.error='The live checkpoint could not be saved. Earlier finalized windows are retained.';}runtime.resolve(snapshot(j));
  }
  async function launch(j){
    if(closing)throw Error('The live receiver is shutting down.');if(starting.size||runtimes.size)throw Error('Stop the active live receiver before starting another.');starting.add(j.id);
    try{
      projectFor(j);const active=getActiveProjectId();if(active&&active!==j.projectId)throw Error('Open the owning live project before starting this receiver.');
      // Recover only finalized old segments on an explicit start/resume action.
      for(const run of j.runs.filter(r=>!r.cleaned)){await stage(j,run);await fs.rm(runDirectory(j,run),{recursive:true,force:true});run.cleaned=true;}
      if(j.elapsedSeconds>=j.maxSeconds)throw Error('The six-hour or selected live duration limit has been reached.');if(j.runs.length>=LIVE_INGEST_LIMITS.runs)throw Error('Start a new live session after repeated reconnects.');await space();
      const port=await allocatePort();if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('Could not allocate a safe localhost RTMP port.');
      const streamKey=randomBytes(24).toString('hex'),serverUrl=`rtmp://127.0.0.1:${port}/live`,connection={serverUrl,streamKey,streamUrl:serverUrl+'/'+streamKey};
      const run={id:randomUUID(),offset:j.elapsedSeconds,startedAt:now(),finalized:false,cleaned:false};await fs.mkdir(runDirectory(j,run),{recursive:true,mode:0o700});j.runs.push(run);j.status='starting';j.error='';j.phase='Starting local encoder receiver';j.updatedAt=now();save(j);
      const child=spawnReceiver(executable(),liveReceiverArgs({streamUrl:connection.streamUrl,remainingSeconds:j.maxSeconds-j.elapsedSeconds,dir:runDirectory(j,run)}),{cwd:runDirectory(j,run),stdio:['ignore','ignore','pipe']}),runtime={child,run,connection};runtime.done=new Promise(resolve=>{runtime.resolve=resolve;});runtimes.set(j.id,runtime);
      // Never collect or expose FFmpeg stderr: it can include the local stream key.
      child.stderr?.resume();child.once('error',()=>{void finalize(j,runtime,1,true);});child.once('close',code=>{void finalize(j,runtime,code);});
      j.status='waiting';j.phase='Waiting for OBS or another local RTMP encoder';save(j);
      runtime.poll=setInterval(()=>{void drain(j,runtime).catch(()=>{j.error='Local storage or finalized-window validation failed. Saved windows are retained.';signalStop(j,runtime,'Stopping safely after a local capture error','error');});},Math.max(20,pollMs));runtime.poll.unref?.();
      runtime.limit=setTimeout(()=>signalStop(j,runtime,'Local live duration limit reached'),Math.min(2147483647,(j.maxSeconds-j.elapsedSeconds+120)*1000));runtime.limit.unref?.();
      return {...snapshot(j),connection};
    }catch(error){const runtime=runtimes.get(j.id);if(runtime)signalStop(j,runtime,'Stopping after a local receiver startup error','error');j.status='error';j.error=error.message;j.updatedAt=now();try{save(j);}catch{/* Stop the process even when checkpoint storage is unavailable. */}throw error;}finally{starting.delete(j.id);}
  }
  return {
    list:()=>[...sessions.values()].sort((a,b)=>b.createdAt-a.createdAt).map(snapshot),get:id=>snapshot(get(id)),
    connection(id){get(id);const connection=runtimes.get(id)?.connection;if(!connection)throw Error('Resume this local receiver to obtain a new encoder address.');return {...connection};},
    async start(body={}){
      if(body.url!==undefined||body.streamUrl!==undefined||body.host!==undefined||body.port!==undefined||body.streamKey!==undefined)throw Error('Connect an encoder to the generated localhost address; source URLs are not accepted.');
      if(typeof body.projectId!=='string'||!body.projectId||body.projectId.length>160)throw Error('Choose the owning live project.');if(sessions.size>=LIVE_INGEST_LIMITS.sessions)throw Error('The saved live-session limit is reached.');
      const j={id:randomUUID(),projectId:body.projectId,title:typeof body.title==='string'&&body.title.trim()?body.title.trim().slice(0,160):'Local encoder recording',maxSeconds:boundedNumber(body.maxSeconds,LIVE_INGEST_LIMITS.durationSeconds,LIVE_INGEST_LIMITS.durationSeconds,'live duration'),maxBytes:boundedNumber(body.maxBytes,LIVE_INGEST_LIMITS.bytes,LIVE_INGEST_LIMITS.bytes,'live storage budget'),elapsedSeconds:0,bytes:0,windowIds:[],runs:[],createdAt:now(),updatedAt:now(),status:'starting'};
      projectFor(j);if(starting.size||runtimes.size)throw Error('Stop the active live receiver before starting another.');sessions.set(j.id,j);save(j);return launch(j);
    },
    async stop(id,{cancel=false,projectId}={}){const j=get(id);if(projectId&&projectId!==j.projectId)throw Error('This live session belongs to another project.');const runtime=runtimes.get(id);if(!runtime)return snapshot(j);signalStop(j,runtime,cancel?'Cancelling local receiver':'Finalizing the current live window',cancel?'cancelled':'stopped');return runtime.done;},
    async command(id,action,options={}){const j=get(id);if(options.projectId&&options.projectId!==j.projectId)throw Error('This live session belongs to another project.');if(action==='resume'){if(runtimes.has(id))return {...snapshot(j),connection:this.connection(id)};return launch(j);}if(action==='stop'||action==='cancel')return this.stop(id,{...options,cancel:action==='cancel'});throw Error('Unknown local live receiver action.');},
    async waitForCallbacks(){await Promise.allSettled([...callbacks]);},
    async shutdown(){closing=true;await Promise.all([...runtimes.keys()].map(id=>this.stop(id)));}
  };
}
