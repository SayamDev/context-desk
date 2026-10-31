import test from 'node:test';import assert from 'node:assert/strict';import {createMemoryView} from '../public/story-memory.js';
test('Story Memory flushes changes made while the previous save is pending before reporting saved',async()=>{
  const original=globalThis.fetch;const rows={innerHTML:''},status={textContent:''},select={value:'m'},writes=[];let release;
  const initial={id:'m',title:'Season',revision:0,facts:[{id:'f',text:'Original',author:'human',confirmed:false}]};
  globalThis.fetch=async(url,options={})=>{if(options.method==='PUT'){const body=JSON.parse(options.body);writes.push(body);if(writes.length===1)await new Promise(r=>release=r);return Response.json({...body,revision:writes.length})}return Response.json(initial)};
  try{const view=createMemoryView({rows,status,select,getSelected:()=>null,onSelect(){},trashToggle:{checked:false},trashButton:{}});await view.open('m');rows.oninput({target:{dataset:{fact:'0'},value:'First edit'}});const first=view.save();rows.oninput({target:{dataset:{fact:'0'},value:'Second edit'}});const second=view.save();release();await Promise.all([first,second]);assert.equal(writes.length,2);assert.equal(writes[1].facts[0].text,'Second edit');assert.equal(writes[1].revision,1);assert.equal(status.textContent,'Memory saved')}finally{globalThis.fetch=original}
});
