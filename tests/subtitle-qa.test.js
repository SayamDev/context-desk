import test from 'node:test';import assert from 'node:assert/strict';
import {repetition,strayScript,lineIssues,dominantScript} from '../public/subtitle-qa.js';
test('ASR loops are flagged, natural single-word repeats are not',()=>{
  assert.equal(repetition('Do not get clever, do not, do not get clever, do not'),true);
  assert.equal(repetition('No, no, no, he is upset now'),false);
  assert.equal(repetition('Like that. No, no, no, like this.'),false);
});
test('stray scripts, untranslated spans and duplicates are flagged without blocking',()=>{
  assert.equal(strayScript('אני احلى لسه دلوقتي','Original',{original:true,sourceScript:'arabic'}),'hebrew');
  assert.equal(strayScript('Hello there','English'),'');
  const originals=[{text:'مرحبا بكم جميعا'},{text:'شكرا'}];
  const issues=lineIssues([{start:0,end:1,text:'Welcome مرحبا بكم'},{start:.5,end:2,text:'Welcome مرحبا بكم'}],{language:'English',sourceScript:'arabic',originals});
  assert.equal(issues.length,2);assert.match(issues[1].reasons.join(' '),/previous line/);assert.match(issues[1].reasons.join(' '),/Overlaps/);
  assert.equal(dominantScript([{text:'كده لا'},{text:'ok'}]),'arabic');
});
