// Live buffer: records a live platform link on this computer, keeps the last
// five minutes and cuts "clip back" MP4s on demand. Mounted in Source & live controls.
import {el,kbd,badge,formatTime as time} from './ds.js';
const statusText={connecting:'Connecting to the stream…',live:'Recording the last 5 minutes',ended:'Stream ended',failed:'Could not record',stopped:'Stopped'};
const signalWhy={audio:'Sudden rise in loudness.',laugh:'Laughter heard in the stream audio.',chat:'Chat suddenly got much busier.',chatlaugh:'Lots of viewers laughing in chat.'};
const clipState={rendering:['cue','Cutting',true],ready:['volt','Ready'],failed:['danger','Failed']};

export function createLiveBuffer({getUrl=()=>'',onMessage=()=>{}}={}){
  let panel,status,clock,live,track,span,stop,alert,alertText,signals,clipButtons=[],mark,marks,list,count,session=null,timer=null,busy=false;
  async function call(url,body){
    const response=await fetch(url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'Live clipping request failed.');return data;
  }
  function report(text){if(status)status.textContent=text;try{onMessage(text)}catch{/* Messages are optional. */}}
  const active=()=>session&&(session.status==='connecting'||session.status==='live');
  // Positions a stream time inside the visible buffer window [now - limit, now].
  const place=(t,s)=>Math.max(0,Math.min(100,(t-(s.now-s.bufferLimit))/s.bufferLimit*100));
  function renderTrack(s){
    track.querySelectorAll('.lb-mark,.lb-clip').forEach(n=>n.remove());
    if(!s){span.style.left='100%';span.style.width='0';return}
    span.style.left=`${place(s.now-s.buffered,s)}%`;span.style.width=`${Math.min(100,s.buffered/s.bufferLimit*100)}%`;
    for(const c of s.clips){if(c.end<s.now-s.bufferLimit)continue;const node=el('span',`lb-clip is-${c.status}`),from=place(c.start,s);node.style.left=`${from}%`;node.style.width=`${place(c.end,s)-from}%`;node.title=`Clip ${time(c.start)} → ${time(c.end)}`;track.append(node)}
    for(const m of s.markers){if(m.t<s.now-s.bufferLimit)continue;const node=el('span',`lb-mark is-${m.kind||'manual'}`);node.style.left=`${place(m.t,s)}%`;node.append(el('em',undefined,m.label||'Marked'));node.title=`${m.label||'Marked'} at ${time(m.t)}`;track.append(node)}
  }
  function clipRow(c){
    const row=el('li',`cd-lclip is-${c.status}`),thumb=el('div','cd-lclip-thumb'),body=el('div','cd-lclip-body'),meta=el('div','cd-row'),[tone,text,dot]=clipState[c.status]||['neutral',c.status];
    thumb.append(el('span','cd-dur',time(c.seconds)));meta.append(badge(tone,text,dot),el('span','cd-tc lb-muted',`${time(c.start)} → ${time(c.end)}`));
    body.append(meta,el('p','cd-lclip-title',`Last ${Math.round(c.seconds)} seconds`));
    if(c.download){const a=el('a','cd-btn cd-btn-sm cd-btn-primary','Download clip');a.href=c.download;a.download='';body.append(a)}
    else if(c.status==='failed')body.append(el('p','lb-error',c.error));
    else{const bar=el('div','cd-bar');bar.append(el('span'));body.append(bar)}
    row.append(thumb,body);return row;
  }
  function render(){
    if(!panel)return;const s=session;panel.dataset.status=s?.status||'idle';
    clock.textContent=time(s?.now);live.hidden=!s;
    status.textContent=s?(s.error||`${statusText[s.status]||s.status}${s.status==='live'?` · ${time(s.buffered)} buffered`:''}`):'Paste a live link in the field above, then start.';
    for(const button of [...clipButtons,mark])button.disabled=!s?.buffered;stop.hidden=!active();
    const own=s?.markers.filter(m=>m.kind==='manual')||[];marks.textContent=own.length?`Marked at ${own.slice(-5).map(m=>time(m.t)).join(', ')}`:'';
    const peak=s?.status==='live'&&s.markers.filter(m=>m.kind!=='manual').at(-1);alert.hidden=!(peak&&s.now-peak.t<=20);if(!alert.hidden)alertText.replaceChildren(el('strong',undefined,`${peak.label} at ${time(peak.t)}`),document.createTextNode(signalWhy[peak.kind]||'Worth a look.'));
    signals.textContent=s?`${s.signals?.chat?.state==='connected'?`Chat ${s.signals.chat.perMinute}/min`:(s.signals?.chat?.label||'Chat off')} · ${s.signals?.laughter==='on'?'Laughter detection on':'Laughter detection not installed (npm run setup:laughter)'}`:'';
    renderTrack(s);count.textContent=`Instant clips · ${s?.clips.length||0}`;
    list.replaceChildren(...[...(s?.clips||[])].reverse().map(clipRow));
    if(!s?.clips.length)list.append(el('li','lb-empty','Press 1, 2 or 3 while recording. Clips land here in about a second.'));
  }
  function schedule(){clearTimeout(timer);timer=null;if(session&&(active()||session.clips.some(c=>c.status==='rendering')))timer=setTimeout(()=>void refresh(),1000);}
  async function refresh(){if(!session)return;try{session=await call(`/api/live-buffer/${session.id}`)}catch(error){report(error.message);session={...session,status:'stopped'}}render();schedule();}
  async function run(task){if(busy)return;busy=true;try{session=await task();render();schedule()}catch(error){report(error.message)}finally{busy=false}}
  const clip=seconds=>session?.buffered&&run(()=>call(`/api/live-buffer/${session.id}/clip`,{seconds}));
  function mount(){
    if(panel?.isConnected)return true;const setup=document.getElementById('sourceSetup');if(!setup)return false;
    panel=el('details','live-buffer speech-details');panel.id='liveBufferControls';panel.open=true;panel.append(el('summary',undefined,'Clip a live stream as it airs'));
    const intro=el('p','depth-help','Paste a live YouTube, Twitch or Kick link in the field above. Context Desk records it on this computer, keeps only the last 5 minutes, and cuts the last 15, 30 or 60 seconds the moment something happens.');
    const start=el('button','cd-btn cd-btn-secondary','Start live buffer');start.type='button';
    start.onclick=()=>{const url=String(getUrl()||'').trim();if(!url){report('Paste the live stream link first.');return}run(()=>call('/api/live-buffer',{url}))};
    const desk=el('div','lb-desk'),main=el('section','cd-live'),head=el('div','cd-live-head'),left=el('div','cd-row');
    live=badge('signal','Live',true);clock=el('span','cd-tc cd-live-now','00:00');status=el('span','lb-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    stop=el('button','cd-btn cd-btn-sm cd-btn-ghost','Stop');stop.type='button';stop.hidden=true;stop.onclick=()=>session&&run(()=>call(`/api/live-buffer/${session.id}/stop`,{}));
    left.append(live,clock,status);head.append(left,el('span','cd-label','Buffer 05:00'),stop);
    track=el('div','cd-live-track');track.setAttribute('aria-hidden','true');span=el('span','lb-span');track.append(span,el('span','cd-live-edge'));
    const actions=el('div','cd-live-actions');actions.append(el('span','cd-label','Clip back'));
    clipButtons=[15,30,60].map((seconds,index)=>{const b=el('button',`cd-btn cd-btn-sm ${index===1?'cd-btn-primary':'cd-btn-secondary'}`,`${seconds}s`);b.type='button';b.disabled=true;b.append(kbd(String(index+1)));b.onclick=()=>clip(seconds);return b;});
    mark=el('button','cd-btn cd-btn-sm cd-btn-secondary','Mark');mark.type='button';mark.disabled=true;mark.onclick=()=>session&&run(()=>call(`/api/live-buffer/${session.id}/mark`,{}));
    actions.append(...clipButtons,el('span','lb-grow'),mark);marks=el('p','lb-marks');signals=el('p','lb-signals');main.append(head,track,actions,marks,signals);
    alert=el('div','lb-alert');alert.setAttribute('role','status');alert.hidden=true;alertText=el('p');const take=el('button','cd-btn cd-btn-sm','Clip 30s');take.type='button';take.append(kbd('2'));take.onclick=()=>clip(30);alert.append(alertText,take);
    const queue=el('aside','lb-queue');count=el('span','cd-label','Instant clips · 0');list=el('ol','lb-list');queue.append(alert,count,list);
    desk.append(main,queue);
    const note=el('p','depth-help','Clips are cut without re-encoding, so they can start up to 2 seconds early. Times count from when you started recording. Use streams you have permission to clip.');
    panel.append(intro,start,desk,note);
    const form=document.getElementById('linkForm');if(form?.parentElement)form.after(panel);else (setup.querySelector('.source-setup-content')||setup).prepend(panel);
    render();return true;
  }
  document.addEventListener('keydown',event=>{
    if(session?.status!=='live'||event.metaKey||event.ctrlKey||event.altKey||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName)||event.target?.isContentEditable)return;
    const seconds={1:15,2:30,3:60}[event.key];if(seconds){event.preventDefault();clip(seconds)}
  });
  return {sync(){mount()},start(){mount();panel?.querySelector(':scope>button')?.click();panel?.scrollIntoView({block:'center'})},clip,recording:()=>session?.status==='live'};
}
