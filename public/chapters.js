// Episode chapters on the Clips page: once a whole-video subtitle track is finished, Muse Spark
// splits the recording into titled chapters. The list seeks the source player and exports as text.
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
  const $=id=>section.querySelector('#'+id);let key='',data=null,busy=false,loading=false,current=-1,version=0;
  const job=()=>getJob();
  function render(){
    const j=job(),list=$('chaptersList'),chapters=data?.chapters||[];
    $('chaptersCopy').hidden=$('chaptersDownload').hidden=!chapters.length;
    $('chaptersMake').textContent=busy?'Writing chapters…':loading?'Loading chapters…':chapters.length?'Regenerate chapters':'Make chapters';$('chaptersMake').disabled=busy||loading;
    $('chaptersMake').className='cd-btn cd-btn-sm '+(chapters.length?'cd-btn-ghost':'cd-btn-primary');
    $('chaptersMeta').textContent=chapters.length?`${chapters.length} chapters · from the ${data.language==='Original'?'original':data.language} subtitles · Muse Spark draft, check before posting`:`Split ${j?.sourceName?'this recording':'the recording'} into titled chapters you can jump between and paste into a YouTube description.`;
    list.innerHTML=chapters.map((c,i)=>{
      const next=chapters[i+1]?.start??data.duration;
      return `<li class="chapter${i===current?' is-current':''}"><button type="button" data-chapter="${i}" aria-label="Play chapter ${i+1}, ${esc(c.title)}, at ${chapterClock(c.start)}"><span class="chapter-time">${chapterClock(c.start)}</span><span class="chapter-body"><b dir="auto">${esc(c.title)}</b><span dir="auto">${esc(c.summary)}</span><small>${chapterClock(next-c.start)} long</small></span></button></li>`;
    }).join('');
  }
  async function load(j,epoch){
    try{
      const result=await requestJson('/api/chapters/'+j.id);
      if(version===epoch)data=result?.chapters?result:null;
    }catch(error){if(version===epoch)$('chaptersStatus').textContent=error.message||'Saved chapters could not load.'}
    finally{if(version===epoch){loading=false;render()}}
  }
  $('chaptersMake').onclick=async()=>{
    const j=job();if(!j||busy||loading)return;
    const epoch=version;
    busy=true;$('chaptersStatus').textContent=`Muse Spark is reading the ${chapterClock(j.duration||0)} subtitle track.`;render();
    try{
      const result=await requestJson('/api/chapters/'+j.id,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      if(version!==epoch)return;
      data=result;$('chaptersStatus').textContent='';toast(`${data.chapters.length} chapters ready. Check the titles before you post them.`);
    }catch(error){if(version===epoch)$('chaptersStatus').textContent=error.message||'Chapters could not be written.'}
    finally{if(version===epoch){busy=false;render()}}
  };
  $('chaptersCopy').onclick=async()=>{if(!data)return;try{await navigator.clipboard.writeText(youtubeText(data.chapters));toast('Copied. Paste it into the YouTube description; the first line must stay 0:00.')}catch{toast('Copy was blocked. Use Download .txt instead.')}};
  $('chaptersDownload').onclick=()=>{if(data)download(new Blob([youtubeText(data.chapters)+'\n'],{type:'text/plain'}),'chapters.txt')};
  section.addEventListener('click',event=>{const b=event.target.closest('[data-chapter]');if(b&&data)seek(data.chapters[Number(b.dataset.chapter)].start)});
  // Marks the chapter that is playing in the source player.
  player?.addEventListener('timeupdate',()=>{if(!data||section.hidden)return;const t=player.currentTime,i=data.chapters.findLastIndex(c=>c.start<=t);if(i===current)return;current=i;for(const [n,row]of section.querySelectorAll('.chapter').entries())row.classList.toggle('is-current',n===i)});
  return {sync(){
    const j=job(),next=j?j.id+'|'+j.language:'';
    section.hidden=!j;
    if(next===key)return;
    key=next;data=null;current=-1;busy=false;loading=Boolean(j);version++;
    $('chaptersStatus').textContent='';
    if(j){render();void load(j,version)}
  }};
}
