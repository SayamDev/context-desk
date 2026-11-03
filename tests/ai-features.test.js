import test from 'node:test';import assert from 'node:assert/strict';import {Readable} from 'node:stream';
import {createAskService,cleanMoments,questionKey} from '../lib/ask.js';
import {createCultureService,cleanLines,cleanNotes} from '../lib/culture.js';
import {activeNote} from '../public/culture-notes.js';
import {assDocument} from '../lib/exports.js';

const memoryStore=()=>{const records=new Map();return {getRecord:(k,id)=>records.get(k+'/'+id),putRecord:(k,id,v)=>records.set(k+'/'+id,{...v,id}),listRecords:k=>[...records].filter(([key])=>key.startsWith(k+'/')).map(([,v])=>v)}};
const muse=(answer,calls=[])=>async(url,init)=>{calls.push(JSON.parse(init.body));return {ok:true,status:200,json:async()=>({choices:[{message:{content:JSON.stringify(answer)}}]})}};
const call=async(service,method,url,body,headers={})=>{const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);Object.assign(req,{method,url,headers:{host:'127.0.0.1:3001',...headers}});let out;await service.handle(req,{},(_,status,data)=>out={status,data});return out};
const JOB='11111111-1111-4111-8111-111111111111';
const subtitles={get:id=>{if(id!==JOB)throw Error('Processing job not found.');return {id,status:'complete',language:'English',duration:3600,sourceName:'Episode 32'}},track:()=>[{start:3090,text:'I know that you told him about Ikram'},{start:3120,text:'That is a lie'}]};

test('answer moments stay inside the recording, 5 to 90 seconds, in order and not overlapping',()=>{
  const out=cleanMoments([{start:3200,end:3400,title:'Long',quote:'q',why:'w'},{start:3090,end:3165,title:'Accusation',quote:'q',why:'w'},{start:3100,end:3150,title:'Overlaps',quote:'',why:''},{start:9000,end:9050,title:'Past the end'},{start:10,end:12,title:'Too short'},{start:5,end:40,title:''}],3600);
  assert.deepEqual(out.map(m=>[m.start,m.end,m.title]),[[3090,3165,'Accusation'],[3200,3290,'Long']]);
  assert.equal(questionKey(' What  is the ARGUMENT? '),questionKey('what is the argument?'));
});

test('asking reads the whole track once, returns cited moments, and repeats come from the saved answer',async()=>{
  const calls=[],service=createAskService({store:memoryStore(),subtitles,key:()=>'k',fetchImpl:muse({answer:'Falla accuses Samer.',moments:[{start:3090,end:3165,title:'The accusation',quote:'I know that you told him about Ikram',why:'States it.'}]},calls)});
  const first=await call(service,'POST','/api/ask/'+JOB,{question:'What is the biggest argument?'},{origin:'http://127.0.0.1:3001'});
  assert.equal(first.status,200);assert.equal(first.data.moments[0].title,'The accusation');assert.match(calls[0].messages[1].content,/Question: What is the biggest argument\?/);assert.match(calls[0].messages[1].content,/\[51:30\] I know that you told him about Ikram/);
  const again=await call(service,'POST','/api/ask/'+JOB,{question:'what is the biggest argument?'});assert.equal(again.data.cached,true);assert.equal(calls.length,1);
  assert.equal((await call(service,'GET','/api/ask/'+JOB)).data.history.length,1);
  assert.equal((await call(service,'POST','/api/ask/'+JOB,{question:'?'})).status,400);
  assert.equal((await call(service,'POST','/api/ask/22222222-2222-4222-8222-222222222222',{question:'Anything?'})).status,404);
  assert.equal((await call(service,'POST','/api/ask/'+JOB,{question:'Anything?'},{origin:'https://evil.example'})).status,403);
});

test('culture notes keep one note per known line and save by content',async()=>{
  assert.deepEqual(cleanLines([{line:2,original:'يلا بينا',translation:"Let's go"},{line:'x',original:'a'},{line:3,original:''}]),[{line:2,original:'يلا بينا',translation:"Let's go"}]);
  assert.deepEqual(cleanNotes([{line:2,phrase:'يلا',literal:'come on',meaning:'Hurry up, let us go'},{line:2,phrase:'again',literal:'',meaning:'dup'},{line:9,phrase:'x',literal:'',meaning:'not sent'},{line:2,phrase:'',meaning:'m'}],[{line:2}]).length,1);
  const calls=[],service=createCultureService({store:memoryStore(),key:()=>'k',fetchImpl:muse({notes:[{line:4,phrase:'والله',literal:'by God',meaning:'I swear, used to insist it is true'}]},calls)});
  const body={lines:[{line:4,original:'والله ما قلت',translation:'I swear I did not say it'}],dialect:'Levantine',language:'English'};
  const out=await call(service,'POST','/api/culture-notes',body,{origin:'http://127.0.0.1:3001'});
  assert.equal(out.status,200);assert.equal(out.data.notes[0].phrase,'والله');assert.match(calls[0].messages[0].content,/Levantine/);assert.match(calls[0].messages[1].content,/4\. والله ما قلت\n {3}English: I swear I did not say it/);
  assert.equal((await call(service,'POST','/api/culture-notes',body)).data.cached,true);assert.equal(calls.length,1);
  assert.equal((await call(service,'POST','/api/culture-notes',{lines:[]})).status,400);
});

