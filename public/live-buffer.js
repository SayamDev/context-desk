// Live buffer: records a live platform link on this computer, keeps the last
// five minutes and cuts "clip back" MP4s on demand. Mounted in Source & live controls.
const time=value=>{const s=Math.max(0,Math.floor(Number(value)||0));return `${Math.floor(s/3600)?Math.floor(s/3600)+':':''}${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
const node=(tag,text,className)=>{const value=document.createElement(tag);if(text!==undefined)value.textContent=text;if(className)value.className=className;return value;};
const statusText={connecting:'Connecting to the stream…',live:'Recording the last 5 minutes',ended:'Stream ended',failed:'Could not record',stopped:'Stopped'};

export function createLiveBuffer({getUrl=()=>'',onMessage=()=>{}}={}){
  let panel,status,clock,fill,stop,clipButtons=[],mark,marks,list,session=null,timer=null,busy=false;
  async function call(url,body){
    const response=await fetch(url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'Live clipping request failed.');return data;
  }
  function report(text){if(status)status.textContent=text;try{onMessage(text)}catch{/* Messages are optional. */}}
  const active=()=>session&&(session.status==='connecting'||session.status==='live');
  function render(){
    if(!panel)return;const s=session;panel.dataset.status=s?.status||'idle';
    clock.textContent=time(s?.now);fill.style.width=`${s?Math.min(100,s.buffered/s.bufferLimit*100):0}%`;
    status.textContent=s?(s.error||`${statusText[s.status]||s.status}${s.status==='live'?` · ${time(s.buffered)} buffered`:''}`):'Paste a live link above, then start.';
    for(const button of [...clipButtons,mark])button.disabled=!s?.buffered;stop.hidden=!active();
    marks.textContent=s?.markers.length?`Marked at ${s.markers.slice(-5).map(m=>time(m.t)).join(', ')}`:'';
    list.replaceChildren(...[...(s?.clips||[])].reverse().map(c=>{
      const row=node('li',undefined,`live-buffer-clip is-${c.status}`),label=node('span',`${time(c.start)} → ${time(c.end)} · ${Math.round(c.seconds)}s`);
      let state;if(c.download){state=node('a','Download clip');state.href=c.download;state.download='';}else state=node('span',c.status==='failed'?`Failed · ${c.error}`:'Cutting…');
      row.append(label,state);return row;
    }));
  }
  function schedule(){clearTimeout(timer);timer=null;if(session&&(active()||session.clips.some(c=>c.status==='rendering')))timer=setTimeout(()=>void refresh(),1000);}
  async function refresh(){if(!session)return;try{session=await call(`/api/live-buffer/${session.id}`)}catch(error){report(error.message);session={...session,status:'stopped'}}render();schedule();}
  async function run(task){if(busy)return;busy=true;try{session=await task();render();schedule()}catch(error){report(error.message)}finally{busy=false}}
  const clip=seconds=>session?.buffered&&run(()=>call(`/api/live-buffer/${session.id}/clip`,{seconds}));
  function mount(){
    if(panel?.isConnected)return true;const setup=document.getElementById('sourceSetup');if(!setup)return false;
    panel=node('details',undefined,'live-buffer speech-details');panel.id='liveBufferControls';panel.open=true;panel.append(node('summary','Clip a live stream as it airs'));
    const intro=node('p','Paste a live YouTube, Twitch or Kick link above. Context Desk records it on this computer, keeps only the last 5 minutes, and cuts the last 15, 30 or 60 seconds the moment something happens. Keys 1, 2, 3 while recording.','depth-help');
    const start=node('button','Start live buffer');start.type='button';
    start.onclick=()=>{const url=String(getUrl()||'').trim();if(!url){report('Paste the live stream link first.');return}run(()=>call('/api/live-buffer',{url}))};
    const head=node('div',undefined,'live-buffer-head');clock=node('strong','00:00','live-buffer-clock');status=node('span','','live-buffer-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    stop=node('button','Stop');stop.type='button';stop.hidden=true;stop.onclick=()=>session&&run(()=>call(`/api/live-buffer/${session.id}/stop`,{}));
    head.append(node('span','● LIVE','live-buffer-badge'),clock,status,stop);
    const bar=node('div',undefined,'live-buffer-bar');fill=node('span');bar.append(fill);
    const actions=node('div',undefined,'live-buffer-actions');actions.append(node('span','Clip back','live-buffer-label'));
    clipButtons=[15,30,60].map((seconds,index)=>{const b=node('button',`${seconds}s`);b.type='button';b.disabled=true;b.append(node('kbd',String(index+1)));if(index===1)b.className='primary';b.onclick=()=>clip(seconds);return b;});
    mark=node('button','Mark');mark.type='button';mark.disabled=true;mark.onclick=()=>session&&run(()=>call(`/api/live-buffer/${session.id}/mark`,{}));
    actions.append(...clipButtons,mark);
    marks=node('p','','live-buffer-marks');list=node('ol',undefined,'live-buffer-clips');
    const note=node('p','Clips are cut without re-encoding, so they can start up to 2 seconds early. Times count from when you started recording. Use streams you have permission to clip.','depth-help');
    panel.append(intro,start,head,bar,actions,marks,list,note);
    const content=setup.querySelector('.source-setup-content')||setup;content.prepend(panel);render();return true;
  }
  document.addEventListener('keydown',event=>{
    if(session?.status!=='live'||event.metaKey||event.ctrlKey||event.altKey||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName)||event.target?.isContentEditable)return;
    const seconds={1:15,2:30,3:60}[event.key];if(seconds){event.preventDefault();clip(seconds)}
  });
  return {sync(){mount()}};
}
