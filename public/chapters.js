// Episode chapters on the Clips page: once a whole-video subtitle track is finished, Muse Spark
// splits the recording into titled chapters (lib/chapters.js). Each chapter shows a still from the
// recording, jumps the source player there, and the list copies as YouTube chapters.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const chapterClock=seconds=>{const s=Math.max(0,Math.floor(seconds)),h=Math.floor(s/3600),m=Math.floor(s/60)%60,x=String(s%60).padStart(2,'0');return h?`${h}:${String(m).padStart(2,'0')}:${x}`:`${m}:${x}`};
export const youtubeText=chapters=>chapters.map(c=>`${chapterClock(c.start)} ${c.title}`).join('\n');

export function mountChapters({after,getJob,player,seek,toast,download,requestJson}){
  const section=document.createElement('section');section.className='chapters-panel';section.id='chapters';section.hidden=true;section.setAttribute('aria-labelledby','chaptersHeading');
  section.innerHTML=`<div class="chapters-head"><div><h2 id="chaptersHeading">Chapters</h2><p id="chaptersMeta"></p></div><div class="cd-row chapters-actions">
    <button type="button" id="chaptersCopy" class="cd-btn cd-btn-sm cd-btn-secondary" hidden>Copy for YouTube</button><button type="button" id="chaptersDownload" class="cd-btn cd-btn-sm cd-btn-ghost" hidden>Download .txt</button>
    <button type="button" id="chaptersMake" class="cd-btn cd-btn-sm cd-btn-primary">Make chapters</button></div></div>
    <p id="chaptersStatus" class="chapters-status" role="status"></p><ol id="chaptersList" class="chapters-list"></ol>`;
  after.after(section);
  const $=id=>section.querySelector('#'+id);let key='',data=null,busy=false,current=-1;
  const job=()=>getJob();
  function render(){
    const j=job(),list=$('chaptersList'),chapters=data?.chapters||[];
    $('chaptersCopy').hidden=$('chaptersDownload').hidden=!chapters.length;
    $('chaptersMake').textContent=busy?'Writing chapters…':chapters.length?'Make again':'Make chapters';$('chaptersMake').disabled=busy;
    $('chaptersMake').className='cd-btn cd-btn-sm '+(chapters.length?'cd-btn-ghost':'cd-btn-primary');
    $('chaptersMeta').textContent=chapters.length?`${chapters.length} chapters · from the ${data.language==='Original'?'original':data.language} subtitles · Muse Spark draft, check before posting`:`Split ${j?.sourceName?'this recording':'the recording'} into titled chapters you can jump between and paste into a YouTube description.`;
    if(busy){list.innerHTML=Array.from({length:6},()=>'<li class="chapter is-loading" aria-hidden="true"><span class="chapter-thumb"><span class="cd-thumb-fill"></span></span><span class="chapter-body"><b></b><i></i></span></li>').join('');return}
    list.innerHTML=chapters.map((c,i)=>{const next=chapters[i+1]?.start??data.duration,still=j?.sourceId?`/api/import/${esc(j.sourceId)}/frame?t=${Math.floor(Math.min(next-1,c.start+8))}&w=320`:'';
      return `<li class="chapter${i===current?' is-current':''}"><button type="button" data-chapter="${i}" aria-label="Play chapter ${i+1}, ${esc(c.title)}, at ${chapterClock(c.start)}"><span class="chapter-thumb">${still?`<img src="${still}" alt="" loading="lazy">`:'<span class="cd-thumb-fill"></span>'}<span class="cd-dur">${chapterClock(c.start)}</span></span><span class="chapter-body"><b dir="auto">${esc(c.title)}</b><span dir="auto">${esc(c.summary)}</span><small>${chapterClock(next-c.start)} long</small></span></button></li>`}).join('');
  }
  async function load(j){try{data=await requestJson('/api/chapters/'+j.id);if(!data?.chapters)data=null}catch{data=null}if(key===j.id+'|'+j.language)render()}
  $('chaptersMake').onclick=async()=>{const j=job();if(!j||busy)return;busy=true;$('chaptersStatus').textContent=`Muse Spark is reading the ${chapterClock(j.duration||0)} subtitle track. This takes up to a minute.`;render();
    try{data=await requestJson('/api/chapters/'+j.id,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});$('chaptersStatus').textContent='';toast(`${data.chapters.length} chapters ready. Check the titles before you post them.`)}
    catch(error){$('chaptersStatus').textContent=error.message||'Chapters could not be written.'}finally{busy=false;render()}};
  $('chaptersCopy').onclick=async()=>{if(!data)return;try{await navigator.clipboard.writeText(youtubeText(data.chapters));toast('Copied. Paste it into the YouTube description; the first line must stay 0:00.')}catch{toast('Copy was blocked. Use Download .txt instead.')}};
  $('chaptersDownload').onclick=()=>{if(data)download(new Blob([youtubeText(data.chapters)+'\n'],{type:'text/plain'}),'chapters.txt')};
  section.addEventListener('click',event=>{const b=event.target.closest('[data-chapter]');if(b&&data)seek(data.chapters[Number(b.dataset.chapter)].start)});
  // Marks the chapter that is playing in the source player.
  player?.addEventListener('timeupdate',()=>{if(!data||section.hidden)return;const t=player.currentTime,i=data.chapters.findLastIndex(c=>c.start<=t);if(i===current)return;current=i;for(const [n,row]of section.querySelectorAll('.chapter').entries())row.classList.toggle('is-current',n===i)});
  return {sync(){const j=job();section.hidden=!j;if(!j)return;const next=j.id+'|'+j.language;if(next!==key){key=next;data=null;current=-1;render();void load(j)}}};
}
