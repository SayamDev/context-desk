// Live bar: while a live tab is connected, a bar at the bottom of every page says whether clipping
// is running, for how long and what it has found, with one button to start or stop it. Clipping
// keeps going in the background (clock.js), so the editor can work elsewhere. The bar also opens the
// live monitor (live-monitor.js) and announces each new clip as it is found.
const clockText=s=>{const t=Math.max(0,Math.floor(s)),h=Math.floor(t/3600),m=String(Math.floor(t/60)%60).padStart(2,'0'),x=String(t%60).padStart(2,'0');return h?`${h}:${m}:${x}`:`${m}:${x}`};

export function mountLiveBar({getState,start,reconnect,stop,open,every,monitor,onClip,focusSource}){
  const bar=document.createElement('div');bar.className='live-bar';bar.hidden=true;bar.setAttribute('role','region');bar.setAttribute('aria-label','Live clipping');
  bar.innerHTML=`<span class="live-bar-dot" aria-hidden="true"></span><div class="live-bar-text"><strong id="liveBarTitle"></strong><span id="liveBarDetail" class="cd-tc"></span></div>
    <button type="button" class="cd-btn cd-btn-sm cd-btn-ghost" id="liveBarMonitor" aria-pressed="false">Watch</button><button type="button" class="cd-btn cd-btn-sm cd-btn-ghost" id="liveBarSound" hidden>Mute</button><button type="button" class="cd-btn cd-btn-sm cd-btn-ghost" id="liveBarOpen">Clips</button><button type="button" class="cd-btn cd-btn-sm cd-btn-ghost" id="liveBarHelp" aria-haspopup="dialog" aria-controls="livePlayerHelp" aria-expanded="false">Find source player</button><button type="button" class="cd-btn cd-btn-sm" id="liveBarToggle"></button>`;
  const help=document.createElement('section');
  help.id='livePlayerHelp';
  help.className='live-player-help';
  help.setAttribute('popover','auto');
  help.setAttribute('role','dialog');
  help.setAttribute('aria-labelledby','livePlayerHelpTitle');
  help.innerHTML=`<h2 id="livePlayerHelpTitle">Use the original player</h2><p>In Chrome, look above the page for <strong>View tab</strong> or <strong>Switch to shared tab</strong>. You can also look for the sharing icon on the source tab. If you shared a separate window, use your browser’s Window menu to bring it forward. Use Skip or Play there while clipping continues.</p><button type="button" class="cd-btn cd-btn-secondary" popovertarget="livePlayerHelp" popovertargetaction="hide">Got it</button>`;
  document.body.append(bar,help);
  const $=id=>bar.querySelector('#'+id);let shown='',seen=null;
  function render(){
    const s=getState(),visible=s.connected||s.reconnect;bar.hidden=!visible;document.body.classList.toggle('has-live-bar',visible);
    $('liveBarHelp').hidden=!s.connected;
    $('liveBarHelp').textContent=s.sourcePlayer?'Switch to player':'Find shared tab';
    if(!s.connected){if(help.matches(':popover-open'))help.hidePopover();if(monitor?.isOpen())monitor.close();if(!visible){seen=null;return}}
    bar.dataset.state=s.scanning?'on':s.framing?'framing':'off';
    $('liveBarTitle').textContent=!s.connected?'Live tab disconnected':s.scanning?'Live clipping':s.framing?'Check the framing, then start':'Live tab connected · not clipping';
    $('liveBarDetail').textContent=`${s.reconnect?'Share the same tab to continue · ':''}${clockText(s.elapsed)} · ${s.windows} ${s.windows===1?'window':'windows'} · ${s.clips} ${s.clips===1?'clip':'clips'}`;
    // A clip found since the last tick is announced once; clips already there when the bar connected are not.
    if(seen===null||!s.scanning&&s.clips<seen)seen=s.clips;else if(s.clips>seen){seen=s.clips;if(s.latest)onClip?.(s.latest)}
    monitor?.update({title:$('liveBarTitle').textContent,detail:s.latest?.hook?`${$('liveBarDetail').textContent} · Latest: ${s.latest.hook}`:$('liveBarDetail').textContent,scanning:s.scanning});
    const watching=Boolean(monitor?.isOpen());$('liveBarMonitor').hidden=!s.connected||!monitor?.supported();$('liveBarMonitor').textContent=watching?'Close monitor':'Watch';$('liveBarMonitor').setAttribute('aria-pressed',String(watching));
    $('liveBarSound').hidden=!watching;$('liveBarSound').textContent=monitor?.soundOn()?'Mute':'Turn sound on';
    const label=s.reconnect?'Reconnect live tab':s.scanning?'Pause clipping':'Resume clipping';$('liveBarToggle').disabled=s.connecting;if(shown!==label){shown=label;$('liveBarToggle').textContent=label;$('liveBarToggle').className='cd-btn cd-btn-sm '+(s.scanning?'cd-btn-secondary live-bar-stop':'cd-btn-primary')}
  }
  $('liveBarHelp').onclick=()=>{
    if(help.matches(':popover-open')){help.hidePopover();return}
    if(!focusSource?.())help.showPopover();
  };
  help.addEventListener('toggle',event=>$('liveBarHelp').setAttribute('aria-expanded',String(event.newState==='open')));
  $('liveBarToggle').onclick=()=>{const s=getState();if(s.reconnect)reconnect();else if(s.scanning)stop();else start();render()};
  $('liveBarMonitor').onclick=async()=>{monitor.isOpen()?monitor.close():await monitor.open();render()};
  $('liveBarSound').onclick=()=>{monitor.setSound(!monitor.soundOn());render()};
  $('liveBarOpen').onclick=open;
  every(1000,render);
  return {render};
}
