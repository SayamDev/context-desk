import test from 'node:test';import assert from 'node:assert/strict';
import {captionStyleIds,captionSegments,wordTimes,layoutLines,styleOf} from '../public/caption-styles.js';
import {assDocument} from '../lib/exports.js';
const cue={start:0,end:3,text:'we bought the car yesterday morning'};
test('every style produces segments covering the whole line with no gaps',()=>{
  for(const id of captionStyleIds){const s=captionSegments(cue,id);assert.ok(s.length,id);assert.equal(s[0].start,0,id);assert.equal(s.at(-1).end,3,id);
    for(let i=1;i<s.length;i++)assert.ok(Math.abs(s[i].start-s[i-1].end)<1e-9,`${id} gap at ${i}`)}
});
test('estimated word times fill the line when a track has no word timing',()=>{
  const w=wordTimes(cue);assert.equal(w.length,6);assert.equal(w[0].start,0);assert.ok(Math.abs(w.at(-1).end-3)<1e-9);assert.ok(w.every(x=>x.estimated));
  const real=wordTimes({...cue,text:'a b',words:[{text:'a',start:.5,end:1},{text:'b',start:1.2,end:2}]},.1);assert.equal(real[0].start,.6);
});
test('chunked styles show N words, active word moves, hidden words keep layout',()=>{
  const two=captionSegments(cue,'beast');assert.ok(two.every(s=>s.words.length<=2));assert.equal(two[0].words[0].text,'WE');
  const type=captionSegments(cue,'typewriter');assert.equal(type[0].words.filter(w=>w.state==='future').length,5);assert.equal(type.at(-1).words.length,6);
  assert.deepEqual(layoutLines(type[0].words,{width:720,fontSize:40,style:styleOf('typewriter')}),layoutLines(type.at(-1).words,{width:720,fontSize:40,style:styleOf('typewriter')}));
});
test('export emits one event per segment for every style',()=>{
  for(const id of captionStyleIds){const m={start:0,end:5,trimIn:0,trimOut:4,showCaptions:true,captionLanguage:'English',captionStyle:id,captionLook:{},captionCues:{Original:[cue],English:[cue]},captionOffset:0};
    const events=assDocument(m,720,1280).split('\n').filter(l=>l.startsWith('Dialogue: 0'));assert.equal(events.length,captionSegments(cue,id).length,id)}
  const k=assDocument({start:0,end:5,trimIn:0,trimOut:4,showCaptions:true,captionLanguage:'English',captionStyle:'karaoke',captionLook:{},captionCues:{Original:[cue],English:[cue]},captionOffset:0},720,1280);
  assert.match(k,/\\c&H978d8f&/i);
});
