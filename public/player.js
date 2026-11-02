// Media identity is independent of inspector rendering. HTMLMediaElement.src is
// absolute even when the saved project URL is relative.
export function assignMediaSource(video,url,base=globalThis.location?.href){
  const current=video.getAttribute('src');
  if(current&&new URL(current,base).href===new URL(url,base).href)return false;
  video.setAttribute('src',url);return true;
}
export function cleanPlayerPreferences(value={}){
  const volume=Number(value.volume);
  return {volume:Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):1,muted:value.muted===true,speed:[.5,.75,1,1.25,1.5,2].includes(Number(value.speed))?Number(value.speed):1};
}
export function applyPlayerPreferences(video,prefs){video.volume=prefs.volume;video.muted=prefs.muted;video.defaultPlaybackRate=prefs.speed;video.playbackRate=prefs.speed}
export function bindPlayerControls(video,{volume,mute,speed,status,fullscreen,surface,storage=globalThis.localStorage}){
  const key='context-desk-player-v1';let prefs;
  try{prefs=cleanPlayerPreferences(JSON.parse(storage.getItem(key)||'{}'))}catch{prefs=cleanPlayerPreferences()}
  applyPlayerPreferences(video,prefs);
  const sync=()=>{volume.value=String(Math.round(video.volume*100));volume.setAttribute('aria-valuetext',`${Math.round(video.volume*100)} percent`);mute.textContent=video.muted?'Unmute':'Mute';mute.setAttribute('aria-pressed',String(video.muted));speed.value=String(video.playbackRate)};
  const save=()=>{prefs={volume:video.volume,muted:video.muted,speed:video.playbackRate};try{storage.setItem(key,JSON.stringify(prefs))}catch{}sync()};
  volume.oninput=()=>{video.volume=Number(volume.value)/100;if(video.volume>0)video.muted=false;save()};mute.onclick=()=>{video.muted=!video.muted;save()};speed.onchange=()=>{video.defaultPlaybackRate=Number(speed.value);video.playbackRate=Number(speed.value);save()};
  video.addEventListener('volumechange',save);video.addEventListener('ratechange',save);
  for(const event of ['waiting','stalled','playing','canplay','pause','error'])video.addEventListener(event,()=>{status.textContent=video.error?'Preview unavailable. Reopen the clip or restore its source.':video.readyState<3&&!video.paused?'Buffering video…':'';surface.setAttribute('aria-busy',String(Boolean(status.textContent&&!video.error)))});
  fullscreen.hidden=!surface.requestFullscreen;fullscreen.onclick=()=>{surface.requestFullscreen?.().catch(()=>{status.textContent='Fullscreen is unavailable in this browser.'})};sync();
}
