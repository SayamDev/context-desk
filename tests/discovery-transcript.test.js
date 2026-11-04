import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {openStore} from '../lib/store.js';
import {createDiscoveryService} from '../lib/discovery.js';
import {transcriptPlan,validateStoryCandidates,sourceSectionCues} from '../lib/transcript-discovery.js';

async function fixture(t,duration=135){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'transcript-discovery-'));
  const store=openStore(root);t.after(async()=>{store.close();await fs.rm(root,{recursive:true,force:true})});
  const project=store.createProject({sourceId:'source'});let speech=0,story=0;
  const dependencies={store,claimSource:()=>({file:'fixture',duration,title:'Episode',size:20,release(){}}),frame:async()=>Buffer.from('fixture'),extract:async()=>({data:'data:audio/wav;base64,AAAA'}),transcribe:async()=>{speech++;return {transcript:'Why did you leave? Because I finally found my answer.',turns:[{startMs:1000,endMs:9000,text:'Why did you leave?'},{startMs:10000,endMs:22000,text:'Because I finally found my answer.'}]}},analyse:async()=>{story++;return {worthClipping:true,hook:'A decision explained'}},translate:async lines=>lines};
  return {store,project,dependencies,calls:()=>({speech,story})};
}
async function settle(service,id){for(let i=0;i<400;i++){const job=service.get(id);if(!['queued','running'].includes(job.status))return job;await new Promise(r=>setTimeout(r,2))}throw Error('Worker did not settle')}

