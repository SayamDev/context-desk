import test from 'node:test';import assert from 'node:assert/strict';
import {socialPresets,socialExportIssue,socialHandoff} from '../public/social.js';
import {createDurableTranslationCache} from '../lib/translation-store.js';
test('social recipes use edited MP4 output, enforce Shorts length and expose honest upload handoffs',()=>{
 for(const name of ['tiktok','instagram','facebook','shorts']){const p=socialPresets[name];assert.equal(p.aspect,'portrait');assert.equal(p.format,'mp4');assert.equal(p.quality,1080);assert.match(socialHandoff(name).upload,/^https:/)}
 assert.match(socialExportIssue('shorts',{duration:181,...socialPresets.shorts}),/3 minutes/);
 assert.match(socialExportIssue('tiktok',{duration:20,aspect:'square',format:'webm',quality:720}),/Reapply/);
 assert.equal(socialExportIssue('shorts',{duration:180,...socialPresets.shorts}),'');assert.equal(socialHandoff('custom'),null);
});
test('translation cache survives a service restart and separates meaning-changing options',async()=>{
 const records=new Map(),store={getRecord:(kind,key)=>records.get(kind+key),putRecord:(kind,key,value)=>records.set(kind+key,value)};
 let calls=0;const request=async()=>{calls++;return {lines:[{id:0,text:'Hello'}],provider:'test'}};
 const context=['model-v1','English','Moroccan Darija','names',[{id:0,text:'سلام'}]];
 const first=createDurableTranslationCache(store);const [a,b]=await Promise.all([first.run(context,request),first.run(context,request)]);assert.deepEqual(a,b);assert.equal(calls,1);
 const afterRestart=createDurableTranslationCache(store);assert.equal((await afterRestart.run(context,request)).cacheHit,true);assert.equal(calls,1);
 await afterRestart.run([...context,'changed glossary'],request);assert.equal(calls,2);
 await afterRestart.run(context,request,{refresh:true});assert.equal(calls,3);
});
test('a failed or interrupted paid translation requires explicit retry instead of an automatic replay',async()=>{
 const records=new Map(),store={getRecord:(kind,key)=>records.get(kind+key),putRecord:(kind,key,value)=>records.set(kind+key,value)};
 const cache=createDurableTranslationCache(store);let calls=0;
 await assert.rejects(cache.run(['failed'],async()=>{calls++;throw Error('offline')}),/offline/);
 await assert.rejects(createDurableTranslationCache(store).run(['failed'],async()=>{calls++}),/Retry translation/);assert.equal(calls,1);
 await cache.run(['failed'],async()=>{calls++;return {lines:[]}}, {refresh:true});assert.equal(calls,2);
 // Simulate an abandoned request in a different server process.
 cache.run(['interrupted'],()=>new Promise(()=>{}));
 await assert.rejects(createDurableTranslationCache(store).run(['interrupted'],async()=>{calls++}),/interrupted/);assert.equal(calls,2);
});
