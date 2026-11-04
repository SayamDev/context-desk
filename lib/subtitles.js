import {languageBias,needsTranslation} from '../public/languages.js';
import {speechCues,srtDocument,syncedCues} from '../public/timing.js';
import {displayCues} from '../public/caption-display.js';
import {createJobQueue,jobIdentity} from './jobs.js';

import {captionLanguages,findVariant,romanizations} from '../public/locales.js';
export const subtitleLanguages=new Set(['Original',...captionLanguages]);
export function subtitleSections(duration){const sections=[];for(let start=0;start<duration;start+=45)sections.push({start,end:Math.min(duration,start+45),audioStart:Math.max(0,start-.8),audioEnd:Math.min(duration,start+45.8)});return sections}
export function placeSectionCues(cues,section){return cues.map(c=>({...c,start:Math.max(section.start,c.start+section.audioStart),end:Math.min(section.end,c.end+section.audioStart),words:c.words?.map(w=>({...w,start:w.start+section.audioStart,end:w.end+section.audioStart})),boundaryReview:c.start+section.audioStart<section.start+.8||c.end+section.audioStart>section.end-.8})).filter(c=>c.end-c.start>=.1)}
// A provider error that retrying cannot fix (a missing or rejected key, a bad request).
const fatal=error=>[400,401,403].includes(error?.status)||/api key|unauthori[sz]ed|forbidden/i.test(error?.message||'');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Retries a transient failure (network, timeout, 5xx, rate limit, a reply that could not be read).
export async function withRetry(run,{attempts=3,wait=pause,delays=[2000,8000]}={}){
  for(let attempt=1;;attempt++){try{return await run()}catch(error){if(fatal(error)||attempt>=attempts)throw error;await wait(error?.status===429?delays.at(-1)*2:delays[attempt-1]??delays.at(-1))}}
}
// Translates a batch so that one bad reply never stops a two-hour job: a batch that fails twice is
// split in half and each half retried, down to single lines. A line that still fails keeps its original
// text, flagged for a person to translate; nothing is guessed. Key and account errors still stop the job.
export async function translateResilient(part,translateBatch,{wait=pause}={}){
  try{
    const lines=await withRetry(async()=>{const lines=await translateBatch(part);if(lines.length!==part.length||lines.some((line,id)=>line.id!==part[id].id||!line.text?.trim()))throw Error('Translated line order could not be verified.');return lines},{attempts:2,wait});
    return lines;
  }catch(error){
    if(fatal(error))throw error;
    if(part.length===1)return [{id:part[0].id,text:part[0].text,uncertain:true,untranslated:true}];
    const half=Math.ceil(part.length/2);
    return [...await translateResilient(part.slice(0,half),translateBatch,{wait}),...await translateResilient(part.slice(half),translateBatch,{wait})];
  }
}
export function createSubtitleService({claimSource,extract,transcribe,translate,store,validate=()=>{},wait=pause}){
  const memoryCache=new Map();
  const snapshot=j=>({id:j.id,kind:'subtitles',sourceId:j.sourceId,sourceName:j.sourceName,duration:j.duration,language:j.language,speechLanguage:j.speechLanguage||'',status:j.status,phase:j.phase,completedSeconds:j.completedSeconds,sectionsDone:j.records.length,sectionsTotal:j.sections.length,sectionsRemaining:j.sections.length-j.records.length,cueCount:j.records.reduce((n,r)=>n+r.translated.length,0),speechRequests:j.speechRequests,translationRequests:j.translationRequests,error:j.error||'',reviewed:j.reviewed,wordTimed:j.wordTimed,createdAt:j.createdAt,inFlight:j.inFlight,legacyReadOnly:j.legacyReadOnly===true});
  const queue=createJobQueue({store,kind:'subtitle_job',publicJob:snapshot,resumeOnBoot:true,execute:async(j,worker)=>{
    const source=claimSource(j.sourceId);
    try{for(let index=j.records.length;index<j.sections.length;index++){
      if(worker.shouldStop())break;const section=j.sections[index];j.phase='Preparing audio';j.inFlight=null;worker.checkpoint();
      const key=jobIdentity([j.sourceId,j.speechProvider,j.speechLanguage,j.keywords,index,...(j.requireTimedSubtitles?[j.preserveAudioTimeline?'timed-v3':'timed-v2']:[])]);let cached=store?.getRecord('speech_cache',key)||memoryCache.get(key);
      if(!cached){
        const audio=await extract(source.file,{start:section.audioStart,end:section.audioEnd,preserveTimeline:j.preserveAudioTimeline});j.phase='Transcribing source speech';j.speechRequests++;j.inFlight={provider:j.speechProvider,operation:'speech',section:index};worker.checkpoint();
        const speech=await withRetry(async()=>{const speech=await transcribe(Buffer.from(audio.data.split(',')[1],'base64'),j);if(speech.speechError)throw Error(speech.speechError);return speech},{wait});if(speech.transcript&&!speech.turns?.length&&!speech.words?.length)throw Error('Speech returned without timestamps. Retry this section or use another transcription engine.');
        const timed=speechCues(speech,section.audioEnd-section.audioStart);
        if(j.requireTimedSubtitles&&speech.transcript?.trim()&&!timed.length)throw Error('Speech was detected without usable subtitle timing. Retry this section or choose another speech engine.');
        cached={cues:placeSectionCues(timed,section),detectedLanguage:speech.detectedLanguage||''};if(store)store.putRecord('speech_cache',key,cached);else memoryCache.set(key,cached);j.inFlight=null;worker.checkpoint();
      }
      const original=cached.cues;
      const mixedSpeech=j.language!=='Original'&&j.translationProvider==='meta'&&languageBias(j.speechLanguage).length>1;
      const translateSection=mixedSpeech||needsTranslation(j.language,cached.detectedLanguage)||j.language!=='Original'&&Boolean(j.script==='roman'||j.variant&&j.variant.toLowerCase()!==String(cached.detectedLanguage||'').replaceAll('_','-').toLowerCase());
      j.wordTimed=j.wordTimed&&original.every(c=>c.words?.length);let translated=[];j.phase=translateSection?'Translating subtitle section':'Saving subtitle section';
      for(let at=0;at<original.length;at+=25){
        const part=original.slice(at,at+25);
        if(!translateSection)translated.push(...part.map(c=>({...c})));
        else{const translationKey=jobIdentity(['regional-v2',key,j.language,j.variant,j.script,j.translationProvider,j.dialectNote,j.translationMode,j.glossary,at,part]);let lines=store?.getRecord('subtitle_translation',translationKey)?.lines;
          if(!lines){j.translationRequests++;j.inFlight={provider:j.translationProvider,operation:'translation',section:index,part:at};worker.checkpoint();lines=await translateResilient(part.map((c,id)=>({id,text:c.text,...(c.speaker?{speaker:c.speaker}:{})})),batch=>translate(batch,{...j,speechLanguage:cached.detectedLanguage||j.speechLanguage},[...(index>0?(j.records[index-1]?.original||[]).slice(-8):[]),...original.slice(Math.max(0,at-8),at)]),{wait});if(store&&!lines.some(line=>line.untranslated))store.putRecord('subtitle_translation',translationKey,{lines});j.inFlight=null;worker.checkpoint()}
          if(j.requireTimedSubtitles&&lines.some(line=>line.untranslated)){
            throw Error(`Translation could not be verified in section ${index+1}. Retry to finish this section. Earlier subtitles are saved.`);
          }
          translated.push(...part.map((c,id)=>{const {words,...cue}=c;return {...cue,text:lines[id].text,...(lines[id].untranslated?{uncertain:true,untranslated:true,reviewReason:'Not translated: the translator failed on this line twice. Translate it by hand.'}:lines[id].uncertain?{uncertain:true,reviewReason:'The translator was not sure of this line.'}:{})}}));}
      }
      j.records.push({original,translated});j.completedSeconds=section.end;j.reviewed=false;worker.checkpoint();
    }
    if(j.requireTimedSubtitles&&j.records.length===j.sections.length&&!j.records.some(record=>record.translated.length)){
      throw Error('No timed speech was found in this recording. Choose another speech engine or check the original audio.');
    }
    return j.records.length===j.sections.length;}finally{source.release()}
  }});
  return {
    list:()=>queue.list(),get:id=>queue.get(id),counts:()=>queue.counts(),
    track(id,original=false){return queue.document(id).records.flatMap(r=>original?r.original:r.translated)},
    async start(body){
      validate(body);if(!Array.isArray(body.keywords||[]))throw Error('Keywords must be a list.');const keywords=(body.keywords||[]).slice(0,12).map(x=>String(x).slice(0,50));
      if(!subtitleLanguages.has(body.language))throw Error('Choose a supported subtitle language.');
      const source=claimSource(body.sourceId);source.release();
      const variant=findVariant(body.language,body.variant)?.id||'',script=body.script==='roman'&&romanizations[body.language]?'roman':'native';
      const options={sourceId:body.sourceId,language:body.language,variant,script,speechProvider:body.speechProvider==='voicestudio'?'voicestudio':'meta',translationProvider:body.translationProvider==='voicestudio'?'voicestudio':'meta',speechLanguage:String(body.speechLanguage||'').slice(0,50),keywords,dialectNote:String(body.dialectNote||'').slice(0,120),translationMode:['natural','concise'].includes(body.translationMode)?body.translationMode:'faithful',glossary:String(body.glossary||'').slice(0,1000)};
      return queue.add({...options,requireTimedSubtitles:true,preserveAudioTimeline:true,sourceName:source.title,duration:source.duration,sections:subtitleSections(source.duration),records:[],completedSeconds:0,speechRequests:0,translationRequests:0,wordTimed:true,reviewed:false},{idempotencyKey:jobIdentity(options)});
    },
    async command(id,action){if(action==='resume'&&queue.document(id).legacyReadOnly)throw Error('Create a new track with your language and provider settings; this recovered download is read-only.');return queue.command(id,action)},
    async handle(req,res,json){
      const route=new URL(req.url,'http://localhost').pathname;if(route!=='/api/subtitles'&&!route.startsWith('/api/subtitles/'))return false;
      try{
        if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)throw Error('Open subtitle actions from the local app.');
        if(route==='/api/subtitles'&&req.method==='GET'){json(res,200,{jobs:this.list(),counts:this.counts()});return true}
        let body={};if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>5000)throw Error('Subtitle request is too large.')}body=JSON.parse(raw)}
        if(route==='/api/subtitles'&&req.method==='POST'){json(res,202,await this.start(body));return true}
        const match=route.match(/^\/api\/subtitles\/([a-f0-9-]{36})(?:\/(track|srt|vtt))?$/);if(!match)throw Error('Subtitle job not found.');const id=match[1];
        if(req.method==='POST'&&!match[2]){json(res,200,await this.command(id,body.action));return true}
        if(req.method!=='GET')throw Error('Method not allowed.');const job=this.get(id);
        if(!match[2])json(res,200,job);
        else if(match[2]==='track')json(res,200,{...job,cues:this.track(id),original:this.track(id,true)});
        else{const query=new URL(req.url,'http://localhost').searchParams,original=query.get('original')==='1',mode=query.get('mode')==='accessible'?'accessible':'clean',draft=job.reviewed?'reviewed':'DRAFT',vtt=match[2]==='vtt',offset=Math.max(-10,Math.min(10,Number(query.get('offset'))||0)),srt=srtDocument(displayCues(syncedCues(this.track(id,original),offset,job.duration),{mode,preserveTiming:vtt}));res.writeHead(200,{'Content-Type':(vtt?'text/vtt':'text/plain')+'; charset=utf-8','Cache-Control':'no-store','Content-Disposition':`attachment; filename="context-desk-${id.slice(0,8)}-${original?'original':job.language}${mode==='accessible'?'-accessible':''}-${draft}.${match[2]}"`});res.end(vtt?'WEBVTT\n\n'+srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g,'$1.$2'):srt)}
      }catch(error){json(res,400,{error:error.message||'Whole-video subtitles failed.'})}return true;
    }
  };
}

