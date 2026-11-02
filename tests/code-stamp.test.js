import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {Readable} from 'node:stream';
import {serverModules,createCodeStamp} from '../lib/code-stamp.js';
import {openStore} from '../lib/store.js';import {createProjectApi,unknownMomentKeys} from '../lib/projects.js';
const root=path.resolve(import.meta.dirname,'..'),rel=f=>path.relative(root,f);
test('the import scan finds every server module, including shared public modules, and no browser-only file',async()=>{
  const files=serverModules(path.join(root,'server.js')).map(rel);
  for(const f of ['server.js','lib/projects.js','lib/exports.js','lib/code-stamp.js','public/caption-styles.js','public/brand-kit.js'])assert.ok(files.includes(f),f);
  for(const f of ['public/app.js','public/ds.js','public/caption-render.js'])assert.ok(!files.includes(f),f);
  // Guard: every lib/ module in the repo must be reachable, or edits to it would not mark the server stale.
  // lib/evaluation.js is only used by scripts/evaluate-speech.js, never by the server.
  const scriptOnly=['evaluation.js'];
  for(const f of (await fs.readdir(path.join(root,'lib'))).filter(f=>f.endsWith('.js')&&!scriptOnly.includes(f)))assert.ok(files.includes('lib/'+f),'lib/'+f+' is not reachable from server.js');
});
test('stale turns true only when an imported file changes',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'stamp-'));
  try{await fs.writeFile(path.join(dir,'main.js'),"import './a.js';\nconst b=await import('./b.js');");await fs.writeFile(path.join(dir,'a.js'),'');await fs.writeFile(path.join(dir,'b.js'),'');await fs.writeFile(path.join(dir,'other.js'),'');
    const stamp=createCodeStamp(path.join(dir,'main.js'));assert.equal(stamp.files.length,3);assert.equal(stamp.stale(),false);
    const later=new Date(Date.now()+5000);await fs.utimes(path.join(dir,'other.js'),later,later);assert.equal(stamp.stale(),false);
    await fs.utimes(path.join(dir,'b.js'),later,later);assert.equal(stamp.stale(),true);
  }finally{await fs.rm(dir,{recursive:true,force:true})}
});
test('an outdated server refuses saves instead of dropping fields, and recovery copies keep every field',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'stale-save-')),store=openStore(dir);let stale=false;const api=createProjectApi(store,{codeStale:()=>stale});
  try{const call=async(method,url,body)=>{const req=Readable.from([JSON.stringify(body)]);Object.assign(req,{method,url,headers:{}});let result;await api(req,{},(_,code,data)=>result={code,data});return result};
    const p=store.createProject({title:'t'}),moment={id:'m',url:'/api/assets/'+'a'.repeat(64),start:0,end:5,trimIn:0,trimOut:5};
    assert.deepEqual(unknownMomentKeys({moments:[{...moment,futureField:1}]}),['futureField']);
    const unknown=await call('PUT','/api/projects/'+p.id,{state:{moments:[{...moment,futureField:1}]},revision:p.revision});assert.equal(unknown.code,409);assert.equal(unknown.data.code,'server-outdated');
    stale=true;const outdated=await call('PUT','/api/projects/'+p.id,{state:{moments:[moment]},revision:p.revision});assert.equal(outdated.code,409);
    const recovery=await call('POST','/api/projects/'+p.id,{action:'recovery',clientId:'c1',state:{moments:[{...moment,futureField:1}]}});assert.ok(recovery.code<300,JSON.stringify(recovery));
    const saved=store.listRecords('project_recovery').find(r=>r.projectId===p.id);assert.equal(saved.state.moments[0].futureField,1);
    stale=false;assert.equal((await call('PUT','/api/projects/'+p.id,{state:{moments:[moment]},revision:p.revision})).code,200);
  }finally{store.close();await fs.rm(dir,{recursive:true,force:true})}
});
