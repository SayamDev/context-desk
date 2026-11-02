import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {captureFrame} from './media-worker.js';
import {probeMedia} from './exports.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const ratios={landscape:16/9,portrait:9/16,square:1,fourfive:4/5};
const finite=Number.isFinite;
const center=b=>({x:b.x+b.w/2,y:b.y+b.h/2});
const distance=(a,b)=>Math.hypot(center(a).x-center(b).x,center(a).y-center(b).y);
function validBox(b){return b&&[b.x,b.y,b.w,b.h].every(finite)&&b.x>=0&&b.y>=0&&b.w>.005&&b.h>.005&&b.x+b.w<=1.00001&&b.y+b.h<=1.00001&&(b.confidence===undefined||finite(b.confidence)&&b.confidence>=.6);}
function validateMoment(m){if(!m||!finite(m.start)||!finite(m.end)||m.start<0||m.end<=m.start||!finite(m.trimIn)||!finite(m.trimOut)||m.trimIn<0||m.trimOut-m.trimIn<.2||m.trimOut>m.end-m.start+.00001||m.mediaStart!==undefined&&(!finite(m.mediaStart)||m.mediaStart<0))throw Error('Correct the saved clip trim before automatic reframing.');}
const union=boxes=>{const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return {x,y,w:Math.max(...boxes.map(b=>b.x+b.w))-x,h:Math.max(...boxes.map(b=>b.y+b.h))-y};};

