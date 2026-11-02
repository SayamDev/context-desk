import {randomBytes} from 'node:crypto';
export function createProductApi({store,search,live,social,onLiveOptions=()=>{}}){
 const sessions=new Map();
 function session(req,res){const cookies=String(req.headers.cookie||'').split(';').map(v=>v.trim()),id=cookies.find(v=>v.startsWith('context_social='))?.slice(15);if(id&&sessions.get(id)>Date.now())return id;const next=randomBytes(32).toString('base64url');sessions.set(next,Date.now()+86400000);for(const [key,end]of sessions)if(end<Date.now())sessions.delete(key);res.setHeader('Set-Cookie',`context_social=${next}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);return next}
 async function body(req){if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)throw Error('Open this action from Context Desk.');let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>24000)throw Error('Request is too large.')}return JSON.parse(raw||'{}')}
 return async(req,res,json)=>{const url=new URL(req.url,'http://localhost'),route=url.pathname;if(!['/api/moment-search','/api/live','/api/social'].some(p=>route===p||route.startsWith(p+'/')))return false;
 try{
  if(route==='/api/moment-search'&&req.method==='POST'){json(res,200,await search.search(await body(req)));return true}
  if(route==='/api/live'&&req.method==='GET'){json(res,200,{sessions:live.list()});return true}
  if(route==='/api/live'&&req.method==='POST'){const data=await body(req);if(live.list?.().some(s=>['starting','waiting','recording','stopping'].includes(s.status)))throw Error('Stop the active receiver before starting another.');const p=store.createProject({title:String(data.title||'Live encoder session').slice(0,160)});try{const options={analyze:data.analyze===true,analysisBudget:Math.max(1,Math.min(25,Number(data.analysisBudget)||10)),speechLanguage:String(data.speechLanguage||'').slice(0,80),language:String(data.language||'Original').slice(0,40),storyLens:['auto','reality','streamer','interview'].includes(data.storyLens)?data.storyLens:'auto'};store.saveProject(p.id,{...p.state,settings:{speechLanguage:options.speechLanguage||'Auto',liveCaptionLanguage:options.language,storyLens:options.storyLens}},p.revision);onLiveOptions(p.id,options);const snapshot=await live.start({projectId:p.id,title:p.title,maxSeconds:data.maxSeconds,maxBytes:data.maxBytes});json(res,202,{session:snapshot,project:store.getProject(p.id)})}catch(error){store.trashProject(p.id,true);throw error}return true}
  if(route.startsWith('/api/live/')&&req.method==='POST'){const data=await body(req);json(res,200,await live.command(route.split('/').at(-1),data.action,{projectId:data.projectId}));return true}
  if(route.startsWith('/api/social')){const id=session(req,res),callback=route.match(/^\/api\/social\/callback\/(youtube|tiktok)$/);
   if(callback&&req.method==='GET'){await social.handleCallback(callback[1],{url:`http://${req.headers.host}${req.url}`,sessionId:id});res.writeHead(303,{Location:'/#/jobs'});res.end();return true}
   if(req.method==='GET'){if(route==='/api/social/status')json(res,200,{providers:social.status(),accounts:social.accounts()});else if(route==='/api/social/drafts')json(res,200,{drafts:social.drafts(url.searchParams.get('projectId')||undefined)});else throw Error('Connection route not found.');return true}
   if(req.method!=='POST')throw Error('Method not allowed.');const data=await body(req);let result;
   if(route==='/api/social/authorize')result=social.beginAuthorization(data.provider,{sessionId:id});
   else if(route==='/api/social/disconnect')result=social.disconnect(data.accountId);
   else if(route==='/api/social/capabilities')result=await social.getCapabilities(data.accountId);
   else if(route==='/api/social/drafts')result=await social.createDraft(data);
   else if(route==='/api/social/confirm')result=social.issueConfirmation(data.draftId,{sessionId:id});
   else if(route==='/api/social/publish')result=await social.publish({draftId:data.draftId,confirmationToken:data.confirmationToken,sessionId:id,confirmed:data.confirmed===true});
   else if(route==='/api/social/poll')result=await social.poll(data.draftId);else throw Error('Connection action not found.');json(res,200,result);return true;
  }
  throw Error('Action not found.');
 }catch(error){json(res,error.status||400,{error:error.message||'This action could not be completed.'});return true}
 };
}
