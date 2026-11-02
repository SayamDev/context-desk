import test from 'node:test';import assert from 'node:assert/strict';
import {speakerFrames,buildReframeTrack} from '../lib/reframe.js';
const face=(x,mouth)=>({x,y:.3,w:.15,h:.25,confidence:.9,mouth});
// Left face talks for 2 s, then the right face talks.
const frames=Array.from({length:20},(_,i)=>{const t=i/4,leftTalks=t<2;return {time:t,boxes:[face(.15,leftTalks?(i%2?.09:.02):.03),face(.65,leftTalks?.03:(i%2?.1:.02))]}});
test('the face moving its lips becomes the subject, with a hard cut on change',()=>{
  const out=speakerFrames(frames);
  assert.equal(out[0].boxes.length,2);
  const first=out.find(f=>f.speaker!==null);assert.equal(first.boxes[0].x,.15);
  const cut=out.find(f=>f.cut);assert.ok(cut&&cut.time>=2&&cut.time<3.5);assert.equal(cut.boxes[0].x,.65);
  assert.equal(out.filter(f=>f.cut).length,1);
});
test('still faces never trigger a speaker and keep the group framed',()=>{
  const still=frames.map(f=>({...f,boxes:f.boxes.map(b=>({...b,mouth:.03}))}));
  assert.ok(speakerFrames(still).every(f=>f.speaker===null&&f.boxes.length===2));
});
test('speaker cuts become scene cuts in the crop track',()=>{
  const moment={start:0,end:5,trimIn:0,trimOut:4.75};
  const track=buildReframeTrack({moment,width:1920,height:1080,aspect:'portrait',frames:speakerFrames(frames),method:'speaker-tracking'});
  assert.ok(track.keyframes.some(k=>k.sceneCut));assert.match(track.warnings[0],/lip movement/i);
});
