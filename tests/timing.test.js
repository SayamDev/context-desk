import test from 'node:test';
import assert from 'node:assert/strict';
import {syncedCues,shouldRestart,speechCues,srtDocument} from '../public/timing.js';
test('earlier subtitle adjustment preserves wording and clips to the source window',()=>{
  const cues=[{start:.2,end:1,text:'أهلاً بالجميع'},{start:3,end:4,text:'Second line'}];
  assert.deepEqual(syncedCues(cues,-.5,3.6),[{start:0,end:.5,text:'أهلاً بالجميع',index:0},{start:2.5,end:3.5,text:'Second line',index:1}]);
  assert.equal(cues[0].start,.2);
});
test('late subtitles do not escape the clip or remain at zero length',()=>{
  assert.deepEqual(syncedCues([{start:1,end:2,text:'x'},{start:3,end:4,text:'y'}],1,3),[{start:2,end:3,text:'x',index:0}]);
  assert.deepEqual(syncedCues([{start:0,end:.2,text:'x'}],-.4,3),[]);
});
test('play resumes inside a trim and restarts after the trim end or source end',()=>{
  assert.equal(shouldRestart(6,4,8),false);assert.equal(shouldRestart(8,4,8),true);assert.equal(shouldRestart(0,4,8),true);assert.equal(shouldRestart(4,4,8),false);
});
test('caption grouping preserves supplied word timings and Arabic text',()=>{
  const cues=speechCues({words:[{start:.2,end:.6,text:'مرحبا'},{start:.6,end:1,text:'بك'}]},2);assert.equal(cues[0].text,'مرحبا بك');assert.deepEqual(cues[0].words.map(w=>[w.start,w.end]),[[.2,.6],[.6,1]]);assert.equal(cues[0].end,1);
});
test('speaker-turn captions remain bounded and do not invent word timestamps',()=>{
  const cues=speechCues({turns:[{startMs:1000,endMs:4000,text:'one two three four five six seven'}]},3);assert.equal(cues.length,2);assert.equal(cues.at(-1).end,3);assert.equal(cues[0].words,undefined);
});
test('full-recording SRT retains hours, unicode and millisecond times',()=>{assert.match(srtDocument([{start:7200.3,end:7201.6,text:'أهلاً — hello'}]),/02:00:00,300 --> 02:00:01,600\nأهلاً — hello/)});
