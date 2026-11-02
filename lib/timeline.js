import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ffmpeg,outputCues} from './exports.js';
import {srtDocument} from '../public/timing.js';
import {captionTarget} from '../public/caption-policy.js';

// FCP7 interchange, not modern FCPXML. Timing, rate, file and link semantics:
// https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/FinalCutPro_XML/Elements/Elements.html
// https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/FinalCutPro_XML/Topics/Topics.html#//apple_ref/doc/uid/TP30001149-CH294-SW1
const escapeXml=value=>String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const tag=(name,value)=>`<${name}>${escapeXml(value)}</${name}>`;
const safeName=value=>String(value||'context-desk-cut').replace(/[\u0000-\u001F\u007F]/g,'').trim().slice(0,100)||'context-desk-cut';
const filename=value=>safeName(value).replace(/[^\p{L}\p{N} _-]/gu,'').trim()||'context-desk-cut';
const supportedAspects=['landscape','portrait','square','fourfive'];

export function timelineRate(input){
  const value=typeof input==='string'&&/^\d+\/\d+$/.test(input)?input.split('/').reduce((a,b)=>Number(a)/Number(b)):Number(input);
  if(Number.isFinite(value)&&value>=1&&value<=120){
    for(const base of [24,30,48,60,120])if(Math.abs(value-base*1000/1001)<.002)return {timebase:base,ntsc:true,numerator:base*1000,denominator:1001,fps:base*1000/1001};
    if(Math.abs(value-Math.round(value))<.00001)return {timebase:Math.round(value),ntsc:false,numerator:Math.round(value),denominator:1,fps:Math.round(value)};
  }
  throw Error('This source frame rate cannot be represented faithfully in FCP7 XML. Convert to an integer or standard NTSC frame rate first.');
}
const rateXml=rate=>`<rate>${tag('timebase',rate.timebase)}${tag('ntsc',rate.ntsc?'TRUE':'FALSE')}</rate>`;
const frames=(seconds,rate)=>Math.round(seconds*rate.numerator/rate.denominator);
const seconds=(count,rate)=>count*rate.denominator/rate.numerator;
const videoCharacteristics=(info,rate)=>`<samplecharacteristics>${rateXml(rate)}${tag('width',info.width)}${tag('height',info.height)}${tag('anamorphic','FALSE')}${info.pixelAspectRatio===undefined||info.pixelAspectRatio===1?tag('pixelaspectratio','square'):''}</samplecharacteristics>`;

