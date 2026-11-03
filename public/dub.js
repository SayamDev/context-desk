// English dub in Studio's Style tab (lib/dub.js makes the track). The preview plays the dub in step
// with the clip and lowers the original through a gain node, so the player's own volume setting
// is never changed; the export mixes the same track at the same level.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function mountDub({after,video,getMoment,clipLines,clipTime,clipSource,requestJson,onChange,toast}){
  const section=document.createElement('section');section.className='dub-panel';section.setAttribute('aria-labelledby','dubHeading');
  section.innerHTML=`<div class="dub-head"><div><h3 id="dubHeading">English dub</h3><p>Muse Spark rewrites each subtitle to fit the speaker's timing; VoiceStudio says it in English in that person's own voice, over the original.</p></div><button type="button" id="dubMake" class="cd-btn cd-btn-sm cd-btn-primary">Make English dub</button></div>
    <label class="dub-engine">Voices<select id="dubEngine"><option value="auto">Each speaker's own voice (VoiceStudio)</option><option value="mac">This Mac's voices</option></select></label><div class="dub-voices" id="dubMacVoices"><label>Speaker A<select id="dubVoiceA"></select></label><label>Speaker B<select id="dubVoiceB"></select></label></div>
    <p class="dub-status" id="dubStatus" role="status"></p>
    <div class="dub-ready" id="dubReady" hidden><label class="dub-use"><input type="checkbox" id="dubUse"> Play and export with the dub</label>
      <label class="dub-level">Original audio <input type="range" id="dubLevel" min="0" max="50" step="5"><output id="dubLevelOut"></output></label>
      <details class="dub-script"><summary>Dub script</summary><ol id="dubScript"></ol></details></div>`;
  after.after(section);
  const $=id=>section.querySelector('#'+id),audio=new Audio();audio.preload='auto';let busy=false,graph=null,voicesLoaded=false;
  const active=()=>{const m=getMoment();return Boolean(m?.useDub&&m.dub?.url)};
  // Lowers the clip's own sound through Web Audio; created once, on the first dubbed play.
  function setOriginal(level){if(!graph){if(level>=1)return;try{const context=new AudioContext(),source=context.createMediaElementSource(video),gain=context.createGain();source.connect(gain).connect(context.destination);graph={context,gain}}catch{return}}graph.gain.gain.value=level;if(graph.context.state==='suspended')void graph.context.resume()}
  function align(){const m=getMoment();if(!active()){audio.pause();setOriginal(1);return}
    if(audio.dataset.src!==m.dub.url){audio.src=m.dub.url;audio.dataset.src=m.dub.url}
    setOriginal(Number(m.dubLevel??.15));const t=clipTime(m);if(t<0||t>m.dub.duration){audio.pause();return}
    if(Math.abs(audio.currentTime-t)>.25)audio.currentTime=t;if(!video.paused&&audio.paused)void audio.play().catch(()=>{});if(video.paused&&!audio.paused)audio.pause()}
  for(const event of ['play','pause','seeked','ratechange'])video.addEventListener(event,()=>{audio.playbackRate=video.playbackRate;align()});
  video.addEventListener('timeupdate',()=>{if(active())align()});
  let studio=false;
  async function loadVoices(){if(voicesLoaded)return;voicesLoaded=true;try{const {voices,voiceStudio}=await requestJson('/api/dub/voices');studio=Boolean(voiceStudio);const opt=$('dubEngine').querySelector('[value=auto]');opt.disabled=!studio;opt.textContent=studio?'Each speaker\'s own voice (VoiceStudio)':'Each speaker\'s own voice (open VoiceStudio)';if(!studio)$('dubEngine').value='mac';const options=voices.map(v=>`<option value="${esc(v.name)}">${esc(v.name)} · ${esc(v.locale.replace('en_',''))}</option>`).join('');$('dubVoiceA').innerHTML=options;$('dubVoiceB').innerHTML=options;
    if(voices.some(v=>v.name==='Daniel'))$('dubVoiceA').value='Daniel';if(voices.some(v=>v.name==='Samantha'))$('dubVoiceB').value='Samantha';sync()}catch{voicesLoaded=false}}
  function sync(){
    const m=getMoment();section.hidden=!m;if(!m)return;void loadVoices();const dub=m.dub;
    if(dub?.voices){if(dub.voices.A)$('dubVoiceA').value=dub.voices.A;if(dub.voices.B)$('dubVoiceB').value=dub.voices.B}
    $('dubMake').textContent=busy?'Making the dub…':dub?'Make again':'Make English dub';$('dubMake').disabled=busy;$('dubMake').className='cd-btn cd-btn-sm '+(dub?'cd-btn-ghost':'cd-btn-primary');
    $('dubMacVoices').hidden=$('dubEngine').value!=='mac';$('dubReady').hidden=!dub;if(!dub){align();return}
    $('dubUse').checked=Boolean(m.useDub);$('dubLevel').value=String(Math.round((m.dubLevel??.15)*100));$('dubLevelOut').textContent=$('dubLevel').value+'%';
    $('dubScript').innerHTML=dub.lines.map(l=>`<li><span class="cd-tc">${l.start.toFixed(1)}s</span> ${esc(l.text)}</li>`).join('');
    if(m.cuts?.length)$('dubStatus').textContent='This clip has cuts inside it, so the export keeps its own audio. Remove the cuts to export the dub.';
    align();
  }
  $('dubMake').onclick=async()=>{
    const m=getMoment();if(!m||busy)return;if(m.captionLanguage!=='English'){toast('Set the subtitles to English first; the dub reads the English lines.');return}
    const lines=clipLines(m),duration=m.trimOut-m.trimIn;if(!lines.length){toast('This clip has no English subtitle lines to dub.');return}if(duration>180){toast('Trim the clip to 3 minutes or less to dub it.');return}
    const cloning=$('dubEngine').value==='auto'&&studio;busy=true;$('dubStatus').textContent=cloning?`Adapting ${lines.length} lines, then cloning each speaker's voice. About 15 seconds a line, so a 30-second clip takes a few minutes…`:`Adapting ${lines.length} lines and recording the voices…`;sync();
    try{m.dub=await requestJson('/api/dub',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines,duration,voices:{A:$('dubVoiceA').value,B:$('dubVoiceB').value,default:$('dubVoiceA').value},sourceLanguage:'Arabic',engine:cloning?'auto':'mac',...clipSource(m)})});m.useDub=true;m.dubLevel??=.15;onChange();$('dubStatus').textContent='';toast(m.dub.engine==='voicestudio'?'English dub ready in the speakers\' own voices. Play the clip to hear it.':'English dub ready. Play the clip to hear it.')}
    catch(error){$('dubStatus').textContent=error.message||'The dub could not be made.'}finally{busy=false;sync()}};
  $('dubEngine').onchange=sync;
  $('dubUse').onchange=()=>{const m=getMoment();if(!m)return;m.useDub=$('dubUse').checked;onChange();align()};
  $('dubLevel').oninput=()=>{const m=getMoment();if(!m)return;m.dubLevel=Number($('dubLevel').value)/100;$('dubLevelOut').textContent=$('dubLevel').value+'%';onChange();align()};
  return {sync};
}