// Active speaker from lip movement: faces are followed by position, each face's mouth
// opening is compared with its neighbouring samples, and the face moving its lips most
// (clearly ahead of the others) becomes the subject. A new speaker must lead for three
// samples and every shot lasts at least 1.5 s, so the crop does not flicker.
export function speakerFrames(frames,{minActivity=.012,lead=1.4,confirm=3,minShot=1.5}={}){
  const tracks=[];
  const assigned=frames.map(frame=>frame.boxes.filter(validBox).map(box=>{
    const c=center(box);let best=null,gap=.12;
    for(const track of tracks){if(frame.time-track.time>1.5)continue;const d=Math.hypot(track.c.x-c.x,track.c.y-c.y);if(d<gap){gap=d;best=track}}
    if(!best){best={id:tracks.length};tracks.push(best)}best.c=c;best.time=frame.time;return {...box,track:best.id}}));
  const mouth=(i,id)=>assigned[i]?.find(b=>b.track===id)?.mouth;
  const activity=(i,id)=>{let sum=0,n=0;for(let k=Math.max(1,i-2);k<=Math.min(assigned.length-1,i+2);k++){const a=mouth(k,id),b=mouth(k-1,id);if(finite(a)&&finite(b)){sum+=Math.abs(a-b);n++}}return n?sum/n:0};
  let speaker=null,candidate=null,streak=0,since=-Infinity;
  return frames.map((frame,i)=>{
    const boxes=assigned[i],ranked=boxes.map(b=>({b,a:activity(i,b.track)})).sort((x,y)=>y.a-x.a),top=ranked[0];
    const clear=top&&top.a>=minActivity&&(!ranked[1]||top.a>=ranked[1].a*lead);
    if(clear&&top.b.track!==speaker){if(candidate===top.b.track)streak++;else{candidate=top.b.track;streak=1}}else if(clear){candidate=null;streak=0}
    let cut=false;
    if(candidate!==null&&streak>=confirm&&frame.time-since>=minShot){cut=speaker!==null;speaker=candidate;since=frame.time;candidate=null;streak=0}
    const current=boxes.find(b=>b.track===speaker);
    // Until someone clearly speaks (or while the speaker is off screen) keep everyone in frame.
    return {time:frame.time,boxes:current?[current]:boxes,cut,speaker:current?speaker:null};
  });
}
export function buildReframeTrack({moment,width,height,aspect='portrait',frames,subject,method='geometric-face-tracking'}){
  validateMoment(moment);
  if(!finite(width)||!finite(height)||width<=0||height<=0||!Object.hasOwn(ratios,aspect))throw Error('Choose a supported aspect and readable source dimensions.');
  if(!Array.isArray(frames)||!frames.length||frames.length>121)throw Error('Recorded source frame samples are required.');
  if(subject!==undefined&&!validBox(subject))throw Error('Draw a valid normalized subject box before tracking.');
  let lastTime=-Infinity;
  for(const frame of frames){if(!finite(frame.time)||frame.time<lastTime||frame.time<moment.trimIn-.00001||frame.time>moment.trimOut+.00001||!Array.isArray(frame.boxes))throw Error('Source sample times must be ordered inside the saved trim.');lastTime=frame.time;}
  const sourceAspect=width/height,targetAspect=ratios[aspect],cropW=Math.min(1,targetAspect/sourceAspect),cropH=Math.min(1,sourceAspect/targetAspect);
  const warnings=[method==='speaker-tracking'?'Cuts to whoever is moving their lips. Lip movement is not proof of speech (laughing, eating, off-screen voices): review each cut.':'Tracks face rectangles geometrically. This does not identify people, infer who is speaking, or guarantee a face remains visible between sampled frames.'];
  const targets=[];let previous=subject,detected=0,tooWide=0,multiple=0,discontinuities=0;
  for(const frame of frames){
    const boxes=frame.boxes.filter(validBox);let target=null,mode='hold',sceneCut=false;
    if(subject){
      if(boxes.length){const ranked=boxes.map(box=>({box,distance:distance(box,previous||subject)})).sort((a,b)=>a.distance-b.distance);if(ranked[0].distance<=.3){target=ranked[0].box;mode='subject';}}
    }else if(boxes.length===1){target=boxes[0];mode='subject';}
    else if(boxes.length>1){target=union(boxes);mode='group';multiple++;}
    if(target){
      detected++;if(target.w>cropW*.92||target.h>cropH*.92)tooWide++;
      if(frame.cut||previous&&distance(target,previous)>.35){sceneCut=true;if(!frame.cut)discontinuities++;}
      previous=target;
      const point=center(target),left=clamp(point.x-cropW/2,0,1-cropW),top=clamp(point.y-cropH*.38,0,1-cropH);
      targets.push({time:frame.time,focusX:cropW<.999999?left/(1-cropW)*100:50,focusY:cropH<.999999?top/(1-cropH)*100:50,confidence:finite(target.confidence)?target.confidence:null,mode,faceCount:boxes.length,sceneCut});
    }else targets.push({time:frame.time,focusX:null,focusY:null,confidence:null,mode,faceCount:boxes.length,sceneCut:false});
  }
  const coverage=detected/frames.length;
  let lastDetected=moment.trimIn,maxLostInterval=0;
  for(const target of targets){if(target.focusX!==null)lastDetected=target.time;else maxLostInterval=Math.max(maxLostInterval,target.time-lastDetected);}
  if(!detected)warnings.push('No reliable face was detected in the selected trim. Keep manual framing or Fit; no automatic crop is applied.');
  else if(detected<frames.length)warnings.push('Faces were missing in some samples. Nearby crop positions are held; review occlusions, entrances and cuts.');
  if(multiple&&method!=='speaker-tracking')warnings.push('Multiple faces are framed as a group unless an explicit subject box is supplied. Face position does not establish the active speaker.');
  if(tooWide)warnings.push('The face/group is too wide or tall for this aspect without cutting someone off. Use Fit, another aspect, or select one subject manually.');
  if(maxLostInterval>2)warnings.push('A face was lost for more than two seconds. Select a subject or use manual framing for this interval.');
  if(discontinuities)warnings.push('Large geometric position changes were detected. Crop positions reset at these samples; review possible scene cuts.');
  const maxSampleGap=Math.max(0,...frames.slice(1).map((f,i)=>f.time-frames[i].time));if(maxSampleGap>1.1)warnings.push('This longer trim uses sparse samples. Fast motion between samples needs manual review.');
  const keyframes=[];let last=null;
  for(let index=0;index<targets.length;index++){
    const sample=targets[index];let x=sample.focusX,y=sample.focusY;
    if(x===null){const ahead=targets.slice(index+1).find(s=>s.focusX!==null&&s.time-sample.time<=2);x=last?.focusX??ahead?.focusX??50;y=last?.focusY??ahead?.focusY??50;}
    if(last&&!sample.sceneCut&&sample.mode!=='hold'){
      const dt=sample.time-last.time,alpha=1-Math.exp(-dt/.38);
      const smooth=(previous,next)=>Math.abs(next-previous)<1?previous:previous+(next-previous)*alpha;
      x=smooth(last.focusX,x);y=smooth(last.focusY,y);
    }
    const keyframe={time:sample.time,focusX:clamp(x,0,100),focusY:clamp(y,0,100),mediaTime:(moment.mediaStart??0)+sample.time,sourceTime:moment.start+sample.time,confidence:sample.confidence,mode:sample.mode,faceCount:sample.faceCount,sceneCut:sample.sceneCut};
    keyframes.push(keyframe);last=keyframe;
  }
  const extend=(time,value)=>({...value,time,mediaTime:(moment.mediaStart??0)+time,sourceTime:moment.start+time});
  if(keyframes[0].time>moment.trimIn)keyframes.unshift(extend(moment.trimIn,keyframes[0]));
  if(keyframes.at(-1).time<moment.trimOut)keyframes.push(extend(moment.trimOut,keyframes.at(-1)));
  const canApply=coverage>=.5&&tooWide===0&&maxLostInterval<=2;
  const firstDetection=frames.find(frame=>frame.boxes.some(validBox)),subjects=firstDetection?firstDetection.boxes.filter(validBox).map((box,index)=>({index,...box})):[];
  return {version:1,method,aspect,subjects,subjectsTime:firstDetection?.time??null,zoom:1,frameMode:canApply?'fill':'fit',timeBasis:'moment-seconds',mediaOffset:moment.mediaStart??0,sourceOffset:moment.start,trimIn:moment.trimIn,trimOut:moment.trimOut,sourceWidth:width,sourceHeight:height,cropWidth:cropW,cropHeight:cropH,keyframes,maxLostInterval,coverage,sampledFrames:frames.length,canApply,needsReview:!canApply||coverage<1||multiple>0||discontinuities>0||maxSampleGap>1.1,warnings};
}