// Older versions saved subtitle documents but not resumable provider options.
// Recover their downloads without guessing settings or making paid requests.
export async function recoverLegacySubtitles(store,directory){
  const fs=await import('node:fs/promises'),path=await import('node:path');
  for(const name of await fs.readdir(directory).catch(()=>[])){
    if(!/^[a-f0-9-]{36}\.json$/.test(name))continue;
    try{const old=JSON.parse(await fs.readFile(path.join(directory,name),'utf8')),j=old.job;
      if(!j?.id||store.getRecord('subtitle_job',j.id)||!Number.isFinite(j.duration)||j.duration<=0||j.duration>21600)continue;
      const sections=subtitleSections(j.duration),original=Array.isArray(old.original)?old.original:[],translated=Array.isArray(old.translated)?old.translated:[];
      const records=sections.slice(0,j.sectionsDone).map(s=>({original:original.filter(c=>c.start>=s.start&&c.start<s.end),translated:translated.filter(c=>c.start>=s.start&&c.start<s.end)}));
      store.putRecord('subtitle_job',j.id,{...j,kind:'subtitle_job',sections,records,createdAt:0,order:0,running:false,pause:false,cancel:false,inFlight:null,legacyReadOnly:true,status:j.status==='complete'?'complete':'interrupted',phase:'Recovered legacy draft',error:'Recovered from an earlier version. Provider options were not saved; downloads are retained. Create a new track to process more audio.',speechProvider:'unknown',translationProvider:'unknown',speechLanguage:'',dialectNote:'',keywords:[],translationMode:'faithful',glossary:''});
    }catch{ /* A damaged old document must not block other projects. */ }
  }
}
