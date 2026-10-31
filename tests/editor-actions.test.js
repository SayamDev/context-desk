import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const source=process.env.CONTEXT_TEST_BASELINE?execFileSync('git',['show','0971751:public/app.js'],{encoding:'utf8'}):fs.readFileSync('public/app.js','utf8');
for(const id of ['focusPlayer','captionsEarlier','captionsLater','resetCaptionSync','applyCaptionLook'])test(id+' marks its button mutation dirty before immediate export or refresh',()=>{
  const controls={},$=id=>controls[id]??={value:'0'},moment={id:'m',captionOffset:0,captionStyle:'pop'},state={selected:'m',moments:[moment,{id:'other',captionStyle:'clean'}]};let dirty=0;const performEdit=(_,fn)=>{fn();dirty++};const line=source.split('\n').find(line=>line.startsWith("$('"+id+"').onclick="));assert.ok(line);
  new Function('$','state','performEdit','updateFrameControls','drawPreview','message','changeCaptionSync',line)($,state,performEdit,()=>{},()=>{},()=>{},n=>moment.captionOffset=n);$(id).onclick();assert.equal(dirty,1);
});