function runVision(args){return new Promise((resolve,reject)=>{
  const child=spawn('/usr/bin/swift',args,{stdio:['ignore','pipe','pipe']});let output='',error='',settled=false;
  const finish=failure=>{if(settled)return;settled=true;clearTimeout(timer);if(failure){child.kill('SIGTERM');reject(failure)}else resolve(output);};
  const timer=setTimeout(()=>finish(Error('Local face detection exceeded two minutes. Shorten the trim and retry.')),120000);
  child.stdout.on('data',chunk=>{output+=chunk;if(output.length>2000000)finish(Error('Face detector output exceeded the safety limit.'));});
  child.stderr.on('data',chunk=>error=(error+chunk).slice(-3000));
  child.on('error',()=>finish(Error('Local face detection requires macOS with the installed Swift command-line tools, or a configured detector provider.')));
  child.on('close',code=>finish(code===0?null:Error(/CVPixelBuffer|sysctlbyname|sandbox/i.test(error)?'Apple Vision cannot allocate image buffers in this sandbox. Run the local server normally outside the Codex sandbox, or use manual framing.':'Local face detection failed. Check the installed macOS Swift/Vision tools. '+error.slice(-500))));
});}
export async function detectVisionFrames({frames,mouth=false}){
  if(process.platform!=='darwin')throw Error('Automatic local face tracking requires macOS Vision and Swift, or a configured detector provider. Keep manual framing on this system.');
  if(!frames.length)return {method:'apple-vision-faces',frames:[]};
  const directory=path.dirname(frames[0].file);if(frames.some(f=>path.dirname(f.file)!==directory))throw Error('Detection frames must share one private working directory.');
  const source=path.resolve(import.meta.dirname,'../scripts/reframe-vision.swift'),cache=path.join(os.tmpdir(),'context-desk-swift-cache');await fs.mkdir(cache,{recursive:true});
  const result=JSON.parse(await runVision(['-module-cache-path',cache,source,directory,...(mouth?['--mouth']:[])]));
  if(result.method!=='apple-vision-faces'||!Array.isArray(result.frames))throw Error('The local face detector returned an invalid result.');
  const byFile=new Map(result.frames.map(f=>[f.file,f.boxes]));
  return {method:result.method,frames:frames.map(frame=>{const boxes=byFile.get(path.basename(frame.file))?.map(({mouth,...box})=>mouth==null?box:{...box,mouth});if(!Array.isArray(boxes))throw Error('The detector did not process every source sample.');return {time:frame.time,boxes};})};
}
function jpegSize(bytes){for(let offset=2;offset+8<bytes.length;){if(bytes[offset]!==255){offset++;continue;}const marker=bytes[offset+1];if([0xc0,0xc1,0xc2,0xc3].includes(marker))return {width:bytes.readUInt16BE(offset+7),height:bytes.readUInt16BE(offset+5)};if(marker===0xd8||marker===0xd9){offset+=2;continue;}const size=bytes.readUInt16BE(offset+2);if(size<2)break;offset+=2+size;}throw Error('The decoded source image dimensions are unavailable.');}
function sourceCrop(moment){const c=moment.sourceType==='screen'&&!moment.cleanCapture?moment.sourceCrop:null;if(!c)return {x:0,y:0,w:1,h:1};if(!validBox(c))throw Error('Correct the saved source player crop before automatic reframing.');return c;}

