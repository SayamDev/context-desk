import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const source=process.env.CONTEXT_TEST_BASELINE?execFileSync('git',['show','0971751:public/app.js'],{encoding:'utf8'}):fs.readFileSync('public/app.js','utf8');
for(const id of ['focusPlayer','captionsEarlier','captionsLater','resetCaptionSync','applyCaptionLook'])test(id+' marks its button mutation dirty before immediate export or refresh',()=>{
  const controls={},$=id=>controls[id]??={value:'0'},moment={id:'m',captionOffset:0,captionStyle:'pop'},state={selected:'m',moments:[moment,{id:'other',captionStyle:'clean'}]};let dirty=0;const performEdit=(_,fn)=>{fn();dirty++};const line=source.split('\n').find(line=>line.startsWith("$('"+id+"').onclick="));assert.ok(line);
  new Function('$','state','performEdit','updateFrameControls','drawPreview','message','changeCaptionSync',line)($,state,performEdit,()=>{},()=>{},()=>{},n=>moment.captionOffset=n);$(id).onclick();assert.equal(dirty,1);
});
test('caption uncertainty toggle participates in history and autosave before refresh',async()=>{
 const start=source.indexOf("$('captionLines').onclick="),end=source.indexOf('  const button=event.target.closest',start),binding=source.slice(start,end)+'};';
 const control={},$=()=>control,moment={id:'m',captionLanguage:'Original',captionReviewed:{Original:true}},cue={text:'A name',uncertain:false},state={selected:'m',moments:[moment]};let dirty=0;
 new Function('$','state','activeCues','renderEditor','performEdit',binding)($,state,()=>[cue],()=>{},(_,fn)=>{fn();dirty++});
 await control.onclick({target:{closest:()=>({dataset:{captionFlag:'0'}})}});
 assert.equal(cue.uncertain,true);assert.equal(moment.captionReviewed.Original,false);assert.equal(dirty,1);
});
test('Studio navigation reopens the selected media after restoring another workspace',()=>{
 const binding=source.split('\n').find(line=>line.startsWith('function navigateWorkspace('));assert.ok(binding);
 let opened=null,view=null;const state={selected:'persisted-moment'};
 new Function('state','selectMoment','showWorkspace',binding+';navigateWorkspace("edit")')(state,id=>{opened=id},name=>{view=name});
 assert.equal(opened,'persisted-moment');assert.equal(view,null);
});
