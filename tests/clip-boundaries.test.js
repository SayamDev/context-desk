import test from 'node:test';import assert from 'node:assert/strict';
import {thoughtCheck,findQuotes,normalizeForSearch} from '../public/clip-boundaries.js';
const cues=[{start:0,end:2,text:'We met last year.'},{start:2.1,end:4,text:'And then everything changed'},{start:4.05,end:6,text:'when she left the show.'},{start:6.2,end:8,text:'Why did she leave?'},{start:8.3,end:10,text:'Because nobody believed her.'},{start:11,end:13,text:'That is the truth.'}];
test('a clip that starts mid-thought and stops before the answer is extended to natural edges',()=>{
  const r=thoughtCheck(cues,4.5,7.9);
  assert.deepEqual(r.issues.map(i=>i.kind),['start-mid','end-question']);
  assert.equal(r.suggestion.trimIn,0,"sentence starts with And, so the one before is included");assert.equal(r.suggestion.trimOut,10.25);
});
test('a clean clip has no issues; a connector start is flagged',()=>{
  assert.deepEqual(thoughtCheck(cues,0,2.3).issues,[]);
  const c=thoughtCheck(cues,2.05,6.1);assert.equal(c.issues[0].kind,'start-connector');assert.equal(c.suggestion.trimIn,0);
  assert.equal(thoughtCheck([{start:0,end:2,text:'و بعدين قالت لا'},{start:2.1,end:3,text:'تمام.'}],0,3).issues[0].kind,'start-connector');
});
test('extensions are bounded and never pass the window end',()=>{assert.ok(thoughtCheck(cues,4.5,5,{windowEnd:6.5}).suggestion.trimOut<=6.5)});
test('quote search matches Arabic without diacritics or letter-form differences, and English',()=>{
  assert.equal(normalizeForSearch('إِنْتِي حلوة'),'انتي حلوه');
  const track={cues:[{start:1,end:2,text:'You look beautiful in everything'},{start:3,end:4,text:'Pick one'}],original:[{start:1,end:2,text:'انتي حلوة في كل حاجة'},{start:3,end:4,text:'اختاري'}]};
  assert.equal(findQuotes(track,'حلوه')[0].index,0);assert.equal(findQuotes(track,'beautiful everything')[0].index,0);assert.equal(findQuotes(track,'missing word').length,0);
});
test('unpunctuated speech ends at the clearest breath instead of growing the clip without end',()=>{
  const chain=Array.from({length:12},(_,i)=>({start:i*2+(i>=5?.5:0),end:i*2+1.95+(i>=5?.5:0),text:'كلام بدون علامات ترقيم هنا'}));
  const r=thoughtCheck(chain,0,4.5);assert.equal(r.issues[0].kind,'end-mid');assert.ok(r.suggestion.trimOut<=14.5,'stays within the forward limit');
  assert.equal(r.suggestion.trimOut,10.2,'ends at the 0.55 s breath after the fifth line (9.95 s + 0.25 s)');
  assert.deepEqual(thoughtCheck(chain,0,10.2).issues,[],'a breath is an acceptable edge');
});
