import test from 'node:test';import assert from 'node:assert/strict';
import {parseSilence,silenceCuts,fillerCuts,cleanCuts,selectExpression,skipCut,removedSeconds} from '../public/silence.js';
import {pictureFilters,audioFilters} from '../lib/exports.js';
test('silence log becomes padded cuts and never removes the whole clip',()=>{
  const log='[silencedetect] silence_start: 1.0\n[silencedetect] silence_end: 2.5 | silence_duration: 1.5\nsilence_start: 4.0\nsilence_end: 4.3\nsilence_start: 8';
  assert.deepEqual(parseSilence(log,10),[{start:1,end:2.5},{start:4,end:4.3},{start:8,end:10}]);
  assert.deepEqual(silenceCuts(parseSilence(log,10)),[{start:1.15,end:2.35},{start:8.15,end:9.85}]);
  assert.deepEqual(cleanCuts([{start:5,end:6},{start:5.5,end:7},{start:-1,end:.05}],0,10),[{start:5,end:7}]);
  assert.deepEqual(cleanCuts([{start:0,end:9.5}],0,10),[]);
  assert.equal(removedSeconds([{start:1,end:2},{start:3,end:3.5}]),1.5);
  assert.equal(skipCut([{start:1,end:2}],1.4),2);assert.equal(skipCut([{start:1,end:2}],2.1),null);
});
test('only hesitation sounds count as fillers',()=>{
  const cuts=fillerCuts([{text:'Umm,',start:1,end:1.3},{text:'like',start:2,end:2.2},{text:'uh',start:3,end:3.1},{text:'so',start:4,end:4.1},{text:'えーと',start:5,end:5.2}]);
  assert.equal(cuts.length,2);assert.equal(cuts[0].start,.96);
});
test('export drops cuts after captions on both picture and sound',()=>{
  const m={trimIn:10,trimOut:20,cuts:[{start:12,end:13}],frameMode:'fit'};
  assert.equal(selectExpression(m.cuts,10),'not(between(t,2,3))');
  assert.match(pictureFilters(m,720,1280,'0.ass',30),/ass=0\.ass.*,fps=30,select='not\(between\(t,2,3\)\)',setpts=N\/FRAME_RATE\/TB$/);
  assert.equal(audioFilters(m),"aselect='not(between(t,2,3))',asetpts=N/SR/TB");
  assert.equal(audioFilters({trimIn:0,trimOut:5}),'');
});
