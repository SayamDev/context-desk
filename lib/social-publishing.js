import fs from 'node:fs/promises';
import {createReadStream,constants,lstatSync,readFileSync,writeFileSync,openSync,closeSync,existsSync,fsyncSync} from 'node:fs';
import path from 'node:path';
import {randomBytes,randomUUID,createHash,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
import {probeMedia} from './exports.js';

// Endpoint contracts and important provider-specific requirements are linked in
// docs/SOCIAL-CONNECTIONS.md. No provider is contacted during construction.
const providers={
  youtube:{name:'YouTube',vars:['YOUTUBE_CLIENT_ID','YOUTUBE_CLIENT_SECRET','YOUTUBE_REDIRECT_URI'],auth:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',scopes:['https://www.googleapis.com/auth/youtube.upload','https://www.googleapis.com/auth/youtube.readonly']},
  tiktok:{name:'TikTok',vars:['TIKTOK_CLIENT_KEY','TIKTOK_CLIENT_SECRET','TIKTOK_REDIRECT_URI'],auth:'https://www.tiktok.com/v2/auth/authorize/',token:'https://open.tiktokapis.com/v2/oauth/token/',scopes:['video.publish']},
  instagram:{name:'Instagram',vars:['INSTAGRAM_APP_ID','INSTAGRAM_APP_SECRET','INSTAGRAM_REDIRECT_URI'],unsupported:'Automated Instagram publishing is not enabled: the verified Reels contract requires an eligible professional account and publicly retrievable media; this local-only app has no approved public-media hosting path. Instagram OAuth is not implemented.'},
  facebook:{name:'Facebook',vars:['FACEBOOK_APP_ID','FACEBOOK_APP_SECRET','FACEBOOK_REDIRECT_URI'],unsupported:'Automated Facebook connection and publishing are not implemented: current Page OAuth, upload and permission contracts could not be verified from accessible official documentation.'}
};
const sha=value=>createHash('sha256').update(value).digest('hex');
const nonce=()=>randomBytes(32).toString('base64url');
const text=(value,max)=>String(value??'').replace(/[\u0000-\u001F\u007F]/g,' ').slice(0,max);
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const assetId=url=>typeof url==='string'?url.match(/^\/api\/assets\/([a-f0-9]{64})$/)?.[1]:null;
const error=message=>Object.assign(Error(message),{safe:true});
function redirectConfig(provider,env){
  const value=env[providers[provider].vars[2]];let url;try{url=new URL(value);}catch{throw error('Configure an absolute registered OAuth redirect URI.');}
  if(url.username||url.password||url.search||url.hash||url.href.length>=512)throw error('OAuth redirect URI must be static, without credentials, query or fragment.');
  const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback))throw error('OAuth redirects require HTTPS, or an explicitly registered local loopback callback.');
  if(provider==='tiktok'){
    const mode=env.TIKTOK_LOGIN_MODE||'desktop';if(!['desktop','web'].includes(mode))throw error('Set TIKTOK_LOGIN_MODE to desktop or web.');
    if(mode==='desktop'&&(!['localhost','127.0.0.1'].includes(url.hostname)||!url.port))throw error('TikTok desktop requires a localhost or 127.0.0.1 redirect URI with an explicit port.');
    if(mode==='web'&&url.protocol!=='https:')throw error('TikTok web Login Kit requires an approved HTTPS redirect URI.');
  }
  return url.href;
}
export function socialProviderStatus(env=process.env){return Object.entries(providers).map(([id,provider])=>{
  const missing=provider.vars.filter(key=>!String(env[key]||'').trim()),issues=[];
  if(!missing.length&&!provider.unsupported)try{redirectConfig(id,env);}catch(failure){issues.push(failure.message);}
  if(provider.unsupported)issues.push(provider.unsupported);
  return {id,name:provider.name,configured:!missing.length&&!issues.length,missing,issues,oauthSupported:!provider.unsupported,uploadSupported:!provider.unsupported,importSupported:false,publishingEnabled:env.CONTEXT_DESK_SOCIAL_PUBLISHING_ENABLED==='1',manualExportSupported:true};
});}

