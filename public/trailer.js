// Make the trailer, on the Clips page: Muse Spark picks the setup, turns and payoff of the episode
// (lib/trailer.js); each beat becomes a clip and together they become the story cut, ready to play.
import {chapterClock} from './chapters.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roles={setup:['cue','Setup'],turn:['signal','Turn'],payoff:['volt','Payoff']};

export function mountTrailer({before,getJob,requestJson,buildCut,toast}){
  const section=document.createElement('section');section.className='trailer-panel';section.id='trailer';section.hidden=true;section.setAttribute('aria-labelledby','trailerHeading');
  section.innerHTML=`<div class="trailer-head"><div><h2 id="trailerHeading">Make the trailer</h2><p id="trailerMeta">Muse Spark picks the setup, the turns and the payoff, then builds a one-minute story cut you can play, retrim and export.</p></div>
    <div class="cd-row"><button type="button" id="trailerBuild" class="cd-btn cd-btn-secondary" hidden>Build story cut</button><button type="button" id="trailerMake" class="cd-btn cd-btn-primary">Make the trailer</button></div></div>
    <p class="trailer-status" id="trailerStatus" role="status"></p><ol class="trailer-beats" id="trailerBeats"></ol>`;
  before.before(section);
  const $=id=>section.querySelector('#'+id);let key='',data=null,busy=false;
  function render(){
    const j=getJob(),beats=data?.beats||[];$('trailerBuild').hidden=!beats.length;
    $('trailerMake').textContent=busy?'Writing the trailer…':beats.length?'Make another':'Make the trailer';$('trailerMake').disabled=busy;$('trailerMake').className='cd-btn '+(beats.length?'cd-btn-ghost':'cd-btn-primary');
    if(beats.length){const total=beats.reduce((n,b)=>n+b.end-b.start,0);$('trailerMeta').innerHTML=`<b>${esc(data.title)}</b> · ${esc(data.logline)} <span class="cd-tc">${beats.length} beats · ${Math.round(total)}s</span>`}
    $('trailerBeats').innerHTML=busy?Array.from({length:5},()=>'<li class="trailer-beat is-loading" aria-hidden="true"><span class="trailer-still"><span class="cd-thumb-fill"></span></span></li>').join(''):beats.map((b,i)=>{const [tone,label]=roles[b.role]||roles.turn;
      return `<li class="trailer-beat"><span class="trailer-still">${j?.sourceId?`<img src="/api/import/${esc(j.sourceId)}/frame?t=${Math.floor(b.start+(b.end-b.start)/2)}&w=320" alt="" loading="lazy">`:'<span class="cd-thumb-fill"></span>'}<span class="cd-dur">${chapterClock(b.start)} · ${Math.round(b.end-b.start)}s</span></span><span class="cd-badge cd-badge-${tone}">${i+1} · ${label}</span><b dir="auto">${esc(b.title)}</b><q dir="auto">${esc(b.quote)}</q></li>`}).join('');
  }
  async function load(j){try{const d=await requestJson('/api/trailer/'+j.id);data=d.beats?d:null}catch{data=null}if(key===j.id)render()}
  $('trailerMake').onclick=async()=>{const j=getJob();if(!j||busy)return;busy=true;$('trailerStatus').textContent=`Muse Spark is reading the ${chapterClock(j.duration||0)} transcript for the story…`;render();
    try{data=await requestJson('/api/trailer/'+j.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({again:Boolean(data)})});$('trailerStatus').textContent='';toast('Trailer beats ready. Choose Build story cut to turn them into clips.')}
    catch(error){$('trailerStatus').textContent=error.message||'The trailer could not be made.'}finally{busy=false;render()}};
  $('trailerBuild').onclick=async()=>{if(!data)return;$('trailerBuild').disabled=true;try{await buildCut(data)}catch(error){toast(error.message||'The story cut could not be built.')}finally{$('trailerBuild').disabled=false}};
  return {sync(){const j=getJob();section.hidden=!j;if(!j)return;if(key!==j.id){key=j.id;data=null;render();void load(j)}}};
}
