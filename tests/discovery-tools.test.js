import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiscoveryTools} from '../public/discovery-tools.js';
class Element{
  constructor(tag,owner){this.tagName=tag.toUpperCase();this.ownerDocument=owner;this.children=[];this.attributes={};this.dataset={};this.style={};this.value='';this.hidden=false;this.disabled=false;this.checked=false;this.textContent='';this.className='';this.listeners={}}
  append(...items){for(const item of items){if(typeof item==='string'){this.children.push({textContent:item});continue}if(item.parentNode)item.parentNode.children=item.parentNode.children.filter(child=>child!==item);item.parentNode=this;this.children.push(item)}}
  appendChild(item){this.append(item);return item}replaceChildren(...items){for(const child of this.children)child.parentNode=null;this.children=[];this.textContent='';this.append(...items)}
  insertBefore(item,before){this.append(item);this.children=this.children.filter(child=>child!==item);this.children.splice(this.children.indexOf(before),0,item);item.parentNode=this}
  after(item){if(!this.parentNode)return;const index=this.parentNode.children.indexOf(this);this.parentNode.children.splice(index+1,0,item);item.parentNode=this.parentNode}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null}
  setAttribute(key,value){this.attributes[key]=String(value);if(key==='id')this.id=String(value)}getAttribute(key){return this.attributes[key]??null}
  addEventListener(type,callback){(this.listeners[type]??=[]).push(callback)}removeEventListener(type,callback){this.listeners[type]=(this.listeners[type]||[]).filter(item=>item!==callback)}
  async emit(type,extra={}){const event={target:this,preventDefault(){},...extra};if(this['on'+type])await this['on'+type](event);for(const callback of this.listeners[type]||[])await callback(event)}
  closest(selector){if(selector.startsWith('.'))return this.className.split(' ').includes(selector.slice(1))?this:this.parentNode?.closest(selector);if(selector.startsWith('#'))return this.id===selector.slice(1)?this:this.parentNode?.closest(selector);return this.tagName===selector.toUpperCase()?this:this.parentNode?.closest(selector)}
  focus(){this.ownerDocument.activeElement=this}
}
class Document{
  constructor(){this.body=new Element('body',this)}createElement(tag){return new Element(tag,this)}
  getElementById(id){const visit=node=>node.id===id?node:node.children?.map(visit).find(Boolean);return visit(this.body)}
}
const allText=node=>[node.textContent,...(node.children||[]).map(allText)].filter(Boolean).join(' ');
function fixture(t,callbacks={}){
  const doc=new Document(),previous=globalThis.document;globalThis.document=doc;t.after(()=>{globalThis.document=previous});
  for(const [id,tag,value] of [['batchPanel','section',''],['momentSearch','input',''],['captionLines','div',''],['aiBudget','select','25'],['clipTarget','select','5'],['scanDepth','select','80'],['captionLanguage','select','Original']]){const node=doc.createElement(tag);node.id=id;node.value=value;doc.body.append(node)}
  let project={id:'project-one',sourceId:'source-one',state:{aiCalls:0}},selected={id:'clip-one',start:20,end:40,mediaStart:20,trimIn:0,trimOut:20,captionLanguage:'Original',captionCues:{Original:[{start:1,end:3,text:'Real question?'},{start:4,end:7,text:'Actual answer.'},{start:10,end:12,text:'A later thought.',uncertain:true}]},captionReviewed:{Original:false}},moments=[selected];
  const requests=[],messages=[],changes=[];
  const tools=createDiscoveryTools({requestJson:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return callbacks.respond?callbacks.respond(url,JSON.parse(options.body)):{speechRequestsMax:1,storyRequestsMax:1,rankingRequestsMax:0,scanSeconds:45,fullSource:false}},getProject:()=>project,getSelected:()=>selected,getMoments:()=>moments,onSelect:callbacks.onSelect||(()=>{}),onMessage:value=>messages.push(value),onChanged:()=>changes.push(true),onTranscriptEdit:callbacks.onTranscriptEdit});
  return {doc,tools,requests,messages,changes,setProject:value=>project=value,setSelected:value=>{selected=value;moments=[value]},selected:()=>selected};
}

