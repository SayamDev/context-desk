import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {mediaRange} from './imports.js';
import {studioStore} from './store.js';

const momentKeys=['id','url','persistedUrl','blob','frames','start','end','mediaStart','batchId','sourceName','sourceType','sourceCrop','sourceCaptureArea','sourcePixels','cleanCapture','sourceLink','manual','splitCreated','status','analysis','transcript','trimIn','trimOut','hook','alternateHook','frameMode','zoom','focusX','focusY','showHook','captionLanguage','translationMode','autoCaptionLanguage','captionStyle','dialectNote','captionCues','captionReviewed','showCaptions','captionError','captionOffset','speechError','speechSource','detectedLanguage','timingSource','translationSource','sourceCaptionsVisible','sourceCaptionMask','audioRms','error','approved','favourite','createdAt','editedAt'];
const localMedia=url=>typeof url==='string'&&/^\/api\/(?:assets\/[a-f0-9]{64}|import\/[a-f0-9-]{36}\/media)$/.test(url);
export function cleanProjectState(input,store=studioStore()){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid project state.');
  const state={version:1,storyMemoryId:typeof input.storyMemoryId==='string'?input.storyMemoryId:null,sourceId:typeof input.sourceId==='string'?input.sourceId:null,sourcePageUrl:String(input.sourcePageUrl||'').slice(0,2000),aspect:['landscape','portrait','square','fourfive'].includes(input.aspect)?input.aspect:'landscape',selected:input.selected||null,workspace:['source','clips','edit','library','jobs'].includes(input.workspace)?input.workspace:'clips',cut:(input.cut||[]).slice(0,5000),settings:{},exports:(input.exports||[]).slice(-200),aiCalls:Math.max(0,Number(input.aiCalls)||0),batchId:input.batchId||null,moments:[]};
  for(const key of ['speechProvider','translationProvider','speechLanguage','liveCaptionLanguage','sourceDialect','speechKeywords','showContext','storyLens','scanDepth','clipTarget','aiBudget','autoGenerate','loopClip','exportQuality','exportFormat','cutTitle','clipSort','clipDirection','codeSwitchLanguage','translationMode','glossary'])if(input.settings?.[key]!==undefined)state.settings[key]=typeof input.settings[key]==='boolean'?input.settings[key]:String(input.settings[key]).slice(0,1000);
  if(!Array.isArray(input.moments)||input.moments.length>5000)throw Error('Project contains too many moments.');
  for(const raw of input.moments){
    if(!raw.id||typeof raw.id!=='string'||raw.id.length>100)throw Error('A clip ID is required.');
    const m=Object.fromEntries(momentKeys.filter(key=>raw[key]!==undefined).map(key=>[key,raw[key]]));
    if(!Number.isFinite(m.start)||!Number.isFinite(m.end)||m.end<=m.start||m.start<0||m.end-m.start>21600)throw Error('Invalid clip source times.');
    if(!localMedia(m.url))throw Error('Save the clip media before saving its edits.');
    m.frames=(m.frames||[]).slice(0,3).map(frame=>{if(localMedia(frame))return frame;if(typeof frame==='string'&&/^data:image\/jpeg;base64,/.test(frame)){const bytes=Buffer.from(frame.split(',')[1],'base64');if(bytes.length>2000000)throw Error('A preview frame is too large.');return store.putAsset(bytes,'image/jpeg').url}throw Error('Invalid preview frame.')});
    m.hook=String(m.hook||'').slice(0,300);m.alternateHook=String(m.alternateHook||'').slice(0,300);m.transcript=String(m.transcript||'').slice(0,24000);
    state.moments.push(m);
  }
  for(const e of state.exports)if(!localMedia(e.url))throw Error('Export media must be saved locally.');
  return state;
}
export function createProjectApi(store=studioStore()){
  const full=p=>({...p,source:p.sourceId?store.getRecord('source',p.sourceId):null});
  return async(req,res,json)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;if(!pathname.startsWith('/api/projects')&&!pathname.startsWith('/api/assets')&&pathname!=='/api/preferences')return false;
    try{
      if(req.method!=='GET'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){json(res,403,{error:'Open project actions from the local app.'});return true}
      if(pathname==='/api/assets'&&req.method==='POST'){
        const type=String(req.headers['content-type']||'application/octet-stream').split(';')[0];if(!/^(image\/(jpeg|png|webp)|video\/(mp4|webm|quicktime)|audio\/(wav|mpeg|webm)|application\/(json|octet-stream)|text\/plain)$/.test(type))throw Error('Unsupported saved asset type.');
        let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>256*1024*1024)throw Error('Captured assets can be up to 256 MB each.');chunks.push(chunk)}if(!size)throw Error('The captured asset is empty.');json(res,201,store.putAsset(Buffer.concat(chunks),type));return true;
      }
      const asset=pathname.match(/^\/api\/assets\/([a-f0-9]{64})$/);
      if(asset&&req.method==='GET'){
        const record=store.assetPath(asset[1]);await fs.access(record.file);let range;try{range=mediaRange(req.headers.range,record.size)}catch{res.writeHead(416,{'Content-Range':`bytes */${record.size}`});res.end();return true}
        res.writeHead(range.partial?206:200,{'Content-Type':record.mime,'X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','Content-Length':range.end-range.start+1,'Cache-Control':'private, max-age=31536000, immutable',...(range.partial?{'Content-Range':`bytes ${range.start}-${range.end}/${record.size}`}:{})});const stream=createReadStream(record.file,{start:range.start,end:range.end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);return true;
      }
      if(pathname==='/api/projects'&&req.method==='GET'){
        const query=new URL(req.url,'http://localhost').searchParams,projects=store.listProjects({search:'',sort:query.get('sort')||'updated',direction:query.get('direction'),trashed:query.get('trash')==='1'}).map(p=>{const source=p.sourceId?store.getRecord('source',p.sourceId):null;return {id:p.id,title:p.title,revision:p.revision,createdAt:p.createdAt,updatedAt:p.updatedAt,lastOpened:p.lastOpened,trashed:p.trashed,sourceId:p.sourceId,duration:source?.duration||0,size:source?.size||0,sourceUrl:source?.sourceUrl||'',status:source?.status||'saved',language:p.state.settings?.speechLanguage||'Auto',dialect:p.state.settings?.sourceDialect||'',clipCount:p.state.moments.length,thumbnail:p.state.moments.find(m=>m.frames?.length)?.frames[0]||null}}).filter(p=>(p.title+' '+p.sourceUrl+' '+p.language+' '+p.dialect).normalize('NFKC').toLocaleLowerCase().includes((query.get('search')||'').normalize('NFKC').toLocaleLowerCase()));const numeric={duration:'duration',size:'size',clips:'clipCount'}[query.get('sort')];if(numeric)projects.sort((a,b)=>(a[numeric]-b[numeric])*(query.get('direction')==='asc'?1:-1)||a.title.localeCompare(b.title));json(res,200,{projects});return true;
      }
      let body={};if(['POST','PUT'].includes(req.method)){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>30000000)throw Error('Project save is too large.');}body=JSON.parse(raw||'{}')}
      if(pathname==='/api/preferences'){if(req.method==='GET')json(res,200,store.getRecord('preferences','workspace')||{});else if(req.method==='PUT'){const p={sort:String(body.sort||'updated'),direction:body.direction==='asc'?'asc':'desc',search:String(body.search||'').slice(0,160),lastProject:typeof body.lastProject==='string'?body.lastProject:null};store.putRecord('preferences','workspace',p);json(res,200,p)}else json(res,405,{error:'Method not allowed'});return true}
      if(pathname==='/api/projects'&&req.method==='POST'){json(res,201,full(store.createProject({title:body.title||'Live production'})));return true}
      const match=pathname.match(/^\/api\/projects\/([a-f0-9-]{36})$/);if(!match){json(res,404,{error:'Project route not found'});return true}
      const id=match[1];if(req.method==='GET'){const p=store.getProject(id);store.touchProject(id);json(res,200,full(p))}
      else if(req.method==='PUT'){
        const owner=store.getRecord('project_editor',id),current=store.getProject(id);
        if(body.clientId&&owner?.clientId===body.clientId&&Number(body.sequence)<=owner.sequence){json(res,200,full(current));return true}
        json(res,200,full(store.saveProject(id,cleanProjectState(body.state,store),body.clientId&&owner?.clientId===body.clientId?current.revision:body.revision,{title:body.title,clientId:body.clientId,sequence:body.sequence})));
      }
      else if(req.method==='POST'&&body.action==='moment-result'){
        const p=store.getProject(id),incoming=cleanProjectState({moments:[body.moment]},store).moments[0],existing=p.state.moments.find(m=>m.id===incoming.id);
        // User edits win over late analysis. Complete a pending result, or save a
        // detached captured window that was finalized while changing sources.
        const merged=existing?{...incoming,...existing,analysis:incoming.analysis,status:incoming.status,transcript:incoming.transcript,speechError:incoming.speechError,speechSource:incoming.speechSource,captionCues:existing.captionCues?.Original?.length?existing.captionCues:incoming.captionCues,hook:existing.hook||incoming.hook}:incoming;
        const moments=p.state.moments.filter(m=>m.id!==merged.id);moments.push(merged);store.saveProject(id,{...p.state,moments},p.revision);json(res,200,{saved:true});
      }
      else if(req.method==='POST'&&body.action==='draft'){
        if(typeof body.clientId!=='string'||body.clientId.length>100)throw Error('Invalid save session.');
        const p=store.getProject(id),owner=store.getRecord('project_editor',id);
        if(owner?.clientId===body.clientId&&owner.sequence>=body.sequence){json(res,200,{saved:true});return true}
        const moments=new Map(p.state.moments.map(m=>[m.id,m]));for(const m of body.patch?.moments||[])moments.set(m.id,m);
        const merged=cleanProjectState({...p.state,...body.patch,moments:[...moments.values()]},store);
        if(p.revision===body.revision||owner?.clientId===body.clientId){store.saveProject(id,merged,p.revision,{title:body.title,clientId:body.clientId,sequence:body.sequence});json(res,200,{saved:true})}
        else{store.putRecord('project_recovery',id+'/'+body.clientId,{state:merged,title:body.title,createdAt:Date.now()});json(res,409,{error:'A separate recovery copy was saved because another tab has newer edits.'})}
      }
      else if(req.method==='POST'&&body.action==='trash'){store.trashProject(id,body.trashed!==false);json(res,200,{saved:true})}
      else json(res,405,{error:'Method not allowed'});
    }catch(error){json(res,error.status||400,{error:error.message||'Project operation failed.'})}return true;
  };
}
