import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleMoments,coverageSummary,sourcePosition,clampTrim,momentLanes} from '../public/studio-ui.js';

test('moment search covers retained source evidence and filters without discarding rejected windows',()=>{
  const moments=[{id:'a',start:12,status:'suggested',hook:'The answer',analysis:{evidence:'She asks about Cairo'}},{id:'b',start:2,status:'not-selected',transcript:'Quiet goodbye'},{id:'c',start:6,status:'interrupted'}];
  assert.deepEqual(visibleMoments(moments,{query:'cairo'}).map(m=>m.id),['a']);
  assert.deepEqual(visibleMoments(moments,{filter:'attention'}).map(m=>m.id),['c']);
  assert.deepEqual(visibleMoments(moments,{filter:'supported',direction:'desc'}).map(m=>m.id),['a']);
  assert.deepEqual(visibleMoments(moments).map(m=>m.id),['b','c','a']);
  assert.deepEqual(moments.map(m=>m.id),['a','b','c']);
});
test('coverage is a union of checked intervals, with truthful gaps and clamped boundaries',()=>{
  const moments=[{start:-2,end:4,analysis:{}},{start:2,end:7,analysis:{}},{start:8,end:99,status:'analysing'},{start:9,end:12,analysis:{}}];
  assert.deepEqual(coverageSummary(moments,10),{checked:8,percent:80,intervals:[[0,7],[9,10]]});
  assert.deepEqual(coverageSummary(moments,0),{checked:0,percent:0,intervals:[]});
});
test('source review uses imported source time and refuses a stale capture clock',()=>{
  assert.equal(sourcePosition({start:123,end:145,blob:{importId:'source'}},500),123);
  assert.equal(sourcePosition({start:123,end:145,sourceType:'screen'},500),null);
  assert.equal(sourcePosition({start:123,end:145,blob:{importId:'source'}},100),100);
});
test('pointer trim clamps crossing handles and retains a playable fifth of a second',()=>{
  assert.deepEqual(clampTrim('in',12,2,8,10),{in:7.8,out:8});
  assert.deepEqual(clampTrim('out',-1,2,8,10),{in:2,out:2.2});
  assert.deepEqual(clampTrim('in',-5,2,8,10),{in:0,out:8});
});
test('coincident source windows get distinct map lanes, while nonoverlapping windows reuse them',()=>{
 const moments=[{id:'b',start:0,end:4},{id:'a',start:0,end:4},{id:'c',start:4,end:8}];
 const result=momentLanes(moments);assert.equal(result.lanes,2);
 assert.deepEqual(result.windows.map(w=>[w.moment.id,w.lane]),[['a',0],['b',1],['c',0]]);
 assert.deepEqual(moments.map(m=>m.id),['b','a','c']);
});

test('producer-created transcript trims remain visible with the supported clip filter',()=>{assert.deepEqual(visibleMoments([{id:'manual',start:0,status:'manual',manual:true},{id:'rejected',start:2,status:'not-selected'}],{filter:'supported'}).map(m=>m.id),['manual'])});
test('Discover sorts by editorial score and keeps discarded clips out of view until asked',async()=>{
  const {visibleMoments}=await import('../public/studio-ui.js');
  const m=(id,start,score,extra={})=>({id,start,status:'suggested',analysis:{rankingScore:score},...extra});
  const list=[m('a',10,61),m('b',20,92),m('c',30,undefined),m('d',40,80,{dismissed:true})];
  assert.deepEqual(visibleMoments(list,{sort:'score'}).map(x=>x.id),['b','a','c']);
  assert.deepEqual(visibleMoments(list,{sort:'time'}).map(x=>x.id),['a','b','c']);
  assert.deepEqual(visibleMoments(list,{filter:'dismissed'}).map(x=>x.id),['d']);
});
