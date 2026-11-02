import test from 'node:test';import assert from 'node:assert/strict';
import {cleanAccents,accentFor,splitKeyword} from '../public/caption-accents.js';
import {assDocument} from '../lib/exports.js';
test('accents keep exact keywords, sparse real emoji, and drop edited lines',()=>{
  const lines=['We bought the car','Then it broke','She cried','He laughed'];
  const out=cleanAccents(lines,[{index:0,keyword:'car',emoji:'🚗'},{index:1,keyword:'BROKE',emoji:'💥'},{index:2,keyword:'cried',emoji:'😢'},{index:3,keyword:'laughed',emoji:'ok'}]);
  assert.deepEqual(out[0],{text:'We bought the car',keyword:'car',emoji:'🚗'});
  assert.equal(out.length,3);assert.equal(out[1].text,'She cried');assert.equal(out[1].emoji,undefined,'second emoji within three lines is dropped');assert.equal(out[2].keyword,'laughed');assert.equal(out[2].emoji,undefined,'not an emoji');
  const m={showAccents:true,captionLanguage:'English',captionAccents:{English:out}};
  assert.equal(accentFor(m,'We bought the car').keyword,'car');assert.equal(accentFor(m,'We bought a car'),null);
  assert.deepEqual(splitKeyword('We bought the car','car'),['We bought the ','car','']);
});
test('export colours the keyword and sets the emoji above in the emoji font',()=>{
  const m={start:0,end:5,trimIn:0,trimOut:4,showCaptions:true,captionLanguage:'English',captionStyle:'punch',captionLook:{},captionCues:{Original:[{start:0,end:3,text:'x'}],English:[{start:0,end:3,text:'We bought the car'}]},showAccents:true,captionAccents:{English:[{text:'We bought the car',keyword:'car',emoji:'🚗'}]},captionOffset:0};
  const ass=assDocument(m,720,1280);assert.match(ass,/\{\\fnNoto Emoji\\c&H[0-9a-f]{6}&\}🚗\{\\fnArial\\c&H[0-9a-f]{6}&\}\\N/i);assert.match(ass,/\{\\c&H[0-9a-f]{6}&\}CAR\{\\c&H[0-9a-f]{6}&\}/i);
});
