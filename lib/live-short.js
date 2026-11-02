// Live clip to ready-to-post Short: transcribe and find the speaker at the same time, write
// the hook and post copy, then render a 9:16 file with captions, hook and speaker framing.
// Every step falls back instead of failing the whole Short: no speech service means no
// captions, no face detector means a centred crop, no Meta means a hook from the transcript.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {detectVisionFrames,speakerFrames,buildReframeTrack} from './reframe.js';
import {assDocument,pictureFilters,ffmpeg,probeMedia} from './exports.js';
import {speechCues} from '../public/timing.js';
import {composePostCaption} from '../public/social.js';

export const shortStages=['transcribing','framing','writing','rendering','ready'];
const projectRoot=path.resolve(import.meta.dirname,'..');
const ffmpegPath=()=>process.env.FFMPEG_PATH||path.join(projectRoot,'.runtime/bin/ffmpeg');
// First sentence of a transcript, short enough to sit on screen as the opening hook.
export function hookFromText(text){const first=String(text||'').trim().split(/(?<=[.!?؟。])\s+/)[0]||'';return first.length>60?first.slice(0,57).replace(/\s+\S*$/,'')+'…':first}
function wav(file){return new Promise(resolve=>{const c=spawn(ffmpegPath(),['-v','error','-i',file,'-vn','-ac','1','-ar','16000','-f','wav','pipe:1'],{stdio:['ignore','pipe','ignore']}),chunks=[];c.stdout.on('data',d=>chunks.push(d));c.on('close',code=>resolve(code===0?Buffer.concat(chunks):null));c.on('error',()=>resolve(null))})}

async function speakerTrack(file,duration,info,dir,detector){
  // One FFmpeg pass at an even rate (about 4 per second, at most 120 samples) instead of a process per frame.
  const fps=Math.min(4,120/duration),framesDir=path.join(dir,'frames');await fs.mkdir(framesDir,{recursive:true});
  await ffmpeg(['-v','error','-y','-i',file,'-vf',`fps=${fps.toFixed(4)},scale=640:-2`,'-q:v','5',path.join(framesDir,'%04d.jpg')],{timeout:120000});
  const frames=(await fs.readdir(framesDir)).filter(f=>f.endsWith('.jpg')).sort().map((f,i)=>({time:Math.min(duration-.05,(i+.5)/fps),file:path.join(framesDir,f)}));if(frames.length<2)throw Error('Too few frames for speaker tracking.');
  try{const detection=await detector({frames,mouth:true}),moment={start:0,end:duration,trimIn:0,trimOut:duration,mediaStart:0};
    return buildReframeTrack({moment,width:info.width,height:info.height,aspect:'portrait',frames:speakerFrames(detection.frames),method:'speaker-tracking'})}
  finally{await fs.rm(framesDir,{recursive:true,force:true})}
}

export async function produceShort({file,dir,sourceUrl='',transcribe,postKit,detector=detectVisionFrames,captionStyle='hormozi',onStage=()=>{}}){
  await fs.mkdir(dir,{recursive:true});const info=await probeMedia(file),duration=info.duration;if(!(duration>0))throw Error('The clip has no readable duration.');
  const notes=[];
  // Speech and framing are independent: run them together.
  onStage('transcribing');
  const speechJob=(async()=>{if(!transcribe){notes.push('No speech service: the Short has no captions.');return {cues:[],transcript:''}}
    const bytes=await wav(file);if(!bytes){notes.push('The clip has no readable audio.');return {cues:[],transcript:''}}
    try{const r=await transcribe(bytes);const transcript=(r.turns?.length?r.turns.map(t=>t.text).join(' '):String(r.transcript||'').replace(/\[\d+s\]\s*/g,'')).trim();return {cues:speechCues(r,duration),transcript}}
    catch(error){notes.push('Speech failed: '+(error.message||'unknown error'));return {cues:[],transcript:''}}})();
  const frameJob=(async()=>{try{const track=await speakerTrack(file,duration,info,dir,detector);return track.frameMode==='fill'?{frameMode:'fill',zoom:1,focusX:track.keyframes[0]?.focusX??50,focusY:track.keyframes[0]?.focusY??50,frameKeyframes:track.keyframes,frameTracking:{aspect:'portrait'},method:'speaker'}:null}
    catch(error){notes.push('Speaker framing unavailable ('+(error.message||'error')+'): centred crop used.');return null}})();
  const speech=await speechJob;onStage('framing');const framing=await frameJob||{frameMode:'fill',zoom:1,focusX:50,focusY:40,method:'centre'};
  onStage('writing');
  let kit=null;if(postKit&&speech.transcript)try{kit=await postKit({transcript:speech.transcript})}catch(error){notes.push('Post copy unavailable: '+(error.message||'error'))}
  const hook=(kit?.title||hookFromText(speech.transcript)).slice(0,80);
  onStage('rendering');
  const moment={start:0,end:duration,trimIn:0,trimOut:duration,mediaStart:0,captionLanguage:'Original',captionStyle,captionLook:{},captionOffset:0,captionCues:{Original:speech.cues},showCaptions:speech.cues.length>0,hook,showHook:Boolean(hook),...framing};
  const fonts=path.join(dir,'fonts');await fs.mkdir(fonts,{recursive:true});for(const font of ['Manrope.ttf','NotoEmoji.ttf'])await fs.copyFile(path.join(projectRoot,'public/assets/fonts',font),path.join(fonts,font));
  await fs.writeFile(path.join(dir,'short.ass'),assDocument(moment,720,1280));
  const out=path.join(dir,'short.mp4'),cover=path.join(dir,'cover.jpg');
  await ffmpeg(['-v','error','-y','-i',file,'-vf',pictureFilters(moment,720,1280,moment.showCaptions||moment.showHook?'short.ass':null,30),'-r','30','-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',out],{cwd:dir,timeout:300000});
  await ffmpeg(['-v','error','-y','-ss',String(Math.min(.8,duration/4)),'-i',out,'-frames:v','1','-q:v','4',cover],{cwd:dir}).catch(()=>{});
  onStage('ready');
  return {file:out,cover,hook,transcript:speech.transcript,captions:speech.cues.length,framing:framing.method,
    postCaption:composePostCaption({caption:kit?.caption||hook,hashtags:kit?.hashtags||[],link:sourceUrl,disclose:true}),notes};
}