export function parseTimelineMediaInfo(text){
  const video=text.match(/(?:Stream[^\n]*: )?Video:[^\n]+/g)?.[0],size=video?.match(/\b(\d{2,5})x(\d{2,5})\b/),duration=text.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/),fps=video?.match(/\b(\d+(?:\.\d+)?) fps\b/),audio=text.match(/(?:Stream[^\n]*: )?Audio:[^\n]+/g)||[];
  if(!size||!fps||!duration)throw Error('Source video dimensions, duration or frame rate are unavailable. Convert this recording before timeline export.');
  const info={width:Number(size[1]),height:Number(size[2]),duration:Number(duration[1])*3600+Number(duration[2])*60+Number(duration[3]),fps:Number(fps[1]),audio:audio.length>0,channels:0,sampleRate:null};
  timelineRate(info.fps);
  const sar=video.match(/SAR (\d+):(\d+)/);if(sar)info.pixelAspectRatio=Number(sar[1])/Number(sar[2]);
  if(audio.length>1)throw Error('Timeline export currently supports one source audio stream. Choose a recording with a single mono or stereo stream.');
  if(audio.length){info.channels=/\bmono\b/.test(audio[0])?1:/\bstereo\b/.test(audio[0])?2:0;info.sampleRate=Number(audio[0].match(/\b(\d+) Hz\b/)?.[1]);if(!info.channels||!info.sampleRate)throw Error('Timeline export supports identified mono or stereo source audio. Convert other layouts before export.');}
  return info;
}
async function probeTimelineMedia(file){
  const result=await ffmpeg(['-hide_banner','-protocol_whitelist','file,pipe','-format_whitelist','mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,avi,mpegts,mpeg,mpegvideo','-i',file,'-t','0','-f','null','-'],{timeout:30000});
  // Output stream descriptions follow the input descriptions; inspect input only.
  return parseTimelineMediaInfo(result.error.split('Stream mapping:')[0].split('Output #')[0]);
}
function validateClip(moment,info){
  const span=moment?.end-moment?.start;
  if(!moment||!Number.isFinite(moment.start)||!Number.isFinite(moment.end)||moment.start<0||span<=0||!Number.isFinite(moment.trimIn)||!Number.isFinite(moment.trimOut)||moment.trimIn<0||moment.trimOut-moment.trimIn<.2-1e-9||moment.trimOut>span+.000001)throw Error('Correct the saved clip trim before timeline export.');
  const origin=moment.mediaStart===undefined?0:moment.mediaStart;
  if(!Number.isFinite(origin)||origin<0)throw Error('The saved source media offset is invalid.');
  if(!Number.isFinite(info.duration)||info.duration<=0||!Number.isInteger(info.width)||!Number.isInteger(info.height)||info.width<=0||info.height<=0)throw Error('Source metadata is incomplete.');
  if(info.audio&&(![1,2].includes(info.channels)||!Number.isFinite(info.sampleRate)))throw Error('Timeline export supports mono or stereo source audio.');
  const rate=timelineRate(info.fps),mediaIn=frames(origin+moment.trimIn,rate),mediaOut=frames(origin+moment.trimOut,rate),sourceFrames=frames(info.duration,rate);
  if(origin+moment.trimOut>info.duration+.02||mediaOut>sourceFrames||mediaOut<=mediaIn)throw Error('The saved trim extends beyond the source media or contains no complete frame. Restore the matching source recording.');
  return {rate,mediaIn,mediaOut,sourceFrames};
}

