import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSegmentList,planClip,pruneSegments,validateClipSeconds,liveLimits} from '../lib/live-buffer.js';
const segs=Array.from({length:10},(_,i)=>({file:`seg${String(i).padStart(6,'0')}.ts`,start:1000+i*2,end:1002+i*2}));
test('reads FFmpeg csv segment lists and ignores foreign or broken rows',()=>{
  const list=parseSegmentList('seg000000.ts,1000.000,1002.000\n../etc/passwd,1,2\nseg000001.ts,1002,x\nseg000002.ts,1004.5,1006.25\n');
  assert.deepEqual(list,[{file:'seg000000.ts',start:1000,end:1002},{file:'seg000002.ts',start:1004.5,end:1006.25}]);
});
test('clip back takes the newest segments and offsets into the first one',()=>{
  assert.deepEqual(planClip(segs,5),{files:['seg000007.ts','seg000008.ts','seg000009.ts'],offset:1,duration:5,start:1015,end:1020});
});
test('clip back longer than the buffer returns everything buffered',()=>{
  const plan=planClip(segs,60);assert.equal(plan.files.length,10);assert.equal(plan.offset,0);assert.equal(plan.duration,20);
});
test('clip back before anything is buffered explains why',()=>{assert.throws(()=>planClip([],15),/Nothing is buffered/)});
test('clip length is bounded',()=>{
  assert.equal(validateClipSeconds('30'),30);
  for(const v of [0,4,121,NaN,'x',Infinity])assert.throws(()=>validateClipSeconds(v));
});
test('buffer pruning keeps the rolling window plus one segment of slack',()=>{
  const long=Array.from({length:200},(_,i)=>({file:`seg${i}.ts`,start:i*2,end:i*2+2}));
  const {keep,drop}=pruneSegments(long);
  assert.equal(keep.length+drop.length,200);
  assert.ok(keep[keep.length-1].end-keep[0].start>=liveLimits.bufferSeconds);
  assert.ok(keep[keep.length-1].end-keep[0].start<=liveLimits.bufferSeconds+2*liveLimits.segmentSeconds);
});
import {detectPeak} from '../lib/live-buffer.js';
test('audio peaks need a baseline, a clear rise and an audible level',()=>{
  const steady=Array(12).fill(-30);
  assert.equal(detectPeak(steady,-22),true);
  assert.equal(detectPeak(steady,-27),false);
  assert.equal(detectPeak(steady.slice(0,5),-10),false);
  assert.equal(detectPeak(Array(12).fill(-70),-55),false);
  assert.equal(detectPeak(Array(12).fill(-40),-26),true);
  assert.equal(detectPeak(steady,NaN),false);
});
import {planRange} from '../lib/live-buffer.js';
test('+10s plans an exact earlier range and refuses footage that left the buffer',()=>{
  const segs=Array.from({length:10},(_,i)=>({file:`seg${String(i).padStart(6,'0')}.ts`,start:1000+i*2,end:1002+i*2}));
  assert.deepEqual(planRange(segs,1005,1015),{files:['seg000002.ts','seg000003.ts','seg000004.ts','seg000005.ts','seg000006.ts','seg000007.ts'],offset:1,duration:10,start:1005,end:1015});
  assert.equal(planRange(segs,990,1004).start,1000);
  assert.throws(()=>planRange(segs,900,950),/left the 5-minute buffer/);
});
import {discoverySections,mergeSpeech,clipLengthSeconds} from '../lib/discovery.js';
test('clip-length presets size discovery sections, and long sections merge two speech halves in order',()=>{
  assert.equal(discoverySections(600,80,'short')[0].end,28);
  assert.equal(discoverySections(600,80,'long')[0].end,88);
  assert.equal(discoverySections(600,80)[0].end,45);
  assert.equal(discoverySections(600,80,'nope')[0].end,clipLengthSeconds.auto);
  const merged=mergeSpeech([{offset:0,part:{transcript:'one',turns:[{startMs:0,endMs:1000,text:'one'}],words:[]}},{offset:44,part:{transcript:'two',turns:[{startMs:500,endMs:900,text:'two'}],words:[{text:'two',start:.5,end:.9}]}}]);
  assert.equal(merged.transcript,'one\ntwo');
  assert.deepEqual(merged.turns.map(t=>t.startMs),[0,44500]);
  assert.equal(merged.words[0].start,44.5);
});
import {playlistDelay,signalScore} from '../lib/live-buffer.js';
test('delay behind live comes from the playlist program-date-time, or is unknown',()=>{
  const now=Date.parse('2026-11-02T10:00:10Z');
  const playlist='#EXTM3U\n#EXT-X-PROGRAM-DATE-TIME:2026-11-02T10:00:02.000Z\n#EXTINF:2.000,\nseg1.ts\n#EXT-X-PROGRAM-DATE-TIME:2026-11-02T10:00:04.000Z\n#EXTINF:2.000,\nseg2.ts\n';
  assert.equal(playlistDelay(playlist,now),4);
  assert.equal(playlistDelay('#EXTM3U\n#EXTINF:2,\nseg.ts',now),null);
});
test('live clip score counts only signals inside the clip',()=>{
  const markers=[{t:10,kind:'chat'},{t:12,kind:'chatlaugh'},{t:50,kind:'laugh'},{t:11,kind:'manual'}];
  assert.equal(signalScore(markers,0,20),80);
  assert.equal(signalScore(markers,30,40),35);
  assert.equal(signalScore(markers,0,60,50),99);
});
