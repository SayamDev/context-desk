import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {validateImportUrl} from './imports.js';
import {startChat,isLaugh,detectChatSpike,detectChatLaughter,laughterScore,laughterInstalled,stopLaughterWorker,signalLimits} from './live-signals.js';

export const liveLimits={bufferSeconds:300,segmentSeconds:2,minClip:5,maxClip:120,maxClips:50,sessionSeconds:6*60*60};
const projectRoot=path.resolve(import.meta.dirname,'..');
const ffmpegPath=()=>process.env.FFMPEG_PATH||path.join(projectRoot,'.runtime/bin/ffmpeg');
const ytEnv={...process.env,PYTHONPATH:[path.join(projectRoot,'.runtime'),process.env.PYTHONPATH].filter(Boolean).join(path.delimiter)};

// FFmpeg segment list (csv): "seg000001.ts,12.000000,14.002000" — times are seconds since the buffer started.
export function parseSegmentList(text){
  return String(text).split('\n').map(line=>line.trim().split(',')).filter(parts=>parts.length===3&&/^seg\d+\.ts$/.test(parts[0]))
    .map(([file,start,end])=>({file,start:Number(start),end:Number(end)})).filter(s=>Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.end>s.start);
}
export function validateClipSeconds(value){
  const seconds=Number(value);
  if(!Number.isFinite(seconds)||seconds<liveLimits.minClip||seconds>liveLimits.maxClip)throw Error(`Clip back between ${liveLimits.minClip} and ${liveLimits.maxClip} seconds.`);
  return seconds;
}
// Picks the finished segments covering the last `seconds` and where to start inside the first one.
export function planClip(segments,seconds){
  if(!segments.length)throw Error('Nothing is buffered yet. Wait a few seconds after the stream connects.');
  const end=segments[segments.length-1].end,from=Math.max(segments[0].start,end-seconds);
  const chosen=segments.filter(s=>s.end>from);
  return {files:chosen.map(s=>s.file),offset:Math.max(0,from-chosen[0].start),duration:end-from,start:from,end};
}
export function pruneSegments(segments,bufferSeconds=liveLimits.bufferSeconds){
  if(!segments.length)return {keep:[],drop:[]};
  const cutoff=segments[segments.length-1].end-bufferSeconds-liveLimits.segmentSeconds;
  return {keep:segments.filter(s=>s.end>=cutoff),drop:segments.filter(s=>s.end<cutoff)};
}

