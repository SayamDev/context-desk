import {frameExpression,splitGeometry} from '../public/reframe-track.js';
import {accentFor} from '../public/caption-accents.js';
import {displayCues} from '../public/caption-display.js';
import {styleOf,captionSegments,layoutLines,fitFont,styleColours,dimColour} from '../public/caption-styles.js';
import {cleanCuts,selectExpression,parseSilence,silenceCuts,removedSeconds} from '../public/silence.js';
import fs from 'node:fs/promises';import {createReadStream} from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {createHash,randomUUID} from 'node:crypto';
import {createJobQueue,jobIdentity} from './jobs.js';import {syncedCues,srtDocument} from '../public/timing.js';
import {captionTarget} from '../public/caption-policy.js';
import {socialExportIssue,socialPresets} from '../public/social.js';
import {cleanCaptionLook,captionFontSize,assColour,bottomMargin} from '../public/brand-kit.js';
const executable=()=>process.env.FFMPEG_PATH||path.resolve(import.meta.dirname,'../.runtime/bin/ffmpeg');
const even=n=>Math.max(2,Math.round(n/2)*2),bounded=(n,min,max,fallback=min)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Number(n))):fallback;
export function dimensions(aspect,quality,source={width:1280,height:720}){const side=quality==='source'?Math.min(2160,source.height):quality===1080?1080:720;return aspect==='portrait'?[even(side),even(side*16/9)]:aspect==='square'?[even(side),even(side)]:aspect==='fourfive'?[even(side),even(side*5/4)]:quality==='source'?[even(source.width*Math.min(1,2160/source.height)),even(side)]:[even(side*16/9),even(side)]}
// Clip-relative subtitles as viewers see them (speaker IDs hidden, overlaps as two rows, clean or
// accessible), see public/caption-display.js.
export function outputCues(moment){return displayCues(trackCues(moment),{mode:moment.captionMode==='accessible'?'accessible':'clean'})}
function trackCues(moment){return syncedCues(moment.captionCues?.[moment.captionLanguage]||[],moment.captionOffset||0,moment.end-moment.start).map(c=>({...c,start:Math.max(0,c.start-moment.trimIn),end:Math.min(moment.trimOut-moment.trimIn,c.end-moment.trimIn),words:c.words?.map(w=>({...w,start:w.start+(moment.captionOffset||0)-moment.trimIn,end:w.end+(moment.captionOffset||0)-moment.trimIn}))})).filter(c=>c.end>c.start)}
export function validateRenderMoment(m,{allowUnreviewed=false}={}){
  if(!m||!Number.isFinite(m.trimIn)||!Number.isFinite(m.trimOut)||m.trimIn<0||m.trimOut-m.trimIn<.2||m.trimOut>m.end-m.start+.05)throw Error('Correct the clip trim before export.');
  if(!m.showCaptions)return;
  const hasSubtitles=outputCues(m).length>0;
  if(allowUnreviewed){
    if(!hasSubtitles)throw Error('No subtitles overlap this clip. Choose Export without subtitles or adjust the trim.');
  }else if(!hasSubtitles||!m.captionReviewed?.[m.captionLanguage]||trackCues(m).some(c=>c.uncertain)){
    throw Error('Review and resolve the flagged subtitle lines in this clip before export.');
  }
}
// An English dub (lib/dub.js) plays over the original, which stays underneath at the chosen level.
// Cuts inside the clip would shift the dub off its lines, so a clip with cuts keeps its own audio.
export function dubFile(store,m){const id=m.useDub&&m.dub?.assetId;if(!id||!/^[a-f0-9]{64}$/.test(id)||cleanCuts(m.cuts,m.trimIn,m.trimOut).length)return null;try{return store.assetPath(id).file}catch{return null}}
export function dubMix(m,original,dubInput,duration){const level=Math.min(1,Math.max(0,Number(m.dubLevel??.15))),filters=audioFilters(m);
  return `[${original}]${filters?filters+',':''}volume=${level.toFixed(2)}[under];[${dubInput}:a]atrim=0:${duration.toFixed(3)},asetpts=PTS-STARTPTS[voice];[under][voice]amix=inputs=2:normalize=0:duration=first[mixed]`}
