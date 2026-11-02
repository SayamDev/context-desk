import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {produceShort,hookFromText} from '../lib/live-short.js';import {thinKeyframes} from '../lib/reframe.js';import {ffmpeg,probeMedia} from '../lib/exports.js';
test('crop keyframes are thinned to the renderer limit and keep every speaker cut',()=>{
  const k=Array.from({length:121},(_,i)=>({time:i/4,focusX:i%30<15?10:80,focusY:50,sceneCut:i>0&&i%15===0}));
  const thin=thinKeyframes(k);assert.ok(thin.length<=64);assert.equal(thin[0],k[0]);assert.equal(thin.at(-1),k.at(-1));
  for(const cut of k.filter(x=>x.sceneCut))assert.ok(thin.includes(cut));assert.ok(thin.every((x,i)=>!i||x.time>thin[i-1].time));
  assert.equal(thinKeyframes(k.slice(0,10)).length,10);
});
test('hook comes from the first sentence and stays short',()=>{assert.equal(hookFromText('She sold the car! Then what.'),'She sold the car!');assert.ok(hookFromText('word '.repeat(40)).length<=60)});
test('a Short is produced with captions, hook and post copy; failures fall back instead of failing',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'short-'));
  try{await ffmpeg(['-v','error','-y','-f','lavfi','-i','testsrc2=size=1280x720:rate=30:duration=4','-f','lavfi','-i','sine=f=300:d=4','-shortest','-c:v','libx264','-c:a','aac',path.join(dir,'clip.mp4')]);
    const stages=[],r=await produceShort({file:path.join(dir,'clip.mp4'),dir:path.join(dir,'out'),sourceUrl:'https://twitch.tv/example',
      transcribe:async()=>({turns:[{startMs:200,endMs:3500,text:'You will not believe what just happened here'}]}),
      postKit:async()=>({title:'What just happened?',caption:'Live, as it happened.',hashtags:['live','stream']}),
      detector:async()=>{throw Error('no detector here')},onStage:s=>stages.push(s)});
    assert.deepEqual(stages,['transcribing','framing','writing','rendering','ready']);
    assert.equal(r.hook,'What just happened?');assert.ok(r.captions>0);assert.equal(r.framing,'centre');assert.match(r.notes.join(' '),/centred crop/);
    assert.match(r.postCaption,/Full video: https:\/\/twitch.tv\/example/);assert.match(r.postCaption,/Edited with AI tools/);assert.match(r.postCaption,/#live #stream/);
    const info=await probeMedia(r.file);assert.equal(info.width,720);assert.equal(info.height,1280);assert.ok(info.audio);
  }finally{await fs.rm(dir,{recursive:true,force:true})}
});