export function createReframeService({store,claimSource,detector=detectVisionFrames}){
  let busy=false;
  return {async start(body){
    if(!body||typeof body!=='object'||typeof body.projectId!=='string'||typeof body.momentId!=='string')throw Error('Choose a saved project and clip for reframing.');
    if(busy){const error=Error('Another clip is being reframed. Wait for it to finish.');error.status=409;throw error;}
    const project=store.getProject(body.projectId),moment=structuredClone(project.state.moments.find(m=>m.id===body.momentId));if(project.trashed||!moment)throw Error('The clip must belong to an active saved project.');validateMoment(moment);
    const duration=moment.trimOut-moment.trimIn;if(duration>180)throw Error('Automatic reframing supports trims up to three minutes. Shorten the saved trim first.');
    if(body.subject!==undefined&&!validBox(body.subject))throw Error('Draw a valid normalized subject box before tracking.');
    const aspect=body.aspect||project.state.aspect||'portrait';if(!Object.hasOwn(ratios,aspect))throw Error('Choose a supported output aspect.');
    const crop=sourceCrop(moment),releases=[];let dir;busy=true;
    try{
      const imported=String(moment.url).match(/^\/api\/import\/([a-f0-9-]{36})\/media$/),asset=String(moment.url).match(/^\/api\/assets\/([a-f0-9]{64})$/);let file;
      if(imported){const source=claimSource(imported[1]);releases.push(source.release);file=source.file;}else if(asset)file=store.assetPath(asset[1]).file;else throw Error('Save the original clip media locally before reframing.');
      if(typeof file!=='string'||!path.isAbsolute(file))throw Error('The original local media file is unavailable.');
      const info=await probeMedia(file);if(!finite(info.duration)||(moment.mediaStart??0)+moment.trimOut>info.duration+.02)throw Error('The saved trim extends beyond the original media. Restore the matching recording.');
      dir=await fs.mkdtemp(path.join(os.tmpdir(),'context-reframe-'));
      const speaker=body.speaker===true,count=speaker?Math.min(121,Math.max(2,Math.ceil(duration*4)+1)):Math.min(61,Math.max(2,Math.ceil(duration*2)+1)),lastSample=Math.max(moment.trimIn,moment.trimOut-1/Math.max(1,info.fps)),frames=[];let dimensions;
      for(let index=0;index<count;index++){
        const time=moment.trimIn+((lastSample-moment.trimIn)*index/(count-1)),decodeTime=(moment.mediaStart??0)+time,bytes=await captureFrame(file,decodeTime),frameFile=path.join(dir,String(index).padStart(4,'0')+'.jpg');
        dimensions??=jpegSize(bytes);await fs.writeFile(frameFile,bytes,{mode:0o600});frames.push({time,file:frameFile});
      }
      const detection=await detector({frames,width:dimensions.width,height:dimensions.height,aspect,subject:body.subject,mouth:speaker});
      if(!detection||typeof detection.method!=='string'||!Array.isArray(detection.frames)||detection.frames.length!==frames.length)throw Error('The detector returned incomplete source samples.');
      for(let i=0;i<frames.length;i++)if(Math.abs(detection.frames[i].time-frames[i].time)>.001)throw Error('The detector changed source sample timing.');
      const adjusted=detection.frames.map(frame=>({...frame,boxes:frame.boxes.map(box=>({...box,x:(box.x-crop.x)/crop.w,y:(box.y-crop.y)/crop.h,w:box.w/crop.w,h:box.h/crop.h})).filter(validBox)}));
      const result=buildReframeTrack({moment,width:dimensions.width*crop.w,height:dimensions.height*crop.h,aspect,frames:speaker?speakerFrames(adjusted):adjusted,subject:speaker?undefined:body.subject,method:speaker?'speaker-tracking':detection.method});
      return {...result,referenceFrame:store.putAsset(await fs.readFile((frames.find(frame=>Math.abs(frame.time-result.subjectsTime)<.001)||frames[0]).file),'image/jpeg').url,projectId:project.id,momentId:moment.id,projectRevision:project.revision,sourceUrl:moment.url,sourceCrop:crop,createdAt:Date.now()};
    }finally{try{if(dir)await fs.rm(dir,{recursive:true,force:true});}finally{for(const release of releases)release();busy=false;}}
  }};
}
export function createReframeApi(options){const service=createReframeService(options);return async(req,res,json)=>{
  if(new URL(req.url,'http://localhost').pathname!=='/api/reframe')return false;
  try{
    if(req.method!=='POST'){json(res,405,{error:'Method not allowed'});return true;}
    if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){json(res,403,{error:'Open reframing from the local app.'});return true;}
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>10000)throw Error('Reframing request is too large.');}
    json(res,200,await service.start(JSON.parse(raw||'{}')));
  }catch(error){json(res,error.status||400,{error:error.message||'Automatic reframing failed.'});}
  return true;
};}
