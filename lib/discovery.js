import {randomUUID} from 'node:crypto';
import {createJobQueue,jobIdentity} from './jobs.js';
import {memoryContext} from './memory.js';
import {speechCues} from '../public/timing.js';

export function discoverySections(duration,depth=80){const sections=[],step=Math.max(45,duration/depth);for(let start=0;start<duration-.2;start+=step)sections.push({start,end:Math.min(duration,start+45)});return sections}
export function spreadSections(length,count){if(length<=count)return Array.from({length},(_,i)=>i);return Array.from({length:count},(_,i)=>Math.round(i*(length-1)/Math.max(1,count-1)))}
export function createDiscoveryService({store,claimSource,frame,extract,transcribe,analyse,translate,validate=()=>{}}){
  const snapshot=j=>({id:j.id,kind:'discovery',projectId:j.projectId,sourceId:j.sourceId,sourceName:j.sourceName,duration:j.duration,status:j.status,phase:j.phase,error:j.error||'',createdAt:j.createdAt,sectionsDone:j.samples.length,sectionsTotal:j.sections.length,sectionsRemaining:j.sections.length-j.samples.length,checksDone:j.results.length,checksTotal:j.shortlist?.length||Math.min(j.budget,j.sections.length),suggested:j.results.filter(r=>r.suggested).length,speechRequests:j.speechRequests,storyRequests:j.storyRequests,translationRequests:j.translationRequests,language:j.options.language,inFlight:j.inFlight});
  const queue=createJobQueue({store,kind:'discovery_job',publicJob:snapshot,execute:async(j,worker)=>{
    const source=claimSource(j.sourceId);
    try{
      for(let index=j.samples.length;index<j.sections.length;index++){
        if(worker.shouldStop())return;const s=j.sections[index];j.phase=`Sampling picture ${index+1} of ${j.sections.length}`;worker.checkpoint();
        const times=[s.start+Math.min(.7,(s.end-s.start)*.1),(s.start+s.end)/2,Math.max(s.start,s.end-.3)],frames=[];
        for(const time of times)frames.push(store.putAsset(await frame(source.file,time),'image/jpeg').url);
        j.samples.push({...s,frames});worker.checkpoint();
      }
      j.shortlist??=spreadSections(j.samples.length,Math.min(j.budget,j.samples.length));worker.checkpoint();
      for(let at=j.results.length;at<j.shortlist.length;at++){
        if(worker.shouldStop())return;const index=j.shortlist[at],s=j.samples[index],options=j.options;
        j.phase=`Checking story ${at+1} of ${j.shortlist.length}`;worker.checkpoint();
        const speechKey=jobIdentity(['discovery-speech-v1',j.sourceId,s.start,s.end,options.speechProvider,options.speechLanguage,options.keywords]);let speech=store.getRecord('discovery_speech',speechKey);
        if(!speech){const audio=await extract(source.file,s);j.speechRequests++;j.inFlight={operation:'speech',section:index,provider:options.speechProvider};worker.checkpoint();speech=await transcribe(Buffer.from(audio.data.split(',')[1],'base64'),options);if(speech.speechError)throw Error(speech.speechError);store.putRecord('discovery_speech',speechKey,speech);j.inFlight=null;worker.checkpoint()}
        const reasoningKey=jobIdentity([speechKey,s.frames,options.context,options.dialectNote,options.storyLens]);let analysis=store.getRecord('discovery_analysis',reasoningKey);
        if(!analysis){const frames=[];for(const url of s.frames){const asset=store.assetPath(url.split('/').at(-1));const {readFile}=await import('node:fs/promises');frames.push('data:image/jpeg;base64,'+(await readFile(asset.file)).toString('base64'))}j.storyRequests++;j.inFlight={operation:'story',section:index,provider:'meta'};worker.checkpoint();analysis=await analyse(frames,speech.transcript,options.context,options.dialectNote,'',options.storyLens);store.putRecord('discovery_analysis',reasoningKey,analysis);j.inFlight=null;worker.checkpoint()}
        const captions={Original:speechCues(speech,s.end-s.start)};let language='Original';
        if(options.language!=='Original'&&captions.Original.length){const key=jobIdentity([speechKey,options.language,options.translationProvider,options.dialectNote,options.translationMode,options.glossary]);let cues=store.getRecord('discovery_translation',key)?.cues;
          if(!cues){cues=[];for(let p=0;p<captions.Original.length;p+=25){const part=captions.Original.slice(p,p+25);j.translationRequests++;j.inFlight={operation:'translation',section:index,provider:options.translationProvider};worker.checkpoint();const lines=await translate(part.map((c,id)=>({id,text:c.text})),options);if(lines.length!==part.length||lines.some((c,id)=>c.id!==id||!c.text?.trim()))throw Error('The translated subtitle order could not be verified.');cues.push(...part.map((c,id)=>{const {words,...timed}=c;return {...timed,text:lines[id].text}}))}store.putRecord('discovery_translation',key,{cues});j.inFlight=null;worker.checkpoint()}
          captions[options.language]=cues;language=options.language;
        }
        const id=j.id+'-'+index,moment={id,url:'/api/import/'+j.sourceId+'/media',blob:{importId:j.sourceId,size:source.size,type:source.mime||'video/mp4',name:source.title},frames:s.frames,start:s.start,end:s.end,mediaStart:s.start,batchId:j.id,sourceName:source.title,sourceType:'file',sourceLink:source.sourceUrl||'',status:analysis.worthClipping?'suggested':'not-selected',analysis,transcript:speech.transcript||'',speechSource:speech.speechSource||'',speechError:speech.speechError||'',detectedLanguage:speech.detectedLanguage||'',timingSource:speech.words?.length?'word':'estimated',trimIn:0,trimOut:s.end-s.start,hook:analysis.hook||'',alternateHook:analysis.alternateHook||'',frameMode:'fit',zoom:1,focusX:50,focusY:50,showHook:false,captionLanguage:language,autoCaptionLanguage:options.language,translationMode:options.translationMode,captionStyle:'punch',dialectNote:options.dialectNote,captionCues:captions,captionReviewed:{},showCaptions:captions[language].length>0,captionOffset:0,sourceCaptionsVisible:analysis.visibleSourceCaptions===true,sourceCaptionMask:false,createdAt:Date.now()};
        // Commit the result before its completion counter. Replaying this local
        // write after a crash is safe; paid requests above reuse durable caches.
        store.putMoment(j.projectId,moment);j.results.push({id,index,suggested:analysis.worthClipping===true});worker.checkpoint();
      }
    }finally{source.release()}
  }});
  return {list:()=>queue.list(),get:id=>queue.get(id),counts:()=>queue.counts(),command:(id,action)=>queue.command(id,action),
    start(body){validate(body);const source=claimSource(body.sourceId);source.release();const project=store.getProject(body.projectId||body.sourceId);if(project.sourceId!==body.sourceId)throw Error('Choose the project that owns this recording.');
      const options={speechProvider:body.speechProvider==='voicestudio'?'voicestudio':'meta',translationProvider:body.translationProvider==='voicestudio'?'voicestudio':'meta',speechLanguage:String(body.speechLanguage||'').slice(0,50),keywords:String(body.keywords||'').split(',').map(s=>s.trim().slice(0,50)).filter(Boolean).slice(0,12),dialectNote:String(body.dialectNote||'').slice(0,120),context:(String(body.context||'').slice(0,1000)+'\n'+memoryContext(body.memoryId?store.getRecord('story_memory',String(body.memoryId)):null)).slice(0,7000),translationMode:['natural','concise'].includes(body.translationMode)?body.translationMode:'faithful',glossary:String(body.glossary||'').slice(0,1000),storyLens:['reality','streamer','interview'].includes(body.storyLens)?body.storyLens:'auto',language:['English','Arabic','French','Spanish','Hindi','Portuguese','German','Turkish','Urdu'].includes(body.language)?body.language:'Original'};
      const depth=[80,240,900].includes(Number(body.depth))?Number(body.depth):80,budget=Math.max(1,Math.min(100,Number(body.budget)||15)),identity=jobIdentity([body.sourceId,options,depth,budget]);
      return queue.add({projectId:project.id,sourceId:body.sourceId,sourceName:source.title,duration:source.duration,options,depth,budget,sections:discoverySections(source.duration,depth),samples:[],results:[],speechRequests:0,storyRequests:0,translationRequests:0},{idempotencyKey:identity});
    }};
}
