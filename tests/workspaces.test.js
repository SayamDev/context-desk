import test from 'node:test';import assert from 'node:assert/strict';
import {workspaceFromHash,workspaceHash,usableMoments} from '../public/workspaces.js';
test('Home is the default entry, and public workspace URLs map to existing saved enum values',()=>{
 assert.equal(workspaceFromHash(''),'home');assert.equal(workspaceFromHash('#/studio'),'edit');assert.equal(workspaceFromHash('#/clips'),'clips');assert.equal(workspaceFromHash('#/projects'),'library');assert.equal(workspaceHash('source'),'#/import');assert.equal(workspaceFromHash('#/unrecognised'),'home');
});
test('discovery navigation counts editable picks rather than rejected analysis windows',()=>{
 const moments=[{id:'a',status:'suggested'},{id:'b',status:'not-selected'},{id:'c',manual:true},{id:'d',approved:true}];assert.deepEqual(usableMoments(moments).map(m=>m.id),['a','c','d']);assert.equal(moments.length,4);
});