export function audioFilters(moment){const cuts=cleanCuts(moment.cuts,moment.trimIn,moment.trimOut);return [moment.audioEnhance?'highpass=f=70,afftdn=nf=-25,loudnorm=I=-16:TP=-1.5:LRA=11':'',cuts.length?`aselect='${selectExpression(cuts,moment.trimIn)}',asetpts=N/SR/TB`:''].filter(Boolean).join(',')}
const assTime=n=>{const ticks=Math.max(0,Math.round(n*100));return `${Math.floor(ticks/360000)}:${String(Math.floor(ticks/6000)%60).padStart(2,'0')}:${String(Math.floor(ticks/100)%60).padStart(2,'0')}.${String(ticks%100).padStart(2,'0')}`};
// Treat subtitle text as text, never ASS override syntax. Full-width braces and
// reverse slash preserve visible punctuation without permitting injected tags.
const assText=s=>String(s).replace(/[\u0000-\u0008\u000B-\u001F]/g,'').replace(/\\/g,'＼').replace(/\{/g,'｛').replace(/\}/g,'｝').replace(/\r?\n/g,'\\N');
const assTag=hex=>assColour(hex).replace(/^&H00/,'&H')+'&';
// Caption events from the shared style catalogue: one Dialogue per constant-look segment,
// with the same words, colours, line breaks and entrance as the canvas preview.
export function assCaptionEvents(cue,styleId,look,{width,height,accent=null}){
  const style=styleOf(styleId),colours=styleColours(style,look),base=Math.round(captionFontSize(width,height,look)*style.size),ink='#111016';
  const outline=style.box?Math.round(base*.16):style.hollow?Math.max(1,base*style.stroke):style.glow?3:base*style.stroke;
  return captionSegments(cue,styleId,{keyword:accent?.keyword}).map(segment=>{
    const fs=fitFont(segment.words,{width,fontSize:base,style}),lines=layoutLines(segment.words,{width,fontSize:fs,style});
    const word=w=>{const t=assText(w.text);if(w.state==='future'&&style.future==='hide')return `{\\alpha&HFF&}${t}{\\alpha&H00&}`;
      if(w.state==='future'&&style.future==='dim')return `{\\c${assTag(dimColour)}}${t}{\\c${assTag(colours.text)}}`;
      const lit=(w.state==='active'&&['color','fill','scale'].includes(style.active))||(w.state==='past'&&style.past==='accent')||w.keyword,litColour=style.box&&style.boxColor==='accent'?'#ffffff':colours.accent;
      if(w.state==='active'&&style.active==='box')return `{\\3c${assTag(colours.accent)}\\bord${Math.round(fs*.25)}\\c${assTag(ink)}}${t}{\\3c${assTag(style.hollow?colours.text:ink)}\\bord${+outline.toFixed(1)}\\c${assTag(colours.text)}}`;
      if(w.state==='active'&&style.active==='fill')return `{\\1a&H00&\\c${assTag(colours.accent)}}${t}{\\1a&HFF&}`;
      if(w.state==='active'&&style.active==='scale')return `{\\fscx112\\fscy112\\c${assTag(colours.accent)}}${t}{\\fscx100\\fscy100\\c${assTag(colours.text)}}`;
      return lit?`{\\c${assTag(litColour)}}${t}{\\c${assTag(colours.text)}}`:t};
    const enter=segment.enter==='pop'?'\\fscx112\\fscy112\\t(0,200,0.5,\\fscx100\\fscy100)':segment.enter==='fade'?'\\fad(150,0)':'';
    const emoji=accent?.emoji?`{\\fnNoto Emoji\\c${assTag(style.box&&style.boxColor==='accent'?'#ffffff':colours.accent)}}${accent.emoji}{\\fn${look.font}\\c${assTag(colours.text)}}\\N`:'';
    return `Dialogue: 0,${assTime(segment.start)},${assTime(segment.end)},Caption,,0,0,0,,{\\fs${fs}${style.glow?`\\blur6\\3c${assTag(colours.accent)}`:''}${enter}}${emoji}${lines.map(line=>line.map(i=>word(segment.words[i])).join(' ')).join('\\N')}\n`;
  }).join('');
}
export function assDocument(m,width,height){
  const look=cleanCaptionLook(m.captionLook,m.captionStyle),style=styleOf(m.captionStyle),colours=styleColours(style,look),font=Math.round(captionFontSize(width,height,look)*style.size),hookFont=Math.round(Math.min(width/13,54)),bottom=look.position==='top'?Math.round(height*.1):look.position==='middle'?0:Math.round(height*bottomMargin(width,height)),alignment={top:8,middle:5,bottom:2}[look.position];
  const outline=style.box?Math.round(font*.16):style.hollow?Math.max(1,font*style.stroke):style.glow?3:+(font*style.stroke).toFixed(1),boxAlpha=style.boxColor==='black'?'26':'20',outlineAss=style.box?assColour(colours.box,boxAlpha):assColour(style.hollow?colours.text:style.glow?colours.accent:'#111016');
  const back=assColour('#000000','60'),noteFont=Math.round(Math.min(width/24,40));
  let output=`[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,${look.font},${font},${assColour(colours.text,style.hollow?'FF':'00')},${assColour(colours.accent)},${outlineAss},${back},${style.weight>=600?-1:0},${style.italic?-1:0},0,0,100,100,0,0,${style.box?3:1},${outline},${style.box?0:+(font*style.shadow).toFixed(1)},${alignment},${Math.round(width*.07)},${Math.round(width*.07)},${bottom},1\nStyle: Hook,Arial,${hookFont},&H00FFFFFF,&H00FFFFFF,&H401B1416,&H401B1416,-1,0,0,0,100,100,0,0,3,10,0,${m.showCaptions?8:2},${Math.round(width*.08)},${Math.round(width*.08)},${Math.round(height*(m.showCaptions ? .07 : .06))},1\nStyle: Note,Arial,${noteFont},&H00ECF1F3,&H00ECF1F3,${assColour('#0b0b0d','22')},${assColour('#0b0b0d','22')},-1,0,0,0,100,100,0,0,3,${Math.round(noteFont*.45)},0,7,${Math.round(width*.05)},${Math.round(width*.05)},${Math.round(height*.05)},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  if(m.showCaptions)for(const cue of outputCues(m))output+=assCaptionEvents(cue,m.captionStyle,look,{width,height,accent:accentFor(m,cue.text)});
  // WrapStyle 2 turns off automatic wrapping, so the hook gets explicit line breaks that fit the frame.
  if(m.showHook&&m.hook){const budget=Math.max(8,Math.floor(width*.82/(hookFont*.56))),lines=[''];for(const word of String(m.hook).split(/\s+/).filter(Boolean)){const line=lines.at(-1);if(line&&line.length+1+word.length>budget)lines.push(word);else lines[lines.length-1]=line?line+' '+word:word}
    output+=`Dialogue: 1,0:00:00.00,${assTime(Math.min(2.6,m.trimOut-m.trimIn))},Hook,,0,0,0,,${lines.map(assText).join('\\N')}\n`}
  // Culture notes: a card at the top-left while the explained line is on screen (phrase in volt, meaning below).
  if(m.showCultureNotes&&Array.isArray(m.cultureNotes)){const timed=new Map(trackCues(m).map(c=>[c.index,c])),budget=Math.max(12,Math.floor(width*.82/(noteFont*.55)));
    for(const n of m.cultureNotes){const c=timed.get(n.line);if(!c||n.hidden||!n.phrase||!n.meaning)continue;const lines=[''];for(const word of String(n.meaning).split(/\s+/).filter(Boolean)){const line=lines.at(-1);if(line&&line.length+1+word.length>budget)lines.push(word);else lines[lines.length-1]=line?line+' '+word:word}
      output+=`Dialogue: 2,${assTime(c.start)},${assTime(Math.min(m.trimOut-m.trimIn,Math.max(c.end,c.start+3)))},Note,,0,0,0,,{\\c${assTag('#c9f23b')}}${assText(n.phrase)}{\\c&HECF1F3&}\\N${lines.map(assText).join('\\N')}\n`}}
  return output;
}
export function pictureFilters(m,width,height,assFile,fps=30){const filters=[];if(m.sourceType==='screen'&&!m.cleanCapture&&m.sourceCrop){const c=m.sourceCrop;filters.push(`crop=iw*${bounded(c.w,.01,1,1)}:ih*${bounded(c.h,.01,1,1)}:iw*${bounded(c.x,0,.99)}:ih*${bounded(c.y,0,.99)}`)}
  const position=key=>{const value=frameExpression({...m,outputAspect:width===height?'square':Math.abs(width/height-.8)<.01?'fourfive':width<height?'portrait':'landscape'},key);return value.includes('(')?"'"+value+"'":value};
  if(m.frameMode==='split'){const g=splitGeometry(width,height,m.splitCam),c=g.cam,band=n=>`scale=${width}:${n}:force_original_aspect_ratio=increase:force_divisible_by=2`;const pre=filters.splice(0).join(',');filters.push((pre?pre+',':'')+`split[cam][game];[cam]crop=w='iw*${c.w}':h='min(ih,iw*${c.w}*${g.top}/${width})':x='min(iw*${c.x},iw-ow)':y='min(ih*${c.y},ih-oh)',${band(g.top)},crop=${width}:${g.top}[top];[game]${band(g.bottom)},crop=${width}:${g.bottom}:(iw-ow)*${position('focusX')}:(ih-oh)/2[bottom];[top][bottom]vstack`)}else if(m.frameMode==='fill'){const zoom=bounded(m.zoom,1,3,1);filters.push(`scale=${even(width*zoom)}:${even(height*zoom)}:force_original_aspect_ratio=increase:force_divisible_by=2`,`crop=${width}:${height}:(iw-ow)*${position('focusX')}:(ih-oh)*${position('focusY')}`)}else filters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2`,`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x101014`);
  filters.push('setsar=1');if(m.sourceCaptionMask)filters.push('drawbox=x=0:y=ih*0.76:w=iw:h=ih*0.24:color=0x151419:t=fill');if(assFile)filters.push('ass='+assFile+':shaping=complex:fontsdir=fonts');
  // Cuts go last so captions and reframing keep the source clock; fps first makes N/FRAME_RATE exact.
  const cuts=cleanCuts(m.cuts,m.trimIn,m.trimOut);if(cuts.length)filters.push(`fps=${fps}`,`select='${selectExpression(cuts,m.trimIn)}'`,`setpts=N/FRAME_RATE/TB`);return filters.join(',');}
