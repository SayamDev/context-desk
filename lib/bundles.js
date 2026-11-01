import fs from 'node:fs/promises';
import {createReadStream,createWriteStream,rmSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {createJobQueue,jobIdentity} from './jobs.js';

const assetId=url=>typeof url==='string'?url.match(/^\/api\/assets\/([a-f0-9]{64})$/)?.[1]:null;
const cleanName=value=>String(value||'Context Desk clips').normalize('NFKC').replace(/[^\p{L}\p{N} _-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,90)||'Context Desk clips';
const jobId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
const suffixes={'video/mp4':'.mp4','video/webm':'.webm','video/quicktime':'.mov'};
const stopError=()=>Object.assign(Error('Bundle packaging stopped.'),{stopped:true});
function reviewedSubtitles(job){
  const moments=job?.moments?.filter(moment=>moment.showCaptions)||[];
  return moments.length>0&&moments.every(moment=>moment.captionReviewed?.[moment.captionLanguage]===true&&(moment.captionCues?.[moment.captionLanguage]||[]).length>0&&moment.captionCues[moment.captionLanguage].every(cue=>!cue.uncertain));
}
function planBundle(store,body){
  if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.projectId!=='string')throw Error('Choose a saved project for the download bundle.');
  const project=store.getProject(body.projectId);if(project.trashed)throw Error('Restore this project before downloading its exports.');
  const ids=body.exportIds,urls=body.exportUrls;
  if((ids!==undefined)===(urls!==undefined))throw Error('Choose saved export IDs or saved project export URLs.');
  const selected=ids??urls;
  if(!Array.isArray(selected)||selected.length<1||selected.length>500||selected.some(id=>typeof id!=='string'||!id||id.length>200))throw Error('Choose 1–500 saved exports for the bundle.');
  const completed=store.listRecords('export_job').filter(job=>job.projectId===project.id&&job.status==='complete'&&assetId(job.output?.url)),saved=project.state.exports||[],entries=[],exports=[],warnings=[],seen=new Set();
  for(const selection of selected){
    let job,result;
    if(ids){
      const requested=store.getRecord('export_job',selection);
      if(requested){if(requested.projectId!==project.id||requested.status!=='complete'||!requested.output)throw Error('Every selected export must be complete and belong to this project.');job=requested;}
      else{const record=store.getRecord('export_result',selection);if(record){if(record.projectId!==project.id)throw Error('Every selected export must belong to this project.');result=record;}else result=saved.find(item=>item.id===selection);}
    }else{
      if(!assetId(selection))throw Error('Only saved local project export URLs can be bundled.');result=saved.find(item=>item.url===selection);
    }
    if(!job&&!result)throw Error('The selected export was not found in this saved project.');
    if(!job)job=completed.find(item=>item.output.url===result.url);
    const output=job?.output||result,id=assetId(output?.url);
    if(!id)throw Error('The selected export is not saved local media.');
    if(seen.has(id))continue;seen.add(id);
    const record=store.assetPath(id),extension=suffixes[record.mime];if(!extension||record.size<1)throw Error('Choose a saved MP4, WebM or MOV video export.');
    const order=exports.length+1,label=cleanName(job?.name||result?.name||'Clip').replace(/ (?:mp4|webm|mov)$/i,''),stem=String(order).padStart(3,'0')+'-'+label;
    const exportId=job?.id||selection,media={assetId:id,name:stem+extension,size:record.size,role:'video',exportId};entries.push(media);
    const provenance={order,exportId,name:job?.name||result?.name||'Clip',video:{entry:media.name,assetId:id,size:record.size},subtitles:null};
    const subtitle=job?.srt||result?.srt;
    if(body.includeSubtitles!==false&&subtitle){
      const subtitleId=assetId(subtitle.url),reviewed=job?reviewedSubtitles(job):result?.captionsReviewed===true;
      if(!reviewed)warnings.push(`Export ${order}: subtitle review could not be confirmed; SRT was left out.`);
      else if(!subtitleId)warnings.push(`Export ${order}: no saved local SRT is available.`);
      else{try{const srt=store.assetPath(subtitleId);if(!['text/plain','application/x-subrip'].includes(srt.mime)||srt.size<1)throw Error('Not a saved SRT');const entry={assetId:subtitleId,name:stem+'.srt',size:srt.size,role:'subtitles',exportId};entries.push(entry);provenance.subtitles={entry:entry.name,assetId:subtitleId,size:srt.size,reviewed:true};}catch{warnings.push(`Export ${order}: the reviewed SRT asset is unavailable and was left out.`);}}
    }
    exports.push(provenance);
  }
  const totalBytes=entries.reduce((total,entry)=>total+entry.size,0);
  if(!Number.isSafeInteger(totalBytes)||totalBytes>100*1024**3)throw Error('A download bundle can contain up to 100 GB of saved exports.');
  const name=cleanName(body.name||project.title||'Context Desk clips');
  return {projectId:project.id,projectRevision:project.revision,name,filename:name+'.zip',entries,exports,totalBytes,warnings,entriesDone:0,output:null};
}
async function localAsset(store,id){
  if(!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid saved bundle asset.');
  const record=store.assetPath(id),expected=path.join(store.root,'assets',id);
  if(path.resolve(record.file)!==path.resolve(expected))throw Error('Bundle media must remain in the local asset store.');
  const stat=await fs.lstat(record.file);
  if(!stat.isFile()||stat.isSymbolicLink())throw Error('Bundle sources must be regular local files; symbolic links are not allowed.');
  if(await fs.realpath(record.file)!==path.join(await fs.realpath(store.root),'assets',id))throw Error('Bundle media must not traverse symbolic-link directories.');
  if(stat.size!==record.size)throw Error('A saved export changed on disk. Restore the original media before bundling.');
  return {...record,size:stat.size};
}
function zipFiles(directory,names,worker){return new Promise((resolve,reject)=>{
  // Encoded media gains little from compression. Store mode avoids spending
  // CPU recompressing hundreds of clips; ZIP64 is supported by the local tool.
  const child=spawn('/usr/bin/zip',['-0','-q','-X','archive.zip',...names],{cwd:directory,stdio:['ignore','ignore','pipe'],env:{...process.env,ZIP:'',ZIPOPT:'',COPYFILE_DISABLE:'1'}});let error='',settled=false,aborted=null,forceKill;
  const finish=failure=>{if(settled)return;settled=true;clearInterval(cancel);clearTimeout(timeout);clearTimeout(forceKill);failure?reject(failure):resolve();};
  // Wait for process exit before removing its working files.
  const abort=failure=>{if(settled||aborted)return;aborted=failure;child.kill('SIGTERM');forceKill=setTimeout(()=>child.kill('SIGKILL'),1000);};
  const cancel=setInterval(()=>{if(worker.shouldStop())abort(stopError());},75),timeout=setTimeout(()=>abort(Error('ZIP packaging exceeded its time limit. Resume the saved bundle to retry.')),3600000);
  child.stderr.on('data',chunk=>error=(error+chunk).slice(-2000));child.on('error',()=>finish(Error('The local /usr/bin/zip tool is unavailable.')));child.on('close',code=>finish(aborted||(code===0?null:worker.shouldStop()?stopError():Error('ZIP packaging failed. '+error.slice(-700)))));
});}
async function saveArchive(store,file,job,worker){
  const temporary=path.join(store.root,'assets','.bundle-'+job.id+'.tmp'),hash=createHash('sha256');let size=0;
  try{
    await pipeline(createReadStream(file),async function*(source){for await(const part of source){if(worker.shouldStop())throw stopError();size+=part.length;hash.update(part);yield part;}},createWriteStream(temporary,{flags:'wx',mode:0o600}));
    if(worker.shouldStop())throw stopError();const id=hash.digest('hex'),target=path.join(store.root,'assets',id);await fs.rename(temporary,target);store.registerAsset(id,size,'application/zip');
    return {id,url:'/api/assets/'+id,size,type:'application/zip',name:job.filename};
  }finally{await fs.rm(temporary,{force:true});}
}
export function createBundleService({store,statfs=fs.statfs}){
  const snapshot=job=>({id:job.id,kind:'bundle',projectId:job.projectId,sourceName:job.name,name:job.name,status:job.status,phase:job.phase,error:job.error||'',createdAt:job.createdAt,sectionsDone:job.entriesDone||0,sectionsTotal:job.entries.length,sectionsRemaining:Math.max(0,job.entries.length-(job.entriesDone||0)),exportCount:job.exports.length,fileCount:job.entries.length,totalBytes:job.totalBytes,warnings:job.warnings||[],output:job.output||null,speechRequests:0,translationRequests:0});
  const queue=createJobQueue({store,kind:'bundle_job',publicJob:snapshot,execute:async(job,worker)=>{
    if(!jobId(job.id))throw Error('Invalid bundle working-directory identity.');
    const directory=path.join(store.root,'bundles',job.id);job.entriesDone=0;job.output=null;
    try{
      if(store.getProject(job.projectId).trashed)throw Error('Restore this project before building its download bundle.');
      await fs.rm(directory,{recursive:true,force:true});if(worker.shouldStop())return false;
      const disk=await statfs(store.root),needed=128*1024**2+job.totalBytes*2+Math.max(1024**2,job.entries.length*4096);
      if(disk.bavail*disk.bsize<needed)throw Error('Not enough free disk space for the ZIP and its saved download copy. Free at least '+Math.ceil(needed/1024**2)+' MB, then resume.');
      await fs.mkdir(directory,{recursive:true,mode:0o700});await fs.chmod(directory,0o700);
      const staged=[];
      for(const entry of job.entries){
        if(worker.shouldStop())return false;
        if(!/^[\p{L}\p{N} _.-]+$/u.test(entry.name)||entry.name.includes('..')||['archive.zip','context-desk-manifest.json'].includes(entry.name)||entry.name.startsWith('-'))throw Error('Invalid archive entry name.');
        let source;try{source=await localAsset(store,entry.assetId);}catch(error){if(entry.role!=='subtitles')throw error;job.warnings.push(`Export ${entry.exportId}: the reviewed SRT file is unavailable on disk and was left out.`);const provenance=job.exports.find(item=>item.exportId===entry.exportId);if(provenance)provenance.subtitles=null;worker.checkpoint();continue;}if(source.size!==entry.size)throw Error('A saved export changed size. Start a fresh download bundle.');
        const destination=path.join(directory,entry.name);await fs.link(source.file,destination);const linked=await fs.lstat(destination);if(!linked.isFile()||linked.isSymbolicLink())throw Error('Bundle sources must be regular local files.');
        staged.push(entry);job.entriesDone++;job.phase=`Preparing download ${job.entriesDone} of ${job.entries.length}`;worker.checkpoint();
      }
      job.entries=staged;job.totalBytes=staged.reduce((total,entry)=>total+entry.size,0);
      if(worker.shouldStop())return false;
      const manifest={format:'context-desk-export-bundle',version:1,projectId:job.projectId,projectRevision:job.projectRevision,bundleId:job.id,name:job.name,createdAt:job.createdAt,mediaOrigin:'saved local project exports',exports:job.exports,warnings:job.warnings};
      await fs.writeFile(path.join(directory,'context-desk-manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});
      job.phase='Packaging saved clips into ZIP';worker.checkpoint();await zipFiles(directory,[...job.entries.map(entry=>entry.name),'context-desk-manifest.json'],worker);if(worker.shouldStop())return false;
      job.phase='Saving download bundle';worker.checkpoint();job.output=await saveArchive(store,path.join(directory,'archive.zip'),job,worker);worker.checkpoint();store.putRecord('bundle_result',job.id,{...job.output,projectId:job.projectId,name:job.filename,createdAt:Date.now()});return true;
    }catch(error){if(error.stopped&&worker.shouldStop())return false;throw error;}
    finally{await fs.rm(directory,{recursive:true,force:true});}
  }});
  // A ZIP is atomic. On restart discard incomplete working files and wait for
  // explicit resume; source exports stay intact and are never re-rendered.
  for(const saved of store.listRecords('bundle_job'))if(jobId(saved.id)){
    rmSync(path.join(store.root,'bundles',saved.id),{recursive:true,force:true});rmSync(path.join(store.root,'assets','.bundle-'+saved.id+'.tmp'),{force:true});
    if(saved.status==='interrupted'){const document=queue.document(saved.id);document.entriesDone=0;document.phase='Resume required to rebuild the ZIP';document.error='Local ZIP packaging was interrupted. Original saved exports are intact. Resume to rebuild the download.';store.putRecord('bundle_job',saved.id,document);}
  }
  return {list:()=>queue.list(),get:id=>queue.get(id),counts:()=>queue.counts(),command:(id,action)=>queue.command(id,action),start(body){const plan=planBundle(store,body);return queue.add(plan,{idempotencyKey:jobIdentity(plan)});}};
}
