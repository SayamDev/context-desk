import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubtitleService,subtitleSections,placeSectionCues,translateResilient,withRetry} from '../lib/subtitles.js';
const settle=async(service,id)=>{for(let n=0;n<100;n++){if(['complete','paused','error'].includes(service.get(id).status))return service.get(id);await new Promise(r=>setTimeout(r,2))}throw Error('Job did not settle')};
test('whole-video sections cover the source continuously with bounded overlap',()=>{const s=subtitleSections(91);assert.deepEqual(s.map(x=>[x.start,x.end]),[[0,45],[45,90],[90,91]]);assert.ok(s.every(x=>x.audioEnd-x.audioStart<=60));const cues=placeSectionCues([{start:0,end:2,text:'boundary'}],s[1]);assert.equal(cues[0].start,45);assert.equal(cues[0].end,46.2)});
test('whole-video failure retains completed sections and retries translation without paying for speech again',async()=>{
  let asr=0,translations=0,fail=true,releases=0;
  const service=createSubtitleService({claimSource:()=>({file:'fixture',duration:90,title:'Two sections',release(){releases++}}),extract:async()=>({data:'data:audio/wav;base64,AAAA'}),transcribe:async()=>{asr++;return {turns:[{startMs:1000,endMs:2000,text:'مرحبا'}]}},translate:async cues=>{translations++;if(translations===2&&fail)throw Object.assign(Error('Unauthorized'),{status:401});return cues.map(c=>({...c,text:'Hello'}))}});
  const job=await service.start({sourceId:'source',language:'English',keywords:[]});let result=await settle(service,job.id);assert.equal(result.status,'error');assert.equal(result.sectionsDone,1);assert.equal(service.track(job.id).length,1);assert.equal(asr,2);
  fail=false;await service.command(job.id,'resume');result=await settle(service,job.id);assert.equal(result.status,'complete');assert.equal(result.sectionsDone,2);assert.equal(asr,2);assert.equal(service.track(job.id)[1].text,'Hello');assert.ok(releases>=3);
});
test('pause finishes its section and resume continues from the next section',async()=>{
  let continueSpeech;const barrier=new Promise(r=>continueSpeech=r);let calls=0;
  const service=createSubtitleService({claimSource:()=>({file:'fixture',duration:90,title:'Two sections',release(){}}),extract:async()=>({data:'data:audio/wav;base64,AAAA'}),transcribe:async()=>{if(++calls===1)await barrier;return {turns:[{startMs:0,endMs:1000,text:'Hello'}]}},translate:async c=>c});
  const job=await service.start({sourceId:'source',language:'Original',keywords:[]});await service.command(job.id,'pause');continueSpeech();assert.equal((await settle(service,job.id)).sectionsDone,1);await service.command(job.id,'resume');assert.equal((await settle(service,job.id)).status,'complete');assert.equal(calls,2);
});

const instant=async()=>{};
test('a translation reply that is cut off or miscounted is retried, then split, never stopping the job',async()=>{
  const part=[0,1,2,3].map(id=>({id,text:'سطر '+id})),calls=[];
  // Whole batches always come back one line short; halves work on the second try.
  let tries=0;const lines=await translateResilient(part,async batch=>{calls.push(batch.length);if(batch.length===4)return batch.slice(1).map(c=>({...c,text:'Line'}));if(++tries%2)throw SyntaxError("Expected ',' or ']' after array element in JSON");return batch.map(c=>({id:c.id,text:'Line '+c.id}))},{wait:instant});
  assert.deepEqual(lines.map(l=>l.text),['Line 0','Line 1','Line 2','Line 3']);assert.deepEqual(calls,[4,4,2,2,2,2]);
});
test('a single line that keeps failing keeps its original text, flagged for a person; a key error still stops',async()=>{
  const lines=await translateResilient([{id:0,text:'كلمة'},{id:1,text:'جملة'}],async batch=>{if(batch.some(c=>c.id===1))throw Error('Translation did not match the source lines.');return batch.map(c=>({id:c.id,text:'Word'}))},{wait:instant});
  assert.deepEqual(lines,[{id:0,text:'Word'},{id:1,text:'جملة',uncertain:true,untranslated:true}]);
  await assert.rejects(translateResilient([{id:0,text:'x'},{id:1,text:'y'}],async()=>{throw Object.assign(Error('Unauthorized'),{status:401})},{wait:instant}),/Unauthorized/);
});
test('transient provider errors are retried with backoff; rate limits wait longer',async()=>{
  const waits=[];let n=0;
  assert.equal(await withRetry(async()=>{if(++n<3)throw Object.assign(Error('busy'),{status:n===1?503:429});return 'ok'},{wait:async ms=>waits.push(ms)}),'ok');
  assert.deepEqual(waits,[2000,16000]);
});
test('a whole-video job with a flaky translator still completes, with the failing line flagged',async()=>{
  const service=createSubtitleService({wait:instant,claimSource:()=>({file:'fixture',duration:40,title:'Flaky',release(){}}),extract:async()=>({data:'data:audio/wav;base64,AAAA'}),transcribe:async()=>({turns:[{startMs:0,endMs:900,text:'أهلا'},{startMs:1000,endMs:1900,text:'غامض'}]}),translate:async cues=>{if(cues.some(c=>c.text==='غامض'))throw SyntaxError('Unexpected end of JSON input');return cues.map(c=>({...c,text:'Hello'}))}});
  const job=await service.start({sourceId:'source',language:'English',keywords:[]});const result=await settle(service,job.id);
  assert.equal(result.status,'complete');const track=service.track(job.id);assert.equal(track[0].text,'Hello');assert.equal(track[1].text,'غامض');assert.equal(track[1].untranslated,true);
});

test('a mixed-language recording keeps matching speech and translates only the requested output',async()=>{
  const requests=[];
  let sections=0;
  const service=createSubtitleService({
    claimSource:()=>({file:'fixture',duration:90,title:'Mixed speech',release(){}}),
    extract:async()=>({data:'data:audio/wav;base64,AAAA'}),
    transcribe:async()=>++sections===1
      ?{detectedLanguage:'en-US',turns:[{startMs:1000,endMs:2000,text:'Already English'}]}
      :{detectedLanguage:'ar',turns:[{startMs:1000,endMs:2000,text:'مرحبا'}]},
    translate:async(cues,options)=>{
      requests.push([options.speechLanguage,options.language]);
      return cues.map(c=>({...c,text:'Hello'}));
    }
  });
  const job=await service.start({sourceId:'source',language:'English'});
  assert.equal((await settle(service,job.id)).status,'complete');
  assert.deepEqual(requests,[['ar','English']]);
  assert.deepEqual(service.track(job.id).map(c=>c.text),['Already English','Hello']);
});
