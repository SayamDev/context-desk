import test from 'node:test';
import assert from 'node:assert/strict';
import {captionVariants,translationGuide,scriptIssue,findVariant,romanizations} from '../public/locales.js';
test('every caption language has at least one variant with a concrete guide',()=>{
  for(const [language,list] of Object.entries(captionVariants)){assert.ok(list.length,language);for(const v of list){assert.match(v.id,/^[a-z]{2,3}-[A-Za-z]+$/);assert.ok(v.guide.length>30,v.id)}}
  assert.equal(new Set(Object.values(captionVariants).flat().map(v=>v.id)).size,Object.values(captionVariants).flat().length);
});
test('the translation guide names the regional audience and the romanised script when chosen',()=>{
  assert.match(translationGuide('Spanish','es-AR'),/voseo/);
  assert.match(translationGuide('Arabic','ar-EG'),/Egyptian/);
  assert.match(translationGuide('Hindi','hi-IN','roman'),/Hinglish/);
  assert.doesNotMatch(translationGuide('German','de-CH','roman'),/Latin letters/);
  assert.equal(findVariant('Spanish','nope').id,'es-ES');
  assert.equal(translationGuide('Klingon','x'),'');
});
test('flags translations in the wrong script or Chinese variant',()=>{
  assert.equal(scriptIssue('Arabic',['إيه ده؟ مش ممكن']),'');
  assert.match(scriptIssue('Arabic',['What is this? No way']),/own script/);
  assert.equal(scriptIssue('Hindi',['kya baat hai yaar'],{script:'roman'}),'');
  assert.match(scriptIssue('Hindi',['क्या बात है यार'],{script:'roman'}),/Latin letters/);
  assert.match(scriptIssue('Mandarin Chinese',['我们说这个时间'],{variant:'zh-TW'}),/Traditional/);
  assert.equal(scriptIssue('Mandarin Chinese',['我們說這個時間'],{variant:'zh-TW'}),'');
  assert.match(scriptIssue('German',['Das ist großartig'],{variant:'de-CH'}),/ss/);
  assert.equal(scriptIssue('Japanese',['本当にすごいですね']),'');
  assert.ok(Object.keys(romanizations).every(l=>captionVariants[l]));
});
import {isFillerOnly} from '../public/locales.js';
test('filler-only lines in several languages, never lines that say something',()=>{
  for(const t of ['Um.','Uh, uh…','Hmm','you know','Eh, este…','Euh bon','Ähm','Yani şey','يعني','えっと','嗯','Matlab acha'])assert.equal(isFillerOnly(t),true,t);
  for(const t of ['Um, I quit.','So what happened?','Like the first one','','Okay, let us go'])assert.equal(isFillerOnly(t),false,t);
});
