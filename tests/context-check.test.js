import test from 'node:test';
import assert from 'node:assert/strict';
import {contextLines,contextBeats,createContextCheck} from '../lib/context-check.js';
import {Readable} from 'node:stream';

const cue=(start,text)=>({start,end:start+1,text});
const moment={id:'clip',start:100,end:130,trimIn:4,trimOut:8,captionLanguage:'English',captionCues:{Original:[cue(2,'هل كنت تعلم؟'),cue(5,'نعم'),cue(9,'انتظر')],English:[cue(2,'Did you know?'),cue(5,'Yes')]}};
test('context review uses saved cue timings and rejects fabricated indexes and roles',()=>{
  const {lines}=contextLines(moment);
  assert.deepEqual(lines.map(line=>line.start),[2,5,9]);
  assert.equal(lines[0].translation,'Did you know?');
  const beats=contextBeats({beats:[{line:999,role:'Setup'},{line:0,role:'Setup',reason:'This is the question'},{line:1,role:'Setup'},{line:2,role:'Invented'}]},lines);
  assert.deepEqual(beats.map(({role,start,original})=>[role,start,original]),[['Setup',2,'هل كنت تعلم؟']]);
  const long={...moment,end:230,trimOut:100,captionCues:{Original:Array.from({length:120},(_,i)=>cue(i,'Line '+i))}};
  assert.equal(contextLines(long).sampled,true);
  assert.ok(contextLines(long).lines.length<=36);
});
test('a repeated context check reuses the Muse result and falls back to saved dialogue without a key',async()=>{
  const records=new Map();let calls=0,key='fixture';
  const store={getProject:()=>({state:{moments:[moment]}}),getRecord:(_,id)=>records.get(id),putRecord:(_,id,value)=>records.set(id,value)};
  const api=createContextCheck({store,getKey:()=>key,ask:async()=>{calls++;return {beats:[{line:0,role:'Setup',reason:'Question'}]}}});
  const run=async()=>{
    const request=Object.assign(Readable.from([JSON.stringify({projectId:'project',momentId:'clip'})]),{url:'/api/context-check',method:'POST',headers:{}});
    let result;await api(request,{},(_,code,data)=>{assert.equal(code,200);result=data});return result;
  };
  assert.equal((await run()).method,'muse');
  assert.equal((await run()).beats[0].start,2);
  assert.equal(calls,1);
  key='';
  assert.deepEqual((await run()).beats.map(beat=>beat.role),['Before the cut','Inside the cut','After the cut']);
});
