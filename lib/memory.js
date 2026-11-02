import {randomUUID} from 'node:crypto';
export function cleanMemory(body){return {title:String(body.title||'Story memory').slice(0,100),facts:(Array.isArray(body.facts)?body.facts:[]).slice(0,200).map(f=>({id:typeof f.id==='string'?f.id:randomUUID(),text:String(f.text||'').slice(0,1000),author:f.author==='ai'?'ai':'human',confirmed:f.confirmed===true,source:f.source&&typeof f.source==='object'?{projectId:String(f.source.projectId||''),momentId:String(f.source.momentId||''),start:Math.max(0,Number(f.source.start)||0),end:Math.max(0,Number(f.source.end)||0),evidence:String(f.source.evidence||'').slice(0,500)}:null}))}}
export function memoryContext(memory){return (memory?.facts||[]).filter(f=>f.confirmed&&f.text.trim()).map(f=>`${f.text} [editor-confirmed context; ${f.source?'source '+f.source.projectId+' @ '+f.source.start+'–'+f.source.end+'s':'editor note, no source citation'}]`).join('\n').slice(0,6000)}
export function createMemoryApi(store){return async(req,res,json)=>{
  const route=new URL(req.url,'http://localhost').pathname;if(!route.startsWith('/api/memories'))return false;
  try{if(req.method!=='GET'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)throw Error('Open story memory from the local app.');
    if(route==='/api/memories'&&req.method==='GET'){json(res,200,{memories:store.listRecords('story_memory').filter(m=>Boolean(m.trashed)===(new URL(req.url,'http://localhost').searchParams.get('trash')==='1')).map(m=>({id:m.id,title:m.title,revision:m.revision}))});return true}
    let body={};if(['POST','PUT'].includes(req.method)){let raw='';for await(const c of req){raw+=c;if(raw.length>300000)throw Error('Story memory is too large.')}body=JSON.parse(raw||'{}')}
    if(route==='/api/memories'&&req.method==='POST'){const m={...cleanMemory(body),id:randomUUID(),revision:0};store.putRecord('story_memory',m.id,m);json(res,201,m);return true}
    const id=route.split('/').at(-1);if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid story memory.');const current=store.getRecord('story_memory',id);if(!current)throw Error('Story memory not found.');
    if(req.method==='GET')json(res,200,current);
    else if(req.method==='PUT'){if(body.revision!==current.revision){json(res,409,{error:'Story memory changed in another tab. Reload it before saving.'});return true}const m={...cleanMemory(body),id,revision:current.revision+1,trashed:body.trashed===true};store.putRecord('story_memory',id,m);json(res,200,m)}else json(res,405,{error:'Method not allowed'});
  }catch(error){json(res,400,{error:error.message})}return true;
}}
