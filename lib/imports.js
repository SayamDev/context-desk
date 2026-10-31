import fs from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';

export const supportedHosts=['youtube.com','youtu.be','twitch.tv','vimeo.com','dailymotion.com','tiktok.com','instagram.com','facebook.com','fb.watch','kick.com','rumble.com','archive.org','wikimedia.org'];
export function validateImportUrl(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('Paste a public HTTPS video link without a custom port or login.');
  if(!supportedHosts.some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))throw Error('This site is not supported for direct import yet. Use a video file or browser capture.');
  return url.href;
}
export const importLimits={durationSeconds:6*60*60,bytes:20*1024*1024*1024,downloadBytes:4*1024*1024*1024};
export const metadataTemplate='{"title":%(title)j,"duration":%(duration)j,"is_live":%(is_live)j,"live_status":%(live_status)j,"formats":%(formats.:.{format_id,height,ext,vcodec,acodec,tbr,filesize,filesize_approx,has_drm})j}';
export function estimatedBytes(format,duration){return Number(format.filesize)||Number(format.filesize_approx)||Math.max(1,Number(format.tbr)||((format.vcodec&&format.vcodec!=='none')?5000:160))*duration*125}
export function chooseDownloadFormat(info,maxHeight=1080){
  const formats=(info.formats||[]).filter(f=>!f.has_drm&&/^[\w.-]+$/.test(f.format_id));
  const audio=formats.filter(f=>f.vcodec==='none'&&f.acodec!=='none'&&f.ext==='m4a').sort((a,b)=>(Number(b.tbr)||0)-(Number(a.tbr)||0))[0];
  const options=formats.filter(f=>f.vcodec&&f.vcodec!=='none'&&f.ext==='mp4'&&f.height<=maxHeight).map(video=>{
    const separate=video.acodec==='none';if(separate&&!audio)return null;
    return {format:video.format_id+(separate?'+'+audio.format_id:''),height:video.height,bytes:estimatedBytes(video,info.duration)+(separate?estimatedBytes(audio,info.duration):0),rate:Number(video.tbr)||0};
  }).filter(option=>option&&option.bytes<=importLimits.downloadBytes*.88).sort((a,b)=>b.height-a.height||b.rate-a.rate);
  if(!options.length)throw Error('No browser-compatible quality fits this recording. Try a local video file or connect the playing tab.');
  return options[0];
}
export function workingSetTooLarge(sizes){return Math.max(0,...sizes)>importLimits.downloadBytes*1.1||sizes.reduce((a,b)=>a+b,0)>importLimits.downloadBytes*3}
export function validateDuration(value){if(!Number.isFinite(value)||value<=0||value>importLimits.durationSeconds)throw Error('Recordings can be up to 6 hours long.');return value}
export function validateSegment(start,end,duration){if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end-start>60||end>duration+.1)throw Error('Choose an audio section of up to 60 seconds within the video.');return {start,end}}
export function mediaRange(header,size){
  if(!header)return {start:0,end:size-1,partial:false};const match=header.match(/^bytes=(\d*)-(\d*)$/);if(!match||(!match[1]&&!match[2]))throw Error('Invalid byte range');
  const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));const end=match[1]&&match[2]?Math.min(Number(match[2]),size-1):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=size)throw Error('Invalid byte range');return {start,end,partial:true};
}
const jobs=new Map(),limit=importLimits.bytes;
const cacheRoot=await fs.mkdtemp(path.join(os.tmpdir(),'context-desk-imports-'));
const projectRoot=path.resolve(import.meta.dirname,'..');
const env={...process.env,PYTHONPATH:[path.join(projectRoot,'.runtime'),process.env.PYTHONPATH].filter(Boolean).join(path.delimiter)};
function run(job,args,timeout=90000){return new Promise((resolve,reject)=>{
  const child=spawn(process.env.YTDLP_PYTHON||'python3',['-m','yt_dlp','--ignore-config','--no-plugin-dirs','--no-playlist','--no-cache-dir','--socket-timeout','20','--retries','1','--js-runtimes','node',...args],{env,stdio:['ignore','pipe','pipe']});job.child=child;let output='',error='';const collect=args.includes('--print');let settled=false;
  const done=(failure)=>{if(settled)return;settled=true;clearTimeout(timer);clearInterval(sizeGuard);job.child=null;if(failure)reject(failure);else resolve(output)};
  const timer=setTimeout(()=>{child.kill('SIGTERM');done(Error('Import timed out. Try a shorter recording or browser capture.'));},timeout);
  const sizeGuard=setInterval(async()=>{try{const names=await fs.readdir(job.dir);const sizes=await Promise.all(names.map(async name=>(await fs.stat(path.join(job.dir,name))).size));if(workingSetTooLarge(sizes)){child.kill('SIGTERM');done(Error('The selected quality exceeds the working budget.'));}}catch{}},1500);
  child.stdout.on('data',chunk=>{output=collect?output+chunk.toString():(output+chunk.toString()).slice(-16000);if(collect&&output.length>2_000_000){child.kill();done(Error('The platform returned an unexpectedly large response. Try a local file.'));}const match=chunk.toString().match(/\[download\]\s+([\d.]+)%/);if(match){job.progress=Number(match[1]);job.message=`Preparing ${job.quality||'the recording'} · ${Math.round(job.progress)}%`;}});
  child.stderr.on('data',chunk=>{error=(error+chunk.toString()).slice(-8000)});
  child.once('error',()=>done(Error('Video importer is unavailable. Run the import setup described in README.')));
  child.once('close',code=>{if(job.status==='cancelled')done(Error('Import cancelled.'));else if(code!==0){const detail=/No module named/.test(error)?'Video importer is unavailable. Run the import setup described in README.':/private|sign in|login|bot|403|unavailable|not available/i.test(error)?'The platform did not allow this recording to be imported. You can use a local file or browser capture.':'This video could not be imported. It may require access, use an unsupported format, or be unavailable.';done(Error(detail));}else done();});
});}
async function importVideo(job){
  try{
    job.status='checking';job.message='Checking the video and available quality…';
    const raw=await run(job,['--print',metadataTemplate,'--skip-download','--',job.url]);const info=JSON.parse(raw);
    if(job.status==='cancelled')return;
    job.title=String(info.title||'Imported video').slice(0,160);
    if(info.is_live||info.live_status==='is_live'){job.status='needs-capture';job.message='This source is live. Connect its playing tab once; framing and scanning will start automatically.';return;}
    validateDuration(info.duration);
    job.duration=info.duration;job.status='downloading';job.message='Preparing a clean recording with its original audio…';
    const ffmpeg=process.env.FFMPEG_PATH||path.join(projectRoot,'.runtime/bin/ffmpeg');
    for(const height of [1080,720,480]){
      const plan=chooseDownloadFormat(info,height);job.quality=plan.height+'p';job.message=`Preparing ${job.quality} with original audio · quality chosen to fit the local working budget…`;
      try{await run(job,['--newline','--progress','--max-filesize','4G','--ffmpeg-location',ffmpeg,'-f',plan.format,'--merge-output-format','mp4','--no-write-subs','--no-write-auto-subs','-o',path.join(job.dir,'source.%(ext)s'),'--',job.url],2700000);
        if(job.status==='cancelled')return;
        const names=await fs.readdir(job.dir),media=names.find(name=>/^source\.(mp4|webm|mov|mkv)$/.test(name));
        if(!media||(await fs.stat(path.join(job.dir,media))).size>importLimits.downloadBytes)throw Error('The selected quality exceeds the working budget.');
        break;
      }catch(error){if(job.status==='cancelled')return;if(!/working budget|No usable video|selected quality/i.test(error.message)||height===480)throw error;for(const name of await fs.readdir(job.dir))await fs.rm(path.join(job.dir,name),{force:true});job.progress=0;job.message='Choosing a smaller source quality automatically…';}
    }
    if(job.status==='cancelled')return;
    const names=await fs.readdir(job.dir);const name=names.find(name=>/^source\.(mp4|webm|mov|mkv)$/.test(name));if(!name)throw Error('No usable video was produced. Try browser capture or a local file.');
    const stat=await fs.stat(path.join(job.dir,name));if(stat.size>importLimits.downloadBytes||stat.size<1000)throw Error('The recording is empty or exceeds the import working budget.');
    job.file=path.join(job.dir,name);job.size=stat.size;job.mime=name.endsWith('.webm')?'video/webm':name.endsWith('.mkv')?'video/x-matroska':'video/mp4';job.touched=Date.now();job.status='ready';job.progress=100;job.message='Video ready. Starting your clip scan…';
  }catch(error){if(job.status!=='cancelled'){job.status='error';job.message=error.message;}}
  finally{delete job.url;}
}
function snapshot(job){return {id:job.id,status:job.status,message:job.message,title:job.title||'',duration:job.duration||0,quality:job.quality||'',progress:job.progress||0,size:job.size||0,mediaUrl:job.status==='ready'?`/api/import/${job.id}/media`:undefined,mime:job.mime};}
export function claimImportSource(id){const job=jobs.get(id);if(!job||job.status!=='ready')throw Error('The recording expired. Load the full video again before starting subtitles.');job.inUse=(job.inUse||0)+1;job.touched=Date.now();let released=false;return {file:job.file,duration:job.duration,title:job.title,size:job.size,release(){if(released)return;released=true;job.inUse--;job.touched=Date.now()}}}
export async function handleImport(req,res,sendJson){
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname!=='/api/import'&&!pathname.startsWith('/api/import/'))return false;
  if(req.method==='POST'||req.method==='DELETE'){
    const origin=req.headers.origin,host=req.headers.host;
    if(origin&&origin!==`http://${host}`){sendJson(res,403,{error:'Open this action from the local app.'});return true;}
  }
  try{
    if(pathname==='/api/import/upload'&&req.method==='POST'){
      if([...jobs.values()].some(job=>['checking','downloading','uploading'].includes(job.status))){sendJson(res,409,{error:'A source is already being prepared. Wait for it or cancel it first.'});return true;}
      if(jobs.size>=3){const oldest=[...jobs.values()].find(job=>!job.child&&!job.audioBusy&&!job.inUse&&job.status!=='uploading');if(oldest){jobs.delete(oldest.id);await fs.rm(oldest.dir,{recursive:true,force:true});}}
      const duration=validateDuration(Number(req.headers['x-video-duration'])),incoming=Number(req.headers['content-length']);if(incoming>limit)throw Error('The local video exceeds 20 GB.');const disk=await fs.statfs(cacheRoot);if(incoming>0&&incoming+512*1024*1024>disk.bavail*disk.bsize)throw Error('Not enough free local disk space to prepare this file. Free some space or choose a smaller source.');
      const id=randomUUID(),dir=path.join(cacheRoot,id);await fs.mkdir(dir);const file=path.join(dir,'source.mp4'),job={id,dir,file,duration,title:decodeURIComponent(String(req.headers['x-video-name']||'Local recording')).slice(0,160),status:'uploading',created:Date.now(),touched:Date.now(),size:0,mime:String(req.headers['content-type']||'video/mp4').startsWith('video/')?String(req.headers['content-type']):'video/mp4'};jobs.set(id,job);
      const output=createWriteStream(file);
      try{await new Promise((resolve,reject)=>{const fail=error=>{output.destroy();reject(error)};req.on('data',chunk=>{job.size+=chunk.length;if(job.size>limit){fail(Error('The local video exceeds 20 GB.'));req.unpipe(output)}});req.on('aborted',()=>fail(Error('Local video preparation was cancelled.')));req.on('error',fail);output.on('error',fail);output.on('finish',resolve);req.pipe(output)});if(job.size<1000)throw Error('The local video was empty.');job.status='ready';job.progress=100;job.message='Local video ready.';job.touched=Date.now();sendJson(res,201,snapshot(job));}
      catch(error){jobs.delete(id);await fs.rm(dir,{recursive:true,force:true});throw error}return true;
    }
    if(pathname==='/api/import'&&req.method==='POST'){
      if([...jobs.values()].some(job=>['checking','downloading','uploading'].includes(job.status))){sendJson(res,409,{error:'A video is already importing. Wait for it or cancel it first.'});return true;}
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>5000)throw Error('The link is too long.');}
      if(jobs.size>=3){const oldest=[...jobs.values()].find(job=>!job.child&&!job.audioBusy&&!job.inUse);if(oldest){jobs.delete(oldest.id);await fs.rm(oldest.dir,{recursive:true,force:true});}}
      const body=JSON.parse(raw),url=validateImportUrl(body.url);const id=randomUUID(),dir=path.join(cacheRoot,id);await fs.mkdir(dir);const job={id,dir,url,status:'checking',message:'Checking your video…',created:Date.now()};jobs.set(id,job);importVideo(job);sendJson(res,202,snapshot(job));return true;
    }
    const match=pathname.match(/^\/api\/import\/([a-f0-9-]{36})(\/(?:media|audio))?$/);const job=match&&jobs.get(match[1]);if(!job){sendJson(res,404,{error:'This import expired. Paste the link again.'});return true;}
    if(match[2]==='/audio'&&req.method==='POST'){
      if(job.status!=='ready')throw Error('The video is not ready for speech analysis.');if(job.audioBusy){sendJson(res,409,{error:'Another speech section is being prepared. Try again shortly.'});return true;}
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2000)throw Error('Audio request is too large.');}const body=JSON.parse(raw);const segment=validateSegment(Number(body.start),Number(body.end),job.duration);job.audioBusy=true;job.touched=Date.now();
      try{const audio=await extractAudio(job.file,segment);sendJson(res,200,audio)}finally{job.audioBusy=false}return true;
    }
    if(req.method==='DELETE'){if(job.inUse){sendJson(res,409,{error:'Pause the subtitle job before removing its recording.'});return true;}job.status='cancelled';job.child?.kill('SIGTERM');sendJson(res,200,snapshot(job));return true;}
    if(req.method!=='GET'){sendJson(res,405,{error:'Method not allowed'});return true;}
    if(!match[2]){sendJson(res,200,snapshot(job));return true;}
    if(job.status!=='ready'){sendJson(res,409,{error:'The video is not ready yet.'});return true;}
    job.touched=Date.now();let selection;try{selection=mediaRange(req.headers.range,job.size)}catch{res.writeHead(416,{'Content-Range':`bytes */${job.size}`});res.end();return true;}const {start,end,partial:range}=selection;
    res.writeHead(range?206:200,{'Content-Type':job.mime,'Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'no-store',...(range?{'Content-Range':`bytes ${start}-${end}/${job.size}`}:{})});const stream=createReadStream(job.file,{start,end});stream.on('error',()=>res.destroy());stream.pipe(res);return true;
  }catch(error){sendJson(res,400,{error:error.message||'Import failed.'});return true;}
}
const cleanup=setInterval(async()=>{for(const [id,job]of jobs){if(Date.now()-(job.touched||job.created)>3600000&&!job.child&&!job.audioBusy&&!job.inUse&&job.status!=='uploading'){jobs.delete(id);await fs.rm(job.dir,{recursive:true,force:true}).catch(()=>{});}}},60000);cleanup.unref();