test('transcript plan covers every source second and reports an explicit partial-scan limit',()=>{
  const full=transcriptPlan(21600,{});assert.equal(full.sections.length,480);assert.equal(full.scanSeconds,21600);assert.equal(full.fullSource,true);
  const limited=transcriptPlan(21600,{speechSectionLimit:2});assert.equal(limited.scanSeconds,90);assert.equal(limited.fullSource,false);assert.equal(limited.preview.speechRequestsMax,2);
});
test('ranking proposals need exact timestamped source evidence and retain neighboring context',()=>{
  const cues=[{id:'a',start:10,end:15,text:'Why did you leave?'},{id:'b',start:16,end:26,text:'Because I found an answer.'},{id:'c',start:27,end:33,text:'And that changed everything.'}];
  const proposals=[{start:15,end:27,score:90,evidence:[{cueId:'b',quote:'Because I found an answer.'}]},{start:10,end:25,score:100,evidence:[{cueId:'a',quote:'Invented dialogue'}]}];
  const result=validateStoryCandidates(proposals,cues,{duration:60,minSeconds:10,maxSeconds:90,contextSeconds:6});
  assert.equal(result.candidates.length,1);assert.equal(result.rejected.length,1);assert.equal(result.candidates[0].start,9);assert.equal(result.candidates[0].end,33);assert.equal(result.candidates[0].evidence[0].start,16);
});
test('opt-in transcript discovery scans all speech once, cites retained moments and reuses speech across editorial settings',async t=>{
  const f=await fixture(t),service=createDiscoveryService(f.dependencies);
  const job=service.start({sourceId:'source',projectId:f.project.id,strategy:'transcript',budget:2});const done=await settle(service,job.id);
  assert.equal(done.status,'complete');assert.equal(done.strategy,'transcript');assert.equal(done.speechSectionsDone,3);assert.equal(done.coverageSeconds,135);assert.equal(done.fullSourceTranscribed,true);assert.equal(done.speechRequests,3);assert.equal(done.checksDone,2);
  for(const moment of f.store.getProject(f.project.id).state.moments){assert.ok(moment.analysis.sourceEvidence.length);assert.ok(moment.transcript.includes('Because'));assert.equal(moment.discoveryStrategy,'transcript')}
  const another=service.start({sourceId:'source',projectId:f.project.id,strategy:'transcript',budget:1,context:'A different editorial question'});await settle(service,another.id);assert.equal(f.calls().speech,3);assert.equal(service.get(another.id).speechCacheHits,3);
});
test('unsupported injected rankings cannot create useful clips and ranking requests are bounded and cached',async t=>{
  const f=await fixture(t),service=createDiscoveryService({...f.dependencies,rankStories:async()=>({candidates:[{start:0,end:30,evidence:[{cueId:'missing',quote:'Fabricated'}]}]})});
  const j=service.start({sourceId:'source',projectId:f.project.id,strategy:'transcript',budget:3});const done=await settle(service,j.id);
  assert.equal(done.status,'complete');assert.equal(done.rankingRequests,1);assert.equal(done.rejectedCandidates,1);assert.equal(done.suggested,0);assert.equal(f.calls().story,0);
});
test('speech limits remain visible and existing requests retain fast sampling behavior',async t=>{
  const f=await fixture(t,225),service=createDiscoveryService(f.dependencies);
  const partial=service.start({sourceId:'source',projectId:f.project.id,strategy:'transcript',speechSectionLimit:2,budget:1});const done=await settle(service,partial.id);
  assert.equal(done.fullSourceTranscribed,false);assert.equal(done.coverageSeconds,90);assert.equal(done.unreviewedSeconds,135);assert.equal(done.costPreview.speechRequestsMax,2);
  const fast=service.start({sourceId:'source',projectId:f.project.id,budget:1});assert.equal(fast.strategy,'fast');assert.equal((await settle(service,fast.id)).speechRequests,1);
});
test('pause checkpoints the in-flight speech result and restart resumes without repeating completed speech',async t=>{
  const f=await fixture(t);let release,entered;
  const barrier=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);let calls=0;
  const transcribe=async()=>{calls++;if(calls===1){entered();await barrier}return {turns:[{startMs:1000,endMs:5000,text:'Why does this matter?'},{startMs:6000,endMs:15000,text:'Because the source explains what happened.'}]}};
  let service=createDiscoveryService({...f.dependencies,transcribe});
  const j=service.start({sourceId:'source',projectId:f.project.id,strategy:'transcript',budget:1});await started;
  service.command(j.id,'pause');release();let paused=await settle(service,j.id);
  assert.equal(paused.status,'paused');assert.equal(paused.speechSectionsDone,1);assert.equal(calls,1);
  service=createDiscoveryService({...f.dependencies,transcribe});assert.equal(service.get(j.id).status,'paused');service.command(j.id,'resume');
  assert.equal((await settle(service,j.id)).status,'complete');assert.equal(calls,3);
});
test('cancel after an active request keeps its transcript and starts no further paid operation',async t=>{
  const f=await fixture(t);let release,entered;const barrier=new Promise(r=>release=r),started=new Promise(r=>entered=r);
  const service=createDiscoveryService({...f.dependencies,transcribe:async()=>{entered();await barrier;return {turns:[{startMs:0,endMs:6000,text:'Source words remain saved.'}]}}});
  const j=service.start({sourceId:'source',projectId:f.project.id,strategy:'transcript'});await started;service.command(j.id,'cancel');release();const done=await settle(service,j.id);
  assert.equal(done.status,'cancelled');assert.equal(done.speechSectionsDone,1);assert.equal(done.speechRequests,1);assert.equal(done.storyRequests,0);assert.equal(service.transcript(j.id)[0].text,'Source words remain saved.');
});
test('unknown running provider requests become interrupted without automatic paid replay',async t=>{
  const f=await fixture(t);let release,entered;const barrier=new Promise(r=>release=r),started=new Promise(r=>entered=r);
  const initial=createDiscoveryService({...f.dependencies,transcribe:async()=>{entered();await barrier;return {turns:[]}}});
  const j=initial.start({sourceId:'source',projectId:f.project.id,strategy:'transcript',speechSectionLimit:1});await started;
  const recovered=createDiscoveryService(f.dependencies);await new Promise(r=>setImmediate(r));
  assert.equal(recovered.get(j.id).status,'interrupted');assert.match(recovered.get(j.id).error,/charge/);assert.equal(f.calls().speech,0);
  initial.command(j.id,'cancel');release();await settle(initial,j.id);
});
test('translation checkpoints each successful paid batch before a later failure',async t=>{
  const f=await fixture(t,90);let translations=0,fail=true;
  const words=Array.from({length:200},(_,i)=>({start:i*.2,end:i*.2+.19,text:'word'+i}));
  const service=createDiscoveryService({...f.dependencies,transcribe:async()=>({words}),rankStories:async({cues})=>({candidates:[{start:0,end:80,evidence:[{cueId:cues[0].id,quote:cues[0].text}]}]}),translate:async lines=>{translations++;if(translations===2&&fail)throw Error('Translation unavailable');return lines.map(line=>({...line,text:'translated '+line.text}))}});
  const j=service.start({sourceId:'source',projectId:f.project.id,strategy:'transcript',budget:1,language:'English'});assert.equal((await settle(service,j.id)).status,'error');
  fail=false;service.command(j.id,'resume');assert.equal((await settle(service,j.id)).status,'complete');
  assert.equal(translations,4);assert.equal(service.get(j.id).translationRequests,4);
});

