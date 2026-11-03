// Live monitor: a small always-on-top window showing exactly what live clipping records (the framed
// picture and the tab's sound), so the editor can watch the stream while working elsewhere. Chrome's
// Document Picture-in-Picture gives it a status line and buttons; other browsers get the plain
// video Picture-in-Picture. Sound starts off; the stream's own tab is muted while it is shared.
const css=`*{box-sizing:border-box}html,body{margin:0;height:100%;background:#0b0b0d;color:#f3f1ec;font:500 13px/1.3 Manrope,system-ui,sans-serif}
body{display:grid;grid-template-rows:1fr auto}video{width:100%;height:100%;min-height:0;object-fit:contain;background:#000;display:block}
.bar{display:flex;align-items:center;gap:8px;padding:8px 10px;border-top:1px solid #2a2a30}.dot{width:9px;height:9px;border-radius:50%;background:#7c7a84;flex:none}
.on .dot{background:#ff5a1f;box-shadow:0 0 0 3px rgba(255,90,31,.25)}.text{display:grid;min-width:0;flex:1}.text strong{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.text span{color:#a6a4ad;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}button{font:700 12px/1 Manrope,system-ui,sans-serif;border-radius:999px;padding:7px 11px;border:1px solid #3a3a42;background:#18181c;color:#f3f1ec;cursor:pointer}
button:hover{border-color:#f3f1ec}button:focus-visible{outline:2px solid #3bf2c9;outline-offset:2px}button[aria-pressed=true]{background:#3bf2c9;border-color:#3bf2c9;color:#0b0b0d}.stop{border-color:#ff5a1f}`;

export function createLiveMonitor({getStreams,stop,onChange=()=>{}}){
  let win=null,video=null,owned=[],muted=true,fallback=null;
  const supported=()=>Boolean(window.documentPictureInPicture)||Boolean(document.pictureInPictureEnabled);
  function streamFor(){
    const {video:source,audio}=getStreams();if(!source)return null;
    owned=[source,...audio.map(t=>t.clone())];return new MediaStream(owned);
  }
  function release(){owned.forEach(t=>t.stop());owned=[];win=null;video=null;fallback=null;onChange()}
  let opening=null;
  // One window at a time: a second request would replace the first, so callers share a pending open.
  function open(){if(win||fallback){win?.focus?.();return Promise.resolve(true)}opening??=openWindow().finally(()=>{opening=null});return opening}
  async function openWindow(){
    const stream=streamFor();if(!stream)return false;
    try{
      if(window.documentPictureInPicture){
        win=await documentPictureInPicture.requestWindow({width:420,height:290});
        win.document.title='Live monitor · Context Desk';
        const style=win.document.createElement('style');style.textContent=css;win.document.head.append(style);
        win.document.body.innerHTML=`<video autoplay playsinline></video><div class="bar"><span class="dot" aria-hidden="true"></span><div class="text"><strong id="t">Live monitor</strong><span id="d" class="tc"></span></div><button type="button" id="s" aria-pressed="${!muted}">${muted?'Sound off':'Sound on'}</button><button type="button" id="x" class="stop">Stop</button></div>`;
        video=win.document.querySelector('video');
        win.document.getElementById('s').onclick=()=>setSound(muted);
        win.document.getElementById('x').onclick=()=>stop();
        const own=win;own.addEventListener('pagehide',()=>{if(win===own)release()},{once:true});
      }else{
        // Plain Picture-in-Picture: the video floats; sound is switched from the live bar.
        video=fallback=document.createElement('video');video.playsInline=true;video.autoplay=true;
        video.addEventListener('leavepictureinpicture',()=>{video.srcObject=null;release()},{once:true});
      }
      video.muted=muted;video.srcObject=stream;await video.play().catch(()=>{});
      if(fallback)await video.requestPictureInPicture();
      onChange();return true;
    }catch{owned.forEach(t=>t.stop());owned=[];win=null;video=null;fallback=null;return false}
  }
  // After the framing changes, show the newly framed picture.
  function refresh(){if(!video)return;const old=owned,stream=streamFor();if(!stream){owned=old;return}video.srcObject=stream;old.forEach(t=>t.stop());void video.play().catch(()=>{})}
  function close(){if(win){win.close();return}if(fallback&&document.pictureInPictureElement===fallback)void document.exitPictureInPicture()}
  function setSound(on){muted=!on;if(video)video.muted=muted;const b=win?.document.getElementById('s');if(b){b.textContent=on?'Sound on':'Sound off';b.setAttribute('aria-pressed',String(on))}onChange()}
  // Called every second by the live bar with the same state it shows.
  function update({title,detail,scanning}){if(!win)return;win.document.body.classList.toggle('on',Boolean(scanning));win.document.getElementById('t').textContent=title;win.document.getElementById('d').textContent=detail}
  return {open,close,refresh,update,setSound,supported,isOpen:()=>Boolean(win||fallback),soundOn:()=>!muted};
}
