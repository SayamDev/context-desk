import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../lib/store.js';
import {createProjectApi} from '../lib/projects.js';

const fresh=()=>openStore(fs.mkdtempSync(path.join(os.tmpdir(),'desk-delete-')));
function exchange(api,url,data){const req=Readable.from(data?[JSON.stringify(data)]:[]);Object.assign(req,{url,method:'POST',headers:{host:'localhost:3001'}});const out={};return api(req,out,(res,code,value)=>{out.code=code;out.value=value}).then(()=>out)}
const recordIds=(store,kind)=>store.listRecords(kind).map(r=>r.id);

test('a project is deleted for good only from Trash, with its own records, never shared caches',()=>{
  const store=fresh(),p=store.createProject({title:'Episode 29',sourceId:'11111111-1111-4111-8111-111111111111'}),other=store.createProject({title:'Episode 31'});
  store.putMoment(p.id,{id:'m1',start:0,end:5});
  store.putRecord('project_editor',p.id,{clientId:'a',sequence:1});
  store.putRecord('project_recovery',p.id+'/r1',{id:'r1',projectId:p.id,state:{}});
  store.putRecord('export_result','e1',{id:'e1',projectId:p.id,url:'/api/assets/x'});
  store.putRecord('subtitle_job','j1',{id:'j1',sourceId:p.sourceId});
  store.putRecord('source',p.sourceId,{id:p.sourceId,status:'ready'});
  store.putRecord('speech_cache','hash1',{text:'shared'});
  store.putRecord('project_editor',other.id,{clientId:'b',sequence:1});
  assert.throws(()=>store.deleteProject(p.id),{status:409});
  store.trashProject(p.id,true);
  assert.deepEqual(store.deleteProject(p.id),{sourceId:p.sourceId,freedBytes:0});
  assert.throws(()=>store.getProject(p.id),/not found/);
  assert.equal(store.getRecord('project_editor',p.id),null);assert.ok(store.getRecord('project_editor',other.id));
  for(const kind of ['project_recovery','export_result','subtitle_job','source'])assert.deepEqual(store.listRecords(kind),[],kind);
  assert.equal(store.listRecords('speech_cache').length,1);
  assert.equal(store.getProject(other.id).title,'Episode 31');
});

test('a recording shared with another project stays when one of them is deleted',()=>{
  const store=fresh(),source='22222222-2222-4222-8222-222222222222',a=store.createProject({title:'A',sourceId:source});store.createProject({title:'B',sourceId:source});
  store.putRecord('source',source,{id:source});store.putRecord('visual_index',source,{sourceId:source,frames:[]});store.trashProject(a.id,true);
  assert.equal(store.deleteProject(a.id).sourceId,null);
  assert.equal(recordIds(store,'source').length,1);assert.equal(recordIds(store,'visual_index').length,1);
});

test('stored media no one mentions is collected, but referenced or just-written media stays',()=>{
  const store=fresh(),orphan=store.putAsset(Buffer.from('old export'),'video/mp4'),kept=store.putAsset(Buffer.from('kept clip'),'video/mp4'),recent=store.putAsset(Buffer.from('still exporting'),'video/mp4');
  const p=store.createProject({title:'Keeps one'});store.saveProject(p.id,{moments:[],exports:[{url:kept.url}]},0);
  // Age two assets past the ten-minute guard by rewriting their timestamps.
  const sqlite=new DatabaseSync(path.join(store.root,'studio.sqlite'));
  sqlite.prepare('UPDATE assets SET created_at=0 WHERE id IN (?,?)').run(orphan.id,kept.id);sqlite.close();
  assert.equal(store.collectAssets(),orphan.size);
  assert.equal(fs.existsSync(path.join(store.root,'assets',orphan.id)),false);
  assert.equal(fs.existsSync(path.join(store.root,'assets',kept.id)),true);
  assert.equal(fs.existsSync(path.join(store.root,'assets',recent.id)),true);
});

test('the API removes the recording after the records, and refuses one still in use before touching anything',async()=>{
  const store=fresh(),source='33333333-3333-4333-8333-333333333333',removed=[];let busy=true;
  const api=createProjectApi(store,{sources:{assertRemovable(id){if(busy)throw Object.assign(Error('This recording is in use.'),{status:409})},async remove(id){removed.push(id);return 1000},async removeOrphans(){return 0}}});
  const p=store.createProject({title:'In use',sourceId:source});store.trashProject(p.id,true);
  const refused=await exchange(api,'/api/projects/'+p.id,{action:'delete'});
  assert.equal(refused.code,409);assert.equal(store.getProject(p.id).trashed,true);assert.deepEqual(removed,[]);
  busy=false;const done=await exchange(api,'/api/projects/'+p.id,{action:'delete'});
  assert.deepEqual(done.value,{deleted:true,freedBytes:1000});assert.deepEqual(removed,[source]);
  const active=store.createProject({title:'Active'});
  assert.equal((await exchange(api,'/api/projects/'+active.id,{action:'delete'})).code,409);
});

test('Empty Trash deletes every trashed project it can, reports the rest, then clears unused recordings',async()=>{
  const store=fresh(),calls=[];
  const api=createProjectApi(store,{sources:{assertRemovable(id){if(id.startsWith('4'))throw Error('This recording is in use.')},async remove(id){calls.push('remove '+id);return 10},async removeOrphans(){calls.push('orphans');return 5}}});
  const busy=store.createProject({title:'Busy',sourceId:'44444444-4444-4444-8444-444444444444'}),free=store.createProject({title:'Free',sourceId:'55555555-5555-4555-8555-555555555555'}),open=store.createProject({title:'Open'});
  store.trashProject(busy.id,true);store.trashProject(free.id,true);
  const result=(await exchange(api,'/api/projects/trash/empty')).value;
  assert.equal(result.deleted,1);assert.equal(result.freedBytes,15);assert.deepEqual(result.skipped.map(s=>s.title),['Busy']);
  assert.deepEqual(calls,['remove 55555555-5555-4555-8555-555555555555','orphans']);
  assert.equal(store.getProject(busy.id).trashed,true);assert.equal(store.getProject(open.id).trashed,false);
});