export function createEncryptedTokenStore(store){
  const filename=path.join(store.root,'.social-token-key');let key;
  function loadKey(){
    if(key)return key;
    if(!existsSync(filename)){
      if(store.listRecords('social_secret').some(record=>record.ciphertext))throw error('The private social token key is missing. Restore it securely before reconnecting accounts.');
      let descriptor;try{descriptor=openSync(filename,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);writeFileSync(descriptor,randomBytes(32));fsyncSync(descriptor);}catch(failure){if(failure.code!=='EEXIST')throw error('The private social token key could not be created.');}finally{if(descriptor!==undefined)closeSync(descriptor);}
    }
    const stat=lstatSync(filename);if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)throw error('The social token key must be a private regular file with mode 600.');
    const descriptor=openSync(filename,constants.O_RDONLY|constants.O_NOFOLLOW);try{key=readFileSync(descriptor);}finally{closeSync(descriptor);}if(key.length!==32)throw error('The private social token key is invalid.');return key;
  }
  return {
    get(id){const record=store.getRecord('social_secret',id);if(!record?.ciphertext)return null;try{const decipher=createDecipheriv('aes-256-gcm',loadKey(),Buffer.from(record.iv,'base64'));decipher.setAAD(Buffer.from(id));decipher.setAuthTag(Buffer.from(record.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(record.ciphertext,'base64')),decipher.final()]).toString('utf8'));}catch(failure){if(failure.safe)throw failure;throw error('Saved social credentials could not be decrypted. Restore the private key or reconnect the account.');}},
    set(id,value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',loadKey(),iv);cipher.setAAD(Buffer.from(id));const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);store.putRecord('social_secret',id,{version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')});},
    delete(id){store.putRecord('social_secret',id,{deleted:true});}
  };
}
export function tiktokChunks(size){
  if(!Number.isSafeInteger(size)||size<1||size>4_000_000_000)throw error('TikTok video size must be positive and no larger than 4 GB.');
  const chunkSize=size<=64_000_000?size:10_000_000,totalChunks=Math.max(1,Math.floor(size/chunkSize)),ranges=Array.from({length:totalChunks},(_,i)=>({start:i*chunkSize,end:i===totalChunks-1?size-1:(i+1)*chunkSize-1}));
  return {chunkSize,totalChunks,ranges};
}
function metadataFor(provider,input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw error('Review the post metadata and explicitly choose visibility.');
  const allowed=provider==='youtube'?['private','unlisted','public']:['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','SELF_ONLY'];
  if(!allowed.includes(input.visibility))throw error('Explicitly choose a supported visibility; there is no default privacy setting.');
  if(typeof input.title!=='string'||!input.title.trim()||input.title.length>(provider==='youtube'?100:2200))throw error('Enter a title within this provider’s supported length.');
  if(provider==='youtube'){
    if(typeof input.madeForKids!=='boolean'||typeof input.containsSyntheticMedia!=='boolean')throw error('Choose the made-for-kids and synthetic-media declarations explicitly.');
    if(String(input.description||'').length>5000)throw error('YouTube descriptions can be up to 5000 characters.');
    const tags=input.tags??[];if(!Array.isArray(tags)||tags.some(tag=>typeof tag!=='string')||tags.join(',').length>500)throw error('Review the YouTube tags.');
    return {title:input.title.trim(),description:String(input.description||''),visibility:input.visibility,tags:[...tags],madeForKids:input.madeForKids,containsSyntheticMedia:input.containsSyntheticMedia,notifySubscribers:input.notifySubscribers===true};
  }
  const metadata={title:input.title,visibility:input.visibility,allowComment:input.allowComment===true,allowDuet:input.allowDuet===true,allowStitch:input.allowStitch===true,commercialDisclosure:input.commercialDisclosure===true,brandOrganic:input.brandOrganic===true,brandContent:input.brandContent===true,musicUsageAccepted:input.musicUsageAccepted===true,brandedPolicyAccepted:input.brandedPolicyAccepted===true};
  if(metadata.commercialDisclosure&&!metadata.brandOrganic&&!metadata.brandContent)throw error('Choose Your Brand and/or Branded Content for commercial disclosure.');
  if(!metadata.commercialDisclosure&&(metadata.brandOrganic||metadata.brandContent))throw error('Enable commercial disclosure before choosing its brand settings.');
  if(metadata.brandContent&&metadata.visibility==='SELF_ONLY')throw error('Branded TikTok content cannot use Only Me visibility. Choose another supported visibility yourself.');
  return metadata;
}
function fingerprint(draft){return sha(JSON.stringify({projectId:draft.projectId,projectRevision:draft.projectRevision,accountId:draft.accountId,connectionVersion:draft.connectionVersion,provider:draft.provider,providerAccountId:draft.providerAccountId,accountName:draft.accountName,assetId:draft.assetId,assetBytes:draft.assetBytes,assetHash:draft.assetHash,duration:draft.duration,metadata:draft.metadata}));}
const publicAccount=account=>({id:account.id,provider:account.provider,providerAccountId:account.providerAccountId,displayName:account.displayName,status:account.status,connectedAt:account.connectedAt,expiresAt:account.expiresAt});
const publicDraft=draft=>({id:draft.id,status:draft.status,projectId:draft.projectId,projectRevision:draft.projectRevision,accountId:draft.accountId,provider:draft.provider,accountName:draft.accountName,assetUrl:'/api/assets/'+draft.assetId,assetBytes:draft.assetBytes,duration:draft.duration,metadata:draft.metadata,capabilities:draft.capabilities,createdAt:draft.createdAt,result:draft.result||null,error:draft.error||''});