test('a culture note shows while its line plays, for at least 3 seconds, in the preview and the export',()=>{
  const cues=[{start:10,end:11,text:'I swear I did not say it'},{start:12,end:16,text:'Fine'}];
  const m={start:0,end:30,trimIn:5,trimOut:25,captionLanguage:'English',captionCues:{English:cues},captionReviewed:{English:true},showCaptions:true,captionStyle:'clean',showCultureNotes:true,cultureNotes:[{line:0,phrase:'والله',literal:'by God',meaning:'I swear, used to insist it is true'}]};
  const cueAt=line=>cues[line];
  assert.equal(activeNote(m,cueAt,12.5)?.phrase,'والله');assert.equal(activeNote(m,cueAt,13.5),null);
  assert.equal(activeNote({...m,showCultureNotes:false},cueAt,10.5),null);
  const ass=assDocument(m,1080,1920);
  assert.match(ass,/Style: Note,Arial,40,/);
  assert.match(ass,/Dialogue: 2,0:00:05\.00,0:00:08\.00,Note,,0,0,0,,\{\\c&H3BF2C9&\}والله\{\\c&HECF1F3&\}\\NI swear, used to insist it is true/i);
  assert.doesNotMatch(assDocument({...m,cultureNotes:[{...m.cultureNotes[0],hidden:true}]},1080,1920),/,Note,,/);
});

import {createTrailerService,cleanBeats} from '../lib/trailer.js';
test('trailer beats are 5-18 s, in story order, never overlapping and about a minute in all',()=>{
  const beats=cleanBeats([{start:600,end:640,role:'turn',title:'Too long gets cut',quote:'q'},{start:100,end:112,role:'setup',title:'Setup',quote:'q'},{start:105,end:115,role:'turn',title:'Overlap',quote:''},{start:900,end:902,role:'turn',title:'Too short'},{start:1200,end:1212,role:'odd',title:'Odd role',quote:''},{start:5000,end:5010,role:'payoff',title:'Past the end'}],3600);
  assert.deepEqual(beats.map(b=>[b.start,b.end,b.role]),[[100,112,'setup'],[600,618,'turn'],[1200,1212,'turn']]);
  const many=cleanBeats(Array.from({length:8},(_,i)=>({start:i*100,end:i*100+15,role:'turn',title:'Beat '+i,quote:''})),3600);
  assert.equal(many.length,5);assert.ok(many.reduce((n,b)=>n+b.end-b.start,0)<=75);
});
test('a trailer is made once per track, remade only on request, and needs at least three beats',async()=>{
  const beats=[{start:100,end:112,role:'setup',title:'A',quote:'a'},{start:300,end:312,role:'turn',title:'B',quote:'b'},{start:900,end:912,role:'payoff',title:'C',quote:'c'}];
  const calls=[],service=createTrailerService({store:memoryStore(),subtitles,key:()=>'k',fetchImpl:muse({title:'The red room',logline:'An accusation splits the house.',beats},calls)});
  const first=await call(service,'POST','/api/trailer/'+JOB,{},{origin:'http://127.0.0.1:3001'});assert.equal(first.status,200);assert.equal(first.data.beats.length,3);assert.equal(first.data.title,'The red room');
  assert.equal((await call(service,'POST','/api/trailer/'+JOB,{})).data.cached,true);assert.equal(calls.length,1);
  await call(service,'POST','/api/trailer/'+JOB,{again:true});assert.equal(calls.length,2);
  assert.equal((await call(service,'GET','/api/trailer/'+JOB)).data.title,'The red room');
  const thin=createTrailerService({store:memoryStore(),subtitles,key:()=>'k',fetchImpl:muse({title:'x',logline:'y',beats:beats.slice(0,2)})});
  assert.equal((await call(thin,'POST','/api/trailer/'+JOB,{})).status,502);
});