test('native words in padded audio belong to one source section at a seam',()=>{
  const one=sourceSectionCues({words:[{start:44.5,end:45.3,text:'Boundary'},{start:45.4,end:45.7,text:'after'}]},{start:0,end:45,audioStart:0,audioEnd:45.8});
  const two=sourceSectionCues({words:[{start:.3,end:1.1,text:'Boundary'},{start:1.2,end:1.5,text:'after'}]},{start:45,end:90,audioStart:44.2,audioEnd:90});
  assert.equal(one.flatMap(c=>c.words).filter(w=>w.text==='Boundary').length,1);
  assert.equal(two.flatMap(c=>c.words).filter(w=>w.text==='Boundary').length,0);
  assert.equal(two[0].text,'after');assert.ok(two[0].start>=45);
});
test('preview performs no processing and untimed speech fails closed',async t=>{
  const f=await fixture(t),service=createDiscoveryService({...f.dependencies,transcribe:async()=>({transcript:'Words without any usable source times'})});
  const preview=service.preview({sourceId:'source',strategy:'transcript',speechSectionLimit:2,budget:2});assert.equal(preview.speechRequestsMax,2);assert.equal(f.calls().speech,0);assert.equal(service.list().length,0);
  const j=service.start({sourceId:'source',projectId:f.project.id,strategy:'transcript',speechSectionLimit:1});const done=await settle(service,j.id);assert.equal(done.status,'error');assert.match(done.error,/timestamps/);assert.equal(done.coverageSeconds,0);assert.equal(done.storyRequests,0);
});

test('local discovery creates editable dialogue clips with no Meta calls',async t=>{
  const f=await fixture(t,45);
  const {createLocalStoryRanker}=await import('../lib/meta-story-ranker.js');
  const rankLocalStories=createLocalStoryRanker({fetch:async(url,request)=>{
    assert.equal(url,'http://127.0.0.1:11434/api/chat');
    assert.equal(request.headers.Authorization,undefined);
    return Response.json({message:{content:JSON.stringify({stories:[
      {setup:'1',turn:'2',payoff:'3',reason:'The reason follows the question.',score:80},
      {setup:'1',turn:'99',payoff:'3',reason:'Invalid reference.',score:90}
    ]})}});
  }});
  const service=createDiscoveryService({...f.dependencies,rankLocalStories,
    validate:()=>assert.fail('Local discovery must not require Meta'),
    transcribe:async(_,options)=>{
      assert.equal(options.speechProvider,'voicestudio');
      return {turns:[{startMs:1000,endMs:4000,text:'لماذا غادرت؟'},{startMs:5000,endMs:9000,text:'كنت أبحث عن إجابة'},{startMs:12000,endMs:18000,text:'الآن أعرف السبب'}]};
    },
    translate:async(lines,options)=>{assert.equal(options.translationProvider,'voicestudio');return lines}
  });
  const job=service.start({sourceId:'source',projectId:f.project.id,strategy:'local',language:'English',clipMinSeconds:10});
  const done=await settle(service,job.id);
  assert.equal(done.status,'complete',done.error);assert.equal(done.suggested,1);assert.equal(done.rejectedCandidates,1);
  assert.equal(done.storyRequests,0);assert.equal(f.calls().story,0);
  const [clip]=f.store.getProject(f.project.id).state.moments;
  assert.equal(clip.mediaStart,clip.start);assert.equal(clip.analysis.setup,'لماذا غادرت؟');
  assert.equal(clip.analysis.payoff,'الآن أعرف السبب');assert.equal(clip.discoveryStrategy,'local');
});