export function createSocialPublishingService({store,env=process.env,fetchImpl=fetch,tokenStore=createEncryptedTokenStore(store),now=Date.now,probe=probeMedia}){
  const refreshes=new Map();
  const configured=provider=>{const status=socialProviderStatus(env).find(item=>item.id===provider);if(!status)throw error('Unsupported social provider.');if(!status.configured)throw error(status.issues[0]||'Configure the provider app credentials and registered redirect URI before connecting.');return providers[provider];};
  const sessionHash=sessionId=>{if(typeof sessionId!=='string'||sessionId.length<24||sessionId.length>512)throw error('A private browser session is required.');return sha(sessionId);};
  const accountDocument=id=>{const account=store.getRecord('social_account',id);if(!account||account.status!=='connected')throw error('Connect this social account before continuing.');configured(account.provider);return account;};
  async function request(url,options={},uploadProvider){
    const parsed=new URL(url),allowed=uploadProvider==='youtube'?parsed.hostname==='www.googleapis.com'&&/^\/(?:resumable\/)?upload\/youtube\/v3\/videos$/.test(parsed.pathname):uploadProvider==='tiktok'?['open-upload.tiktokapis.com','upload.us.tiktokapis.com'].includes(parsed.hostname)&&/^\/(?:video|upload)\/$/.test(parsed.pathname):['oauth2.googleapis.com','www.googleapis.com','open.tiktokapis.com'].includes(parsed.hostname);
    if(!allowed||parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port||parsed.hash){options.body?.destroy?.();throw error('The provider returned an untrusted upload or API endpoint. No media was sent.');}
    let response;try{response=await fetchImpl(parsed.href,{...options,redirect:'error',signal:AbortSignal.timeout(uploadProvider?600000:45000)});}catch{options.body?.destroy?.();throw error('The provider request failed or timed out. Review the account/provider status before trying again.');}
    if(!response.ok){options.body?.destroy?.();const failure=error(`The provider request failed (HTTP ${response.status}). Check permissions, limits and account authorization.`);failure.httpStatus=response.status;throw failure;}
    return response;
  }
  async function readJson(response){try{let raw='',bytes=0;const decoder=new TextDecoder();if(response.body){for await(const part of response.body){bytes+=part.byteLength;if(bytes>1_000_000)throw Error();raw+=decoder.decode(part,{stream:true});}}raw+=decoder.decode();return JSON.parse(raw);}catch{throw error('The provider returned an invalid response.');}}
  const jsonRequest=async(url,options={},uploadProvider)=>readJson(await request(url,options,uploadProvider));
  const formRequest=(provider,body)=>jsonRequest(providers[provider].token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});
  function parseTokens(provider,data,previous){
    if(typeof data.access_token!=='string'||!data.access_token||data.access_token.length>8192||!Number.isFinite(data.expires_in)||data.expires_in<=0||data.expires_in>366*86400||data.token_type&&data.token_type.toLowerCase()!=='bearer')throw error('The provider did not issue a usable access token. Reconnect the account.');
    const scopes=String(data.scope||previous?.scope||'').split(/[ ,]+/);if(providers[provider].scopes.some(scope=>!scopes.includes(scope)))throw error('Required publishing/account scopes were not granted. Reconnect and review the permissions.');
    return {accessToken:data.access_token,refreshToken:typeof data.refresh_token==='string'?data.refresh_token:previous?.refreshToken||null,expiresAt:now()+data.expires_in*1000,refreshExpiresAt:data.refresh_expires_in?now()+data.refresh_expires_in*1000:previous?.refreshExpiresAt||null,scope:scopes.join(' '),providerAccountId:data.open_id||previous?.providerAccountId||null};
  }
  async function accessToken(account){
    const key='tokens:'+account.id,stored=tokenStore.get(key);if(!stored)throw error('Saved account authorization is unavailable. Reconnect the account.');
    if(stored.expiresAt>now()+60000)return stored.accessToken;
    if(refreshes.has(account.id))return refreshes.get(account.id);
    const pending=(async()=>{
      if(!stored.refreshToken||stored.refreshExpiresAt&&stored.refreshExpiresAt<=now())throw error('Account authorization expired. Reconnect before continuing.');
      const provider=account.provider,body={grant_type:'refresh_token',refresh_token:stored.refreshToken,client_secret:env[providers[provider].vars[1]],[provider==='youtube'?'client_id':'client_key']:env[providers[provider].vars[0]]};
      try{const data=await formRequest(provider,body),tokens=parseTokens(provider,data,stored);if(tokens.providerAccountId&&tokens.providerAccountId!==account.providerAccountId)throw error('The refreshed authorization belongs to a different account. Reconnect.');const current=store.getRecord('social_account',account.id);if(current?.status!=='connected'||current.connectionVersion!==account.connectionVersion)throw error('Account authorization changed during refresh. Reconnect before continuing.');tokenStore.set(key,tokens);store.putRecord('social_account',account.id,{...account,expiresAt:tokens.expiresAt});return tokens.accessToken;}
      catch(failure){const current=store.getRecord('social_account',account.id);if([400,401].includes(failure.httpStatus)&&current?.status==='connected'&&current.connectionVersion===account.connectionVersion)store.putRecord('social_account',account.id,{...current,status:'requires-reconnect'});throw failure.safe?failure:error('Account authorization refresh failed. Reconnect before publishing.');}
    })();refreshes.set(account.id,pending);try{return await pending;}finally{refreshes.delete(account.id);}
  }
  async function profile(provider,token,providerAccountId){
    if(provider==='youtube'){
      const data=await jsonRequest('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',{headers:{Authorization:'Bearer '+token}});
      if(data.items?.length!==1||typeof data.items[0].id!=='string')throw error('Select exactly one eligible YouTube channel during authorization.');return {providerAccountId:data.items[0].id,displayName:text(data.items[0].snippet?.title||data.items[0].id,200),visibilityOptions:['private','unlisted','public']};
    }
    const response=await jsonRequest('https://open.tiktokapis.com/v2/post/publish/creator_info/query/',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json; charset=UTF-8'}});
    if(response.error?.code!=='ok'||!Array.isArray(response.data?.privacy_level_options)||!Number.isFinite(response.data?.max_video_post_duration_sec)||!providerAccountId)throw error('TikTok creator information is unavailable or posting is currently restricted.');
    const data=response.data;return {providerAccountId,displayName:text(data.creator_nickname||data.creator_username||providerAccountId,200),visibilityOptions:data.privacy_level_options.filter(option=>['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','SELF_ONLY'].includes(option)),maximumDuration:data.max_video_post_duration_sec,commentDisabled:data.comment_disabled===true,duetDisabled:data.duet_disabled===true,stitchDisabled:data.stitch_disabled===true};
  }
  async function capabilities(account){const token=await accessToken(account),result=await profile(account.provider,token,account.providerAccountId);if(result.providerAccountId!==account.providerAccountId)throw error('Account authorization changed. Reconnect and create a new review draft.');return result;}
  function checkTikTok(metadata,caps,duration){
    if(!caps.visibilityOptions.includes(metadata.visibility))throw error('Choose visibility from the creator’s current available options.');
    if(duration>caps.maximumDuration)throw error('The saved video exceeds this TikTok creator’s current duration limit.');
    if(metadata.allowComment&&caps.commentDisabled||metadata.allowDuet&&caps.duetDisabled||metadata.allowStitch&&caps.stitchDisabled)throw error('One of the chosen interactions is disabled in this creator’s current account settings.');
    if(env.TIKTOK_APP_AUDITED!=='1'&&(metadata.visibility!=='SELF_ONLY'||caps.visibilityOptions.includes('PUBLIC_TO_EVERYONE')))throw error('Unaudited TikTok clients require an eligible private creator account and explicitly chosen Only Me visibility. Public posting requires TikTok audit approval.');
  }
  async function savedAsset(projectId,{exportId,assetUrl}){
    const project=store.getProject(projectId);if(project.trashed)throw error('Restore the project before publishing its export.');let output;
    if(exportId){const job=store.getRecord('export_job',exportId),result=store.getRecord('export_result',exportId);if(job){if(job.projectId!==project.id||job.status!=='complete')throw error('Choose a completed export belonging to this project.');output=job.output;}else if(result){if(result.projectId!==project.id)throw error('Choose an export belonging to this project.');output=result;}else output=project.state.exports?.find(item=>item.id===exportId);}
    else if(assetUrl)output=project.state.exports?.find(item=>item.url===assetUrl);
    if(!output||!assetId(output.url))throw error('Choose a real saved video export belonging to this project.');return {project,asset:await checkAsset(assetId(output.url))};
  }
  async function checkAsset(id){
    const record=store.assetPath(id),expected=path.join(store.root,'assets',id),stat=await fs.lstat(record.file);
    if(path.resolve(record.file)!==path.resolve(expected)||!stat.isFile()||stat.isSymbolicLink()||await fs.realpath(record.file)!==path.join(await fs.realpath(store.root),'assets',id)||stat.size!==record.size||!['video/mp4','video/webm','video/quicktime'].includes(record.mime)||stat.size<1)throw error('The saved export media changed or is not a supported regular local video asset.');
    const hash=createHash('sha256');for await(const chunk of createReadStream(record.file))hash.update(chunk);if(hash.digest('hex')!==id)throw error('The saved export media changed. Render and review a new export.');return {...record,id,size:stat.size};
  }
  function draftDocument(id){const draft=store.getRecord('social_draft',id);if(!draft)throw error('Publishing draft not found.');if(draft.fingerprint!==fingerprint(draft))throw error('The review draft changed. Create a new exact review before publishing.');return draft;}
  function assertAccountCurrent(account){const current=store.getRecord('social_account',account.id);if(current?.status!=='connected'||current.connectionVersion!==account.connectionVersion)throw error('Account authorization changed during this attempt. Review a new draft.');}
  function publicationGate(draft){if(env.CONTEXT_DESK_SOCIAL_PUBLISHING_ENABLED!=='1')throw error('Publishing is disabled. Complete provider setup and explicitly enable CONTEXT_DESK_SOCIAL_PUBLISHING_ENABLED before requesting publish confirmation.');const account=accountDocument(draft.accountId);if(account.connectionVersion!==draft.connectionVersion)throw error('Account authorization changed after review. Create a new draft.');if(draft.status!=='review')throw error('This draft is no longer awaiting review. Check the existing provider attempt before making another upload.');if(draft.provider==='tiktok'&&(!draft.metadata.musicUsageAccepted||draft.metadata.brandContent&&!draft.metadata.brandedPolicyAccepted))throw error('Review and accept TikTok’s applicable Music Usage and Branded Content declarations before confirming.');return account;}
  const api={
    status:()=>socialProviderStatus(env),accounts:()=>store.listRecords('social_account').map(publicAccount),drafts:projectId=>store.listRecords('social_draft').filter(draft=>!projectId||draft.projectId===projectId).map(publicDraft),getDraft:id=>publicDraft(draftDocument(id)),
    beginAuthorization(provider,{sessionId}={}){
      const definition=configured(provider),binding=sessionHash(sessionId),state=nonce(),verifier=nonce(),stateId=sha(state),redirectUri=redirectConfig(provider,env),url=new URL(definition.auth),desktop=provider==='tiktok'&&(env.TIKTOK_LOGIN_MODE||'desktop')==='desktop';
      url.searchParams.set(provider==='youtube'?'client_id':'client_key',env[definition.vars[0]]);url.searchParams.set('response_type','code');url.searchParams.set('scope',definition.scopes.join(provider==='youtube'?' ':','));url.searchParams.set('redirect_uri',redirectUri);url.searchParams.set('state',state);
      if(provider==='youtube'||desktop){url.searchParams.set('code_challenge',createHash('sha256').update(verifier).digest(desktop?'hex':'base64url'));url.searchParams.set('code_challenge_method','S256');}
      if(provider==='youtube'){url.searchParams.set('access_type','offline');url.searchParams.set('prompt','consent');}
      store.putRecord('social_oauth',stateId,{provider,sessionHash:binding,redirectUri,expiresAt:now()+600000,used:false});tokenStore.set('oauth:'+stateId,{verifier});return {authorizationUrl:url.href,expiresAt:now()+600000};
    },
    async handleCallback(provider,{url,sessionId}={}){
      configured(provider);const binding=sessionHash(sessionId),redirect=redirectConfig(provider,env);let callback;try{callback=new URL(url);}catch{throw error('Invalid OAuth callback URL.');}
      const registered=new URL(redirect);if(callback.origin!==registered.origin||callback.pathname!==registered.pathname||callback.username||callback.password||callback.hash||callback.searchParams.getAll('state').length!==1||callback.searchParams.getAll('code').length>1)throw error('OAuth callback does not match the registered redirect and unique state.');
      const state=callback.searchParams.get('state'),stateId=sha(state||''),pending=store.getRecord('social_oauth',stateId);if(!pending||pending.used||pending.provider!==provider||pending.expiresAt<=now()||!same(pending.sessionHash,binding)||pending.redirectUri!==redirect)throw error('OAuth state is invalid, expired, already used, or belongs to another browser session.');
      const secret=tokenStore.get('oauth:'+stateId);store.putRecord('social_oauth',stateId,{...pending,used:true});tokenStore.delete('oauth:'+stateId);
      const code=callback.searchParams.get('code');if(callback.searchParams.has('error')||!code||code.length>4096||!secret?.verifier)throw error('Authorization was declined or did not return a valid code.');
      const definition=providers[provider],body={grant_type:'authorization_code',code,redirect_uri:redirect,client_secret:env[definition.vars[1]],[provider==='youtube'?'client_id':'client_key']:env[definition.vars[0]]};if(provider==='youtube'||(env.TIKTOK_LOGIN_MODE||'desktop')==='desktop')body.code_verifier=secret.verifier;
      const data=await formRequest(provider,body),tokens=parseTokens(provider,data),info=await profile(provider,tokens.accessToken,tokens.providerAccountId),id=provider+':'+sha(info.providerAccountId).slice(0,24),previous=store.getRecord('social_account',id),account={id,provider,providerAccountId:info.providerAccountId,displayName:info.displayName,status:'connected',connectedAt:now(),expiresAt:tokens.expiresAt,connectionVersion:(previous?.connectionVersion||0)+1};tokens.providerAccountId=info.providerAccountId;tokenStore.set('tokens:'+id,tokens);store.putRecord('social_account',id,account);return publicAccount(account);
    },
    disconnect(accountId){const account=store.getRecord('social_account',accountId);if(!account)throw error('Social account not found.');tokenStore.delete('tokens:'+accountId);store.putRecord('social_account',accountId,{...account,status:'disconnected',connectionVersion:account.connectionVersion+1});return {disconnected:true,providerRevoked:false};},
    async getCapabilities(accountId){const account=accountDocument(accountId);return {accountId,provider:account.provider,...await capabilities(account)};},
    async createDraft(body){
      if(!body||typeof body.projectId!=='string'||typeof body.accountId!=='string')throw error('Choose a saved project, export and connected account.');const account=accountDocument(body.accountId),metadata=metadataFor(account.provider,body.metadata),{project,asset}=await savedAsset(body.projectId,body),info=await probe(asset.file);
      if(!Number.isFinite(info.duration)||info.duration<=0)throw error('The saved export duration is unavailable.');if(account.provider==='tiktok'&&asset.mime!=='video/mp4')throw error('Render a saved MP4 export before posting to TikTok.');
      if(asset.size>256*1024**3)throw error('The saved video exceeds YouTube’s supported upload size.');if(account.provider==='tiktok')tiktokChunks(asset.size);
      const caps=await capabilities(account);if(account.provider==='tiktok')checkTikTok(metadata,caps,info.duration);
      const draft={id:randomUUID(),status:'review',projectId:project.id,projectRevision:project.revision,accountId:account.id,connectionVersion:account.connectionVersion,provider:account.provider,providerAccountId:account.providerAccountId,accountName:caps.displayName,assetId:asset.id,assetBytes:asset.size,assetHash:asset.id,duration:info.duration,metadata,capabilities:caps,createdAt:now()};draft.fingerprint=fingerprint(draft);store.putRecord('social_draft',draft.id,draft);return publicDraft(draft);
    },
    issueConfirmation(draftId,{sessionId}={}){const draft=draftDocument(draftId);publicationGate(draft);const confirmationToken=nonce(),expiresAt=now()+60000;store.putRecord('social_confirmation',sha(confirmationToken),{draftId,fingerprint:draft.fingerprint,sessionHash:sessionHash(sessionId),expiresAt,used:false});return {draft:publicDraft(draft),confirmationToken,expiresAt};},
    async publish({draftId,confirmationToken,sessionId,confirmed}={}){
      if(confirmed!==true||typeof confirmationToken!=='string')throw error('Explicit final confirmation of this exact draft is required.');const binding=sessionHash(sessionId),draft=draftDocument(draftId),account=publicationGate(draft),asset=await checkAsset(draft.assetId),confirmationId=sha(confirmationToken),confirmation=store.getRecord('social_confirmation',confirmationId);
      if(!confirmation||confirmation.used||confirmation.expiresAt<=now()||confirmation.draftId!==draft.id||confirmation.fingerprint!==draft.fingerprint||!same(confirmation.sessionHash,binding))throw error('Publish confirmation is invalid, expired, already used, or belongs to another exact review/session.');
      const current=draftDocument(draftId);publicationGate(current);store.putRecord('social_confirmation',confirmationId,{...confirmation,used:true});draft.status='publishing';store.putRecord('social_draft',draft.id,draft);
      try{
        const token=await accessToken(account),caps=await profile(account.provider,token,account.providerAccountId);assertAccountCurrent(account);if(caps.providerAccountId!==draft.providerAccountId)throw error('The connected provider account changed. Review a new draft.');
        if(account.provider==='youtube'){
          const metadata={snippet:{title:draft.metadata.title,description:draft.metadata.description,tags:draft.metadata.tags},status:{privacyStatus:draft.metadata.visibility,selfDeclaredMadeForKids:draft.metadata.madeForKids,containsSyntheticMedia:draft.metadata.containsSyntheticMedia}},response=await request('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers='+draft.metadata.notifySubscribers,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Length':String(asset.size),'X-Upload-Content-Type':asset.mime},body:JSON.stringify(metadata)}),uploadUrl=response.headers.get('location');
          if(!uploadUrl)throw error('YouTube did not return a resumable upload session.');tokenStore.set('upload:'+draft.id,{provider:'youtube',url:uploadUrl});
          assertAccountCurrent(account);const result=await jsonRequest(uploadUrl,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':asset.mime,'Content-Length':String(asset.size)},body:createReadStream(asset.file,{flags:constants.O_RDONLY|constants.O_NOFOLLOW}),duplex:'half'},'youtube');if(typeof result.id!=='string'||!/^[A-Za-z0-9_-]{6,64}$/.test(result.id))throw error('YouTube did not return a verifiable video ID. Check the channel before attempting another upload.');
          draft.status='uploaded';draft.result={provider:'youtube',videoId:result.id,url:'https://www.youtube.com/watch?v='+encodeURIComponent(result.id),requestedVisibility:draft.metadata.visibility,returnedVisibility:result.status?.privacyStatus||null};
        }else{
          checkTikTok(draft.metadata,caps,draft.duration);const chunks=tiktokChunks(asset.size),m=draft.metadata,data=await jsonRequest('https://open.tiktokapis.com/v2/post/publish/video/init/',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify({post_info:{title:m.title,privacy_level:m.visibility,disable_comment:!m.allowComment,disable_duet:!m.allowDuet,disable_stitch:!m.allowStitch,brand_organic_toggle:m.brandOrganic,brand_content_toggle:m.brandContent},source_info:{source:'FILE_UPLOAD',video_size:asset.size,chunk_size:chunks.chunkSize,total_chunk_count:chunks.totalChunks}})});
          if(data.error?.code!=='ok'||typeof data.data?.publish_id!=='string'||typeof data.data?.upload_url!=='string')throw error('TikTok did not initialize a valid upload. Check creator limits and permissions.');draft.result={provider:'tiktok',publishId:text(data.data.publish_id,200),requestedVisibility:m.visibility};store.putRecord('social_draft',draft.id,draft);tokenStore.set('upload:'+draft.id,{provider:'tiktok',url:data.data.upload_url});
          for(const [index,range] of chunks.ranges.entries()){assertAccountCurrent(account);const transferred=await request(data.data.upload_url,{method:'PUT',headers:{'Content-Type':asset.mime,'Content-Length':String(range.end-range.start+1),'Content-Range':`bytes ${range.start}-${range.end}/${asset.size}`},body:createReadStream(asset.file,{start:range.start,end:range.end,flags:constants.O_RDONLY|constants.O_NOFOLLOW}),duplex:'half'},'tiktok');if(transferred.status!==(index===chunks.ranges.length-1?201:206))throw error('TikTok did not acknowledge the expected upload chunk. Check the existing attempt before retrying.');}draft.status='processing';
        }
        tokenStore.delete('upload:'+draft.id);store.putRecord('social_draft',draft.id,draft);return publicDraft(draft);
      }catch(failure){draft.status='needs-attention';draft.error=failure.safe?failure.message:'Publishing stopped. Check the provider account before trying another upload.';store.putRecord('social_draft',draft.id,draft);throw error(draft.error);}
    },
    async poll(draftId){const draft=draftDocument(draftId);if(draft.provider!=='tiktok'||!draft.result?.publishId)throw error('This draft has no TikTok publishing attempt to check.');const account=accountDocument(draft.accountId),token=await accessToken(account),data=await jsonRequest('https://open.tiktokapis.com/v2/post/publish/status/fetch/',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({publish_id:draft.result.publishId})});if(data.error?.code!=='ok'||!['PROCESSING_UPLOAD','PROCESSING_DOWNLOAD','SEND_TO_USER_INBOX','PUBLISH_COMPLETE','FAILED'].includes(data.data?.status))throw error('TikTok publishing status is unavailable.');draft.result={...draft.result,providerStatus:data.data.status,publicPostIds:(data.data.publicaly_available_post_id||[]).map(id=>String(id)).filter(id=>/^\d{1,30}$/.test(id))};draft.status=data.data.status==='PUBLISH_COMPLETE'?'published':data.data.status==='FAILED'?'failed':'processing';store.putRecord('social_draft',draft.id,draft);return publicDraft(draft);}
  };
  // Never replay an upload after a process restart: its remote outcome may be
  // ambiguous. Confirmation records are inert and also expire after 60 seconds.
  for(const draft of store.listRecords('social_draft'))if(draft.status==='publishing')store.putRecord('social_draft',draft.id,{...draft,status:'needs-attention',error:'Publishing was interrupted. Check the provider account before creating another attempt.'});
  return api;
}
