import test from 'node:test';import assert from 'node:assert/strict';
import {guideStatus,guideSteps} from '../public/guide.js';
import {destinationInfo} from '../public/destinations.js';
test('the guide always offers exactly one next action, in order',()=>{
  assert.equal(guideStatus({}).action,'add-video');
  assert.equal(guideStatus({hasSource:true,finding:true}).action,null);
  assert.equal(guideStatus({hasSource:true}).action,'find-clips');
  assert.equal(guideStatus({hasSource:true,clips:3}).cta,'Open the top clip');
  const check=guideStatus({hasSource:true,clips:3,selected:true,toCheck:2});assert.equal(check.step,2);assert.match(check.cta,/2 lines need/);
  assert.equal(guideStatus({hasSource:true,clips:3,selected:true,reviewed:true}).action,'prepare-post');
  const done=guideStatus({hasSource:true,clips:3,selected:true,reviewed:true,exported:true});assert.equal(done.step,guideSteps.length);assert.match(done.hint,/nothing is posted for you/);
});
test('every destination explains how posting really happens, and never claims to post',()=>{
  for(const [id,info] of Object.entries(destinationInfo)){assert.ok(info.posting,id);assert.ok(!/\bposted for you\b|\bwe post\b/i.test(info.posting),id)}
  for(const id of ['tiktok','instagram','facebook','shorts'])assert.match(destinationInfo[id].posting,/^You post it/);
});

test('a connected live tab makes starting or stopping live clipping the one next action',async()=>{
  const {guideStatus}=await import('../public/guide.js');
  assert.equal(guideStatus({live:true,hasSource:true,clips:0}).action,'start-live');
  assert.equal(guideStatus({live:true,scanning:true,hasSource:true,clips:0}).cta,'Stop live clipping');
  assert.equal(guideStatus({live:true,hasSource:true,clips:3}).action,'start-live');
  assert.equal(guideStatus({live:true,scanning:true,hasSource:true,clips:3}).action,'open-clip');
  assert.equal(guideStatus({live:false,hasSource:true,clips:0}).action,'find-clips');
});
