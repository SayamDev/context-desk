import test from 'node:test';import assert from 'node:assert/strict';
import {parseVoices,fitRate,wavSeconds,cleanDubLines} from '../lib/dub.js';
import {dubMix,dubFile} from '../lib/exports.js';
import {beatAss,cardAss} from '../lib/trailer-render.js';

test('only real English voices are offered for the dub, and lines fit their time',()=>{
  const listing='Albert              en_US    # Hello! My name is Albert.\nDaniel              en_GB    # Hello! My name is Daniel.\nAmélie              fr_CA    # Bonjour\nSamantha            en_US    # Hello! My name is Samantha.\nBad News            en_US    # Hello!';
  assert.deepEqual(parseVoices(listing),[{name:'Daniel',locale:'en_GB'},{name:'Samantha',locale:'en_US'}]);
  assert.equal(fitRate(5,2),158);assert.equal(fitRate(20,2),240);assert.equal(fitRate(1,10),150);
  assert.deepEqual(cleanDubLines([{line:3,start:1,end:2.5,text:'Hi there',speaker:'A'},{line:4,start:2,end:2.1,text:'too short'},{line:'x',start:0,end:1,text:'bad'},{line:5,start:4,end:99,text:'clipped',speaker:'zz'}],10),[{line:3,start:1,end:2.5,text:'Hi there',speaker:'A'},{line:5,start:4,end:10,text:'clipped',speaker:''}]);
});
test('the WAV length reader handles the header the Mac voice writes',()=>{
  const data=48000,b=Buffer.alloc(44+data);b.write('RIFF',0);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(data,40);
  assert.equal(wavSeconds(b),1);
});
test('the export mixes the dub over the original at the chosen level, and skips it for clips with cuts',()=>{
  const m={trimIn:2,trimOut:12,dubLevel:.2,useDub:true,dub:{assetId:'a'.repeat(64)}};
  assert.equal(dubMix(m,'0:a:0',1,10),'[0:a:0]volume=0.20[under];[1:a]atrim=0:10.000,asetpts=PTS-STARTPTS[voice];[under][voice]amix=inputs=2:normalize=0:duration=first[mixed]');
  const store={assetPath:id=>({file:'/assets/'+id})};
  assert.equal(dubFile(store,m),'/assets/'+'a'.repeat(64));
  assert.equal(dubFile(store,{...m,useDub:false}),null);
  assert.equal(dubFile(store,{...m,cuts:[{start:4,end:5}]}),null);
});
test('trailer shots carry their role, title and only their own subtitles; cards fade their lines',()=>{
  const ass=beatAss({start:100,end:112,role:'turn',title:'Pressed {for} truth'},1,[{start:99,end:101,text:'Before'},{start:104,end:106,text:'Inside'},{start:120,end:121,text:'After'}]);
  assert.match(ass,/Role,,0,0,0,,\{\\fad\(200,250\)\}2 \/ THE TURN/);assert.match(ass,/Beat,,0,0,0,,\{\\fad\(250,250\)\}Pressed for truth/);
  assert.match(ass,/Sub,,0,0,0,,Before/);assert.match(ass,/0:00:04\.00,0:00:06\.00,Sub,,0,0,0,,Inside/);assert.doesNotMatch(ass,/After/);
  assert.match(cardAss([['Big','Maya\'s Choice',.4,3.4]]),/Dialogue: 0,0:00:00\.40,0:00:03\.40,Big,,0,0,0,,\{\\fad\(300,300\)\}Maya's Choice/);
});
