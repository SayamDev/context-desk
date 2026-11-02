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
// Plans a clip for an exact buffered range (used to extend an earlier clip).
export function planRange(segments,from,to){
  if(!segments.length)throw Error('Nothing is buffered yet.');
  const start=Math.max(segments[0].start,from),end=Math.min(segments[segments.length-1].end,to);
  if(end-start<1)throw Error('That part of the stream has already left the 5-minute buffer.');
  const chosen=segments.filter(s=>s.end>start&&s.start<end);
  return {files:chosen.map(s=>s.file),offset:Math.max(0,start-chosen[0].start),duration:end-start,start,end};
}
function stillFrame(file,at,out){return new Promise(resolve=>{const c=spawn(ffmpegPath(),['-v','error','-y','-ss',String(Math.max(0,at)),'-i',file,'-frames:v','1','-vf','scale=480:-2,format=yuvj420p','-q:v','5',out],{stdio:'ignore'});c.on('close',code=>resolve(code===0));c.on('error',()=>resolve(false))})}
// How far behind the real world the newest playlist segment is, from #EXT-X-PROGRAM-DATE-TIME.
export function playlistDelay(text,now=Date.now()){
  const lines=String(text).split('\n');let last=null;
  for(let i=0;i<lines.length;i++){const m=lines[i].match(/^#EXT-X-PROGRAM-DATE-TIME:(.+)$/);if(m){const at=Date.parse(m[1].trim());const d=lines.slice(i+1,i+4).map(l=>l.match(/^#EXTINF:([\d.]+)/)).find(Boolean);if(Number.isFinite(at))last=at+(d?Number(d[1])*1000:0)}}
  return last==null?null:Math.max(0,(now-last)/1000);
}
// Live clips are scored from the signals that actually happened inside them (0-100).
export function signalScore(markers,start,end,chatBoost=0){
  const inside=kind=>markers.some(m=>m.kind===kind&&m.t>=start-2&&m.t<=end+2);
  return Math.min(99,Math.round(35+(inside('chat')?25:0)+(inside('chatlaugh')?20:0)+(inside('laugh')?20:0)+(inside('audio')?10:0)+Math.max(0,Math.min(10,chatBoost))));
}
// Autopilot: fire when signals agree inside the last `window` seconds (one signal alone
// never reaches the threshold), then wait `postRoll` seconds so the clip includes the payoff.
export const autopilotLevels={sensitive:65,balanced:75,strict:85};
export const autopilotLimits={window:20,preRoll:22,postRoll:8,cooldown:45};
export function autopilotTrigger(markers,now,{threshold=autopilotLevels.balanced,lastAt=-Infinity}={}){
  const {window,cooldown}=autopilotLimits,recent=markers.filter(m=>m.kind!=='manual'&&m.t>=now-window&&m.t<=now);
  if(!recent.length)return null;const t=Math.max(...recent.map(m=>m.t));
  if(t-lastAt<cooldown||signalScore(markers.filter(m=>m.kind!=='manual'),now-window+2,now-2)<threshold)return null;
  return {t,reason:[...new Set(recent.map(m=>m.label))].join(' + ')};
}
// First sentence of a transcript, short enough for an on-screen hook.
export function hookFrom(text){const first=String(text||'').trim().split(/(?<=[.!?؟。])\s+/)[0]||'';return first.length>80?first.slice(0,77).replace(/\s+\S*$/,'')+'…':first}
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
  let err='';child.stderr.on('data',c=>{err=(err+c).slice(-4000)});child.on('error',()=>resolve({level:NaN,height:0}));
  child.on('close',()=>{const m=err.match(/mean_volume:\s*(-?[\d.]+) dB/),v=err.match(/Video:.*?(\d{3,4})x(\d{3,4})/);resolve({level:m?Number(m[1]):NaN,height:v?Number(v[2]):0})});
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

export function createLiveBufferService({transcribe}={}){
  let session=null;
  async function refresh(s){
    const segments=parseSegmentList(await fs.readFile(path.join(s.dir,'list.csv'),'utf8').catch(()=>''));
    const {keep,drop}=pruneSegments(segments);
    for(const seg of drop)if(!s.removed.has(seg.file)){s.removed.add(seg.file);fs.rm(path.join(s.dir,seg.file),{force:true}).catch(()=>{});}
    s.segments=keep;
    if(s.origin==null&&keep.length)s.origin=keep[0].start;
    if(!s.levelBusy){const next=keep.find(seg=>!s.levels.has(seg.file));if(next){s.levelBusy=true;analyseSegment(s,next).finally(()=>{s.levelBusy=false})}}
    closeChatWindow(s,Date.now());
    if(s.playlist&&Date.now()-(s.delayAt||0)>5000){s.delayAt=Date.now();fetch(s.playlist,{signal:AbortSignal.timeout(4000)}).then(r=>r.text()).then(t=>{const d=playlistDelay(t);s.delay=d==null?null:d+liveLimits.segmentSeconds}).catch(()=>{})}
    if(s.captions.on&&!s.captions.busy&&keep.length>=3&&Date.now()-s.captions.at>6000)captionDraft(s,keep.slice(-3));
    runAutopilot(s);
  }
  function runAutopilot(s){
    const a=s.autopilot;if(!a.on||s.status!=='live')return;const now=streamNow(s);
    if(!a.pending){const hit=autopilotTrigger(s.markers,now,{threshold:a.threshold,lastAt:a.lastAt});if(hit){a.pending=hit;a.lastAt=hit.t}return}
    if(now<a.pending.t+autopilotLimits.postRoll)return;
    const {t,reason}=a.pending,o=s.origin||0;a.pending=null;
    try{clip(s,null,null,{from:o+t-autopilotLimits.preRoll,to:o+t+autopilotLimits.postRoll,reason})}catch{/* The moment already left the buffer. */}
  }
  // Extra points when chat in the clip ran hotter than the session's usual 10 s window.
  function chatBoost(s,clip){const usual=s.chatHistory.map(h=>h.count).sort((a,b)=>a-b)[Math.floor(s.chatHistory.length/2)]||0;if(!usual)return 0;const inClip=s.chatHistory.filter(h=>h.start>=clip.createdAt-(clip.end-clip.start)*1000-15000&&h.start<=clip.createdAt).map(h=>h.count);return inClip.length?Math.round((Math.max(...inClip)/usual-1)*10):0}
  const streamNow=s=>s.segments.length?s.segments[s.segments.length-1].end-(s.origin||0):0;
  // One marker per signal kind every 10 s keeps the track readable.
  function addMarker(s,kind,t,label){if(!(t>=0))return;const last=s.markers.filter(m=>m.kind===kind).at(-1);if(last&&Math.abs(t-last.t)<10)return;s.markers=[...s.markers,{t,label,kind}].slice(-100)}
  async function analyseSegment(s,seg){
    const file=path.join(s.dir,seg.file),t=(seg.start+seg.end)/2-(s.origin||0);
    const probe=await meanVolume(file),level=probe.level;if(probe.height)s.height=probe.height;const history=[...s.levels.values()].filter(Number.isFinite).slice(-30);s.levels.set(seg.file,level);
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
  // Opt-in caption draft: transcribe the newest ~6 s with the configured speech service.
  function captionDraft(s,segs){
    s.captions.busy=true;s.captions.at=Date.now();
    const child=spawn(ffmpegPath(),['-v','error','-i','concat:'+segs.map(g=>path.join(s.dir,g.file)).join('|'),'-vn','-ac','1','-ar','16000','-f','wav','pipe:1'],{stdio:['ignore','pipe','ignore']}),chunks=[];
    child.stdout.on('data',c=>chunks.push(c));child.on('error',()=>{s.captions.busy=false});
    child.on('close',async()=>{try{if(!transcribe)throw Error('No speech service is configured.');const r=await transcribe(Buffer.concat(chunks));const text=(r.turns?.length?r.turns.map(t=>t.text).join(' '):String(r.transcript||'').replace(/\[\d+s\]\s*/g,'')).trim();s.captions.text=text.slice(-160);s.captions.t=(segs[segs.length-1].end-(s.origin||0));s.captions.source=r.speechSource||'';s.captions.error=''}catch(error){s.captions.on=false;s.captions.error=error.message||'Caption draft stopped.'}finally{s.captions.busy=false}});
  }
  // Autopilot clips also get a transcript and a draft hook, so they are ready to post.
  function draftClipText(c){
    if(!transcribe)return;const child=spawn(ffmpegPath(),['-v','error','-i',c.file,'-vn','-ac','1','-ar','16000','-f','wav','pipe:1'],{stdio:['ignore','pipe','ignore']}),chunks=[];
    child.stdout.on('data',chunk=>chunks.push(chunk));child.on('error',()=>{});
    child.on('close',async code=>{if(code!==0)return;try{const r=await transcribe(Buffer.concat(chunks));c.transcript=(r.turns?.length?r.turns.map(t=>t.text).join(' '):String(r.transcript||'').replace(/\[\d+s\]\s*/g,'')).trim().slice(0,2000);c.hook=hookFrom(c.transcript)}catch{/* The clip is still usable without text. */}});
  }
  function view(s){
    const o=s.origin||0,now=s.segments.length?s.segments[s.segments.length-1].end-o:0;
    return {id:s.id,url:s.url,status:s.status,error:s.error,now,buffered:s.segments.length?now-s.segments[0].start:0,bufferLimit:liveLimits.bufferSeconds,
      delay:Number.isFinite(s.delay)?Math.round(s.delay):null,captions:{on:s.captions.on,text:s.captions.text,error:s.captions.error,source:s.captions.source},
      source:{label:(()=>{try{const u=new URL(s.url);return (u.hostname.replace(/^www\./,'')+u.pathname).replace(/\/$/,'').slice(0,60)}catch{return ''}})(),height:s.height||0},
      levels:s.segments.slice(-150).map(seg=>({t:(seg.start+seg.end)/2-o,db:s.levels.get(seg.file)})).filter(l=>Number.isFinite(l.db)),preview:s.segments.length?`/api/live-buffer/${s.id}/frame`:null,
      signals:{chat:{...s.chat,perMinute:chatPerMinute(s)},laughter:laughterInstalled()?'on':'not-installed'},
      autopilot:{on:s.autopilot.on,threshold:s.autopilot.threshold,waiting:Boolean(s.autopilot.pending),reason:s.autopilot.pending?.reason||''},
      markers:s.markers,clips:s.clips.map(({file,thumbFile,...clip})=>({...clip,score:signalScore(s.markers,clip.start-o,clip.end-o,chatBoost(s,clip)),start:clip.start-o,end:clip.end-o,thumb:clip.thumbReady?`/api/live-buffer/${s.id}/clips/${clip.id}/thumb`:null,download:clip.status==='ready'?`/api/live-buffer/${s.id}/clips/${clip.id}`:null}))};
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
    const s={id:randomUUID(),url:href,status:'connecting',error:'',segments:[],removed:new Set(),levels:new Map(),levelBusy:false,markers:[],chat:{state:'waiting',label:'Chat starts with the stream'},chatWindow:null,chatHistory:[],delay:null,captions:{on:false,busy:false,at:0,text:'',error:''},clips:[],autopilot:{on:false,threshold:autopilotLevels.balanced,lastAt:-Infinity,pending:null},dir:await fs.mkdtemp(path.join(os.tmpdir(),'context-desk-live-'))};
    session=s;
    resolveStreamUrl(href).then(stream=>{
      if(session!==s||s.status==='stopped')return;s.playlist=stream[0];
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
  function clip(s,seconds,extend,auto){
    if(!auto)return refresh(s).then(()=>cut(s,seconds,extend,null));return cut(s,null,null,auto);
  }
  function cut(s,seconds,extend,auto){
    const base=extend&&s.clips.find(c=>c.id===extend);if(extend&&!base)throw Error('That clip is no longer available.');
    const plan=auto?planRange(s.segments,auto.from,auto.to):base?planRange(s.segments,base.start-10,base.end):planClip(s.segments,validateClipSeconds(seconds));
    if(s.clips.length>=liveLimits.maxClips){const old=s.clips.shift();fs.rm(old.file,{force:true}).catch(()=>{});fs.rm(old.thumbFile,{force:true}).catch(()=>{});}
    const c={id:randomUUID(),status:'rendering',start:plan.start,end:plan.end,seconds:plan.duration,createdAt:Date.now(),error:'',thumbReady:false,auto:Boolean(auto),reason:auto?.reason||'',transcript:'',hook:'',file:path.join(s.dir,`clip-${s.clips.length+1}-${Date.now()}.mp4`)};c.thumbFile=c.file.replace(/\.mp4$/,'.jpg');
    s.clips.push(c);
    cutClip(s.dir,plan,c.file).then(async()=>{c.status='ready';c.thumbReady=await stillFrame(c.file,plan.duration/2,c.thumbFile);if(c.auto)draftClipText(c)},e=>{c.status='failed';c.error=e.message});
    return c;
  }
  async function readBody(req){let size=0,body='';for await(const chunk of req){size+=chunk.length;if(size>4096)throw Error('Request too large.');body+=chunk}return body?JSON.parse(body):{}}
  return {
    async handle(req,res,json){
      const {pathname}=new URL(req.url,'http://localhost');
      if(pathname!=='/api/live-buffer'&&!pathname.startsWith('/api/live-buffer/'))return false;
      if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return json(res,403,{error:'Open live clipping from the local app.'}),true;
      try{
        if(pathname==='/api/live-buffer'&&req.method==='GET'){if(session)await refresh(session).catch(()=>{});return json(res,200,{session:session&&session.status!=='stopped'?view(session):null}),true;}
        if(pathname==='/api/live-buffer'&&req.method==='POST'){const body=await readBody(req);return json(res,202,view(await start(String(body.url||'')))),true;}
        const m=pathname.match(/^\/api\/live-buffer\/([\w-]{36})(?:\/(clip|mark|stop|frame|captions|autopilot|clips\/([\w-]{36})(\/thumb)?))?$/);
        if(!m||!session||session.id!==m[1])return json(res,404,{error:'This live session has ended. Start it again.'}),true;
        const s=session,action=m[2];
        if(!action&&req.method==='GET'){await refresh(s).catch(()=>{});return json(res,200,view(s)),true;}
        if(action==='clip'&&req.method==='POST'){const body=await readBody(req);await clip(s,body.seconds,typeof body.extend==='string'?body.extend:null);return json(res,202,view(s)),true;}
        if(action==='autopilot'&&req.method==='POST'){const body=await readBody(req);s.autopilot.on=body.on===true;if(autopilotLevels[body.level])s.autopilot.threshold=autopilotLevels[body.level];if(!s.autopilot.on)s.autopilot.pending=null;return json(res,200,view(s)),true;}
        if(action==='captions'&&req.method==='POST'){const body=await readBody(req);s.captions.on=body.on===true&&Boolean(transcribe);s.captions.error=body.on===true&&!transcribe?'No speech service is configured.':'';if(!s.captions.on)s.captions.text='';return json(res,200,view(s)),true;}
        if(action==='frame'&&req.method==='GET'){
          // First (key) frame of the latest finished segment, re-extracted at most every 2 s.
          const seg=s.segments[s.segments.length-1];if(!seg)return json(res,404,{error:'Nothing buffered yet.'}),true;
          const out=path.join(s.dir,'preview.jpg');if(s.previewFor!==seg.file&&Date.now()-(s.previewAt||0)>1800){s.previewAt=Date.now();if(await stillFrame(path.join(s.dir,seg.file),0,out))s.previewFor=seg.file}
          const bytes=await fs.readFile(out).catch(()=>null);if(!bytes)return json(res,404,{error:'Preview not ready.'}),true;
          res.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':bytes.length,'Cache-Control':'no-store'});res.end(bytes);return true;
        }
        if(m[4]&&req.method==='GET'){const c=s.clips.find(x=>x.id===m[3]&&x.thumbReady);const bytes=c&&await fs.readFile(c.thumbFile).catch(()=>null);if(!bytes)return json(res,404,{error:'Thumbnail not ready.'}),true;res.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':bytes.length,'Cache-Control':'no-store'});res.end(bytes);return true;}
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
