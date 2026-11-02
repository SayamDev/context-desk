import test from 'node:test';import assert from 'node:assert/strict';import os from 'node:os';
import {healthChecks} from '../lib/health.js';
test('setup check names what is missing, what it blocks and the fix; optional items do not block readiness',async()=>{
  const runner=async(cmd,args)=>cmd.endsWith('ffmpeg')?{ok:true,out:' scale V->V'}:{ok:false,out:''};
  const r=await healthChecks({env:{FFMPEG_PATH:'/x/ffmpeg'},platform:'darwin',runner,dataDir:os.tmpdir()});
  const by=Object.fromEntries(r.checks.map(c=>[c.id,c]));
  assert.equal(by.ffmpeg.ok,true);assert.equal(by.captions.ok,false);assert.match(by.captions.fix,/npm run setup/);assert.match(by.ai.blocks,/translation/);
  assert.equal(by.importer.needed,false);assert.equal(by.storage.ok,true);assert.equal(r.ready,false);
  const ok=await healthChecks({env:{FFMPEG_PATH:'/x/ffmpeg',MODEL_API_KEY:'set'},platform:'linux',runner:async()=>({ok:true,out:' ass V->V'}),dataDir:os.tmpdir()});
  assert.equal(ok.ready,true);assert.ok(ok.checks.every(c=>!c.fix));
});