// Burned-in captions and hooks need the libass "ass" filter; checked once per process.
let assSupport;export function hasAssFilter(){return assSupport??=new Promise(resolve=>{const c=spawn(executable(),['-hide_banner','-filters'],{stdio:['ignore','pipe','ignore']});let out='';c.stdout.on('data',d=>out+=d);c.on('close',()=>resolve(/ ass /.test(out)));c.on('error',()=>resolve(false))})}
export function ffmpeg(args,{cwd,onProgress,shouldStop,timeout=3600000}={}){return new Promise((resolve,reject)=>{const child=spawn(executable(),args,{cwd,stdio:['ignore','pipe','pipe']});let error='',output='',settled=false;const finish=failure=>{if(settled)return;settled=true;clearTimeout(timer);clearInterval(cancel);failure?reject(failure):resolve({output,error})};const timer=setTimeout(()=>{child.kill('SIGTERM');finish(Error('Rendering exceeded the time limit. Completed segments are saved.'))},timeout),cancel=setInterval(()=>{if(shouldStop?.()){child.kill('SIGTERM');finish(Error('Export stopped. Completed segments are saved.'))}},200);child.stdout.on('data',c=>{output=(output+c).slice(-2000);const matches=[...c.toString().matchAll(/out_time_us=(\d+)/g)];if(matches.length)try{onProgress?.(Number(matches.at(-1)[1])/1000000)}catch(error){child.kill('SIGTERM');finish(error)}});child.stderr.on('data',c=>error=(error+c.toString()).slice(-20000));child.on('error',()=>finish(Error('FFmpeg is unavailable. Run the local importer setup.')));child.on('close',code=>finish(code===0?null:Error('FFmpeg could not render this source. '+error.slice(-700))))})}
export function parseMediaInfo(text){const video=text.match(/Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/),duration=text.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/),fps=text.match(/Video:[^\n]*?([\d.]+) fps/);if(!video)throw Error('No readable video stream was found.');return {width:Number(video[1]),height:Number(video[2]),duration:duration?Number(duration[1])*3600+Number(duration[2])*60+Number(duration[3]):null,audio:/Stream[^\n]*Audio:/.test(text),fps:Number(fps?.[1])||30}}
export async function probeMedia(file){const result=await ffmpeg(['-hide_banner','-protocol_whitelist','file,pipe','-format_whitelist','mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,avi,mpegts,mpeg,mpegvideo','-i',file,'-t','0','-f','null','-']);return parseMediaInfo(result.error)}
async function saveOutput(store,file,type){const hash=createHash('sha256');for await(const part of createReadStream(file))hash.update(part);const id=hash.digest('hex'),target=path.join(store.root,'assets',id);const temporary=target+'.'+randomUUID()+'.tmp';await fs.copyFile(file,temporary);await fs.rename(temporary,target);const stat=await fs.stat(target);const record={id,url:'/api/assets/'+id,size:stat.size,type};store.registerAsset(id,stat.size,type);return record}
export function createExportService({store,claimSource}){
  const snapshot=j=>({id:j.id,kind:'export',projectId:j.projectId,sourceName:j.name,clipTitle:j.moments?.length===1?(j.moments[0].hook||j.moments[0].sourceName||j.name):j.name,status:j.status,phase:j.phase,error:j.error||'',createdAt:j.createdAt,sectionsDone:j.segments.length,sectionsTotal:j.moments.length,sectionsRemaining:j.moments.length-j.segments.length,completedSeconds:j.completedSeconds||0,duration:j.duration,speechRequests:0,translationRequests:0,output:j.output,srt:j.srt,destination:j.destination||'custom',unreviewedSubtitles:j.subtitleMode==='unreviewed',captionLanguages:[...new Set(j.moments.filter(m=>m.showCaptions).map(m=>m.captionLanguage))]});
  const queue=createJobQueue({store,kind:'export_job',publicJob:snapshot,execute:async(j,worker)=>{
    const dir=path.join(store.root,'renders',j.id);await fs.mkdir(path.join(dir,'fonts'),{recursive:true});for(const font of ['Manrope.ttf','NotoEmoji.ttf'])await fs.copyFile(path.resolve(import.meta.dirname,'../public/assets/fonts/'+font),path.join(dir,'fonts',font));let release=[];
    try{const inputs=j.moments.map(m=>{const imported=m.url.match(/^\/api\/import\/([a-f0-9-]{36})\/media$/),asset=m.url.match(/^\/api\/assets\/([a-f0-9]{64})$/);if(imported){const source=claimSource(imported[1]);release.push(source.release);return source.file}if(asset)return store.assetPath(asset[1]).file;throw Error('Save source media before export.')});
      const disk=await fs.statfs(store.root);if(disk.bavail*disk.bsize<512*1024*1024+Math.min(30*1024**3,j.duration*1500000))throw Error('Not enough free disk space for the render and its intermediate segments. Free space and resume.');const first=await probeMedia(inputs[0]),[width,height]=dimensions(j.aspect,j.quality,first),fps=Math.max(1,Math.min(60,first.fps));j.width=width;j.height=height;worker.checkpoint();
      if(j.moments.some(m=>m.showCaptions||m.showHook)&&!await hasAssFilter())throw Error('This FFmpeg cannot burn in captions (it was built without libass). On macOS run: brew install ffmpeg-full, then npm run setup:imports and restart Context Desk.');
      for(let i=j.segments.length;i<j.moments.length;i++){if(worker.shouldStop())return;const m=j.moments[i],duration=m.trimOut-m.trimIn,dub=dubFile(store,m),info=i===0?first:await probeMedia(inputs[i]);j.phase=`Rendering clip ${i+1} of ${j.moments.length}`;worker.checkpoint();
        const assFile=`${i}.ass`;await fs.writeFile(path.join(dir,assFile),assDocument(m,width,height),'utf8');const output=path.join(dir,i+'.mp4'),base=j.moments.slice(0,i).reduce((n,m)=>n+m.trimOut-m.trimIn,0);let last=0;
        await ffmpeg(['-v','error','-y','-ss',String((m.mediaStart||0)+m.trimIn),'-protocol_whitelist','file,pipe','-format_whitelist','mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,avi,mpegts,mpeg,mpegvideo','-i',inputs[i],...(!info.audio?['-f','lavfi','-i','anullsrc=r=48000:cl=stereo']:[]),...(dub?['-i',dub]:[]),'-t',String(duration-removedSeconds(cleanCuts(m.cuts,m.trimIn,m.trimOut))),'-map','0:v:0',...(dub?['-filter_complex',dubMix(m,info.audio?'0:a:0':'1:a:0',info.audio?1:2,duration),'-map','[mixed]']:['-map',info.audio?'0:a:0':'1:a:0']),'-vf',pictureFilters(m,width,height,m.showCaptions||m.showHook?assFile:null,fps),...(!dub&&audioFilters(m)?['-af',audioFilters(m)]:[]),'-r',String(fps),'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-map_metadata','-1','-movflags','+faststart','-progress','pipe:1',output],{cwd:dir,shouldStop:()=>j.cancel,onProgress:seconds=>{if(Date.now()-last<700)return;last=Date.now();j.completedSeconds=base+Math.min(duration,seconds);worker.checkpoint()}});
        const asset=await saveOutput(store,output,'video/mp4');j.segments.push(asset);j.completedSeconds=base+duration;worker.checkpoint();
      }
      if(worker.shouldStop())return;j.phase='Packaging saved clips';worker.checkpoint();const concat=j.segments.map((asset,i)=>{return `file '${i}.mp4'`}).join('\n');for(let i=0;i<j.segments.length;i++)await fs.copyFile(store.assetPath(j.segments[i].id).file,path.join(dir,i+'.mp4'));await fs.writeFile(path.join(dir,'concat.txt'),concat);const output=path.join(dir,'finished.'+(j.format==='webm'?'webm':'mp4'));
      await ffmpeg(['-v','error','-y','-f','concat','-safe','1','-i','concat.txt',...(j.format==='webm'?['-c:v','libvpx-vp9','-crf','30','-b:v','0','-c:a','libopus']:['-c','copy','-movflags','+faststart']),'-map_metadata','-1',output],{cwd:dir,shouldStop:()=>j.cancel});j.output=await saveOutput(store,output,j.format==='webm'?'video/webm':'video/mp4');
      let clock=0;const cues=j.moments.flatMap(m=>{const track=m.showCaptions?outputCues(m).map(c=>({...c,start:c.start+clock,end:c.end+clock})):[];clock+=m.trimOut-m.trimIn;return track});j.srt=cues.length?store.putAsset(Buffer.from(srtDocument(cues)),'text/plain'):null;store.putRecord('export_result',j.id,{...j.output,projectId:j.projectId,name:j.name+'.'+j.format,createdAt:Date.now()});j.completedSeconds=j.duration;worker.checkpoint();await fs.rm(dir,{recursive:true,force:true});return true;
    }finally{release.forEach(fn=>fn())}
  }});
  // Finds pauses inside one clip's trim; returns cut ranges on the moment's window clock.
  async function silence(m){
    const trimIn=Number(m?.trimIn),trimOut=Number(m?.trimOut),mediaStart=Number(m?.mediaStart||0);if(!Number.isFinite(trimIn)||!Number.isFinite(trimOut)||trimOut-trimIn<1||trimOut-trimIn>900||!(mediaStart>=0))throw Error('Choose a clip between 1 second and 15 minutes long.');
    const imported=String(m.url||'').match(/^\/api\/import\/([a-f0-9-]{36})\/media$/),asset=String(m.url||'').match(/^\/api\/assets\/([a-f0-9]{64})$/);let release=()=>{},file;
    if(imported){const source=claimSource(imported[1]);release=source.release;file=source.file}else if(asset)file=store.assetPath(asset[1]).file;else throw Error('Save source media before cutting silences.');
    try{const {error}=await ffmpeg(['-hide_banner','-nostats','-ss',String(mediaStart+trimIn),'-t',String(trimOut-trimIn),'-protocol_whitelist','file,pipe','-i',file,'-vn','-af','silencedetect=noise=-35dB:d=0.5','-f','null','-'],{timeout:120000});
      return silenceCuts(parseSilence(error,trimOut-trimIn)).map(r=>({start:r.start+trimIn,end:r.end+trimIn}));}finally{release()}
  }
  return {silence,list:()=>queue.list(),get:id=>queue.get(id),command:(id,action)=>queue.command(id,action),start(body){
    const p=store.getProject(body.projectId),ids=body.momentIds;
    if(!Array.isArray(ids)||!ids.length||ids.length>100)throw Error('Choose 1–100 saved clips for an export.');
    const subtitleMode=body.subtitleMode==='unreviewed'?'unreviewed':body.subtitleMode==='none'?'none':'current';
    const moments=ids.map(id=>{
      const m=p.state.moments.find(m=>m.id===id);if(!m)return m;
      const language=p.state.settings?.liveCaptionLanguage===undefined?m.captionLanguage:captionTarget(m,p.state.settings.liveCaptionLanguage);
      return {...m,captionLanguage:language,...(body.draft?{showCaptions:false,showHook:false}:subtitleMode==='none'?{showCaptions:false}:subtitleMode==='unreviewed'?{showCaptions:true}:{})};
    });
    moments.forEach(moment=>validateRenderMoment(moment,{allowUnreviewed:subtitleMode==='unreviewed'}));
    const duration=moments.reduce((n,m)=>n+m.trimOut-m.trimIn,0);
    if(duration>21600)throw Error('A story cut can be up to six hours.');
    const destination=Object.hasOwn(socialPresets,body.destination||'')?body.destination:'custom';
    const plan={projectId:p.id,subtitleMode,moments:structuredClone(moments),aspect:['portrait','square','fourfive'].includes(body.aspect)?body.aspect:'landscape',quality:body.quality==='source'?'source':body.quality===1080?1080:720,format:body.format==='webm'?'webm':'mp4',duration,destination,name:String(body.name||'context-desk-cut').replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,100)||'context-desk-cut',segments:[],completedSeconds:0};
    const issue=socialExportIssue(destination,plan);if(issue)throw Error(issue);
    return queue.add(plan,{idempotencyKey:jobIdentity(plan)});
  }};
}
