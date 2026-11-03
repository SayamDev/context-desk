// Post kit, at the top of Studio's Export tab: one button writes the post (title, caption, hashtags
// with Muse Spark), finds culture notes when the clip has none, sets the title card to the post
// title, and gathers it all with the clip's subtitles into one ZIP to post from.
import {zipBlob} from './zip.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug=text=>String(text||'clip').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,40)||'clip';

export function notesText(notes){return (notes||[]).filter(n=>!n.hidden).map(n=>`${n.phrase} (${n.literal}): ${n.meaning}`).join('\n')}

export function mountPostKit({before,getMoment,clipText,clipSrt,writePost,findNotes,titleCards,caption,toast,download}){
  const section=document.createElement('section');section.className='post-kit-panel';section.setAttribute('aria-labelledby','postKitHeading');
  section.innerHTML=`<div class="post-kit-head"><div><h3 id="postKitHeading">Post kit</h3><p>Everything to post this clip: title card, caption, hashtags, culture notes and subtitles.</p></div><button type="button" id="postKitMake" class="cd-btn cd-btn-primary">Make post kit</button></div>
    <ol class="post-kit-steps" id="postKitSteps" hidden><li data-step="post">Post title, caption and hashtags</li><li data-step="notes">Culture notes</li><li data-step="card">Title card</li></ol>
    <div class="post-kit-ready" id="postKitReady" hidden><img id="postKitCard" alt="Title card for this clip"><div class="post-kit-copy"><b id="postKitTitle" dir="auto"></b><p id="postKitCaption" dir="auto"></p><div class="post-kit-notes" id="postKitNotes"></div>
      <div class="cd-row"><button type="button" id="postKitCopy" class="cd-btn cd-btn-sm cd-btn-secondary">Copy caption</button><button type="button" id="postKitZip" class="cd-btn cd-btn-sm cd-btn-primary">Download kit (.zip)</button></div></div></div>`;
  before.before(section);
  const $=id=>section.querySelector('#'+id);let busy=false,cardUrl='';
  const step=(name,state)=>{const li=section.querySelector(`[data-step=${name}]`);if(li)li.dataset.state=state};
  async function preview(){const m=getMoment();if(!m)return;const blob=await titleCards.render('16:9');if(cardUrl)URL.revokeObjectURL(cardUrl);cardUrl=blob?URL.createObjectURL(blob):'';$('postKitCard').src=cardUrl}
  function sync(){
    const m=getMoment();section.hidden=!m;if(!m)return;const ready=Boolean(m.postCaption);
    $('postKitMake').textContent=busy?'Making the kit…':ready?'Make it again':'Make post kit';$('postKitMake').disabled=busy;$('postKitMake').className='cd-btn '+(ready?'cd-btn-ghost':'cd-btn-primary');
    $('postKitReady').hidden=!ready||busy;if(!ready||busy)return;
    $('postKitTitle').textContent=m.postTitle||'';$('postKitCaption').textContent=m.postCaption;
    const notes=(m.cultureNotes||[]).filter(n=>!n.hidden);$('postKitNotes').innerHTML=notes.length?`<span class="cd-label">Culture notes</span>${notes.map(n=>`<span><b dir="auto">${esc(n.phrase)}</b> ${esc(n.meaning)}</span>`).join('')}`:'';
    void preview();
  }
  $('postKitMake').onclick=async()=>{
    const m=getMoment();if(!m||busy)return;if(!clipText(m)){toast('This clip has no subtitle lines yet. Transcribe it first.');return}
    busy=true;$('postKitSteps').hidden=false;for(const s of ['post','notes','card'])step(s,'waiting');sync();
    try{
      step('post','working');await writePost(m);step('post','done');
      step('notes','working');try{if(!m.cultureNotes?.length)await findNotes(m);step('notes','done')}catch{step('notes','skipped')}
      step('card','working');titleCards.useTitle(m.postTitle);await titleCards.draw();step('card','done');
      toast('Post kit ready. Read the caption and notes before you post.');
    }catch(error){toast(error.message||'The post kit could not be made.')}
    finally{busy=false;setTimeout(()=>{$('postKitSteps').hidden=true},1500);sync()}};
  $('postKitCopy').onclick=async()=>{const m=getMoment();if(!m?.postCaption)return;try{await navigator.clipboard.writeText(m.postCaption);toast('Caption copied.')}catch{caption()?.select();toast('Copy was blocked. The caption is selected in the field below.')}};
  $('postKitZip').onclick=async()=>{
    const m=getMoment();if(!m)return;$('postKitZip').disabled=true;
    try{const name=slug(m.postTitle||m.hook),[tall,wide]=await Promise.all([titleCards.render('9:16'),titleCards.render('16:9')]),notes=notesText(m.cultureNotes);
      const files=[{name:'caption.txt',data:(m.postTitle?m.postTitle+'\n\n':'')+m.postCaption+'\n'},{name:'subtitles.srt',data:clipSrt(m)}];
      if(tall)files.unshift({name:'title-card-9x16.png',data:tall});if(wide)files.unshift({name:'title-card-16x9.png',data:wide});if(notes)files.push({name:'culture-notes.txt',data:notes+'\n'});
      download(await zipBlob(files),`${name}-post-kit.zip`);toast('Post kit downloaded. Export the video from this tab to post with it.')}
    catch(error){toast(error.message||'The kit could not be zipped.')}finally{$('postKitZip').disabled=false}};
  return {sync};
}
