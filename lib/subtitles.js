import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {speechCues,srtDocument} from '../public/timing.js';

export const subtitleLanguages=new Set(['Original','English','Arabic','French','Spanish','Hindi','Portuguese','German','Turkish','Urdu']);
export function subtitleSections(duration){const sections=[];for(let start=0;start<duration;start+=45)sections.push({start,end:Math.min(duration,start+45),audioStart:Math.max(0,start-.8),audioEnd:Math.min(duration,start+45.8)});return sections}
export function placeSectionCues(cues,section){return cues.map(c=>({...c,start:Math.max(section.start,c.start+section.audioStart),end:Math.min(section.end,c.end+section.audioStart),words:c.words?.map(w=>({...w,start:w.start+section.audioStart,end:w.end+section.audioStart})),boundaryReview:c.start+section.audioStart<section.start+.8||c.end+section.audioStart>section.end-.8})).filter(c=>c.end-c.start>=.1)}

export function createSubtitleService({claimSource,extract,transcribe,translate,checkpointDir,validate=()=>{}}){
  const jobs=new Map(),speechCache=new Map();let active=null;
  const snapshot=j=>({id:j.id,sourceId:j.sourceId,sourceName:j.sourceName,duration:j.duration,language:j.language,status:j.status,phase:j.phase,completedSeconds:j.completedSeconds,sectionsDone:j.records.length,sectionsTotal:j.sections.length,cueCount:j.records.reduce((n,r)=>n+r.translated.length,0),speechRequests:j.speechRequests,translationRequests:j.translationRequests,error:j.error||'',reviewed:j.reviewed,wordTimed:j.wordTimed});
  const save=async j=>{if(!checkpointDir)return;await fs.mkdir(checkpointDir,{recursive:true});const target=path.join(checkpointDir,j.id+'.json');await fs.writeFile(target+'.tmp',JSON.stringify({job:snapshot(j),original:j.records.flatMap(r=>r.original),translated:j.records.flatMap(r=>r.translated)}));await fs.rename(target+'.tmp',target)};
  async function run(j){
    if(active||j.running)return;active=j.id;j.running=true;j.pause=false;j.status='running';j.error='';let source;
    try{
      source=claimSource(j.sourceId);
      for(let index=j.records.length;index<j.sections.length;index++){
        if(j.pause)break;const section=j.sections[index];j.phase='Preparing audio';
        const key=JSON.stringify([j.sourceId,j.speechProvider,j.speechLanguage,j.keywords,index]);let original=speechCache.get(key);
        if(!original){
          const audio=await extract(source.file,{start:section.audioStart,end:section.audioEnd});j.phase='Transcribing source speech';j.speechRequests++;
          const speech=await transcribe(Buffer.from(audio.data.split(',')[1],'base64'),j);
          if(speech.speechError)throw Error(speech.speechError);if(speech.transcript&&!speech.turns?.length&&!speech.words?.length)throw Error('Speech returned without timestamps. Retry this section or use another transcription engine.');
          j.wordTimed=j.wordTimed&&Boolean(speech.words?.length);
          original=placeSectionCues(speechCues(speech,section.audioEnd-section.audioStart),section);speechCache.set(key,original);
        }
        j.wordTimed=j.wordTimed&&original.every(c=>c.words?.length);let translated=[];j.phase=j.language==='Original'?'Saving subtitle section':'Translating subtitle section';
        for(let at=0;at<original.length;at+=25){
          const part=original.slice(at,at+25);
          if(j.language==='Original')translated.push(...part.map(c=>({...c})));
          else{j.translationRequests++;const lines=await translate(part.map((c,id)=>({id,text:c.text})),j);if(lines.length!==part.length||lines.some((line,id)=>line.id!==id||!line.text?.trim()))throw Error('Translated line order could not be verified. Retry this section.');translated.push(...part.map((c,id)=>{const {words,...cue}=c;return {...cue,text:lines[id].text}}))}
        }
        j.records.push({original,translated});j.completedSeconds=section.end;j.reviewed=false;await save(j);
      }
      j.status=j.records.length===j.sections.length?'complete':'paused';j.phase=j.status==='complete'?'Draft subtitles ready':'Paused after completed section';
    }catch(error){j.status='error';j.error=error.message||'Subtitle processing stopped.';j.phase='Stopped · completed sections kept'}
    finally{source?.release();j.running=false;active=null;await save(j).catch(error=>{j.error+=' Checkpoint could not be saved: '+error.message});}
  }
  return {
    list:()=>[...jobs.values()].map(snapshot),
    get(id){const j=jobs.get(id);if(!j)throw Error('This subtitle job is unavailable.');return snapshot(j)},
    track(id,original=false){const j=jobs.get(id);if(!j)throw Error('This subtitle job is unavailable.');return j.records.flatMap(r=>original?r.original:r.translated)},
    async start(body){
      validate(body);if(!Array.isArray(body.keywords||[]))throw Error('Keywords must be a list.');body.keywords=(body.keywords||[]).slice(0,12).map(x=>String(x).slice(0,50));
      if(active)throw Error('Pause the current whole-video subtitle job before starting another.');
      if(!subtitleLanguages.has(body.language))throw Error('Choose a supported subtitle language.');
      const existing=[...jobs.values()].find(j=>j.sourceId===body.sourceId&&j.language===body.language&&j.speechProvider===body.speechProvider&&j.translationProvider===body.translationProvider&&j.speechLanguage===String(body.speechLanguage||'')&&j.dialectNote===String(body.dialectNote||'').slice(0,120)&&JSON.stringify(j.keywords)===JSON.stringify(body.keywords||[]));
      if(existing)return snapshot(existing);
      const source=claimSource(body.sourceId);source.release();
      if(jobs.size>=6){const old=[...jobs.values()].find(j=>!j.running);jobs.delete(old.id);if(checkpointDir)await fs.rm(path.join(checkpointDir,old.id+'.json'),{force:true}).catch(()=>{});if(![...jobs.values()].some(j=>j.sourceId===old.sourceId))for(const key of speechCache.keys())if(JSON.parse(key)[0]===old.sourceId)speechCache.delete(key)}
      const j={id:randomUUID(),sourceId:body.sourceId,sourceName:source.title,duration:source.duration,language:body.language,speechProvider:body.speechProvider,translationProvider:body.translationProvider,speechLanguage:String(body.speechLanguage||''),keywords:(body.keywords||[]).slice(0,12),dialectNote:String(body.dialectNote||'').slice(0,120),sections:subtitleSections(source.duration),records:[],completedSeconds:0,speechRequests:0,translationRequests:0,wordTimed:true,status:'queued',phase:'Preparing subtitles',reviewed:false};jobs.set(j.id,j);void run(j);return snapshot(j);
    },
    async command(id,action){const j=jobs.get(id);if(!j)throw Error('This subtitle job is unavailable.');if(action==='pause'){j.pause=true;if(j.running)j.phase='Pausing after the current section'}else if(action==='resume'){if(active&&active!==id)throw Error('Another subtitle job is running.');if(!j.running&&j.status!=='complete')void run(j)}else if(action==='review'){if(j.status!=='complete')throw Error('Finish all sections before confirming this subtitle track.');j.reviewed=true;await save(j)}else throw Error('Unknown subtitle action.');return snapshot(j)},
    async handle(req,res,json){
      const route=new URL(req.url,'http://localhost').pathname;if(route!=='/api/subtitles'&&!route.startsWith('/api/subtitles/'))return false;
      try{
        if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)throw Error('Open subtitle actions from the local app.');
        if(route==='/api/subtitles'&&req.method==='GET'){json(res,200,{jobs:this.list()});return true}
        let body={};if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>5000)throw Error('Subtitle request is too large.')}body=JSON.parse(raw)}
        if(route==='/api/subtitles'&&req.method==='POST'){json(res,202,await this.start(body));return true}
        const match=route.match(/^\/api\/subtitles\/([a-f0-9-]{36})(?:\/(track|srt))?$/);if(!match)throw Error('Subtitle job not found.');const id=match[1];
        if(req.method==='POST'&&!match[2]){json(res,200,await this.command(id,body.action));return true}
        if(req.method!=='GET')throw Error('Method not allowed.');const job=this.get(id);
        if(!match[2])json(res,200,job);
        else if(match[2]==='track')json(res,200,{...job,cues:this.track(id),original:this.track(id,true)});
        else{const original=new URL(req.url,'http://localhost').searchParams.get('original')==='1',draft=job.reviewed?'reviewed':'DRAFT';res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Content-Disposition':`attachment; filename="context-desk-${id.slice(0,8)}-${original?'original':job.language}-${draft}.srt"`});res.end(srtDocument(this.track(id,original)))}
      }catch(error){json(res,400,{error:error.message||'Whole-video subtitles failed.'})}return true;
    }
  };
}
