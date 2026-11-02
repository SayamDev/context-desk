// "Find what's shown": a one-off index of what is visible in a recording, made on this Mac with
// Apple Vision's built-in image classifier (free, no network), then searched by word.
// One frame every 2 seconds; labels are Apple's English identifiers (sofa, sunglasses, bottle…).
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ffmpeg} from './exports.js';

const STEP=2;
// Everyday words mapped to Apple's label identifiers.
const SYNONYMS={glasses:['eyeglasses','sunglasses'],couch:['sofa'],drink:['drinking_glass','bottle','beverage','cup'],car:['car','automobile','vehicle','conveyance'],phone:['cellular_telephone','telephone','phone'],food:['food','dish','meal','dessert','fruit'],flowers:['flower','bouquet','decorative_plant'],kiss:['kiss'],dog:['dog','canine'],cat:['cat','feline']};
const norm=word=>String(word).toLowerCase().replace(/[^a-z_ ]/g,'').trim();
export function queryLabels(query){
  return [...new Set(norm(query).split(/\s+/).filter(w=>w.length>1).flatMap(w=>{const single=w.replace(/(ies)$/,'y').replace(/s$/,'');return [w,single,...(SYNONYMS[w]||SYNONYMS[single]||[])]}))];
}
// Frames whose labels match, merged into time ranges (gaps up to two steps), best first.
export function searchIndex(frames,query,{limit=20}={}){
  const wanted=queryLabels(query);if(!wanted.length)return [];
  const hits=frames.map(f=>{const matched=f.labels.filter(l=>wanted.some(w=>l.id===w||l.id.split('_').includes(w)));return matched.length?{t:f.t,score:matched.reduce((a,l)=>a+l.c,0),labels:matched.map(l=>l.id)}:null}).filter(Boolean);
  const ranges=[];for(const h of hits){const last=ranges.at(-1);if(last&&h.t-last.end<=STEP*2){last.end=h.t+STEP;last.score+=h.score;h.labels.forEach(l=>last.labels.add(l))}else ranges.push({start:h.t,end:h.t+STEP,score:h.score,labels:new Set(h.labels)})}
  return ranges.map(r=>({start:r.start,end:r.end,score:+r.score.toFixed(2),labels:[...r.labels]})).sort((a,b)=>b.score-a.score).slice(0,limit);
}
function runSwift(dir){return new Promise((resolve,reject)=>{
  const cache=path.join(os.tmpdir(),'context-desk-swift-cache'),child=spawn('/usr/bin/swift',['-module-cache-path',cache,path.resolve(import.meta.dirname,'../scripts/vision-labels.swift'),dir],{stdio:['ignore','pipe','pipe']});let out='',err='';
  child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err=(err+d).slice(-2000));child.on('error',()=>reject(Error('Visual search needs macOS with the Swift command-line tools.')));
  child.on('close',code=>code===0?resolve(JSON.parse(out)):reject(Error('Apple Vision could not label the frames. '+err.trim().split('\n').pop())))})}
export function createVisualIndex({store,claimSource}){
  const running=new Map();
  async function build(sourceId,source,state){
    const dir=await fs.mkdtemp(path.join(os.tmpdir(),'context-visual-'));
    try{await fs.mkdir(path.join(dir,'f'));await ffmpeg(['-v','error','-y','-i',source.file,'-vf',`fps=1/${STEP},scale=320:-2`,'-q:v','5',path.join(dir,'f','%06d.jpg')],{timeout:1800000});
      state.progress='Recognising what is shown';const result=await runSwift(path.join(dir,'f'));
      const frames=result.frames.map((f,i)=>({t:i*STEP,labels:f.labels}));store.putRecord('visual_index',sourceId,{sourceId,frames,method:result.method,createdAt:Date.now()});running.delete(sourceId)}
    catch(error){state.status='error';state.error=error.message}
    finally{source.release();fs.rm(dir,{recursive:true,force:true}).catch(()=>{})}
  }
  return {
    status(sourceId){const saved=store.getRecord('visual_index',sourceId),live=running.get(sourceId);if(live)return {status:live.status,progress:live.progress,error:live.error||''};return saved?{status:'ready',frames:saved.frames.length}:{status:'none'}},
    start(sourceId){if(running.get(sourceId)?.status==='running')return this.status(sourceId);const source=claimSource(sourceId),state={status:'running',progress:'Sampling frames',startedAt:Date.now()};running.set(sourceId,state);void build(sourceId,source,state);return this.status(sourceId)},
    search(sourceId,query){const saved=store.getRecord('visual_index',sourceId);if(!saved)throw Error('Index this recording first.');return searchIndex(saved.frames,query)}
  };
}