// Flags a segment as an audio peak when it is clearly louder than the recent baseline.
export function detectPeak(history,level,{minHistory=10,rise=6,floor=-50}={}){
  if(!Number.isFinite(level)||history.length<minHistory||level<floor)return false;
  const sorted=[...history].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
  return level-median>=rise;
}
function meanVolume(file){return new Promise(resolve=>{
  const child=spawn(ffmpegPath(),['-v','info','-nostats','-i',file,'-vn','-af','volumedetect','-f','null','-'],{stdio:['ignore','ignore','pipe']});
  let err='';child.stderr.on('data',c=>{err=(err+c).slice(-4000)});child.on('error',()=>resolve(NaN));
  child.on('close',()=>{const m=err.match(/mean_volume:\s*(-?[\d.]+) dB/);resolve(m?Number(m[1]):NaN)});
});}
function resolveStreamUrl(url){return new Promise((resolve,reject)=>{
  const child=spawn(process.env.YTDLP_PYTHON||'python3',['-m','yt_dlp','--ignore-config','--no-plugin-dirs','--no-playlist','--no-cache-dir','--socket-timeout','20','--js-runtimes','node','-f','bv*[height<=1080]+ba/b[height<=1080]/b','-g',url],{env:ytEnv,stdio:['ignore','pipe','pipe']});
  let out='',err='';const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Finding the live stream timed out.'))},60000);
  child.stdout.on('data',c=>{out+=c});child.stderr.on('data',c=>{err=(err+c).slice(-600)});
  child.on('error',()=>{clearTimeout(timer);reject(Error('The local importer is not installed. Run npm run setup:imports.'))});
  child.on('close',code=>{clearTimeout(timer);const urls=out.trim().split('\n').filter(Boolean);
    if(code===0&&urls.length&&urls.length<=2&&urls.every(u=>/^https:\/\//.test(u)))resolve(urls);else reject(Error(/not currently live|is offline|will begin|recording is not available/i.test(err)?'This channel is not live right now.':'This live stream could not be opened. It may be restricted or unsupported.'));});
});}

function cutClip(dir,plan,out){return new Promise((resolve,reject)=>{
  const list=plan.files.map(f=>`file '${path.join(dir,f)}'`).join('\n');
  fs.writeFile(out+'.txt',list).then(()=>{
    const child=spawn(ffmpegPath(),['-v','error','-y','-f','concat','-safe','0','-ss',plan.offset.toFixed(3),'-i',out+'.txt','-t',plan.duration.toFixed(3),'-c','copy','-bsf:a','aac_adtstoasc','-movflags','+faststart',out],{stdio:['ignore','ignore','pipe']});
    let err='';child.stderr.on('data',c=>{err=(err+c).slice(-400)});
    child.on('error',()=>reject(Error('FFmpeg is unavailable. Run npm run setup:imports or set FFMPEG_PATH.')));
    child.on('close',code=>{fs.rm(out+'.txt',{force:true}).catch(()=>{});code===0?resolve():reject(Error('This clip could not be cut. '+err.trim().split('\n').pop()))});
  },reject);
});}

export function createLiveBufferService(){
  let session=null;
  async function refresh(s){
    const segments=parseSegmentList(await fs.readFile(path.join(s.dir,'list.csv'),'utf8').catch(()=>''));
    const {keep,drop}=pruneSegments(segments);
    for(const seg of drop)if(!s.removed.has(seg.file)){s.removed.add(seg.file);fs.rm(path.join(s.dir,seg.file),{force:true}).catch(()=>{});}
    s.segments=keep;
    if(s.origin==null&&keep.length)s.origin=keep[0].start;
    if(!s.levelBusy){const next=keep.find(seg=>!s.levels.has(seg.file));if(next){s.levelBusy=true;analyseSegment(s,next).finally(()=>{s.levelBusy=false})}}
    closeChatWindow(s,Date.now());
  }
  const streamNow=s=>s.segments.length?s.segments[s.segments.length-1].end-(s.origin||0):0;
  // One marker per signal kind every 10 s keeps the track readable.
  function addMarker(s,kind,t,label){if(!(t>=0))return;const last=s.markers.filter(m=>m.kind===kind).at(-1);if(last&&Math.abs(t-last.t)<10)return;s.markers=[...s.markers,{t,label,kind}].slice(-100)}
  async function analyseSegment(s,seg){
    const file=path.join(s.dir,seg.file),t=(seg.start+seg.end)/2-(s.origin||0);
    const level=await meanVolume(file),history=[...s.levels.values()].filter(Number.isFinite).slice(-30);s.levels.set(seg.file,level);
    if(detectPeak(history,level))addMarker(s,'audio',t,'Audio peak');
    if(s.levels.size>400)s.levels.delete(s.levels.keys().next().value);
    const laugh=await laughterScore(file,ffmpegPath());if(laugh!==null&&laugh>=signalLimits.laughThreshold)addMarker(s,'laugh',t,'Laughter');
  }
  // Chat arrives in real time; count it in 10 s windows and place each window on the stream clock.
  const windowMs=signalLimits.chatWindowSeconds*1000;
  function onChat(s,{text,at}){if(s.status==='stopped')return;closeChatWindow(s,at);const w=s.chatWindow??={start:Math.floor(at/windowMs)*windowMs,count:0,laughs:0};w.count++;if(isLaugh(text))w.laughs++}
  function closeChatWindow(s,at){
    const w=s.chatWindow;if(!w||at<w.start+windowMs)return;s.chatWindow=null;
    const t=streamNow(s)-(Date.now()-(w.start+windowMs/2))/1000,history=s.chatHistory.slice(-30).map(h=>h.count);
    if(detectChatSpike(history,w.count))addMarker(s,'chat',t,'Chat spike');
    if(detectChatLaughter(w))addMarker(s,'chatlaugh',t,'Chat laughing');
    s.chatHistory=[...s.chatHistory,{start:w.start,count:w.count}].slice(-60);
  }
  function chatPerMinute(s){const since=Date.now()-60000;return s.chatHistory.filter(h=>h.start>=since).reduce((a,h)=>a+h.count,0)+(s.chatWindow?.count||0)}
  function view(s){
    const o=s.origin||0,now=s.segments.length?s.segments[s.segments.length-1].end-o:0;
    return {id:s.id,url:s.url,status:s.status,error:s.error,now,buffered:s.segments.length?now-s.segments[0].start:0,bufferLimit:liveLimits.bufferSeconds,
      signals:{chat:{...s.chat,perMinute:chatPerMinute(s)},laughter:laughterInstalled()?'on':'not-installed'},
      markers:s.markers,clips:s.clips.map(({file,...clip})=>({...clip,start:clip.start-o,end:clip.end-o,download:clip.status==='ready'?`/api/live-buffer/${s.id}/clips/${clip.id}`:null}))};
  }
  async function stop(s){
    if(!s)return;clearInterval(s.poll);clearTimeout(s.deadline);s.status='stopped';s.stopChat?.();
    if(s.child&&s.child.exitCode===null)s.child.kill('SIGTERM');
    await new Promise(resolve=>setTimeout(resolve,300));
    await fs.rm(s.dir,{recursive:true,force:true}).catch(()=>{});
  }
  async function start(url){
    const href=validateImportUrl(url);
    if(session&&session.status!=='stopped')await stop(session);
    const s={id:randomUUID(),url:href,status:'connecting',error:'',segments:[],removed:new Set(),levels:new Map(),levelBusy:false,markers:[],chat:{state:'waiting',label:'Chat starts with the stream'},chatWindow:null,chatHistory:[],clips:[],dir:await fs.mkdtemp(path.join(os.tmpdir(),'context-desk-live-'))};
    session=s;
    resolveStreamUrl(href).then(stream=>{
      if(session!==s||s.status==='stopped')return;
      const inputs=stream.flatMap(u=>['-reconnect','1','-reconnect_streamed','1','-reconnect_delay_max','5','-i',u]);
      const maps=stream.length===2?['-map','0:v:0','-map','1:a:0']:['-map','0:v:0?','-map','0:a:0?'];
      s.child=spawn(ffmpegPath(),['-v','error',...inputs,...maps,'-c','copy',
        '-f','segment','-segment_time',String(liveLimits.segmentSeconds),'-segment_format','mpegts','-segment_list',path.join(s.dir,'list.csv'),'-segment_list_type','csv',path.join(s.dir,'seg%06d.ts')],{stdio:['ignore','ignore','pipe']});
      let err='';s.child.stderr.on('data',c=>{err=(err+c).slice(-400)});
      s.child.on('error',()=>{s.status='failed';s.error='FFmpeg is unavailable. Run npm run setup:imports or set FFMPEG_PATH.'});
      s.child.on('close',()=>{if(s.status!=='stopped'){s.status=s.segments.length?'ended':'failed';s.error=s.segments.length?'The stream ended or disconnected. Buffered clips are still available.':('The stream could not be recorded. '+err.trim().split('\n').pop()).trim()}});
      s.stopChat=startChat(href,{dir:s.dir,onMessage:msg=>onChat(s,msg),onStatus:(state,label)=>{s.chat={state,label}}});
      s.poll=setInterval(()=>refresh(s).then(()=>{if(s.status==='connecting'&&s.segments.length)s.status='live'}).catch(()=>{}),1000);
      s.deadline=setTimeout(()=>stop(s),liveLimits.sessionSeconds*1000);
    },error=>{if(session===s){s.status='failed';s.error=error.message}});
    return s;
  }
  async function clip(s,seconds){
    await refresh(s);
    const plan=planClip(s.segments,validateClipSeconds(seconds));
    if(s.clips.length>=liveLimits.maxClips){const old=s.clips.shift();fs.rm(old.file,{force:true}).catch(()=>{});}
    const c={id:randomUUID(),status:'rendering',start:plan.start,end:plan.end,seconds:plan.duration,error:'',file:path.join(s.dir,`clip-${s.clips.length+1}-${Date.now()}.mp4`)};
    s.clips.push(c);
    cutClip(s.dir,plan,c.file).then(()=>{c.status='ready'},e=>{c.status='failed';c.error=e.message});
    return c;
  }
  async function readBody(req){let size=0,body='';for await(const chunk of req){size+=chunk.length;if(size>4096)throw Error('Request too large.');body+=chunk}return body?JSON.parse(body):{}}
  return {
    async handle(req,res,json){
      const {pathname}=new URL(req.url,'http://localhost');
      if(pathname!=='/api/live-buffer'&&!pathname.startsWith('/api/live-buffer/'))return false;
      if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return json(res,403,{error:'Open live clipping from the local app.'}),true;
      try{
        if(pathname==='/api/live-buffer'&&req.method==='POST'){const body=await readBody(req);return json(res,202,view(await start(String(body.url||'')))),true;}
        const m=pathname.match(/^\/api\/live-buffer\/([\w-]{36})(?:\/(clip|mark|stop|clips\/([\w-]{36})))?$/);
        if(!m||!session||session.id!==m[1])return json(res,404,{error:'This live session has ended. Start it again.'}),true;
        const s=session,action=m[2];
        if(!action&&req.method==='GET'){await refresh(s).catch(()=>{});return json(res,200,view(s)),true;}
        if(action==='clip'&&req.method==='POST'){const body=await readBody(req);await clip(s,body.seconds);return json(res,202,view(s)),true;}
        if(action==='mark'&&req.method==='POST'){await refresh(s).catch(()=>{});const now=s.segments.length?s.segments[s.segments.length-1].end-(s.origin||0):0;s.markers=[...s.markers,{t:now,label:'Marked',kind:'manual'}].slice(-100);return json(res,200,view(s)),true;}
        if(action==='stop'&&req.method==='POST'){await stop(s);return json(res,200,view(s)),true;}
        if(m[3]&&req.method==='GET'){
          const c=s.clips.find(x=>x.id===m[3]&&x.status==='ready');if(!c)return json(res,404,{error:'Clip not ready.'}),true;
          const {size}=await fs.stat(c.file);
          res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':size,'Content-Disposition':`attachment; filename="live-clip-${Math.round(c.start)}s.mp4"`,'Cache-Control':'no-store'});
          createReadStream(c.file).on('error',()=>res.destroy()).pipe(res);return true;
        }
        return json(res,405,{error:'Method not allowed.'}),true;
      }catch(error){return json(res,400,{error:error.message||'Live request failed.'}),true;}
    },
    shutdown(){stopLaughterWorker();return stop(session)}
  };
}
