import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {openStore} from '../lib/store.js';
test('project edits, sources and background results survive closing and reopening SQLite',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'desk-store-test-'));let db=openStore(root);
  try{const p=db.createProject({title:'Episode',sourceId:'source'});db.putRecord('source','source',{status:'ready',size:42});db.putMoment(p.id,{id:'later',start:90,hook:'Server result'});const saved=db.saveProject(p.id,{moments:[{id:'first',start:3,hook:'My edit',captionCues:{Arabic:[{start:0,end:1,text:'أهلاً'}]}}],cut:['first'],settings:{speechLanguage:'Arabic'}},p.revision);db.close();db=openStore(root);const restored=db.getProject(p.id);assert.equal(restored.revision,saved.revision);assert.equal(restored.state.moments.length,2);assert.equal(restored.state.moments.find(m=>m.id==='first').hook,'My edit');assert.equal(restored.state.settings.speechLanguage,'Arabic');assert.equal(db.getRecord('source','source').size,42)}finally{db.close();await fs.rm(root,{recursive:true,force:true})}
});
test('stale saves fail instead of overwriting newer changes and real sort order is stable',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'desk-store-test-')),db=openStore(root);
  try{const a=db.createProject({title:'Zulu'});db.createProject({title:'Alpha'});db.saveProject(a.id,{cut:['x']},0);assert.throws(()=>db.saveProject(a.id,{cut:[]},0),/newer/);assert.deepEqual(db.listProjects({sort:'title',direction:'asc'}).map(p=>p.title),['Alpha','Zulu']);assert.deepEqual(db.listProjects({sort:'title',direction:'desc'}).map(p=>p.title),['Zulu','Alpha']);assert.throws(()=>db.assetPath('../secret'),/asset/);db.trashProject(a.id,true);assert.equal(db.listProjects().length,1);db.trashProject(a.id,false);assert.equal(db.listProjects().length,2)}finally{db.close();await fs.rm(root,{recursive:true,force:true})}
});
