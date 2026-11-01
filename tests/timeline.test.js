import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {buildTimelineDocument,timelineRate,parseTimelineMediaInfo,createTimelineExport,createTimelineApi} from '../lib/timeline.js';
import {openStore} from '../lib/store.js';
import {ffmpeg} from '../lib/exports.js';
const info={width:320,height:180,duration:60,fps:25,audio:true,channels:2,sampleRate:48000};
const moment=(id,extra={})=>({id,url:'/api/import/00000000-0000-0000-0000-000000000001/media',sourceName:'Source & <camera>',start:10,end:20,mediaStart:10,trimIn:1.04,trimOut:3.04,frameMode:'fit',captionLanguage:'Original',showCaptions:false,...extra});
// Parse through an independent XML implementation instead of asserting only strings.
function xmlTree(xml){const result=spawnSync('python3',['-c',`import sys,json,xml.etree.ElementTree as E
r=E.fromstring(sys.stdin.read())
def tree(e): return {'tag':e.tag,'attrs':e.attrib,'text':e.text,'children':[tree(c) for c in e]}
print(json.dumps(tree(r)))`],{input:xml,encoding:'utf8'});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout)}
const child=(node,tag)=>node.children.find(c=>c.tag===tag),value=(node,tag)=>child(node,tag)?.text;
const descendants=(node,tag)=>[...(node.tag===tag?[node]:[]),...node.children.flatMap(c=>descendants(c,tag))];
test('FCP7 XML preserves ordered source trims, shared file references, frame clocks and linked stereo',()=>{
 const file='/tmp/source & café #1.mp4',result=buildTimelineDocument({name:'Cut & <review>\u0001',aspect:'portrait',clips:[{moment:moment('late'),file,info},{moment:moment('early',{start:0,end:5,mediaStart:0,trimIn:.12,trimOut:.52}),file,info}]});
 const tree=xmlTree(result.xml),sequence=child(tree,'sequence'),media=child(sequence,'media'),video=child(media,'video'),videoItems=child(video,'track').children.filter(c=>c.tag==='clipitem');
 assert.equal(tree.attrs.version,'5');assert.equal(value(sequence,'name'),'Cut & <review>');assert.equal(value(sequence,'duration'),'60');
 assert.deepEqual(videoItems.map(c=>[value(c,'start'),value(c,'end'),value(c,'in'),value(c,'out')]),[['0','50','276','326'],['50','60','3','13']]);
 assert.equal(descendants(tree,'pathurl').length,1);assert.equal(descendants(tree,'pathurl')[0].text,pathToFileURL(file).href);
 assert.equal(value(child(child(video,'format'),'samplecharacteristics'),'width'),'1080');assert.equal(value(child(child(video,'format'),'samplecharacteristics'),'height'),'1920');
 const audio=child(media,'audio'),tracks=audio.children.filter(c=>c.tag==='track');assert.equal(tracks.length,2);
 assert.deepEqual(tracks.map(t=>t.children.filter(c=>c.tag==='clipitem').map(c=>[value(c,'start'),value(c,'end'),value(child(c,'sourcetrack'),'trackindex')])),[[['0','50','1'],['50','60','1']],[['0','50','2'],['50','60','2']]]);
 const clipIds=new Set(descendants(tree,'clipitem').map(c=>c.attrs.id));for(const ref of descendants(tree,'linkclipref'))assert.ok(clipIds.has(ref.text));assert.equal(descendants(videoItems[0],'linkclipref').length,3);
});
test('NTSC timebase uses 1000/1001 and cumulative timeline quantization does not drift',()=>{
 assert.deepEqual(timelineRate('30000/1001'),{timebase:30,ntsc:true,numerator:30000,denominator:1001,fps:30000/1001});assert.equal(timelineRate(23.976).timebase,24);assert.equal(timelineRate(59.94).ntsc,true);assert.equal(timelineRate(30).ntsc,false);assert.throws(()=>timelineRate(27.32),/frame rate/);
 const clips=Array.from({length:100},(_,i)=>({moment:moment(String(i),{start:0,end:1,mediaStart:0,trimIn:0,trimOut:.21}),file:'/tmp/source.mp4',info:{...info,fps:30000/1001}}));
 const result=buildTimelineDocument({name:'NTSC',clips}),tree=xmlTree(result.xml),sequence=child(tree,'sequence');assert.equal(value(child(sequence,'rate'),'ntsc'),'TRUE');assert.equal(value(sequence,'duration'),'600');assert.equal(result.sidecar.clips.at(-1).sequenceOutFrame,600);assert.ok(result.sidecar.clips.every(c=>c.mediaOutFrame-c.mediaInFrame===6));
});
test('captured-window local zero differs from original source clock; omitted effects and captions are explicit',()=>{
 const m=moment('capture',{start:600,end:610,mediaStart:undefined,trimIn:1,trimOut:3,showHook:true,hook:'Title',frameMode:'fill',zoom:1.5,sourceCaptionMask:true,showCaptions:true,captionStyle:'karaoke',captionOffset:0,captionCues:{Original:[{start:1.2,end:2.4,text:'Review <this>',uncertain:true}]},captionReviewed:{Original:false}});
 const result=buildTimelineDocument({name:'Capture',clips:[{moment:m,file:'/tmp/capture.webm',info:{...info,duration:10,audio:false,channels:0}}]});
 const item=descendants(xmlTree(result.xml),'clipitem')[0];assert.equal(value(item,'in'),'25');assert.equal(value(item,'out'),'75');assert.equal(result.sidecar.clips[0].originalSourceStartSeconds,601);assert.equal(result.sidecar.clips[0].mediaStartSeconds,1);assert.equal(result.sidecar.clips[0].savedEdits.zoom,1.5);
 assert.match(result.warnings.join(' '),/framing/i);assert.match(result.warnings.join(' '),/caption/i);assert.match(result.warnings.join(' '),/review/i);assert.match(result.srt,/00:00:00,200 --> 00:00:01,400/);assert.match(result.srt,/Review <this>/);assert.equal(descendants(xmlTree(result.xml),'audio').length,1);
});
test('probe metadata fails closed when required video/rate/audio metadata is unknown',()=>{
 const parsed=parseTimelineMediaInfo('Duration: 00:00:10.04, start: 0\n Stream #0:0: Video: h264, yuv420p, 320x180, 29.97 fps, 30k tbn\n Stream #0:1: Audio: aac, 48000 Hz, stereo, fltp');assert.equal(parsed.fps,29.97);assert.equal(parsed.channels,2);assert.equal(parsed.sampleRate,48000);assert.throws(()=>parseTimelineMediaInfo('Video: h264, 320x180'),/frame rate|duration/);assert.throws(()=>parseTimelineMediaInfo('Duration: 00:00:10.00\nVideo: h264, 320x180, 25 fps\nAudio: aac, 48000 Hz, 5.1, fltp'),/mono or stereo/);
});
test('timeline rejects invalid trims and source overruns',()=>{
 for(const patch of [{trimIn:-1},{trimOut:11},{mediaStart:-1},{trimIn:2,trimOut:2.01},{mediaStart:59}])assert.throws(()=>buildTimelineDocument({clips:[{moment:moment('bad',patch),file:'/tmp/source.mp4',info}]}),/trim|source|frame/i);
});
test('API exports real saved downloads, refuses cross-project IDs and releases imports after failures',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'timeline-api-')),store=openStore(root),file=path.join(root,'fixture.mp4');let held=0;
 try{
  await ffmpeg(['-v','error','-y','-f','lavfi','-i','testsrc2=size=320x180:rate=25','-f','lavfi','-i','sine=frequency=500:sample_rate=48000','-t','4','-c:v','libx264','-preset','ultrafast','-c:a','aac',file]);
  const p=store.createProject(),foreign=store.createProject();store.putMoment(p.id,moment('saved',{start:0,end:4,mediaStart:0,trimIn:1,trimOut:3}));store.putMoment(foreign.id,moment('foreign'));
  const claimSource=()=>{held++;return {file,release(){held--}}},api=createTimelineApi({store,claimSource});
  const call=async(body,headers={},method='POST')=>{const req=Readable.from([JSON.stringify(body)]);Object.assign(req,{url:'/api/timeline',method,headers});let output;await api(req,{},(_,status,data)=>output={status,data});return output};
  const response=await call({projectId:p.id,momentIds:['saved'],name:'Review'});assert.equal(response.status,201);assert.equal(held,0);assert.equal(response.data.xml.name,'Review.xml');assert.equal(response.data.sidecar.name,'Review-context-desk.json');
  const xml=await fs.readFile(store.assetPath(response.data.xml.id).file,'utf8'),sequence=child(xmlTree(xml),'sequence');assert.equal(value(sequence,'duration'),'50');assert.equal(descendants(sequence,'pathurl')[0].text,pathToFileURL(file).href);
  for(const momentIds of [[],Array(101).fill('saved'),['foreign']]){assert.equal((await call({projectId:p.id,momentIds})).status,400);assert.equal(held,0)}
  const repeated=await call({projectId:p.id,momentIds:['saved','saved']});assert.equal(repeated.status,201);assert.equal(repeated.data.durationFrames,100);assert.equal(held,0);
  assert.equal((await call({projectId:p.id,momentIds:['saved']},{origin:'https://elsewhere.example',host:'localhost:3000'})).status,403);assert.equal((await call({}, {},'GET')).status,405);
  const missing=async()=>createTimelineExport({store,claimSource:()=>{held++;return {file:path.join(root,'absent.mp4'),release(){held--}}}},{projectId:p.id,momentIds:['saved']});await assert.rejects(missing);assert.equal(held,0);
 }finally{store.close();await fs.rm(root,{recursive:true,force:true})}
});

