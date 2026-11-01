import {jobIdentity} from './jobs.js';
import {subtitleSections,placeSectionCues} from './subtitles.js';
import {speechCues} from '../public/timing.js';

const finite=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
const normal=text=>String(text||'').normalize('NFKC').replace(/\s+/g,' ').trim();
const BATCH_SECTIONS=12;
export function discoveryBudget(value){const parsed=Number(value);return Math.trunc(Math.max(1,Math.min(100,Number.isFinite(parsed)&&parsed?parsed:15)))}
export function transcriptPlan(duration,body={},hasRanker=false){
  if(!Number.isFinite(duration)||duration<=0||duration>21600)throw Error('Choose a recording up to six hours long.');
  const all=subtitleSections(duration),limit=body.speechSectionLimit===undefined?all.length:Number(body.speechSectionLimit);
  if(!Number.isInteger(limit)||limit<1||limit>480)throw Error('Speech section limit must be an integer from 1 to 480.');
  const sections=all.slice(0,limit),scanSeconds=sections.at(-1).end;
  const minSeconds=finite(body.clipMinSeconds,15,10,45),maxSeconds=finite(body.clipMaxSeconds,90,30,120);
  if(maxSeconds<minSeconds)throw Error('Maximum clip duration must be at least the minimum.');
  const budget=discoveryBudget(body.budget);
  return {sections,scanSeconds,fullSource:sections.length===all.length,minSeconds,maxSeconds,contextSeconds:finite(body.contextSeconds,6,0,15),preview:{strategy:'transcript',sourceSeconds:duration,scanSeconds,fullSource:sections.length===all.length,speechSections:sections.length,speechRequestsMax:sections.length,speechAudioSecondsMax:sections.reduce((n,s)=>n+s.audioEnd-s.audioStart,0),rankingRequestsMax:hasRanker?Math.ceil(sections.length/BATCH_SECTIONS):0,storyRequestsMax:budget,translationRequestsMax:null,pricing:'Request bounds only; provider prices and transcript-dependent translation costs are not estimated. Cached requests may reduce usage.'}};
}

