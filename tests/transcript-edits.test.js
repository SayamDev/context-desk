import test from 'node:test';
import assert from 'node:assert/strict';
import {editByTranscript} from '../public/transcript-edits.js';
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const options=(action='keep-selected',extra={})=>{let n=0;return {action,contextSeconds:0,createId:()=>uuid(++n),...extra}};
const saved=(patch={})=>({id:'source-window',url:'/api/import/source/media',start:100,end:120,mediaStart:100,trimIn:1,trimOut:19,captionLanguage:'Original',captionOffset:0,timingSource:'estimated',transcript:'The complete original automated transcript.',captionCues:{Original:[{start:0,end:3,text:'First source line.'},{start:4,end:6,text:'A specific question?',uncertain:true,reviewReason:'Check the name.'},{start:6,end:9,text:'The complete answer.'},{start:12,end:14,text:'Another complete thought.'},{start:17,end:21,text:'Last source line.'}],English:[{start:0,end:3,text:'Translated first line.'}]},captionReviewed:{Original:false,English:true},analysis:{sourceEvidence:[{quote:'The complete answer.',start:106,end:109}]},approved:true,...patch});

test('keep creates source-ordered playable clips and preserves original source/media clocks',()=>{
  const moment=saved(),result=editByTranscript(moment,[3,1],options());
  assert.deepEqual(result.segments.map(s=>[s.trimIn,s.trimOut]),[[4,6],[12,14]]);assert.deepEqual(result.segments.map(s=>s.id),[uuid(1),uuid(2)]);assert.equal(result.duration,4);assert.equal(result.reviewRequired,true);assert.equal(result.timingSource,'estimated');
  assert.deepEqual(result.ranges.map(r=>[r.sourceStart,r.sourceEnd,r.mediaStart,r.mediaEnd]),[[104,106,104,106],[112,114,112,114]]);
  for(const segment of result.segments){assert.equal(segment.start,100);assert.equal(segment.end,120);assert.equal(segment.mediaStart,100);assert.equal(segment.approved,false);assert.equal(segment.transcript,moment.transcript);assert.equal(segment.captionCues.Original.length,5);assert.equal(segment.captionCues.English.length,1);assert.equal(segment.transcriptEdit.timingStatus,'draft')}
  assert.match(result.notes.join(' '),/estimated|draft/i);assert.deepEqual(moment,saved());
});
test('overlaps, repeated indices and inclusive index ranges merge without rearranging words',()=>{
  const result=editByTranscript(saved(),[2,{from:1,to:2},1,{start:5,end:8}],options());assert.deepEqual(result.segments.map(s=>[s.trimIn,s.trimOut]),[[4,9]]);assert.equal(result.duration,5);
});
test('selected timing clamps to current trim and small keep context handles never escape it',()=>{
  const result=editByTranscript(saved(),[0,4],options('keep-selected',{contextSeconds:.25}));assert.deepEqual(result.segments.map(s=>[s.trimIn,s.trimOut]),[[1,3.25],[16.75,19]]);assert.equal(result.duration,4.5);
});
test('remove creates the chronological complement and never restores selected speech through context handles',()=>{
  const result=editByTranscript(saved(),[1,2],options('remove-selected',{contextSeconds:.25}));assert.deepEqual(result.segments.map(s=>[s.trimIn,s.trimOut]),[[1,4],[9,19]]);assert.equal(result.duration,13);assert.deepEqual(result.removedRanges.map(r=>[r.start,r.end]),[[4,9]]);assert.match(result.notes.join(' '),/exact selected|padding/i);
});
test('displayed-track selection applies caption offset; explicit playback ranges are already offset',()=>{
  const moment=saved({captionLanguage:'English',captionOffset:2}),result=editByTranscript(moment,[0],options());assert.deepEqual(result.segments.map(s=>[s.trimIn,s.trimOut]),[[2,5]]);
  const original=editByTranscript(moment,{indices:[1],ranges:[{start:7,end:9}]},options('keep-selected',{language:'Original'}));assert.deepEqual(original.segments.map(s=>[s.trimIn,s.trimOut]),[[6,9]]);
});
test('capture local-zero media and absolute file media produce distinct correct clocks',()=>{
  const capture=saved({start:600,end:620,mediaStart:undefined}),result=editByTranscript(capture,[1],options());assert.equal(result.ranges[0].sourceStart,604);assert.equal(result.ranges[0].mediaStart,4);assert.equal(result.segments[0].mediaStart,undefined);assert.equal(result.segments[0].start,600);
});
test('nested captions, translations, words, review flags and analysis remain independent across every segment',()=>{
  const moment=saved();moment.captionCues.Original[1].words=[{start:4,end:5,text:'Question',uncertain:true}];const result=editByTranscript(moment,[1,3],options()),[a,b]=result.segments;
  assert.equal(a.captionCues.Original[1].uncertain,true);assert.equal(a.captionReviewed.English,true);a.captionCues.Original[1].words[0].text='Editor correction';a.captionCues.English[0].text='Changed translation';a.captionReviewed.English=false;a.analysis.sourceEvidence[0].quote='Changed note';
  assert.equal(b.captionCues.Original[1].words[0].text,'Question');assert.equal(moment.captionCues.English[0].text,'Translated first line.');assert.equal(b.captionReviewed.English,true);assert.equal(moment.analysis.sourceEvidence[0].quote,'The complete answer.');
});
test('whole-clip removal, empty/untimed selection and sub-playable pieces fail clearly',()=>{
  assert.throws(()=>editByTranscript(saved(),[{start:0,end:25}],options('remove-selected')),/whole clip|playable/i);
  assert.throws(()=>editByTranscript(saved(),[],options()),/select|line/i);
  const bad=saved({captionCues:{Original:[{text:'No times'}]}});assert.throws(()=>editByTranscript(bad,[0],options()),/valid.*line|timed/i);
  assert.throws(()=>editByTranscript(saved(),[{start:4,end:4.1}],options()),/0.2|playable/i);
  const result=editByTranscript(saved({trimIn:3.9}),[1],options('remove-selected'));assert.deepEqual(result.segments.map(s=>[s.trimIn,s.trimOut]),[[6,19]]);assert.ok(result.notes.some(note=>/short|0.2/.test(note)));
});
test('malformed IDs, duplicate IDs, unsupported options and invalid source clocks fail safely',()=>{
  for(const extra of [{createId:()=> 'unsafe'},{createId:()=>uuid(1),existingIds:[uuid(1)]},{contextSeconds:-1},{contextSeconds:4},{language:'Missing'},{action:'delete-all'},{typo:true}])assert.throws(()=>editByTranscript(saved(),[1,3],options('keep-selected',extra)),/ID|UUID|context|track|action|option/i);
  assert.throws(()=>editByTranscript(saved(),[1,3],options('keep-selected',{createId:()=>uuid(1)})),/duplicate|unique/i);
  for(const patch of [{trimIn:-1},{trimOut:21},{mediaStart:-1},{start:NaN},{end:100},{captionOffset:Infinity}])assert.throws(()=>editByTranscript(saved(patch),[1],options()),/trim|source|media|offset/i);
  assert.throws(()=>editByTranscript(saved(),[30],options()),/index|line/i);assert.throws(()=>editByTranscript(saved(),[{from:2,to:1}],options()),/range/i);
});
