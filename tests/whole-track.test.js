import test from 'node:test';import assert from 'node:assert/strict';
import {projectTrack,commitCaptionTranslation} from '../public/caption-policy.js';
test('a whole-recording track projects onto a clip window with clipped edges',()=>{
  const track=[{start:5,end:9,text:'before'},{start:98,end:102,text:'edge',boundaryReview:true},{start:110,end:112,text:'inside',words:[{start:110,end:111,text:'in'}]},{start:200,end:201,text:'after'}];
  const cues=projectTrack(track,{start:100,end:160,mediaStart:100});
  assert.deepEqual(cues.map(c=>c.text),['edge','inside']);
  assert.deepEqual([cues[0].start,cues[0].end],[0,2]);assert.equal('boundaryReview' in cues[0],false);
  assert.deepEqual(cues[1].words[0],{start:10,end:11,text:'in'});
  assert.equal(projectTrack(track,{start:0,end:7904,mediaStart:0}).length,4);
});
test('a stale or failed translation never replaces the visible track',()=>{
  const m={captionCues:{Original:[{start:0,end:1,text:'a'}],English:[{start:0,end:1,text:'A'}]},captionReviewed:{},captionLanguage:'English'};
  const original=JSON.stringify(m.captionCues.Original),previous=JSON.stringify(m.captionCues.English);
  m.captionCues.English[0].text='edited';
  assert.equal(commitCaptionTranslation(m,{original,previous,language:'English',cues:[{start:0,end:1,text:'new'}]}),false);
  assert.equal(m.captionCues.English[0].text,'edited');
});
