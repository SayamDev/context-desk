import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {openStore} from '../lib/store.js';
import {ffmpeg} from '../lib/exports.js';
import {buildReframeTrack,createReframeApi,createReframeService,detectVisionFrames} from '../lib/reframe.js';
const box=(x,extra={})=>({x,y:.25,w:.1,h:.25,confidence:.95,...extra});
const moment={id:'m',url:'/api/import/00000000-0000-0000-0000-000000000001/media',start:300,end:310,mediaStart:30,trimIn:1,trimOut:5};
test('face geometry converts to crop overflow alignment rather than raw center percent',()=>{
 const result=buildReframeTrack({moment,width:1920,height:1080,aspect:'portrait',frames:[{time:1,boxes:[box(.15)]},{time:3,boxes:[box(.35)]},{time:5,boxes:[box(.55)]}]});
 assert.equal(result.canApply,true);assert.equal(result.coverage,1);assert.equal(result.keyframes[0].time,1);assert.ok(result.keyframes[0].focusX<10);assert.ok(result.keyframes.at(-1).focusX>50);assert.equal(result.keyframes[0].focusY,50);
 for(const frame of result.keyframes){assert.ok(frame.focusX>=0&&frame.focusX<=100);assert.ok(frame.focusY>=0&&frame.focusY<=100);assert.equal(frame.mediaTime,30+frame.time);assert.equal(frame.sourceTime,300+frame.time)}
});
test('smoothing holds isolated missing detections and does not chase frame-to-frame jitter',()=>{
 const frames=Array.from({length:11},(_,i)=>({time:1+i*.4,boxes:i===5?[]:[box(.4+(i%2?.005:-.005))]}));
 const result=buildReframeTrack({moment,width:1920,height:1080,aspect:'portrait',frames});
 assert.equal(result.canApply,true);assert.ok(result.coverage>.8);assert.match(result.warnings.join(' '),/missing|not detected/i);const spread=Math.max(...result.keyframes.map(k=>k.focusX))-Math.min(...result.keyframes.map(k=>k.focusX));assert.ok(spread<2);
});
test('multi-face wide groups and missing faces require manual review; explicit target selects geometrically',()=>{
 const frames=[1,3,5].map(time=>({time,boxes:[box(.1),box(.8)]}));
 const wide=buildReframeTrack({moment,width:1920,height:1080,aspect:'portrait',frames});assert.equal(wide.canApply,false);assert.equal(wide.needsReview,true);assert.equal(wide.subjects.length,2);assert.equal(wide.subjectsTime,1);assert.match(wide.warnings.join(' '),/multiple|group/i);
 const selected=buildReframeTrack({moment,width:1920,height:1080,aspect:'portrait',frames,subject:{x:.1,y:.25,w:.1,h:.25}});assert.equal(selected.canApply,true);assert.ok(selected.keyframes.every(k=>k.focusX<5));
 const empty=buildReframeTrack({moment,width:1920,height:1080,aspect:'portrait',frames:frames.map(f=>({...f,boxes:[]}))});assert.equal(empty.canApply,false);assert.equal(empty.coverage,0);assert.match(empty.warnings.join(' '),/no.*face/i);
});
test('out-of-range detector boxes, reversed sample times and invalid trim fail safely',()=>{
 assert.throws(()=>buildReframeTrack({moment:{...moment,trimIn:-1},width:1920,height:1080,frames:[]}),/trim/i);
 assert.throws(()=>buildReframeTrack({moment,width:1920,height:1080,frames:[{time:3,boxes:[]},{time:1,boxes:[]}]}),/time|ordered/i);
 const result=buildReframeTrack({moment,width:1920,height:1080,frames:[{time:1,boxes:[box(-1)]},{time:5,boxes:[box(.4,{confidence:.1})]}]});assert.equal(result.canApply,false);
});
test('saved media service decodes actual trimmed frames and releases imports on errors',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'reframe-test-')),store=openStore(root),file=path.join(root,'test.mp4');let held=0,observed;
 try{
  await ffmpeg(['-v','error','-y','-f','lavfi','-i','testsrc2=size=320x180:rate=10','-t','3','-c:v','libx264','-preset','ultrafast',file]);
  const p=store.createProject();store.putMoment(p.id,{...moment,start:300,end:303,mediaStart:0,trimIn:.5,trimOut:2.5});
  const service=createReframeService({store,claimSource(){held++;return {file,release(){held--}}},detector:async({frames})=>{observed=frames;for(const frame of frames)assert.ok((await fs.stat(frame.file)).size>100);return {method:'test-geometric-detector',frames:frames.map(f=>({time:f.time,boxes:[box(.5)]}))}}});
  const result=await service.start({projectId:p.id,momentId:'m',aspect:'portrait'});assert.equal(result.method,'test-geometric-detector');assert.equal(result.canApply,true);assert.equal(held,0);assert.equal(observed[0].time,.5);assert.equal(observed.at(-1).time,2.4);assert.equal(result.keyframes.at(-1).time,2.5);assert.equal(result.keyframes[0].sourceTime,300.5);await assert.rejects(fs.access(observed[0].file));
  await assert.rejects(service.start({projectId:p.id,momentId:'foreign'}),/belong|saved|found/);assert.equal(held,0);
  const bad=createReframeService({store,claimSource(){held++;return {file,release(){held--}}},detector:async()=>{throw Error('Detector unavailable')}});await assert.rejects(bad.start({projectId:p.id,momentId:'m'}),/Detector unavailable/);assert.equal(held,0);
  const api=createReframeApi({store,claimSource(){throw Error('Should not be reached')}}),req=Readable.from(['{}']);Object.assign(req,{method:'POST',url:'/api/reframe',headers:{origin:'https://foreign.example',host:'localhost:3000'}});let response;await api(req,{},(_,code,data)=>response={code,data});assert.equal(response.code,403);
 }finally{store.close();await fs.rm(root,{recursive:true,force:true})}
});
test('installed Apple Vision executes locally on real decoded frames without inventing a face',async()=>{
 if(process.platform!=='darwin')return;
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'reframe-vision-'));try{const file=path.join(root,'0000.jpg');await ffmpeg(['-v','error','-y','-f','lavfi','-i','color=c=black:s=320x180','-frames:v','1',file]);let result;try{result=await detectVisionFrames({frames:[{time:0,file}]});}catch(error){assert.match(error.message,/Vision cannot allocate image buffers in this sandbox/);return;}assert.equal(result.method,'apple-vision-faces');assert.equal(result.frames.length,1);assert.equal(result.frames[0].time,0);assert.deepEqual(result.frames[0].boxes,[]);}finally{await fs.rm(root,{recursive:true,force:true})}
});
