import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {openStore} from '../lib/store.js';import {cleanProjectState,createProjectApi} from '../lib/projects.js';import {Readable} from 'node:stream';
test('library presentation preference survives the API roundtrip and rejects arbitrary modes',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'desk-view-prefs-')),store=openStore(root),api=createProjectApi(store);
 try{const call=async body=>{const req=Readable.from([JSON.stringify(body)]);Object.assign(req,{method:'PUT',url:'/api/preferences',headers:{}});let result;await api(req,{},(_,code,data)=>result={code,data});return result};
  assert.equal((await call({view:'grid',sort:'title',direction:'asc'})).data.view,'grid');
  assert.equal(store.getRecord('preferences','workspace').view,'grid');
  assert.equal((await call({view:'invented'})).data.view,'list');
 }finally{store.close();await fs.rm(root,{recursive:true,force:true})}
});
test('Library separates usable clip picks from retained rejected analysis windows',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'desk-clip-count-')),store=openStore(root),api=createProjectApi(store);
 try{const p=store.createProject({title:'Honest counts'});store.saveProject(p.id,{moments:[{id:'a',status:'not-selected'},{id:'b',status:'suggested'},{id:'c',status:'error',approved:true}],settings:{}},0);
  const req=Readable.from([]);Object.assign(req,{url:'/api/projects',method:'GET',headers:{}});let result;await api(req,{},(_,code,data)=>result=data);assert.equal(result.projects[0].clipCount,2);assert.equal(result.projects[0].windowCount,3);
 }finally{store.close();await fs.rm(root,{recursive:true,force:true})}
});
test('project serialization externalizes frames and refuses transient media and credential settings',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'desk-project-')),store=openStore(root);try{const asset=store.putAsset(Buffer.from('raw captured pixels'),'video/webm'),state=cleanProjectState({settings:{speechLanguage:'Arabic',MODEL_API_KEY:'must not persist'},moments:[{id:'clip',start:4,end:9,url:asset.url,frames:['data:image/jpeg;base64,'+Buffer.from('preview').toString('base64')],hook:'My hook'}]},store);assert.equal(state.settings.MODEL_API_KEY,undefined);assert.match(state.moments[0].frames[0],/^\/api\/assets\//);assert.throws(()=>cleanProjectState({moments:[{id:'x',start:0,end:1,url:'blob:expired'}]},store),/Save the clip media/);assert.throws(()=>store.assetPath('../../.env'),/asset/)}finally{store.close();await fs.rm(root,{recursive:true,force:true})}});
test('project API returns committed revisions and reports conflicting writes',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'desk-project-api-')),store=openStore(root),api=createProjectApi(store);try{const p=store.createProject({title:'Edit me'});const call=async revision=>{const req=Readable.from([JSON.stringify({revision,state:{moments:[],cut:[],settings:{speechLanguage:'Arabic'}}})]);req.method='PUT';req.url='/api/projects/'+p.id;req.headers={};let result;await api(req,{},(_,code,data)=>result={code,data});return result};assert.equal((await call(0)).code,200);assert.equal((await call(0)).code,409);assert.equal(store.getProject(p.id).state.settings.speechLanguage,'Arabic')}finally{store.close();await fs.rm(root,{recursive:true,force:true})}});
test('refresh drafts win over earlier requests but cannot overwrite a different editor',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'desk-save-order-')),store=openStore(root),api=createProjectApi(store);try{const p=store.createProject({title:'Concurrent edits'});
    const call=async(method,body)=>{const req=Readable.from([JSON.stringify(body)]);req.url='/api/projects/'+p.id;req.method=method;req.headers={};let output;await api(req,{},(_,code,data)=>output={code,data});return output};
    const first={clientId:'A',sequence:1,revision:0,state:{moments:[],settings:{speechLanguage:'Arabic'}}};assert.equal((await call('PUT',first)).code,200);
    assert.equal((await call('POST',{action:'draft',clientId:'A',sequence:2,revision:0,patch:{settings:{speechLanguage:'French'}}})).code,200);
    assert.equal((await call('PUT',first)).code,200);assert.equal(store.getProject(p.id).state.settings.speechLanguage,'French');
    const revision=store.getProject(p.id).revision;assert.equal((await call('PUT',{clientId:'B',sequence:1,revision,state:{moments:[],settings:{speechLanguage:'English'}}})).code,200);
    assert.equal((await call('POST',{action:'draft',clientId:'A',sequence:3,revision,patch:{settings:{speechLanguage:'German'}}})).code,409);
    assert.equal(store.getProject(p.id).state.settings.speechLanguage,'English');assert.equal(store.getRecord('project_recovery',p.id+'/A').state.settings.speechLanguage,'German');
  }finally{store.close();await fs.rm(root,{recursive:true,force:true})}
});
test('a saved conflict recovery is accessible and restores to a separate project without changing the winner',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'desk-recovery-copy-')),store=openStore(root),api=createProjectApi(store);try{const p=store.createProject({title:'Winner'});const call=async(url,method,body={})=>{const req=Readable.from(method==='GET'?[]:[JSON.stringify(body)]);Object.assign(req,{url,method,headers:{}});let output;await api(req,{},(_,code,data)=>output={code,data});return output};const saved=await call('/api/projects/'+p.id,'POST',{action:'recovery',title:'Losing edit',state:{moments:[],settings:{speechLanguage:'Arabic'}}});assert.equal(saved.code,201);const list=await call('/api/projects/'+p.id+'/recoveries','GET');assert.equal(list.data.recoveries.length,1);const copy=await call('/api/projects/'+p.id+'/recoveries/'+saved.data.id,'POST');assert.equal(copy.code,201);assert.notEqual(copy.data.id,p.id);assert.equal(copy.data.state.settings.speechLanguage,'Arabic');assert.equal(store.getProject(p.id).title,'Winner');assert.equal(store.listProjects().length,2)}finally{store.close();await fs.rm(root,{recursive:true,force:true})}
});
