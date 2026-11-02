import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {openStore} from '../lib/store.js';import {createImpact,manualMinutesPerShort} from '../lib/impact.js';import {createLiveBufferService} from '../lib/live-buffer.js';
test('impact counts Shorts and their timing, and labels the time saved as an estimate',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'impact-')),store=openStore(dir);
  try{const impact=createImpact(store);assert.deepEqual({...impact.summary(),assumption:undefined},{shorts:0,exports:0,averageReadySeconds:null,fastestReadySeconds:null,estimatedMinutesSaved:0,assumption:undefined});
    impact.recordShort({readySeconds:14});impact.recordShort({readySeconds:20});impact.recordShort({readySeconds:NaN});
    const s=impact.summary();assert.equal(s.shorts,3);assert.equal(s.averageReadySeconds,17);assert.equal(s.fastestReadySeconds,14);assert.equal(s.estimatedMinutesSaved,3*manualMinutesPerShort);assert.match(s.assumption,/minutes of manual editing/);
  }finally{store.close();await fs.rm(dir,{recursive:true,force:true})}
});
test('replay only accepts a saved recording id',async()=>{
  const service=createLiveBufferService({claimSource:id=>{throw Error('unknown '+id)}});const res={};let out;
  const call=async body=>{const {Readable}=await import('node:stream');const req=Readable.from([JSON.stringify(body)]);Object.assign(req,{method:'POST',url:'/api/live-buffer',headers:{}});await service.handle(req,res,(_,code,data)=>out={code,data});return out};
  assert.match((await call({replay:{sourceId:'../../etc/passwd'}})).data.error,/saved recording/);
  assert.match((await call({replay:{sourceId:'7f0c98cb-0aed-4074-8e98-de06387cde49'}})).data.error,/unknown/);
});
