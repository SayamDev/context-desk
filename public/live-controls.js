const activeStates=new Set(['starting','waiting','recording','stopping']);
const time=value=>{const seconds=Math.max(0,Math.floor(Number(value)||0));return `${Math.floor(seconds/3600)?Math.floor(seconds/3600)+':':''}${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};
const node=(tag,text,className)=>{const value=document.createElement(tag);if(text!==undefined)value.textContent=text;if(className)value.className=className;return value;};
function cleanSession(value){
  if(!value||typeof value.id!=='string'||!value.id||value.id.length>160||typeof value.projectId!=='string'||!value.projectId||value.projectId.length>160)throw Error('The local receiver returned an invalid session.');
  return {id:value.id,projectId:value.projectId,title:String(value.title||'Local encoder recording').slice(0,160),status:String(value.status||'unknown').slice(0,40),phase:String(value.phase||'').slice(0,240),error:String(value.error||'').slice(0,300),windowCount:Math.max(0,Number(value.windowCount)||0),elapsedSeconds:Math.max(0,Number(value.elapsedSeconds)||0),maxSeconds:Math.max(0,Number(value.maxSeconds)||3600),createdAt:Number(value.createdAt)||0,connectionAvailable:value.connectionAvailable===true};
}
function cleanConnection(value){
  if(!value||typeof value.serverUrl!=='string'||typeof value.streamKey!=='string'||!/^[a-f0-9]{48}$/.test(value.streamKey))return null;
  try{const url=new URL(value.serverUrl);if(url.protocol!=='rtmp:'||url.hostname!=='127.0.0.1'||!/^\d+$/.test(url.port)||url.pathname!=='/live'||url.username||url.password||url.search||url.hash)return null;return {serverUrl:url.href,streamKey:value.streamKey};}catch{return null;}
}

// The server creates a separate project for POST /api/live. Credentials are
// retained only in this closure/visible fields, never in project state or logs.
export function createLiveControls({requestJson,getProject=()=>null,onChanged=()=>{},onMessage=()=>{},onJobs=()=>{},onReview=()=>{}}={}){
  if(typeof requestJson!=='function')throw Error('Local encoder controls require the project request helper.');
  let panel,status,list,title,start,analyze,budget,duration,connectionBox,connectionHeading,server,key,reveal,ownerNote,timer=null,loading=null,disposed=false,busy=false,credentials=null,sessions=[],revision=0,lastRequestAt=0;
  const rows=new Map();
  function report(message){if(status)status.textContent=message;try{onMessage(message);}catch{/* Notification failure must not affect a running receiver. */}}
  function safeError(error){let message=String(error?.message||'The local receiver request could not finish.');for(const value of credentials?[credentials.serverUrl,credentials.streamKey]:[])message=message.split(value).join('[local connection]');return message.slice(0,300);}
  function visible(){return Boolean(panel?.isConnected&&document.visibilityState!=='hidden'&&panel.getClientRects().length);}
  function pollingNeeded(){return !disposed&&(sessions.some(session=>activeStates.has(session.status))||visible()&&panel.open);}
  function schedule(){clearTimeout(timer);timer=null;if(pollingNeeded())timer=setTimeout(()=>void refresh(),sessions.some(session=>activeStates.has(session.status))?visible()?1800:5000:6000);}
  function forgetConnection(){credentials=null;if(server)server.value='';if(key){key.value='';key.type='password';}if(reveal){reveal.textContent='Show key';reveal.setAttribute('aria-pressed','false');}if(connectionBox)connectionBox.hidden=true;}
  function showConnection(session,connection){
    const cleaned=cleanConnection(connection);if(!cleaned){forgetConnection();return false;}credentials={...cleaned,sessionId:session.id};connectionHeading.textContent=`Encoder setup · ${session.title}`;server.value=cleaned.serverUrl;key.value=cleaned.streamKey;key.type='password';reveal.textContent='Show key';reveal.setAttribute('aria-pressed','false');connectionBox.hidden=false;return true;
  }
  async function copy(which){
    if(!credentials)return;try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(credentials[which]);report(which==='streamKey'?'Local stream key copied. Paste it into OBS on this computer.':'Local server address copied. Paste it into OBS on this computer.');}catch{report('Automatic copy is unavailable. Select the read-only field and copy it manually.');}
  }
  function mount(){
    if(panel?.isConnected)return true;const setup=document.getElementById('sourceSetup');if(!setup)return false;
    panel=node('details',undefined,'live-ingest-controls speech-details');panel.id='localEncoderControls';const summary=node('summary','Advanced · OBS / local encoder');panel.append(summary);
    const intro=node('p','Record video and audio from OBS or another encoder on this computer. Browser tab capture remains the default for platform links. Starting this receiver creates a separate saved live project.');
    const form=node('div',undefined,'speech-settings'),label=node('label','Session title');title=node('input');title.id='localEncoderTitle';title.type='text';title.maxLength=160;title.value='Local encoder recording';label.htmlFor=title.id;label.append(title);form.append(label);const durationLabel=node('label','Recording limit');duration=node('select');duration.id='localEncoderDuration';for(const [value,text]of [[3600,'1 hour'],[10800,'3 hours'],[21600,'6 hours']]){const option=node('option',text);option.value=String(value);duration.append(option)}duration.value='3600';durationLabel.append(duration);form.append(durationLabel,node('p','Saved windows arrive about every 24 seconds; the final window may be shorter. Long recordings need free disk space.'));
    const analyzeLabel=node('label');analyze=node('input');analyze.type='checkbox';analyze.id='localEncoderAnalyze';analyzeLabel.htmlFor=analyze.id;analyzeLabel.append(analyze,document.createTextNode(' Find live moments with Meta'));const budgetLabel=node('label','Analysis window limit');budget=node('input');budget.id='localEncoderBudget';budget.type='number';budget.min='1';budget.max='25';budget.step='1';budget.value='10';budget.disabled=true;budgetLabel.htmlFor=budget.id;budgetLabel.append(budget);analyze.onchange=()=>{budget.disabled=!analyze.checked||busy;};form.append(analyzeLabel,budgetLabel,node('p','Optional. Finalized audio and sampled frames are sent to Meta only when selected, using the current speech language, output language and story settings. The limit applies to analyzed windows; saved raw video remains available without analysis.'));
    start=node('button','Start local receiver');start.type='button';start.id='startLocalEncoder';form.append(start);ownerNote=node('p');ownerNote.className='depth-help';form.append(ownerNote);
    connectionBox=node('section',undefined,'source-setup-content');connectionBox.hidden=true;connectionBox.setAttribute('aria-label','Local encoder connection');connectionHeading=node('h3','Encoder setup');connectionBox.append(connectionHeading);
    const instructions=node('ol');for(const text of ['In OBS, choose a Custom streaming service. Paste the Server address and Stream Key below.','Send H.264 video and AAC audio from this computer, then start streaming in OBS. This records locally; it does not publish to a platform.','Check the first saved window for picture and audio. Stop the receiver when finished. After a restart, resume explicitly and reconnect OBS.'])instructions.append(node('li',text));connectionBox.append(instructions);
    const fields=node('div',undefined,'speech-settings'),serverLabel=node('label','Server · localhost only');server=node('input');server.id='localEncoderServer';server.readOnly=true;server.type='text';server.autocomplete='off';server.spellcheck=false;serverLabel.htmlFor=server.id;serverLabel.append(server);const copyServer=node('button','Copy server');copyServer.type='button';copyServer.onclick=()=>void copy('serverUrl');
    const keyLabel=node('label','Stream key · this session');key=node('input');key.id='localEncoderKey';key.type='password';key.readOnly=true;key.autocomplete='off';key.spellcheck=false;keyLabel.htmlFor=key.id;keyLabel.append(key);const copyKey=node('button','Copy key');copyKey.type='button';copyKey.onclick=()=>void copy('streamKey');reveal=node('button','Show key');reveal.type='button';reveal.setAttribute('aria-pressed','false');reveal.onclick=()=>{const showing=key.type==='password';key.type=showing?'text':'password';reveal.textContent=showing?'Hide key':'Show key';reveal.setAttribute('aria-pressed',String(showing));};fields.append(serverLabel,copyServer,keyLabel,copyKey,reveal);connectionBox.append(fields,node('p','Keep this connection on this computer. Do not forward the port or expose it on your network. The generated key identifies this session; FFmpeg does not provide strong key authentication.'));
    status=node('p','Open this section to load saved local receiver sessions.');status.id='localEncoderStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');list=node('div');list.className='local-encoder-sessions';list.setAttribute('aria-label','Local encoder sessions');
    panel.append(intro,form,connectionBox,status,list);(setup.querySelector('.source-setup-content')||setup).append(panel);
    start.onclick=()=>void mutate(null,'start');panel.addEventListener('toggle',()=>{if(panel.open)void refresh();else{if(key){key.type='password';reveal.textContent='Show key';reveal.setAttribute('aria-pressed','false');}schedule();}});render();return true;
  }
  function makeRow(session){
    const article=node('article',undefined,'job-row'),heading=node('h4'),info=node('p'),phase=node('p'),error=node('p'),actions=node('div',undefined,'job-actions');error.className='job-error';const buttons={};
    for(const [action,label]of [['details','Show setup details'],['stop','Stop and save'],['cancel','Cancel receiver'],['resume','Resume receiver'],['review','Review saved windows']]){const button=node('button',label);button.type='button';button.onclick=()=>{const current=sessions.find(value=>value.id===session.id);if(current)void(action==='review'?review(current):mutate(current,action));};actions.append(button);buttons[action]=button;}
    article.append(heading,info,phase,error,actions);const row={article,heading,info,phase,error,buttons};rows.set(session.id,row);return row;
  }
  function render(){
    if(!panel)return;const project=getProject(),currentId=project?.id,active=sessions.some(session=>activeStates.has(session.status));start.disabled=busy||active;analyze.disabled=busy||active;budget.disabled=busy||active||!analyze.checked;start.textContent=busy?'Updating local receiver…':active?'Local receiver is active':'Start local receiver';ownerNote.textContent=project?`Current project: ${String(project.title||'Untitled project')}. Start creates a separate live project.`:'Start creates a separate live project; your other projects stay saved.';
    if(credentials&&!sessions.some(session=>session.id===credentials.sessionId&&activeStates.has(session.status)))forgetConnection();
    const displayed=[...sessions].sort((a,b)=>Number(activeStates.has(b.status))-Number(activeStates.has(a.status))||Number(b.projectId===currentId)-Number(a.projectId===currentId)||b.createdAt-a.createdAt).slice(0,12),shown=new Set(displayed.map(session=>session.id));
    for(const [id,row]of rows)if(!shown.has(id)){row.article.remove();rows.delete(id);}
    for(const [index,session]of displayed.entries()){
      const row=rows.get(session.id)||makeRow(session),running=activeStates.has(session.status),stopping=session.status==='stopping';row.heading.textContent=session.title+(session.projectId===currentId?' · current project':'');row.info.textContent=`${session.status} · ${session.windowCount} saved ${session.windowCount===1?'window':'windows'} · ${time(session.elapsedSeconds)} captured`;row.phase.textContent=session.phase;row.error.textContent=session.error;row.error.hidden=!session.error;
      for(const button of Object.values(row.buttons))button.disabled=busy||stopping;
      row.buttons.details.hidden=!running||Boolean(credentials?.sessionId===session.id);row.buttons.stop.hidden=!running;row.buttons.cancel.hidden=!running;row.buttons.resume.hidden=running||session.elapsedSeconds>=session.maxSeconds;row.buttons.resume.disabled=busy||active;row.buttons.review.hidden=!session.windowCount;row.buttons.review.disabled=busy;row.buttons.review.textContent=`Review saved windows (${session.windowCount})`;
      if(list.children[index]!==row.article)list.insertBefore(row.article,list.children[index]||null);
    }
  }
  async function changed(payload,session,action){
    try{await onChanged({session,project:payload?.project||null,projectId:session.projectId,action});}catch{report('Receiver updated. Reopen its saved project to refresh the workspace.');}
    try{await onJobs();}catch{/* The receiver remains active if the Jobs panel cannot refresh. */}
  }
  async function mutate(session,action){
    if(busy||disposed)return;busy=true;revision++;render();
    try{
      if(action==='start'&&!title.value.trim())throw Error('Give the new live session a title.');
      const body=action==='start'?{title:title.value.trim(),maxSeconds:Number(duration.value),analyze:analyze.checked}:{action:action==='details'?'resume':action,projectId:session.projectId};
      if(action==='start'&&analyze.checked){const limit=Number(budget.value);if(!Number.isSafeInteger(limit)||limit<1||limit>25)throw Error('Choose an analysis window limit from 1 to 25.');Object.assign(body,{analysisBudget:limit,speechLanguage:document.getElementById('speechLanguage')?.value||'',language:document.getElementById('liveCaptionLanguage')?.value||'Original',storyLens:document.getElementById('storyLens')?.value||'auto'});}
      const payload=await requestJson(action==='start'?'/api/live':'/api/live/'+encodeURIComponent(session.id),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),raw=payload?.session||payload,updated=cleanSession(raw);
      if(disposed)return;revision++;sessions=[updated,...sessions.filter(value=>value.id!==updated.id)];
      if(action==='start'||action==='resume'||action==='details'){const shown=showConnection(updated,raw.connection||payload?.connection);report(shown?'Local receiver ready for an encoder connection. Check a saved window before relying on its picture and audio.':'Receiver updated. Use Show setup details to obtain its session-only connection.');}
      else{if(credentials?.sessionId===updated.id)forgetConnection();report(action==='cancel'?'Receiver cancelled. Finalized windows remain saved.':'Receiver stopped. Finalized windows remain saved.');}
      await changed(payload,updated,action);await refresh({force:true});
    }catch(error){report(safeError(error));}finally{busy=false;render();schedule();}
  }
  async function review(session){
    if(busy)return;busy=true;render();try{await onReview(session.projectId);}catch{report('The saved windows could not open. Reopen their project from Projects.');}finally{busy=false;render();schedule();}
  }
  async function refresh({force=false}={}){
    clearTimeout(timer);timer=null;if(disposed||!mount()||!force&&!pollingNeeded())return;if(loading)return loading;
    const observedRevision=revision;lastRequestAt=Date.now();loading=(async()=>{try{const data=await requestJson('/api/live'),values=Array.isArray(data)?data:data?.sessions;if(!Array.isArray(values))throw Error('The local receiver list could not be read.');if(disposed||observedRevision!==revision)return;sessions=values.map(cleanSession);render();if(!busy)status.textContent=sessions.length?'Finalized windows are saved in their own live projects. Captured windows still need editorial review.':'No local receiver sessions yet. Start one, then connect OBS on this computer.';}catch(error){if(!disposed&&observedRevision===revision)status.textContent='Receiver status could not refresh. Saved windows are retained. '+safeError(error);}finally{loading=null;schedule();}})();return loading;
  }
  const visibilityChanged=()=>{if(document.visibilityState==='hidden'&&key){key.type='password';reveal.textContent='Show key';reveal.setAttribute('aria-pressed','false');}if(pollingNeeded())void refresh();else schedule();};document.addEventListener('visibilitychange',visibilityChanged);
  return {sync(){if(disposed||!mount())return;render();if(!pollingNeeded()){schedule();return;}if(!loading&&Date.now()-lastRequestAt>=1800)void refresh();else if(!timer)schedule();},refresh(){return refresh({force:true});},destroy(){disposed=true;clearTimeout(timer);forgetConnection();document.removeEventListener('visibilitychange',visibilityChanged);panel?.remove();rows.clear();}};
}
