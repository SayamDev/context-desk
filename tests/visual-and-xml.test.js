import test from 'node:test';import assert from 'node:assert/strict';
import {searchIndex,queryLabels} from '../lib/visual-index.js';import {buildXmeml} from '../lib/nle-export.js';
test('visual search maps everyday words to Apple labels and merges nearby frames into ranges',()=>{
  assert.ok(queryLabels('glasses').includes('sunglasses'));assert.ok(queryLabels('sofas').includes('sofa'));
  const frames=[{t:0,labels:[{id:'people',c:.9}]},{t:2,labels:[{id:'sunglasses',c:.8}]},{t:4,labels:[{id:'sunglasses',c:.7}]},{t:20,labels:[{id:'eyeglasses',c:.5}]}];
  const r=searchIndex(frames,'glasses');assert.equal(r.length,2);assert.deepEqual([r[0].start,r[0].end],[2,6]);assert.deepEqual(r[1].labels,['eyeglasses']);
  assert.deepEqual(searchIndex(frames,'giraffe'),[]);
});
test('editor XML places clips back to back, in source frames, sharing one file definition',()=>{
  const xml=buildXmeml({name:'Ep & 31',fps:25,width:1920,height:1080,clips:[{name:'One',file:'/tmp/My Show/source.mp4',fileDuration:7904,in:10,out:20},{name:'Two',file:'/tmp/My Show/source.mp4',fileDuration:7904,in:100,out:105}]});
  assert.match(xml,/<name>Ep &amp; 31<\/name>/);assert.match(xml,/file:\/\/localhost\/tmp\/My%20Show\/source.mp4/);
  assert.equal((xml.match(/<file id="file-1">/g)||[]).length,1);assert.match(xml,/<start>0<\/start><end>250<\/end><in>250<\/in><out>500<\/out>/);assert.match(xml,/<start>250<\/start><end>375<\/end><in>2500<\/in><out>2625<\/out>/);
});
