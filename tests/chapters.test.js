import test from 'node:test';import assert from 'node:assert/strict';import {Readable} from 'node:stream';
import {chapterTranscript,cleanChapters,youtubeChapters,createChapterService,clock} from '../lib/chapters.js';
import {pickHighlight,wrapTitle} from '../public/title-card.js';
import {youtubeText} from '../public/chapters.js';

test('the transcript sent for chapters is one line per minute and stays inside its budget',()=>{
  const cues=Array.from({length:7200},(_,i)=>({start:i,end:i+1,text:'word '.repeat(12)}));
  const text=chapterTranscript(cues,{budget:20000}),lines=text.split('\n');
  assert.equal(lines.length,120);assert.match(lines[0],/^\[0:00\] word/);assert.match(lines[61],/^\[1:01:00\] /);
  assert.ok(text.length<=20000+120*12,`${text.length} characters`);
  assert.equal(chapterTranscript([{start:NaN,text:'x'},{start:3,text:'  '}]),'');
});

test('chapters are kept in order, inside the recording, 30 s apart and starting at 0:00',()=>{
  const out=cleanChapters([{start:400,title:'Later',summary:'b'},{start:12,title:'  First  ',summary:'a'},{start:420,title:'Too close',summary:''},{start:9999,title:'Past the end',summary:''},{start:600,title:'',summary:'untitled'},{start:'x',title:'Bad'}],7670);
  assert.deepEqual(out.map(c=>[c.start,c.title]),[[0,'First'],[400,'Later']]);
  assert.equal(cleanChapters('nope',100).length,0);
  assert.equal(youtubeChapters([{start:0,title:'Intro'},{start:3725,title:'Votes'}]),'0:00 Intro\n1:02:05 Votes');
  assert.equal(youtubeText([{start:0,title:'Intro'},{start:65,title:'Two'}]),'0:00 Intro\n1:05 Two');
  assert.equal(clock(59),'0:59');
});

function fakeService({status='complete',answer,ok=true}={}){
  const records=new Map(),calls=[];
  const store={getRecord:(k,id)=>records.get(k+'/'+id),putRecord:(k,id,v)=>records.set(k+'/'+id,v)};
  const job={id:'11111111-1111-4111-8111-111111111111',status,language:'English',duration:600,sourceId:'22222222-2222-4222-8222-222222222222',sourceName:'Episode 32'};
  const subtitles={get:id=>{if(id!==job.id)throw Error('Processing job not found.');return job},track:(id,original)=>[{start:0,text:original?'مرحبا':'Hello everyone'},{start:200,text:'The vote is tonight'}]};
  const fetchImpl=async(url,init)=>{calls.push(JSON.parse(init.body));return {ok,status:ok?200:401,json:async()=>ok?{choices:[{message:{content:JSON.stringify(answer??{chapters:[{start:5,title:'Welcome',summary:'The hosts open the show.'},{start:200,title:'The vote',summary:'They talk about tonight.'}]})}}]}:{error:{message:'Bad key'}}}};
  return {service:createChapterService({store,subtitles,fetchImpl,key:()=>'test-key'}),calls,job};
}
const call=async(service,method,url,headers={})=>{const req=Readable.from([]);Object.assign(req,{method,url,headers:{host:'127.0.0.1:3001',...headers}});let out;await service.handle(req,{},(_,status,data)=>out={status,data});return out};

test('making chapters reads the translated track, saves them, and reopens them without another request',async()=>{
  const {service,calls,job}=fakeService(),url='/api/chapters/'+job.id;
  assert.deepEqual((await call(service,'GET',url)).data,{chapters:null});
  const made=await call(service,'POST',url,{origin:'http://127.0.0.1:3001'});
  assert.equal(made.status,200);assert.deepEqual(made.data.chapters.map(c=>[c.start,c.title]),[[0,'Welcome'],[200,'The vote']]);
  assert.equal(calls.length,1);assert.match(calls[0].messages[1].content,/\[3:00\] The vote is tonight/);assert.equal(calls[0].response_format.json_schema.name,'episode_chapters');
  assert.equal((await call(service,'GET',url)).data.chapters.length,2);assert.equal(calls.length,1);
});

test('chapters refuse unfinished tracks, other origins, unknown tracks and provider errors with a clear status',async()=>{
  const unfinished=fakeService({status:'running'});assert.equal((await call(unfinished.service,'POST','/api/chapters/'+unfinished.job.id)).status,409);
  const {service,job}=fakeService();
  assert.equal((await call(service,'POST','/api/chapters/'+job.id,{origin:'https://example.com'})).status,403);
  assert.equal((await call(service,'POST','/api/chapters/33333333-3333-4333-8333-333333333333')).status,404);
  const failing=fakeService({ok:false});const out=await call(failing.service,'POST','/api/chapters/'+failing.job.id);assert.equal(out.status,401);assert.match(out.data.error,/Bad key/);
  const empty=fakeService({answer:{chapters:[]}});assert.equal((await call(empty.service,'POST','/api/chapters/'+empty.job.id)).status,502);
  assert.equal(await service.handle(Object.assign(Readable.from([]),{method:'GET',url:'/api/other',headers:{}}),{},()=>{}),false);
});

test('title cards highlight the strongest word and wrap titles to the box',()=>{
  assert.equal(pickHighlight('She did not see that coming'),'coming');
  assert.equal(pickHighlight('The Power of Love, Episode 32'),'Episode');
  assert.equal(pickHighlight(''),'');
  const measure=text=>text.length*10;
  assert.deepEqual(wrapTitle(measure,'one two three four',100),['one two','three four']);
  assert.equal(wrapTitle(measure,'unbreakablewordhere',90),null);
});
