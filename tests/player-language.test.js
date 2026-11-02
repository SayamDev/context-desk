import test from 'node:test';
import assert from 'node:assert/strict';
import {assignMediaSource,cleanPlayerPreferences,applyPlayerPreferences} from '../public/player.js';
import {captionTarget,inheritCaptionTarget,commitCaptionTranslation,translationQueue} from '../public/caption-policy.js';

test('a UI refresh never reloads the same relative source or changes playback',()=>{
 let assignments=0;const video={src:'https://desk.test/api/assets/abc',currentTime:42,paused:false,getAttribute:()=>'/api/assets/abc',setAttribute(){assignments++}};
 assert.equal(assignMediaSource(video,'/api/assets/abc','https://desk.test/'),false);
 assert.equal(assignMediaSource(video,'https://desk.test/api/assets/abc','https://desk.test/'),false);
 assert.equal(assignments,0);assert.equal(video.currentTime,42);assert.equal(video.paused,false);
 assert.equal(assignMediaSource(video,'/api/assets/other','https://desk.test/'),true);assert.equal(assignments,1);
});
test('volume, mute and speed preferences affect only audio/rate, with bounded persisted values',()=>{
 const video={src:'keep',currentTime:8,paused:false};
 const prefs=cleanPlayerPreferences({volume:.35,muted:true,speed:1.5});applyPlayerPreferences(video,prefs);
 assert.deepEqual(video,{src:'keep',currentTime:8,paused:false,volume:.35,muted:true,defaultPlaybackRate:1.5,playbackRate:1.5});
 assert.equal(cleanPlayerPreferences({volume:8,speed:99}).volume,1);assert.equal(cleanPlayerPreferences({speed:99}).speed,1);
});
test('project target replaces legacy per-clip language; explicit visible overrides win',()=>{
 const a={captionLanguage:'Arabic',captionCues:{Original:[{text:'أهلاً'}],English:[{text:'Hello'}]}};
 assert.equal(captionTarget(a,'English'),'English');inheritCaptionTarget(a,'English');assert.equal(a.captionLanguage,'English');
 a.captionLanguageOverride='French';inheritCaptionTarget(a,'English');assert.equal(a.captionLanguage,'French');assert.deepEqual(a.captionCues.Original,[{text:'أهلاً'}]);
 delete a.captionLanguageOverride;assert.equal(captionTarget(a,undefined,'English'),'English');
});
test('missing target track stays empty instead of falling back to source captions',()=>{
 const m={captionLanguage:'Arabic',captionCues:{Original:[{text:'أهلاً'}]},showCaptions:true};inheritCaptionTarget(m,'English');
 assert.equal(m.captionLanguage,'English');assert.equal(m.captionCues.English,undefined);assert.equal(m.showCaptions,true);
});
test('late translations can complete a reopened clip without replacing human edits or changing its active language',()=>{
 const source=[{start:0,end:1,text:'مرحبا'}],m={captionLanguage:'French',captionCues:{Original:source},captionReviewed:{}};
 const result={original:JSON.stringify(source),previous:undefined,language:'English',cues:[{start:0,end:1,text:'Hello'}]};
 assert.equal(commitCaptionTranslation(m,result),true);assert.equal(m.captionLanguage,'French');assert.equal(m.captionCues.English[0].text,'Hello');
 m.captionCues.English[0].text='Editor correction';assert.equal(commitCaptionTranslation(m,result),false);assert.equal(m.captionCues.English[0].text,'Editor correction');
 const changed={captionCues:{Original:[{text:'Corrected original'}]},captionReviewed:{}};assert.equal(commitCaptionTranslation(changed,result),false);
});
test('translation queue bounds concurrency and deduplicates, while failures allow retry',async()=>{
 let active=0,max=0,calls=0;const releases=[];const queue=translationQueue(2);
 const work=()=>new Promise(resolve=>{active++;calls++;max=Math.max(max,active);releases.push(()=>{active--;resolve()})});
 const a=queue.add('a',work),duplicate=queue.add('a',work),b=queue.add('b',work),c=queue.add('c',work);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,2);assert.equal(a,duplicate);releases.shift()();await a;await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,3);releases.splice(0).forEach(r=>r());await Promise.all([b,c]);assert.equal(max,2);
 await assert.rejects(queue.add('bad',()=>Promise.reject(Error('offline'))));await queue.add('bad',()=>Promise.resolve());
});
