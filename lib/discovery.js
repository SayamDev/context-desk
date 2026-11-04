import {needsTranslation} from '../public/languages.js';
import {createJobQueue,jobIdentity} from './jobs.js';
import {memoryContext} from './memory.js';
import {speechCues} from '../public/timing.js';
import {transcriptPlan,prepareTranscriptDiscovery,transcriptSnapshot,discoveryBudget} from './transcript-discovery.js';

// Clip-length presets size each sampled section: auto 45 s, under 30 s, 30-60 s, 60-90 s.
// Speech recognition takes up to 60 s per request: longer sections are sent in halves and merged in order.
export function mergeSpeech(parts){
  const ok=parts.filter(Boolean);if(ok.length<2)return ok[0];
  const turns=ok.flatMap(p=>(p.part.turns||[]).map(t=>({...t,startMs:t.startMs+p.offset*1000,endMs:t.endMs+p.offset*1000}))),words=ok.flatMap(p=>(p.part.words||[]).map(w=>({...w,start:w.start+p.offset,end:w.end+p.offset})));
  return {...ok[0].part,turns,words,transcript:ok.map(p=>p.part.transcript).filter(Boolean).join('\n').slice(0,8000),speechError:ok.map(p=>p.part.speechError).find(Boolean)};
}
export const clipLengthSeconds={auto:45,short:28,medium:55,long:88};
export function discoverySections(duration,depth=80,clipLength='auto'){const size=clipLengthSeconds[clipLength]||45,sections=[],step=Math.max(size,duration/depth);for(let start=0;start<duration-.2;start+=step)sections.push({start,end:Math.min(duration,start+size)});return sections}
export function spreadSections(length,count){if(length<=count)return Array.from({length},(_,i)=>i);return Array.from({length:count},(_,i)=>Math.round(i*(length-1)/Math.max(1,count-1)))}
export function createDiscoveryService({store,claimSource,frame,extract,transcribe,analyse,translate,rankStories,rankLocalStories,savedTranscript=()=>null,validate=()=>{}}){
  async function transcribeSection(file,s,options,count){
    const send=async range=>{const audio=await extract(file,range);count();return transcribe(Buffer.from(audio.data.split(',')[1],'base64'),options)};
    if(s.end-s.start<=60)return send(s);
    const half=(s.end-s.start)/2,parts=[];
    for(const start of [s.start,s.start+half])parts.push({offset:start-s.start,part:await send({start,end:Math.min(s.end,start+half)})});
    return mergeSpeech(parts);
  }
  const snapshot=j=>({id:j.id,kind:'discovery',strategy:j.strategy||'fast',local:j.options.local===true,...(j.strategy==='transcript'?transcriptSnapshot(j):{}),projectId:j.projectId,sourceId:j.sourceId,sourceName:j.sourceName,duration:j.duration,status:j.status,phase:j.phase,error:j.error||'',createdAt:j.createdAt,sectionsDone:j.strategy==='transcript'?(j.speechRecords||[]).length:j.samples.length,sectionsTotal:j.sections.length,sectionsRemaining:j.sections.length-(j.strategy==='transcript'?(j.speechRecords||[]).length:j.samples.length),checksDone:j.results.length,checksTotal:j.shortlist?.length??Math.min(j.budget,j.sections.length),suggested:j.results.filter(r=>r.suggested).length,speechRequests:j.speechRequests,storyRequests:j.storyRequests,translationRequests:j.translationRequests,language:j.options.language,inFlight:j.inFlight});
  const queue=createJobQueue({store,kind:'discovery_job',publicJob:snapshot,execute:async(j,worker)=>{
    if(j.options.local&&(!rankLocalStories||j.options.rankerVersion!==rankLocalStories.cacheVersion))throw Error('Restart discovery with the currently configured local model.');
    const source=claimSource(j.sourceId);
    try{
      const saved=j.options.transcriptId?savedTranscript(j.sourceId,j.options.transcriptId):null;
      if(j.options.transcriptId&&!saved)throw Error('The saved transcript is unavailable. Start a new local scan.');

      if(j.strategy==='transcript'){if(!await prepareTranscriptDiscovery(j,worker,{store,source,extract,transcribe,frame,rankStories:j.options.local?rankLocalStories:rankStories,savedCues:saved?.cues}))return false}
      else for(let index=j.samples.length;index<j.sections.length;index++){
        if(worker.shouldStop())return;const s=j.sections[index];j.phase=`Sampling picture ${index+1} of ${j.sections.length}`;worker.checkpoint();
        const times=[s.start+Math.min(.7,(s.end-s.start)*.1),(s.start+s.end)/2,Math.max(s.start,s.end-.3)],frames=[];
        for(const time of times){
          let picture;
          try{picture=await frame(source.file,time)}
          catch(error){
            // Platform durations are rounded and can extend past the last video frame.
            const earlier=Math.max(s.start,time-1);
            if(index!==j.sections.length-1||time!==times.at(-1)||earlier===time)throw error;
            picture=await frame(source.file,earlier);
          }
          frames.push(store.putAsset(picture,'image/jpeg').url);
        }
        j.samples.push({...s,frames});worker.checkpoint();
      }
      j.shortlist??=spreadSections(j.samples.length,Math.min(j.budget,j.samples.length));worker.checkpoint();
      for(let at=j.results.length;at<j.shortlist.length;at++){
        if(worker.shouldStop())return;const index=j.shortlist[at],s=j.samples[index],options=j.options;
        j.phase=`Checking story ${at+1} of ${j.shortlist.length}`;worker.checkpoint();
        const speechKey=s.speechKey||jobIdentity(['discovery-speech-v1',j.sourceId,s.start,s.end,options.speechProvider,options.speechLanguage,options.keywords]);let speech=s.speech||store.getRecord('discovery_speech',speechKey);
        if(!speech){j.inFlight={operation:'speech',section:index,provider:options.speechProvider};worker.checkpoint();speech=await transcribeSection(source.file,s,options,()=>{j.speechRequests++});if(speech.speechError)throw Error(speech.speechError);store.putRecord('discovery_speech',speechKey,speech);j.inFlight=null;worker.checkpoint()}
        const reasoningKey=jobIdentity([speechKey,s.frames,options.context,options.dialectNote,options.storyLens]);let analysis=options.local?{
          worthClipping:true,beatType:'Dialogue',reason:s.reason,hook:'',evidence:s.evidence.map(c=>c.quote).join(' / '),
          setup:s.evidence[0].quote,turn:s.evidence[1].quote,payoff:s.evidence[2].quote,
          riskNote:'Dialogue only. Verify the audio, subtitles and reactions before sharing.'
        }:store.getRecord('discovery_analysis',reasoningKey);
        if(worker.shouldStop())return false;
        if(!analysis){const frames=[];for(const url of s.frames){const asset=store.assetPath(url.split('/').at(-1));const {readFile}=await import('node:fs/promises');frames.push('data:image/jpeg;base64,'+(await readFile(asset.file)).toString('base64'))}if(worker.shouldStop())return false;j.storyRequests++;j.inFlight={operation:'story',section:index,provider:'meta'};worker.checkpoint();analysis=await analyse(frames,speech.transcript,options.context+(j.strategy==='transcript'?'\nSource-grounded story candidate: '+JSON.stringify({start:s.start,end:s.end,evidence:s.evidence,reason:s.reason})+'\nJudge only the supplied source speech and pictures; reject unsupported claims.':''),options.dialectNote,'',options.storyLens);store.putRecord('discovery_analysis',reasoningKey,analysis);j.inFlight=null;worker.checkpoint()}
        if(j.strategy==='transcript')analysis={...analysis,worthClipping:analysis.worthClipping===true&&s.evidence.length>0,sourceEvidence:s.evidence,rankingReason:s.reason,rankingScore:s.score,contextEnvelope:{start:s.start,end:s.end,anchorStart:s.anchorStart,anchorEnd:s.anchorEnd},sourceContext:s.contextEvidence,editorialReviewRequired:true};
        if(worker.shouldStop())return false;
        const captions={Original:speechCues(speech,s.end-s.start)};let language='Original',translationError='';
        try{if(analysis.worthClipping===true&&needsTranslation(options.language,speech.detectedLanguage)&&captions.Original.length){const key=jobIdentity([speechKey,options.language,options.translationProvider,options.dialectNote,options.translationMode,options.glossary]);let cues=store.getRecord('discovery_translation',key)?.cues;
          if(!cues){cues=[];for(let p=0;p<captions.Original.length;p+=25){
            if(worker.shouldStop())return false;const part=captions.Original.slice(p,p+25),partKey=jobIdentity([key,p,part]);let lines=store.getRecord('discovery_translation_part',partKey)?.lines;
            if(!lines){j.translationRequests++;j.inFlight={operation:'translation',section:index,part:p,provider:options.translationProvider};worker.checkpoint();lines=await translate(part.map((c,id)=>({id,text:c.text})),{...options,speechLanguage:speech.detectedLanguage||options.speechLanguage});if(lines.length!==part.length||lines.some((c,id)=>c.id!==id||!c.text?.trim()))throw Error('The translated subtitle order could not be verified.');store.putRecord('discovery_translation_part',partKey,{lines})}
            j.inFlight=null;worker.checkpoint();cues.push(...part.map((c,id)=>{const {words,...timed}=c;return {...timed,text:lines[id].text}}))
          }store.putRecord('discovery_translation',key,{cues});j.inFlight=null;worker.checkpoint()}
          captions[options.language]=cues;language=options.language;
        }else if(analysis.worthClipping===true&&options.language!=='Original'&&captions.Original.length){
          captions[options.language]=captions.Original;
          language=options.language;
        }}catch(error){
          if(!options.local)throw error;
          language=options.language;translationError='Local translation unavailable. Original captions are saved. '+error.message;
          j.inFlight=null;
        }
        const id=j.id+'-'+index,moment={id,...(j.strategy==='transcript'?{discoveryStrategy:options.local?'local':'transcript'}:{}),url:'/api/import/'+j.sourceId+'/media',blob:{importId:j.sourceId,size:source.size,type:source.mime||'video/mp4',name:source.title},frames:s.frames,start:s.start,end:s.end,mediaStart:s.start,batchId:j.id,sourceName:source.title,sourceType:'file',sourceLink:source.sourceUrl||'',status:analysis.worthClipping?'suggested':'not-selected',analysis,transcript:speech.transcript||'',speechSource:speech.speechSource||'',speechError:speech.speechError||'',detectedLanguage:speech.detectedLanguage||'',timingSource:speech.words?.length?'word':'estimated',trimIn:0,trimOut:s.end-s.start,hook:analysis.hook||'',alternateHook:analysis.alternateHook||'',frameMode:'fit',zoom:1,focusX:50,focusY:50,showHook:false,captionLanguage:language,autoCaptionLanguage:options.language,translationMode:options.translationMode,captionStyle:'punch',dialectNote:options.dialectNote,captionCues:captions,captionReviewed:{},showCaptions:Boolean(captions[language]?.length),...(translationError?{translationError}:{}),captionOffset:0,sourceCaptionsVisible:analysis.visibleSourceCaptions===true,sourceCaptionMask:false,createdAt:Date.now()};
        // Commit the result before its completion counter. Replaying this local
        // write after a crash is safe; paid requests above reuse durable caches.
        store.putMoment(j.projectId,moment);j.results.push({id,index,suggested:analysis.worthClipping===true});worker.checkpoint();
      }
    }finally{source.release()}
  }});
  return {list:()=>queue.list(),get:id=>queue.get(id),counts:()=>queue.counts(),command:(id,action)=>queue.command(id,action),
    transcript:id=>{const j=queue.document(id);return (j.speechRecords||[]).flatMap(r=>r.cues)},
    preview(body){const source=claimSource(body.sourceId);try{
      if(body.strategy==='local'){
        const plan=transcriptPlan(source.duration,body,Boolean(rankLocalStories),rankLocalStories?.batchSections);
        const reused=Boolean(savedTranscript(body.sourceId));
        return {...plan.preview,strategy:'local',storyRequestsMax:0,reusedTranscript:reused,
          ...(reused?{speechRequestsMax:0,speechAudioSecondsMax:0}:{}),pricing:'Runs on this computer. No Meta requests.'};
      }
      if(body.strategy==='transcript')return transcriptPlan(source.duration,body,Boolean(rankStories)).preview;
      if(body.strategy!==undefined&&body.strategy!=='fast')throw Error('Choose fast or transcript discovery.');
      const depth=[80,240,900].includes(Number(body.depth))?Number(body.depth):80,sections=discoverySections(source.duration,depth,body.clipLength),count=Math.min(discoveryBudget(body.budget),sections.length),selected=spreadSections(sections.length,count).map(index=>sections[index]);
      return {strategy:'fast',sourceSeconds:source.duration,speechSections:count,speechRequestsMax:count,speechAudioSecondsMax:selected.reduce((n,s)=>n+s.end-s.start,0),rankingRequestsMax:0,storyRequestsMax:count,translationRequestsMax:null,fullSource:false,pricing:'Request bounds only; provider prices and transcript-dependent translation costs are not estimated. Cached requests may reduce usage.'};
    }finally{source.release()}} ,
    start(body){const local=body.strategy==='local';if(local&&!rankLocalStories)throw Error('Configure an installed Ollama model for local discovery.');if(!local)validate(body);const source=claimSource(body.sourceId);source.release();const project=store.getProject(body.projectId||body.sourceId);if(project.sourceId!==body.sourceId)throw Error('Choose the project that owns this recording.');
      const reuse=local?savedTranscript(body.sourceId):null;
      const options={...(local?{local:true,rankerVersion:rankLocalStories.cacheVersion,transcriptId:reuse?.id||null}:{}),speechProvider:local||body.speechProvider==='voicestudio'?'voicestudio':'meta',translationProvider:local||body.translationProvider==='voicestudio'?'voicestudio':'meta',speechLanguage:String(body.speechLanguage||reuse?.speechLanguage||'').slice(0,50),keywords:String(body.keywords||'').split(',').map(s=>s.trim().slice(0,50)).filter(Boolean).slice(0,12),dialectNote:String(body.dialectNote||'').slice(0,120),context:(String(body.context||'').slice(0,1000)+'\n'+memoryContext(body.memoryId?store.getRecord('story_memory',String(body.memoryId)):null)).slice(0,7000),translationMode:['natural','concise'].includes(body.translationMode)?body.translationMode:'faithful',glossary:String(body.glossary||'').slice(0,1000),storyLens:['reality','streamer','interview'].includes(body.storyLens)?body.storyLens:'auto',language:['English','Arabic','French','Spanish','Hindi','Portuguese','German','Turkish','Urdu'].includes(body.language)?body.language:'Original'};
      if(body.strategy!==undefined&&!['fast','transcript','local'].includes(body.strategy))throw Error('Choose fast or transcript discovery.');
      const ranker=local?rankLocalStories:rankStories,strategy=local||body.strategy==='transcript'?'transcript':'fast',plan=strategy==='transcript'?transcriptPlan(source.duration,body,Boolean(ranker),ranker?.batchSections):null;
      if(local)Object.assign(plan.preview,{strategy:'local',storyRequestsMax:0,reusedTranscript:Boolean(reuse),...(reuse?{speechRequestsMax:0,speechAudioSecondsMax:0}:{}),pricing:'Runs on this computer. No Meta requests.'});
      const depth=[80,240,900].includes(Number(body.depth))?Number(body.depth):80,budget=discoveryBudget(body.budget),identity=jobIdentity([body.sourceId,options,depth,budget,...(plan?[strategy,plan,ranker?.cacheVersion||Boolean(ranker)]:[])]);
      return queue.add({strategy,...(plan?{transcriptPlan:plan,speechRecords:[],rankingRecords:[],rankingRequests:0,speechCacheHits:0,rankingMethod:local?'local-ollama':ranker?'provider-with-source-citations':'transcript-heuristic'}:{}),projectId:project.id,sourceId:body.sourceId,sourceName:source.title,duration:source.duration,options,depth,budget,sections:plan?plan.sections:discoverySections(source.duration,depth),samples:[],results:[],speechRequests:0,storyRequests:0,translationRequests:0},{idempotencyKey:identity});
    }};
}