export function wavRms(buffer){
  let offset=12;while(offset+8<=buffer.length){const name=buffer.toString('ascii',offset,offset+4),size=buffer.readUInt32LE(offset+4);if(name==='data'){const from=offset+8,end=Math.min(buffer.length,from+size);let energy=0,count=0;for(let i=from;i+1<end;i+=2){const sample=buffer.readInt16LE(i)/32768;energy+=sample*sample;count++}return count?Math.sqrt(energy/count):0}offset+=8+size+(size%2)}return 0;
}
export function extractAudio(file,{start,end}){return new Promise((resolve,reject)=>{
  const executable=process.env.FFMPEG_PATH||path.join(projectRoot,'.runtime/bin/ffmpeg');const child=spawn(executable,['-v','error','-ss',String(start),'-i',file,'-t',String(end-start),'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le','-f','wav','pipe:1'],{stdio:['ignore','pipe','pipe']});const chunks=[];let size=0,error='',settled=false;
  const finish=(failure)=>{if(settled)return;settled=true;clearTimeout(timer);if(failure){child.kill('SIGTERM');reject(failure);return}const buffer=Buffer.concat(chunks);if(buffer.length<100)reject(Error('No source audio was found in this section.'));else resolve({data:'data:audio/wav;base64,'+buffer.toString('base64'),rms:wavRms(buffer)})};
  const timer=setTimeout(()=>finish(Error('Preparing this speech section took too long.')),45000);child.stdout.on('data',chunk=>{size+=chunk.length;if(size>2_100_000)finish(Error('The speech section is too large.'));else chunks.push(chunk)});child.stderr.on('data',chunk=>{error=(error+chunk.toString()).slice(-500)});child.on('error',()=>finish(Error('FFmpeg is unavailable. Run the local importer setup.')));child.on('close',code=>finish(code===0?null:Error('Could not decode source audio for this section.')));
});}