// Ranking is editorial evidence, never a claim of engagement or virality.
// Every accepted proposal must quote actual timed speech inside its source range.
export function validateStoryCandidates(proposals,cues,{duration,minSeconds=15,maxSeconds=90,contextSeconds=6}){
  const byId=new Map(cues.map(c=>[c.id,c])),candidates=[],rejected=[];
  for(const proposal of (Array.isArray(proposals)?proposals:[]).slice(0,200)){
    const start=Number(proposal.start),end=Number(proposal.end);let reason='';
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>duration||end-start>maxSeconds)reason='Invalid or overlong source range.';
    const evidence=[];
    for(const citation of (Array.isArray(proposal.evidence)?proposal.evidence:[]).slice(0,30)){
      const cue=byId.get(citation.cueId),quote=normal(citation.quote);
      if(!cue||cue.uncertain||quote.length<3||!normal(cue.text).includes(quote)||cue.start<start-.05||cue.end>end+.05){reason='Evidence does not match certain speech within the proposed source range.';break}
      evidence.push({cueId:cue.id,quote,start:cue.start,end:cue.end});
    }
    if(!evidence.length)reason='No verifiable source speech was cited.';
    if(reason){rejected.push({start:Number.isFinite(start)?start:null,end:Number.isFinite(end)?end:null,reason});continue}
    // Pad the requested range, then keep whole neighboring utterances whenever
    // they fit. Clip length limits still apply, with context surfaced for review.
    let clipStart=Math.max(0,start-contextSeconds),clipEnd=Math.min(duration,end+contextSeconds);
    const nearby=cues.filter(c=>c.end>clipStart&&c.start<clipEnd);
    if(nearby.length){clipStart=Math.min(clipStart,nearby[0].start);clipEnd=Math.max(clipEnd,nearby.at(-1).end)}
    if(clipEnd-clipStart>maxSeconds){clipStart=start;clipEnd=end}
    if(clipEnd-clipStart<minSeconds){const missing=minSeconds-(clipEnd-clipStart);clipStart=Math.max(0,clipStart-missing/2);clipEnd=Math.min(duration,clipStart+minSeconds);clipStart=Math.max(0,clipEnd-minSeconds)}
    if(clipEnd-clipStart<minSeconds||clipEnd-clipStart>maxSeconds){rejected.push({start,end,reason:'Supported speech cannot fit the selected duration bounds.'});continue}
    const contextEvidence=cues.filter(c=>c.end<=start).slice(-2).concat(cues.filter(c=>c.start>=end).slice(0,2)).map(c=>({cueId:c.id,start:c.start,end:c.end,text:c.text,uncertain:c.uncertain===true}));
    candidates.push({start:clipStart,end:clipEnd,contextEvidence,anchorStart:start,anchorEnd:end,score:finite(proposal.score,0,0,100),reason:String(proposal.reason||'Source speech retained for editorial review.').slice(0,500),evidence,contextBefore:start-clipStart,contextAfter:clipEnd-end});
  }
  return {candidates,rejected};
}
export function transcriptCandidates(cues,{maxSeconds=90}={}){
  const proposals=[];
  for(let i=0;i<cues.length;i++){
    const anchor=cues[i];if(anchor.uncertain)continue;
    const passage=cues.slice(i).filter(c=>c.start<anchor.start+Math.min(45,maxSeconds-12)&&c.end-anchor.start<=maxSeconds-12).slice(0,16);
    const text=passage.map(c=>c.text).join(' '),words=text.split(/\s+/).length;
    if(passage.length<2||words<6)continue;
    const question=/[?؟]/.test(text),resolution=/\b(because|finally|realised|realized|decided|answer|instead|but|however|result|learned|why|how|changed)\b|لأن|لكن|قررت|لماذا|pourquoi|parce que|mais|porque|pero/iu.test(text);
    proposals.push({start:anchor.start,end:passage.at(-1).end,score:Math.min(99,Math.min(words,40)+Number(question)*25+Number(resolution)*25),reason:[question?'Question or exchange':'Speech passage',resolution?'with an explicit explanation or change':'with neighboring source context'].join(' ')+'. Heuristic ranking; source review required.',evidence:passage.filter(c=>!c.uncertain).slice(0,12).map(c=>({cueId:c.id,quote:c.text}))});
  }
  return proposals;
}
export function chooseStoryCandidates(candidates,budget){
  const chosen=[];
  for(const candidate of [...candidates].sort((a,b)=>b.score-a.score||a.start-b.start)){
    if(chosen.some(other=>Math.max(0,Math.min(candidate.end,other.end)-Math.max(candidate.start,other.start))/Math.min(candidate.end-candidate.start,other.end-other.start)>.8))continue;
    chosen.push(candidate);if(chosen.length>=budget)break;
  }
  return chosen;
}
function momentSpeech(cues,s){
  const selected=cues.filter(c=>c.end>s.start&&c.start<s.end),words=selected.flatMap(c=>c.words||[]).filter(w=>w.end>s.start&&w.start<s.end).map(w=>({...w,start:Math.max(0,w.start-s.start),end:Math.min(s.end-s.start,w.end-s.start)}));
  return {transcript:selected.map(c=>c.text).join(' '),turns:selected.map(c=>({startMs:Math.max(0,c.start-s.start)*1000,endMs:Math.min(s.end-s.start,c.end-s.start)*1000,text:c.text})),...(words.length?{words}:{}),speechSource:'Checkpointed source-audio transcript',detectedLanguage:''};
}
export function sourceSectionCues(speech,section){
  if(speech.words?.length){
    // Padded audio improves recognition across seams; midpoint ownership keeps
    // the same native word from entering both adjacent transcript sections.
    const words=speech.words.map(w=>({...w,start:w.start+section.audioStart,end:w.end+section.audioStart})).filter(w=>Number.isFinite(w.start)&&Number.isFinite(w.end)&&(w.start+w.end)/2>=section.start&&(w.start+w.end)/2<section.end).map(w=>({...w,start:Math.max(section.start,w.start),end:Math.min(section.end,w.end)}));
    return speechCues({words},section.end).map(c=>({...c,boundaryReview:c.start<section.start+.8||c.end>section.end-.8}));
  }
  return placeSectionCues(speechCues(speech,section.audioEnd-section.audioStart),section);
}
export async function prepareTranscriptDiscovery(j,worker,{store,source,extract,transcribe,frame,rankStories}){
  j.speechRecords??=[];j.rankingRecords??=[];j.rankingRequests??=0;j.speechCacheHits??=0;
  for(let index=j.speechRecords.length;index<j.sections.length;index++){
    if(worker.shouldStop())return false;
    const section=j.sections[index],options=j.options;
    const key=jobIdentity(['transcript-discovery-v1',j.sourceId,section,options.speechProvider,options.speechLanguage,options.keywords]);
    let saved=store.getRecord('discovery_transcript_speech',key);
    if(!saved){
      j.phase=`Preparing source audio ${index+1} of ${j.sections.length}`;worker.checkpoint();
      const audio=await extract(source.file,{start:section.audioStart,end:section.audioEnd});if(worker.shouldStop())return false;
      j.speechRequests++;j.inFlight={operation:'speech',section:index,provider:options.speechProvider};j.phase=`Transcribing full source ${index+1} of ${j.sections.length}`;worker.checkpoint();
      const speech=await transcribe(Buffer.from(audio.data.split(',')[1],'base64'),options);
      if(speech.speechError)throw Error(speech.speechError);
      const local=speechCues(speech,section.audioEnd-section.audioStart);
      if(normal(speech.transcript)&&!local.length)throw Error('Speech returned without usable timestamps. Retry this section or use another transcription engine.');
      const cues=sourceSectionCues(speech,section).map((c,at)=>({...c,id:`${j.sourceId}:${index}:${at}`}));
      saved={...section,cues,speechSource:speech.speechSource||options.speechProvider,detectedLanguage:speech.detectedLanguage||''};
      store.putRecord('discovery_transcript_speech',key,saved);j.inFlight=null;
    }else{j.speechCacheHits++;j.inFlight=null}
    j.speechRecords.push(saved);worker.checkpoint();
  }
  const cues=j.speechRecords.flatMap(record=>record.cues);
  const plan=j.transcriptPlan;
  for(let at=j.rankingRecords.length;at<Math.ceil(j.sections.length/BATCH_SECTIONS);at++){
    if(worker.shouldStop())return false;
    const from=at*BATCH_SECTIONS,to=Math.min(j.sections.length,(at+1)*BATCH_SECTIONS);
    // Neighboring sections prevent a chapter seam from hiding an exchange.
    const batch=j.speechRecords.slice(Math.max(0,from-1),Math.min(j.sections.length,to+1)).flatMap(record=>record.cues);
    const defaults=transcriptCandidates(batch,plan);
    const key=jobIdentity(['transcript-rank-v1',j.sourceId,batch,j.options.context,j.options.dialectNote,j.options.storyLens,plan.minSeconds,plan.maxSeconds,plan.contextSeconds,rankStories?.cacheVersion||Boolean(rankStories)]);
    let ranked=store.getRecord('discovery_transcript_ranking',key);
    if(!ranked){
      let proposals=defaults,rejectedByRanker=0;
      if(rankStories&&batch.length){
        j.rankingRequests++;j.inFlight={operation:'ranking',section:at,provider:'story-ranker'};j.phase=`Finding transcript stories ${at+1} of ${Math.ceil(j.sections.length/BATCH_SECTIONS)}`;worker.checkpoint();
        const result=await rankStories({sourceId:j.sourceId,duration:j.duration,context:j.options.context,storyLens:j.options.storyLens,cues:batch,candidates:defaults,range:{start:j.sections[from].start,end:j.sections[to-1].end},minSeconds:plan.minSeconds,maxSeconds:plan.maxSeconds});
        if(!result||!Array.isArray(result.candidates))throw Error('Story ranking returned no verifiable candidate list.');proposals=result.candidates;rejectedByRanker=Math.max(0,Math.min(200,Math.trunc(Number(result.rejectedCandidates)||0)));
      }
      ranked={...validateStoryCandidates(proposals,batch,{...plan,duration:plan.scanSeconds}),rejectedByRanker};
      store.putRecord('discovery_transcript_ranking',key,ranked);j.inFlight=null;
    }
    j.inFlight=null;j.rankingRecords.push(ranked);worker.checkpoint();
  }
  j.candidates??=chooseStoryCandidates(j.rankingRecords.flatMap(r=>r.candidates),j.budget);worker.checkpoint();
  for(let index=j.samples.length;index<j.candidates.length;index++){
    if(worker.shouldStop())return false;
    const candidate=j.candidates[index],frames=[];j.phase=`Preparing selected story ${index+1} of ${j.candidates.length}`;worker.checkpoint();
    for(const time of [candidate.start+.5,(candidate.start+candidate.end)/2,Math.max(candidate.start,candidate.end-.3)]){if(worker.shouldStop())return false;frames.push(store.putAsset(await frame(source.file,time),'image/jpeg').url)}
    const sourceRecords=j.speechRecords.filter(r=>r.end>candidate.start&&r.start<candidate.end),speech={...momentSpeech(cues,candidate),speechSource:[...new Set(sourceRecords.map(r=>r.speechSource).filter(Boolean))].join(' + '),detectedLanguage:[...new Set(sourceRecords.map(r=>r.detectedLanguage).filter(Boolean))].join(', ')};
    j.samples.push({...candidate,frames,speech,speechKey:jobIdentity(['transcript-moment-v1',j.sourceId,candidate,cues.filter(c=>c.end>candidate.start&&c.start<candidate.end)])});worker.checkpoint();
  }
  j.shortlist=j.samples.map((_,index)=>index);worker.checkpoint();return true;
}
export function transcriptSnapshot(j){
  const records=j.speechRecords||[],coverageSeconds=records.reduce((n,r)=>n+r.end-r.start,0);
  return {coverageKind:'source-audio-transcription',checkedIntervals:j.results.map(r=>({start:j.samples[r.index].start,end:j.samples[r.index].end,suggested:r.suggested})),speechSectionsDone:records.length,speechSectionsTotal:j.sections.length,coverageSeconds,unreviewedSeconds:Math.max(0,j.duration-coverageSeconds),fullSourceTranscribed:coverageSeconds>=j.duration-.01,speechCacheHits:j.speechCacheHits||0,rankingRequests:j.rankingRequests||0,rankingSectionsDone:(j.rankingRecords||[]).length,rankingSectionsTotal:Math.ceil(j.sections.length/BATCH_SECTIONS),rankingMethod:j.rankingMethod,rejectedCandidates:(j.rankingRecords||[]).reduce((n,r)=>n+r.rejected.length+(r.rejectedByRanker||0),0),costPreview:j.transcriptPlan.preview,transcriptSections:records.map(r=>({start:r.start,end:r.end,cueCount:r.cues.length,transcriptPreview:r.cues.map(c=>c.text).join(' ').slice(0,240)}))};
}
