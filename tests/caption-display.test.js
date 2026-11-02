import test from 'node:test';import assert from 'node:assert/strict';
import {displayCues,overlapIndexes} from '../public/caption-display.js';import {speechCues} from '../public/timing.js';
import {assDocument,outputCues} from '../lib/exports.js';import {lineIssues} from '../public/subtitle-qa.js';
const cues=[{start:0,end:2,text:'Where were you?',speaker:'A'},{start:1.2,end:3,text:'None of your business',speaker:'B'},{start:3.2,end:4,text:'laughter',kind:'sound'},{start:4,end:5,text:'talking far away',kind:'background',speaker:'C'},{start:5,end:6,text:'I am leaving',speaker:'A',cueLabel:'(off-screen)'}];
test('speaker IDs are never shown; overlapping speakers become one dashed row each',()=>{
  const clean=displayCues(cues);assert.equal(clean.length,2);assert.equal(clean[0].text,'- Where were you?\n- None of your business');assert.ok(clean.every(c=>!/\bA\b|Speaker/.test(c.text)));
  assert.equal(clean[1].text,'(off-screen) I am leaving');
});
test('accessible captions add sound descriptions and background speech; clean dialogue leaves them out',()=>{
  const a=displayCues(cues,{mode:'accessible'}).map(c=>c.text);assert.ok(a.includes('[laughter]'));assert.ok(a.includes('(in background) talking far away'));
  assert.ok(!displayCues(cues).some(c=>/laughter|background/.test(c.text)));
});
test('a line inside an overlap joins as another row instead of disappearing',()=>{
  const d=displayCues([{start:0,end:4,text:'one',speaker:'A'},{start:.5,end:3.5,text:'two',speaker:'B'},{start:1,end:2,text:'three',speaker:'C'}]);assert.equal(d.length,1);assert.equal(d[0].text.split('\n').length,3);
});
test('diarized speech keeps speakers and keeps overlapping lines from different speakers',()=>{
  const c=speechCues({turns:[{startMs:0,endMs:3000,speaker:'A',text:'first person talking here'},{startMs:1500,endMs:4000,speaker:'B',text:'second person interrupts'}]},10);
  assert.deepEqual(c.map(x=>x.speaker),['A','B']);assert.equal(c[1].start,1.5);assert.deepEqual([...overlapIndexes(c)].sort(),[0,1]);
});
test('export burns the dashed two-speaker layout and flags overlaps and unclear lines for review',()=>{
  const m={start:0,end:6,trimIn:0,trimOut:6,showCaptions:true,captionLanguage:'English',captionStyle:'clean',captionLook:{},captionOffset:0,captionCues:{Original:cues,English:cues}};
  assert.equal(outputCues(m)[0].text,'- Where were you?\n- None of your business');assert.match(assDocument(m,720,1280),/- Where were you\?.*\\N- None/);
  assert.equal(outputCues({...m,captionMode:'accessible'}).length,4);
  const issues=lineIssues([...cues,{start:7,end:8,text:'he said [unclear] then left',speaker:'A'}],{language:'English'});
  assert.ok(issues.some(i=>i.index===0&&/speak at once/.test(i.reasons.join(' '))));assert.ok(issues.some(i=>/marked unclear/.test(i.reasons.join(' '))));
});