test('discovery defaults preserve sampled costs and controls never call providers on change',async t=>{
  const f=fixture(t);assert.deepEqual(f.tools.discoveryOptions(),{strategy:'sampled',clipMinSeconds:15,clipMaxSeconds:90});assert.equal(f.requests.length,0);
  const strategy=f.doc.getElementById('discoveryStrategy');strategy.value='transcript';await strategy.emit('change');assert.equal(f.requests.length,0);assert.equal(f.tools.discoveryOptions().strategy,'transcript');assert.match(allText(f.doc.getElementById('discoveryModeHelp')),/full|every|speech/i);
  await f.tools.preview();assert.equal(f.requests.length,1);assert.equal(f.requests[0].url,'/api/discovery-preview');assert.equal(f.requests[0].body.strategy,'transcript');assert.equal(f.requests[0].body.sourceId,'source-one');assert.equal(f.requests[0].body.budget,15);
});
test('explicit search renders actual safe quotes and scope; typing causes no API request',async t=>{
  let selected;const f=fixture(t,{onSelect:id=>selected=id,respond:()=>({matches:[{momentId:'clip-one',reason:'Source-supported answer.',evidence:[{quote:'<script>literal quote</script>',field:'transcript'}],source:{start:20,end:40,url:'/api/assets/'+ 'a'.repeat(64),mediaStart:1}}],coverage:{retainedMoments:1,candidateMoments:1,omittedMoments:0,truncatedMoments:0},providerRequests:1})});
  const input=f.doc.getElementById('semanticMomentQuery');input.value='changes mind';await input.emit('input');assert.equal(f.requests.length,0);await f.tools.search();assert.equal(f.requests.length,1);assert.deepEqual(f.requests[0].body,{projectId:'project-one',query:'changes mind',retry:false});assert.match(allText(f.doc.getElementById('semanticMomentResults')),/<script>literal quote<\/script>/);assert.match(allText(f.doc.getElementById('semanticMomentCoverage')),/saved|retained/i);
  await f.doc.getElementById('semanticResult-0').emit('click');assert.equal(selected,'clip-one');
});
test('duplicate submits are guarded and stale project/query responses cannot overwrite the current UI',async t=>{
  let release;const response=new Promise(resolve=>release=resolve),f=fixture(t,{respond:()=>response});f.doc.getElementById('semanticMomentQuery').value='first';const pending=f.tools.search();await f.tools.search();assert.equal(f.requests.length,1);
  f.setProject({id:'project-two',sourceId:'source-two',state:{}});f.tools.sync();release({matches:[{momentId:'clip-one',reason:'Old result',evidence:[{quote:'Actual answer.',field:'transcript'}]}],coverage:{candidateMoments:1,retainedMoments:1}});await pending;assert.doesNotMatch(allText(f.doc.getElementById('semanticMomentResults')),/Old result/);
});
test('failed search exposes explicit retry without automatically replaying a request',async t=>{
  let fail=true;const f=fixture(t,{respond:()=>{if(fail)throw Error('Interrupted request: retry explicitly');return {matches:[],coverage:{candidateMoments:1,retainedMoments:1},providerRequests:1}}});f.doc.getElementById('semanticMomentQuery').value='reaction';await f.tools.search();assert.equal(f.requests.length,1);assert.equal(f.doc.getElementById('semanticMomentRetry').hidden,false);f.tools.sync();assert.equal(f.requests.length,1);fail=false;await f.doc.getElementById('semanticMomentRetry').emit('click');assert.equal(f.requests[1].body.retry,true);
});
test('transcript checkboxes retain raw cue indices and editing returns independent real source trims',async t=>{
  let edited;const f=fixture(t,{onTranscriptEdit:(result,source)=>edited={result,source}});f.tools.sync();const box=f.doc.getElementById('transcriptCue-1');box.checked=true;await box.emit('change');await f.doc.getElementById('transcriptKeepSelected').emit('click');assert.equal(edited.source.id,'clip-one');assert.ok(edited.result.segments[0].trimIn<4);assert.ok(edited.result.segments[0].trimOut>7);assert.equal(edited.result.segments[0].start,20);assert.equal(edited.result.segments[0].captionCues.Original.length,3);assert.equal(f.selected().captionCues.Original[1].text,'Actual answer.');assert.equal(f.requests.length,0);assert.equal(f.changes.length,1);
});
test('changing caption track or cue timings clears stale transcript selection and disabled lines cannot be edited',async t=>{
  const f=fixture(t,{onTranscriptEdit:()=>{}});f.tools.sync();const box=f.doc.getElementById('transcriptCue-0');box.checked=true;await box.emit('change');assert.equal(f.doc.getElementById('transcriptKeepSelected').disabled,false);f.selected().captionCues.Original[0].start=2;f.tools.sync();assert.equal(f.doc.getElementById('transcriptKeepSelected').disabled,true);assert.equal(f.doc.getElementById('transcriptCue-0').checked,false);
  f.setSelected({...f.selected(),captionLanguage:'English',captionCues:{Original:f.selected().captionCues.Original,English:[]}});f.tools.sync();assert.match(allText(f.doc.getElementById('transcriptSelectionStatus')),/no timed|unavailable/i);assert.equal(f.doc.getElementById('transcriptKeepSelected').disabled,true);
});
test('changing a query during a pending explicit search suppresses its old result without another request',async t=>{
  let release;const response=new Promise(resolve=>release=resolve),f=fixture(t,{respond:()=>response});const query=f.doc.getElementById('semanticMomentQuery');query.value='original request';const pending=f.tools.search();query.value='different request';await query.emit('input');release({matches:[{momentId:'clip-one',reason:'Outdated interpretation',evidence:[{quote:'Actual answer.',field:'transcript'}]}],coverage:{candidateMoments:1,retainedMoments:1}});await pending;assert.equal(f.requests.length,1);assert.doesNotMatch(allText(f.doc.getElementById('semanticMomentResults')),/Outdated interpretation/);
});
test('caption selection pages preserve actual cue indices and invalid duration options make no request',async t=>{
  let result;const f=fixture(t,{onTranscriptEdit:edited=>result=edited});const cues=Array.from({length:100},(_,index)=>({start:index*2,end:index*2+1,text:'Saved line '+index}));f.setSelected({...f.selected(),end:220,trimOut:200,captionCues:{Original:cues}});f.tools.sync();assert.equal(f.doc.getElementById('transcriptCue-85'),undefined);await f.doc.getElementById('transcriptNextPage').emit('click');const box=f.doc.getElementById('transcriptCue-85');box.checked=true;await box.emit('change');await f.doc.getElementById('transcriptKeepSelected').emit('click');assert.equal(result.segments[0].trimIn,169.88);assert.equal(result.segments[0].captionCues.Original.length,100);
  f.doc.getElementById('discoveryClipMin').value='-1';await f.tools.preview();assert.equal(f.requests.length,0);assert.match(allText(f.doc.getElementById('discoveryPreviewStatus')),/minimum/i);
});
test('successful transcript editing reenables checkboxes when the parent synchronously selects and syncs a new segment',async t=>{
  let f;f=fixture(t,{onTranscriptEdit:result=>{f.setSelected(result.segments[0]);f.tools.sync()}});const original=f.doc.getElementById('transcriptCue-1');original.checked=true;await original.emit('change');await f.doc.getElementById('transcriptKeepSelected').emit('click');
  const next=f.doc.getElementById('transcriptCue-1');assert.notEqual(f.selected().id,'clip-one');assert.equal(next.disabled,false);next.checked=true;await next.emit('change');assert.equal(f.doc.getElementById('transcriptKeepSelected').disabled,false);assert.equal(f.doc.getElementById('transcriptRemoveSelected').disabled,false);
});
