// Ask the episode, on the Clips page: a question about the whole recording, answered by Muse Spark
// from the finished subtitle track (lib/ask.js). Each supporting moment shows a still, its quote,
// plays in the source player, or becomes a clip with one click.
import {chapterClock} from './chapters.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const starters=['What is the biggest argument in this episode?','When does someone talk about their feelings?','What is the funniest moment?','Who gets nominated or voted on, and why?'];

export function mountAsk({before,getJob,seek,makeClip,toast,requestJson}){
  const section=document.createElement('section');section.className='ask-panel';section.id='askEpisode';section.hidden=true;section.setAttribute('aria-labelledby','askHeading');
  section.innerHTML=`<div class="ask-head"><h2 id="askHeading">Ask the episode</h2><p>Ask anything about what was said. Muse Spark answers from the whole subtitle track and points to the moments, ready to clip.</p></div>
    <form class="ask-form" id="askForm"><label class="sr-only" for="askInput">Your question</label><input id="askInput" class="cd-input" type="text" maxlength="300" placeholder="Ask about the whole episode…" autocomplete="off" dir="auto"><button type="submit" class="cd-btn cd-btn-primary" id="askGo">Ask</button></form>
    <div class="ask-starters" role="group" aria-label="Example questions">${starters.map(q=>`<button type="button" class="cd-btn cd-btn-sm cd-btn-ghost" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <div class="ask-result" id="askResult" aria-live="polite"></div><details class="ask-history" id="askHistory" hidden><summary>Earlier questions</summary><ul></ul></details>`;
  before.before(section);
  const $=id=>section.querySelector('#'+id);let key='',busy=false,current=null,history=[];
  function renderAnswer(answer,{loading=false,error=''}={}){
    const j=getJob(),box=$('askResult');
    if(loading){box.innerHTML=`<div class="ask-answer is-loading" aria-busy="true"><p class="ask-question">${esc(answer)}</p><span class="ask-line"></span><span class="ask-line short"></span><p class="ask-wait">Muse Spark is reading the ${chapterClock(j?.duration||0)} transcript…</p></div>`;return}
    if(error){box.innerHTML=`<p class="ask-error">${esc(error)}</p>`;return}
    if(!answer){box.innerHTML='';return}
    box.innerHTML=`<article class="ask-answer"><p class="ask-question">${esc(answer.question)}${answer.cached?' <span class="cd-badge">Saved answer</span>':''}</p><p class="ask-text" dir="auto">${esc(answer.answer)}</p>
      ${answer.moments.length?`<ol class="ask-moments">${answer.moments.map((m,i)=>`<li class="ask-moment"><button type="button" class="ask-moment-play" data-play="${i}" aria-label="Play ${esc(m.title)} at ${chapterClock(m.start)}"><span class="chapter-thumb">${j?.sourceId?`<img src="/api/import/${esc(j.sourceId)}/frame?t=${Math.floor(m.start+Math.min(4,(m.end-m.start)/2))}&w=320" alt="" loading="lazy">`:'<span class="cd-thumb-fill"></span>'}<span class="cd-dur">${chapterClock(m.start)} · ${Math.round(m.end-m.start)}s</span></span></button>
        <div class="ask-moment-body"><b dir="auto">${esc(m.title)}</b><q dir="auto">${esc(m.quote)}</q><span dir="auto">${esc(m.why)}</span><div class="cd-row"><button type="button" class="cd-btn cd-btn-sm cd-btn-secondary" data-clip="${i}">Make a clip</button><button type="button" class="cd-btn cd-btn-sm cd-btn-ghost" data-play="${i}">Play</button></div></div></li>`).join('')}</ol>`:'<p class="ask-none">No moment in the transcript answers this. Try asking it another way.</p>'}
      <p class="ask-note">Answers are drafts from the subtitle track. Watch the moment before you post it.</p></article>`;
  }
  function renderHistory(){const list=$('askHistory');list.hidden=!history.length;list.querySelector('ul').innerHTML=history.map((h,i)=>`<li><button type="button" class="cd-btn cd-btn-sm cd-btn-ghost" data-history="${i}">${esc(h.question)}</button></li>`).join('')}
  async function ask(question){
    const j=getJob(),q=String(question||'').trim();if(!j||busy||q.length<3)return;busy=true;$('askGo').disabled=true;$('askInput').value=q;renderAnswer(q,{loading:true});
    try{current=await requestJson('/api/ask/'+j.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q})});history=[current,...history.filter(h=>h.question!==current.question)].slice(0,8);renderAnswer(current);renderHistory()}
    catch(error){renderAnswer(null,{error:error.message||'The question could not be answered.'})}finally{busy=false;$('askGo').disabled=false}
  }
  $('askForm').onsubmit=event=>{event.preventDefault();void ask($('askInput').value)};
  section.addEventListener('click',event=>{
    const starter=event.target.closest('[data-ask]');if(starter){void ask(starter.dataset.ask);return}
    const old=event.target.closest('[data-history]');if(old){current=history[Number(old.dataset.history)];$('askInput').value=current.question;renderAnswer({...current,cached:true});return}
    const play=event.target.closest('[data-play]');if(play&&current){seek(current.moments[Number(play.dataset.play)].start);return}
    const clip=event.target.closest('[data-clip]');if(clip&&current){const m=current.moments[Number(clip.dataset.clip)];void makeClip({start:m.start,end:m.end},{hook:m.title}).catch(error=>toast(error.message))}
  });
  async function load(j){try{history=(await requestJson('/api/ask/'+j.id)).history||[]}catch{history=[]}if(key===j.id){renderHistory();if(!current&&history[0]){current={...history[0],cached:true};$('askInput').value=current.question;renderAnswer(current)}}}
  return {sync(){const j=getJob();section.hidden=!j;if(!j)return;if(key!==j.id){key=j.id;current=null;history=[];renderAnswer(null);void load(j)}}};
}
