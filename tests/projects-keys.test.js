import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {savedMomentKeys} from '../public/projects.js';
test('browser and server save the same clip fields',()=>{
  const server=JSON.parse(fs.readFileSync(new URL('../lib/projects.js',import.meta.url),'utf8').match(/const momentKeys=(\[[^\]]*\])/)[1].replace(/'/g,'"'));
  assert.deepEqual([...savedMomentKeys].sort(),[...server].sort());
});
