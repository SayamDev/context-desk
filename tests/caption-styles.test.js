import test from 'node:test';import assert from 'node:assert/strict';
import {captionStyleIds,captionSegments,wordTimes,layoutLines,styleOf} from '../public/caption-styles.js';
import {assDocument} from '../lib/exports.js';
const cue={start:0,end:3,text:'we bought the car yesterday morning'};
const timed={...cue,words:cue.text.split(' ').map((text,i)=>({text,start:i/2,end:(i+1)/2}))};
test('every style produces segments covering the whole line with no gaps',()=>{
  for(const id of captionStyleIds){const s=captionSegments(cue,id);assert.ok(s.length,id);assert.equal(s[0].start,0,id);assert.equal(s.at(-1).end,3,id);
    for(let i=1;i<s.length;i++)assert.ok(Math.abs(s[i].start-s[i-1].end)<1e-9,`${id} gap at ${i}`)}
});
test('untimed translations keep distinct styles and reach the final word sooner',()=>{
  const words=wordTimes(cue);
  assert.equal(words[0].start,0);
  assert.equal(words.at(-1).end,3);
  assert.ok(words.every(word=>word.estimated));
  const previousWeights=cue.text.split(' ').map(word=>word.length+2);
  const previousLastStart=cue.end*(1-previousWeights.at(-1)/previousWeights.reduce((sum,weight)=>sum+weight,0));
  assert.ok(words.at(-1).start<previousLastStart);
  assert.ok(captionSegments(cue,'punch').every(segment=>segment.words.length===6));
  assert.ok(captionSegments(cue,'hormozi').every(segment=>segment.words.length===3));
  assert.ok(captionSegments(cue,'single').every(segment=>segment.words.length===1));
  assert.ok(captionSegments({...timed,text:'we bought the bus yesterday morning'},'punch').length>1);
  const real=wordTimes({...cue,text:'a b',words:[{text:'a',start:.5,end:1},{text:'b',start:1.2,end:2}]},.1);
  assert.equal(real[0].start,.6);
});
test('chunked styles show N words, active word moves, hidden words keep layout',()=>{
  const two=captionSegments(timed,'beast');assert.ok(two.every(s=>s.words.length<=2));assert.equal(two[0].words[0].text,'WE');
  const type=captionSegments(timed,'typewriter');assert.equal(type[0].words.filter(w=>w.state==='future').length,5);assert.equal(type.at(-1).words.length,6);
  assert.deepEqual(layoutLines(type[0].words,{width:720,fontSize:40,style:styleOf('typewriter')}),layoutLines(type.at(-1).words,{width:720,fontSize:40,style:styleOf('typewriter')}));
});
test('export emits one event per segment for every style',()=>{
  for(const id of captionStyleIds){const m={start:0,end:5,trimIn:0,trimOut:4,showCaptions:true,captionLanguage:'English',captionStyle:id,captionLook:{},captionCues:{Original:[cue],English:[cue]},captionOffset:0};
    const events=assDocument(m,720,1280).split('\n').filter(l=>l.startsWith('Dialogue: 0'));assert.equal(events.length,captionSegments(cue,id).length,id)}
  const k=assDocument({start:0,end:5,trimIn:0,trimOut:4,showCaptions:true,captionLanguage:'English',captionStyle:'karaoke',captionLook:{},captionCues:{Original:[timed],English:[timed]},captionOffset:0},720,1280);
  assert.match(k,/\\c&H978d8f&/i);
});

test('Punchy follows measured word onsets and leaves a pause unhighlighted',()=>{
  const line={start:0,end:2,text:'now go',words:[{text:'now',start:.1,end:.35},{text:'go',start:.8,end:1.5}]};
  const segments=captionSegments(line,'punch');
  const activeAt=time=>segments.find(s=>s.start<=time&&time<s.end).words.find(word=>word.state==='active')?.text;
  assert.equal(activeAt(.09),undefined);
  assert.equal(activeAt(.1),'NOW');
  assert.equal(activeAt(.5),undefined);
  assert.equal(activeAt(.8),'GO');
});