test('mixed-rate clips retain source in/out clocks while audio stays aligned across silent gaps',()=>{
 const result=buildTimelineDocument({clips:[
  {moment:moment('a',{start:0,end:4,mediaStart:0,trimIn:0,trimOut:.2}),file:'/tmp/25.mp4',info:{...info,audio:false,channels:0}},
  {moment:moment('b',{start:0,end:4,mediaStart:0,trimIn:1,trimOut:1.2}),file:'/tmp/30.mp4',info:{...info,fps:30,channels:1}},
  {moment:moment('c',{start:0,end:4,mediaStart:0,trimIn:2,trimOut:2.2}),file:'/tmp/25-stereo.mp4',info}
 ]});
 const media=child(child(xmlTree(result.xml),'sequence'),'media'),videoItems=child(child(media,'video'),'track').children.filter(c=>c.tag==='clipitem');
 assert.deepEqual(videoItems.map(c=>[value(c,'start'),value(c,'end'),value(c,'in'),value(c,'out'),value(child(c,'rate'),'timebase')]),[['0','5','0','5','25'],['5','10','30','36','30'],['10','15','50','55','25']]);
 const tracks=child(media,'audio').children.filter(c=>c.tag==='track');assert.deepEqual(tracks.map(t=>t.children.filter(c=>c.tag==='clipitem').map(c=>[value(c,'start'),value(c,'end')])),[[['5','10'],['10','15']],[['10','15']]]);
 assert.match(result.warnings.join(' '),/Mixed frame rates/);
});
test('asset capture timeline uses persisted media, project caption target and a separate review SRT',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'timeline-capture-')),store=openStore(root),file=path.join(root,'capture.mp4');
 try{
  await ffmpeg(['-v','error','-y','-f','lavfi','-i','testsrc2=size=320x180:rate=30000/1001','-t','3','-c:v','libx264','-preset','ultrafast',file]);
  const asset=store.putAsset(await fs.readFile(file),'video/mp4'),p=store.createProject();
  store.saveProject(p.id,{aspect:'square',settings:{liveCaptionLanguage:'English'},moments:[moment('capture',{url:asset.url,start:600,end:603,mediaStart:undefined,trimIn:1,trimOut:2,showCaptions:true,captionLanguage:'Arabic',captionReviewed:{English:true},captionCues:{English:[{start:1.2,end:1.7,text:'Actual saved translation'}],Arabic:[{start:1.2,end:1.7,text:'Original Arabic'}]}})]},0);
  const result=await createTimelineExport({store,claimSource(){throw Error('Assets must not claim imports')}},{projectId:p.id,momentIds:['capture']});
  assert.equal(result.rate.ntsc,true);assert.equal(result.rate.timebase,30);assert.equal(result.durationFrames,30);
  const xml=await fs.readFile(store.assetPath(result.xml.id).file,'utf8'),item=descendants(xmlTree(xml),'clipitem')[0];assert.equal(value(item,'in'),'30');assert.equal(value(item,'out'),'60');assert.equal(descendants(xmlTree(xml),'pathurl')[0].text,pathToFileURL(store.assetPath(asset.id).file).href);
  const sidecar=JSON.parse(await fs.readFile(store.assetPath(result.sidecar.id).file,'utf8'));assert.equal(sidecar.clips[0].originalSourceStartSeconds,601);assert.equal(sidecar.clips[0].savedEdits.captionLanguage,'English');
  const srt=await fs.readFile(store.assetPath(result.srt.id).file,'utf8');assert.match(srt,/Actual saved translation/);assert.doesNotMatch(srt,/Original Arabic/);
 }finally{store.close();await fs.rm(root,{recursive:true,force:true})}
});
