// Renders a Make the trailer result into one watchable MP4: a title card, each beat as a letterboxed
// shot with its role and English subtitles, dips to black between beats, a low hit on every card,
// and a closing logline card. Everything is FFmpeg on this computer, with fonts bundled in the app.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
const W=1280,H=720,BAR=84,FPS=25;
const fontsDir=path.resolve(import.meta.dirname,'../public/assets/fonts');
const assTime=t=>{const s=Math.max(0,t),h=Math.floor(s/3600),m=Math.floor(s/60)%60,x=(s%60).toFixed(2).padStart(5,'0');return `${h}:${String(m).padStart(2,'0')}:${x}`};
const assText=s=>String(s??'').replace(/[\\{}]/g,'').replace(/\r?\n/g,'\\N');
const roleName={setup:'SETUP',turn:'THE TURN',payoff:'PAYOFF'};
function run(bin,args){return new Promise((resolve,reject)=>{const c=spawn(bin,args,{stdio:['ignore','ignore','pipe']});let err='';c.stderr.on('data',d=>err=(err+d).slice(-1500));c.on('error',reject);c.on('close',code=>code===0?resolve():reject(Error(err.trim()||'FFmpeg failed')))})}

// Subtitle file for one shot: a lower-third with the beat's number, role and title, and the English lines.
export function beatAss(beat,index,cues){
  const len=beat.end-beat.start,head=`[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n`+
    `Style: Sub,Manrope,40,&H00F3F1EC,&H00F3F1EC,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,3,0,2,120,120,${BAR+22},1\n`+
    `Style: Role,Manrope,22,&H003BF2C9,&H003BF2C9,&H00000000,&H00000000,-1,0,0,0,100,100,3,0,1,0,0,7,60,60,${BAR+26},1\n`+
    `Style: Beat,Manrope,44,&H00F3F1EC,&H00F3F1EC,&H00000000,&H00000000,-1,0,0,0,100,100,-1,0,1,0,2,7,60,60,${BAR+56},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  let events=`Dialogue: 1,${assTime(.25)},${assTime(Math.min(len,3.2))},Role,,0,0,0,,{\\fad(200,250)}${index+1} / ${roleName[beat.role]||'BEAT'}\n`+`Dialogue: 1,${assTime(.35)},${assTime(Math.min(len,3.2))},Beat,,0,0,0,,{\\fad(250,250)}${assText(beat.title)}\n`;
  for(const c of cues){const s=c.start-beat.start,e=Math.min(len,c.end-beat.start);if(e>s&&e>0)events+=`Dialogue: 0,${assTime(Math.max(0,s))},${assTime(e)},Sub,,0,0,0,,${assText(c.text)}\n`}
  return head+events;
}
export function cardAss(lines){
  const head=`[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n`+
    `Style: Big,Manrope,78,&H00F3F1EC,&H00F3F1EC,&H00000000,&H00000000,-1,0,0,0,100,100,-2,0,1,0,0,5,110,110,0,1\nStyle: Small,Manrope,30,&H00A6A4AD,&H00A6A4AD,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,140,140,150,1\nStyle: Tag,Manrope,24,&H001F5AFF,&H001F5AFF,&H00000000,&H00000000,-1,0,0,0,100,100,4,0,1,0,0,8,60,60,140,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  return head+lines.map(([style,text,from,to])=>`Dialogue: 0,${assTime(from)},${assTime(to)},${style},,0,0,0,,{\\fad(300,300)}${assText(text)}\n`).join('');
}

export async function renderTrailer({trailer,sourceFile,cues,ffmpeg}){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'context-trailer-')),parts=[];
  const video=['-r',String(FPS),'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-ar','48000','-ac','2'];
  // A low hit for each card: a falling sine with a fast decay, like a trailer drum.
  const boom='aevalsrc=0.9*sin(2*PI*(55-25*t)*t)*exp(-3.2*t):s=48000:d=1.6,aformat=channel_layouts=stereo,apad';
  async function card(name,lines,seconds){const ass=path.join(dir,name+'.ass'),out=path.join(dir,name+'.mp4');await fs.writeFile(ass,cardAss(lines));
    await run(ffmpeg,['-v','error','-y','-f','lavfi','-i',`color=c=0x0b0b0d:s=${W}x${H}:d=${seconds}:r=${FPS}`,'-f','lavfi','-i',boom,'-t',String(seconds),'-vf',`ass=${ass}:fontsdir=${fontsDir},fade=in:st=0:d=0.3,fade=out:st=${seconds-.35}:d=0.35`,'-af',`afade=out:st=${seconds-.4}:d=0.4`,...video,out]);parts.push(out)}
  try{
    await card('open',[['Tag','A CONTEXT DESK TRAILER',.2,3.4],['Big',trailer.title,.4,3.4]],3.6);
    for(const [i,beat] of trailer.beats.entries()){
      const len=beat.end-beat.start,ass=path.join(dir,`beat-${i}.ass`),out=path.join(dir,`beat-${i}.mp4`);
      await fs.writeFile(ass,beatAss(beat,i,cues.filter(c=>c.end>beat.start&&c.start<beat.end)));
      await run(ffmpeg,['-v','error','-y','-ss',String(beat.start),'-t',String(len),'-i',sourceFile,'-map','0:v:0','-map','0:a:0?',
        '-vf',`scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,drawbox=x=0:y=0:w=iw:h=${BAR}:color=black:t=fill,drawbox=x=0:y=ih-${BAR}:w=iw:h=${BAR}:color=black:t=fill,ass=${ass}:fontsdir=${fontsDir},fade=in:st=0:d=0.35,fade=out:st=${Math.max(0,len-.4)}:d=0.4`,
        '-af',`afade=in:st=0:d=0.3,afade=out:st=${Math.max(0,len-.45)}:d=0.45`,...video,out]);parts.push(out);
    }
    await card('close',[['Big',trailer.logline,.3,4.4],['Small','Context Desk · drafted with Meta Muse Spark',.8,4.4]],4.8);
    const list=path.join(dir,'parts.txt'),out=path.join(dir,'trailer.mp4');await fs.writeFile(list,parts.map(p=>`file '${p}'`).join('\n'));
    await run(ffmpeg,['-v','error','-y','-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',out]);
    return {file:out,dir,seconds:3.6+4.8+trailer.beats.reduce((n,b)=>n+b.end-b.start,0)};
  }catch(error){await fs.rm(dir,{recursive:true,force:true});throw error}
}