export function buildTimelineDocument({name='context-desk-cut',aspect='landscape',clips}){
  if(!Array.isArray(clips)||clips.length<1||clips.length>100)throw Error('Choose 1–100 saved clips for a timeline.');
  if(!supportedAspects.includes(aspect))throw Error('Choose a supported timeline aspect ratio.');
  name=safeName(name);
  const checked=clips.map(clip=>({...clip,...validateClip(clip.moment,clip.info)})),sequenceRate=checked[0].rate;
  const [width,height]={landscape:[1920,1080],portrait:[1080,1920],square:[1080,1080],fourfive:[1080,1350]}[aspect];
  const warnings=[
    'This XML transfers ordered source edits and linked original audio. It does not render the finished video.',
    'Context Desk framing, crop, zoom, hook titles, caption masks and caption styling are not translated into editor effects. Saved values are included in the JSON sidecar; reapply them in the editor.',
    'Media stays on this computer and is not embedded. Keep the source files in place, or relink them after moving to another computer. Browser captures may require conversion to an editor-supported codec.',
    'Times are rounded to source frames and cumulative sequence frames. Variable-frame-rate cadence, source timecode, colour management and editor scaling defaults require review after import.',
    'FCP7 XML structure and media timing are checked locally; import into Premiere Pro and DaVinci Resolve has not been verified in those applications.'
  ];
  if(checked.some(c=>c.rate.fps!==sequenceRate.fps))warnings.push('Mixed frame rates retain source frame ranges. The editor must resample playback to the first clip’s sequence rate; review cadence and cut boundaries.');
  const files=new Map(),video=[],audio=[[],[]],notes=[],cues=[];let elapsed=0;
  for(let index=0;index<checked.length;index++){
    const clip=checked[index],{moment:m,info,rate,mediaIn,mediaOut,sourceFrames}=clip;
    if(typeof clip.file!=='string'||!path.isAbsolute(clip.file))throw Error('A real absolute local source path is required.');
    const start=frames(elapsed,sequenceRate),duration=seconds(mediaOut-mediaIn,rate);elapsed+=duration;const end=frames(elapsed,sequenceRate);
    if(elapsed>21600)throw Error('A timeline can be up to six hours.');
    if(end<=start)throw Error('The saved trim contains no sequence frame.');
    const itemIds=[`video-${index+1}`,...(info.audio?Array.from({length:info.channels},(_,n)=>`audio-${index+1}-${n+1}`):[])];
    const links=itemIds.map((id,n)=>`<link>${tag('linkclipref',id)}${tag('mediatype',n?'audio':'video')}${tag('trackindex',n||1)}${tag('clipindex',n?audio[n-1].length+1:index+1)}${n&&info.channels===2?tag('groupindex',1):''}</link>`).join('');
    let fileId=files.get(clip.file),fileXml;
    if(fileId)fileXml=`<file id="${fileId}"/>`;
    else{fileId=`file-${files.size+1}`;files.set(clip.file,fileId);fileXml=`<file id="${fileId}">${tag('name',m.sourceName||path.basename(clip.file))}${tag('pathurl',pathToFileURL(clip.file).href)}${rateXml(rate)}${tag('duration',sourceFrames)}<media><video>${videoCharacteristics(info,rate)}</video>${info.audio?`<audio>${tag('channelcount',info.channels)}<samplecharacteristics>${tag('samplerate',info.sampleRate)}</samplecharacteristics></audio>`:''}</media></file>`;}
    const note=`Context Desk clip ${m.id}; original source ${m.start+m.trimIn}–${m.start+m.trimOut}s. Render effects are in the JSON sidecar.`;
    const common=()=>`${tag('name',m.hook||m.sourceName||`Clip ${index+1}`)}${tag('enabled','TRUE')}${tag('duration',sourceFrames)}${rateXml(rate)}${tag('start',start)}${tag('end',end)}${tag('in',mediaIn)}${tag('out',mediaOut)}`;
    video.push(`<clipitem id="${itemIds[0]}">${common()}${fileXml}<sourcetrack>${tag('mediatype','video')}</sourcetrack><logginginfo>${tag('lognote',note)}</logginginfo>${links}</clipitem>`);
    if(info.audio)for(let channel=0;channel<info.channels;channel++)audio[channel].push(`<clipitem id="${itemIds[channel+1]}">${common()}<file id="${fileId}"/><sourcetrack>${tag('mediatype','audio')}${tag('trackindex',channel+1)}</sourcetrack>${links}</clipitem>`);
    const captionCues=m.showCaptions?outputCues(m):[];
    if(m.showCaptions&&(!m.captionReviewed?.[m.captionLanguage]||!captionCues.length||captionCues.some(c=>c.uncertain)))warnings.push(`Clip ${index+1} captions are unreviewed, unresolved or missing. The SRT/notes are a draft for review.`);
    const segmentStart=seconds(start,sequenceRate),segmentEnd=seconds(end,sequenceRate),frameShift=seconds(mediaIn,rate)-((m.mediaStart??0)+m.trimIn);
    for(const cue of captionCues){const cueStart=Math.max(segmentStart,segmentStart+cue.start-frameShift),cueEnd=Math.min(segmentEnd,segmentStart+cue.end-frameShift);if(cueEnd>cueStart)cues.push({...cue,start:cueStart,end:cueEnd});}
    notes.push({order:index+1,momentId:m.id,sourceName:m.sourceName||'',sourceUrl:m.url,localFileUrl:pathToFileURL(clip.file).href,fileId,sourceRate:rate,sourceMetadata:info,sequenceInFrame:start,sequenceOutFrame:end,mediaInFrame:mediaIn,mediaOutFrame:mediaOut,mediaStartSeconds:(m.mediaStart??0)+m.trimIn,mediaEndSeconds:(m.mediaStart??0)+m.trimOut,quantizedMediaStartSeconds:seconds(mediaIn,rate),quantizedMediaEndSeconds:seconds(mediaOut,rate),originalSourceStartSeconds:m.start+m.trimIn,originalSourceEndSeconds:m.start+m.trimOut,savedEdits:structuredClone(m),captionCues});
  }
  const durationFrames=frames(elapsed,sequenceRate),audioXml=audio.filter(track=>track.length).map((items,index)=>`<track>${items.join('')}${tag('enabled','TRUE')}${tag('locked','FALSE')}${tag('outputchannelindex',index+1)}</track>`).join('');
  const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="5"><sequence id="context-desk-sequence">${tag('name',name)}${tag('duration',durationFrames)}${rateXml(sequenceRate)}<timecode>${rateXml(sequenceRate)}${tag('frame',0)}${tag('displayformat','NDF')}</timecode><media><video><format>${videoCharacteristics({width,height},sequenceRate)}</format><track>${video.join('')}${tag('enabled','TRUE')}${tag('locked','FALSE')}</track></video><audio>${audioXml?`${tag('channelcount',audio.filter(t=>t.length).length)}<format><samplecharacteristics>${tag('samplerate',48000)}</samplecharacteristics></format>`:''}${audioXml}</audio></media></sequence></xmeml>\n`;
  return {xml,srt:cues.length?srtDocument(cues):null,warnings:[...new Set(warnings)],rate:sequenceRate,durationFrames,sidecar:{format:'context-desk-timeline-notes',version:1,name,aspect,width,height,sequenceRate,durationFrames,mediaEmbedded:false,warnings:[...new Set(warnings)],clips:notes}};
}

export async function createTimelineExport({store,claimSource},body){
  if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.projectId!=='string'||!body.projectId)throw Error('Choose a saved project for the timeline.');
  const ids=body.momentIds;
  if(!Array.isArray(ids)||ids.length<1||ids.length>100||ids.some(id=>typeof id!=='string'||!id||id.length>100))throw Error('Choose 1–100 saved clip IDs for a timeline.');
  const project=store.getProject(body.projectId);if(project.trashed)throw Error('Restore the project from Trash before exporting its timeline.');
  const moments=ids.map(id=>{const moment=project.state.moments.find(m=>m.id===id);if(!moment)throw Error('Every timeline clip must belong to the selected saved project.');return {...structuredClone(moment),captionLanguage:project.state.settings?.liveCaptionLanguage===undefined?moment.captionLanguage:captionTarget(moment,project.state.settings.liveCaptionLanguage)};});
  const releases=[],sources=new Map(),clips=[];
  try{
    for(const moment of moments){
      let source=sources.get(moment.url);
      if(!source){const imported=String(moment.url).match(/^\/api\/import\/([a-f0-9-]{36})\/media$/),asset=String(moment.url).match(/^\/api\/assets\/([a-f0-9]{64})$/);let file;
        if(imported){const claimed=claimSource(imported[1]);releases.push(claimed.release);file=claimed.file;}
        else if(asset)file=store.assetPath(asset[1]).file;
        else throw Error('Save the source media locally before timeline export.');
        if(typeof file!=='string'||!path.isAbsolute(file))throw Error('A real local source file is required.');
        const stat=await fs.stat(file);if(!stat.isFile()||stat.size===0)throw Error('The saved source media is missing or empty.');
        source={file,info:await probeTimelineMedia(file)};sources.set(moment.url,source);
      }
      clips.push({moment,...source});
    }
    const result=buildTimelineDocument({name:body.name||project.title,aspect:body.aspect||project.state.aspect||'landscape',clips}),base=filename(body.name||project.title),save=(content,type,name)=>({...store.putAsset(Buffer.from(content),type),name});
    return {projectId:project.id,format:'xmeml',version:5,xml:save(result.xml,'application/xml',base+'.xml'),sidecar:save(JSON.stringify({...result.sidecar,projectId:project.id,projectRevision:project.revision},null,2),'application/json',base+'-context-desk.json'),srt:result.srt?save(result.srt,'text/plain',base+'-captions.srt'):null,warnings:result.warnings,rate:result.rate,durationFrames:result.durationFrames,duration:seconds(result.durationFrames,result.rate)};
  }finally{for(const release of releases)release();}
}

export function createTimelineApi({store,claimSource}){
  return async(req,res,json)=>{
    if(new URL(req.url,'http://localhost').pathname!=='/api/timeline')return false;
    try{
      if(req.method!=='POST'){json(res,405,{error:'Method not allowed'});return true;}
      if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){json(res,403,{error:'Open timeline export from the local app.'});return true;}
      const chunks=[];let size=0;for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>20000)throw Error('Timeline request is too large.');chunks.push(Buffer.from(chunk));}
      const body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');json(res,201,await createTimelineExport({store,claimSource},body));
    }catch(error){json(res,error.status||400,{error:error.message||'Timeline export failed.'});}
    return true;
  };
}
