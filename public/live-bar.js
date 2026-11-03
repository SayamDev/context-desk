// Live bar: while a live tab is connected, a bar at the bottom of every page says whether clipping
// is running, for how long and what it has found, with one button to start or stop it. Clipping
// keeps going in the background (clock.js), so the editor can work elsewhere.
const clockText=s=>{const t=Math.max(0,Math.floor(s)),h=Math.floor(t/3600),m=String(Math.floor(t/60)%60).padStart(2,'0'),x=String(t%60).padStart(2,'0');return h?`${h}:${m}:${x}`:`${m}:${x}`};

export function mountLiveBar({getState,start,stop,open,every}){
  const bar=document.createElement('div');bar.className='live-bar';bar.hidden=true;bar.setAttribute('role','region');bar.setAttribute('aria-label','Live clipping');
  bar.innerHTML=`<span class="live-bar-dot" aria-hidden="true"></span><div class="live-bar-text"><strong id="liveBarTitle"></strong><span id="liveBarDetail" class="cd-tc"></span></div>
    <button type="button" class="cd-btn cd-btn-sm cd-btn-ghost" id="liveBarOpen">Clips</button><button type="button" class="cd-btn cd-btn-sm" id="liveBarToggle"></button>`;
  document.body.append(bar);
  const $=id=>bar.querySelector('#'+id);let shown='';
  function render(){
    const s=getState();bar.hidden=!s.connected;document.body.classList.toggle('has-live-bar',s.connected);if(!s.connected)return;
    bar.dataset.state=s.scanning?'on':s.framing?'framing':'off';
    $('liveBarTitle').textContent=s.scanning?'Live clipping':s.framing?'Check the framing, then start':'Live tab connected · not clipping';
    $('liveBarDetail').textContent=`${clockText(s.elapsed)} · ${s.windows} ${s.windows===1?'window':'windows'} · ${s.clips} ${s.clips===1?'clip':'clips'}`;
    const label=s.scanning?'Stop live clipping':'Start live clipping';if(shown!==label){shown=label;$('liveBarToggle').textContent=label;$('liveBarToggle').className='cd-btn cd-btn-sm '+(s.scanning?'cd-btn-secondary live-bar-stop':'cd-btn-primary')}
  }
  $('liveBarToggle').onclick=()=>{getState().scanning?stop():start();render()};
  $('liveBarOpen').onclick=open;
  every(1000,render);
  return {render};
}
