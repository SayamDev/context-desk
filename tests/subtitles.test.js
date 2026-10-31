import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubtitleService,subtitleSections,placeSectionCues} from '../lib/subtitles.js';
const settle=async(service,id)=>{for(let n=0;n<100;n++){if(['complete','paused','error'].includes(service.get(id).status))return service.get(id);await new Promise(r=>setTimeout(r,2))}throw Error('Job did not settle')};
test('whole-video sections cover the source continuously with bounded overlap',()=>{const s=subtitleSections(91);assert.deepEqual(s.map(x=>[x.start,x.end]),[[0,45],[45,90],[90,91]]);assert.ok(s.every(x=>x.audioEnd-x.audioStart<=60));const cues=placeSectionCues([{start:0,end:2,text:'boundary'}],s[1]);assert.equal(cues[0].start,45);assert.equal(cues[0].end,46.2)});
test('whole-video failure retains completed sections and retries translation without paying for speech again',async()=>{
  let asr=0,translations=0,fail=true,releases=0;
  const service=createSubtitleService({claimSource:()=>({file:'fixture',duration:90,title:'Two sections',release(){releases++}}),extract:async()=>({data:'data:audio/wav;base64,AAAA'}),transcribe:async()=>{asr++;return {turns:[{startMs:1000,endMs:2000,text:'مرحبا'}]}},translate:async cues=>{translations++;if(translations===2&&fail)throw Error('Temporary outage');return cues.map(c=>({...c,text:'Hello'}))}});
  const job=await service.start({sourceId:'source',language:'English',keywords:[]});let result=await settle(service,job.id);assert.equal(result.status,'error');assert.equal(result.sectionsDone,1);assert.equal(service.track(job.id).length,1);assert.equal(asr,2);
  fail=false;await service.command(job.id,'resume');result=await settle(service,job.id);assert.equal(result.status,'complete');assert.equal(result.sectionsDone,2);assert.equal(asr,2);assert.equal(service.track(job.id)[1].text,'Hello');assert.ok(releases>=3);
});
test('pause finishes its section and resume continues from the next section',async()=>{
  let continueSpeech;const barrier=new Promise(r=>continueSpeech=r);let calls=0;
  const service=createSubtitleService({claimSource:()=>({file:'fixture',duration:90,title:'Two sections',release(){}}),extract:async()=>({data:'data:audio/wav;base64,AAAA'}),transcribe:async()=>{if(++calls===1)await barrier;return {turns:[{startMs:0,endMs:1000,text:'Hello'}]}},translate:async c=>c});
  const job=await service.start({sourceId:'source',language:'Original',keywords:[]});await service.command(job.id,'pause');continueSpeech();assert.equal((await settle(service,job.id)).sectionsDone,1);await service.command(job.id,'resume');assert.equal((await settle(service,job.id)).status,'complete');assert.equal(calls,2);
});
