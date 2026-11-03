// Culture notes in Studio's Captions tab: Muse Spark explains the idioms, slang and cultural
// references in this clip's original lines (lib/culture.js). Notes live on the clip; switched on,
// each appears as a small card while its line plays, in the preview and in the export.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=s=>`${Math.floor(Math.max(0,s)/60)}:${String(Math.floor(Math.max(0,s)%60)).padStart(2,'0')}`;

// The note on screen at time t (seconds from the clip's source start), as the export shows it.
// cueAt(line) gives that caption line's synced {start,end}.
export function activeNote(moment,cueAt,t){
  if(!moment?.showCultureNotes||!Array.isArray(moment.cultureNotes))return null;
  for(const n of moment.cultureNotes){if(n.hidden)continue;const c=cueAt(n.line);if(c&&t>=c.start&&t<Math.max(c.end,c.start+3))return n}
  return null;
}
export function drawCultureNote(context,note){
  if(!note)return;const {width,height}=context.canvas,font=Math.round(Math.min(width/24,40)),pad=font*.45,x=width*.05,y=height*.05,max=width*.82;
  context.save();context.textBaseline='top';context.font=`700 ${font}px Arial,sans-serif`;
  const lines=[];let line='';for(const word of String(note.meaning).split(/\s+/)){const next=line?line+' '+word:word;if(line&&context.measureText(next).width>max)  {lines.push(line);line=word}else line=next}if(line)lines.push(line);
  const w=Math.min(max,Math.max(context.measureText(note.phrase).width,...lines.map(l=>context.measureText(l).width)))+pad*2,h=(lines.length+1)*font*1.2+pad*2;
  context.fillStyle='rgba(11,11,13,.87)';context.fillRect(x,y,w,h);
  context.fillStyle='#c9f23b';context.fillText(note.phrase,x+pad,y+pad,max);context.fillStyle='#f3f1ec';lines.forEach((l,i)=>context.fillText(l,x+pad,y+pad+(i+1)*font*1.2,max));
  context.restore();
}

export function mountCultureNotes({before,getMoment,clipLines,dialect,requestJson,onChange,toast,seek}){
  const section=document.createElement('section');section.className='culture-notes';section.setAttribute('aria-labelledby','cultureHeading');
  section.innerHTML=`<div class="culture-head"><div><h3 id="cultureHeading">Culture notes</h3><p>Muse Spark explains the idioms, slang and references an English viewer would miss.</p></div>
    <button type="button" id="cultureFind" class="cd-btn cd-btn-sm cd-btn-primary">Find culture notes</button></div>
    <label class="culture-show" hidden><input type="checkbox" id="cultureShow"> Show notes on the video</label><p class="culture-status" id="cultureStatus" role="status"></p><ol class="culture-list" id="cultureList"></ol>`;
  before.before(section);
  const $=id=>section.querySelector('#'+id);let busy=false;
  function sync(){
    const m=getMoment();section.hidden=!m;if(!m)return;const notes=m.cultureNotes||[];
    $('cultureFind').textContent=busy?'Reading the clip…':notes.length?'Find again':'Find culture notes';$('cultureFind').disabled=busy;$('cultureFind').className='cd-btn cd-btn-sm '+(notes.length?'cd-btn-ghost':'cd-btn-primary');
    section.querySelector('.culture-show').hidden=!notes.length;$('cultureShow').checked=Boolean(m.showCultureNotes);
    const times=new Map(clipLines(m).map(l=>[l.line,l.start]));
    $('cultureList').innerHTML=notes.map((n,i)=>[n,i]).sort((a,b)=>a[0].line-b[0].line).map(([n,i])=>`<li class="culture-note${n.hidden?' is-hidden':''}"><button type="button" class="culture-time" data-note-seek="${i}">${clock(times.get(n.line)??0)}</button><div><b dir="auto">${esc(n.phrase)}</b><span class="culture-literal">${esc(n.literal)}</span><span>${esc(n.meaning)}</span></div><label class="culture-keep"><input type="checkbox" data-note-keep="${i}" ${n.hidden?'':'checked'}> On video</label></li>`).join('');
  }
  // Finds notes for the open clip; the Post kit calls this too. Throws when the clip cannot be read.
  async function find(){
    const m=getMoment();if(!m||busy)return;const lines=clipLines(m).filter(l=>l.original);if(!lines.length){toast('This clip has no original-language lines yet. Transcribe it first.');return}
    busy=true;$('cultureStatus').textContent='';sync();
    try{const data=await requestJson('/api/culture-notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:lines.map(({line,original,translation})=>({line,original,translation})),dialect:dialect(),language:m.captionLanguage==='Original'?'English':m.captionLanguage})});
      m.cultureNotes=data.notes;if(data.notes.length&&m.showCultureNotes===undefined)m.showCultureNotes=true;onChange();
      $('cultureStatus').textContent=data.notes.length?'':'Nothing here needs explaining for an English viewer.';if(data.notes.length)toast(`${data.notes.length} culture ${data.notes.length===1?'note':'notes'} found. Check each one against the speech.`)}
    catch(error){$('cultureStatus').textContent=error.message||'Culture notes could not be written.';throw error}finally{busy=false;sync()}}
  $('cultureFind').onclick=()=>find().catch(()=>{});
  $('cultureShow').onchange=()=>{const m=getMoment();if(!m)return;m.showCultureNotes=$('cultureShow').checked;onChange({redraw:true})};
  section.addEventListener('change',event=>{const keep=event.target.closest('[data-note-keep]');const m=getMoment();if(!keep||!m)return;m.cultureNotes[Number(keep.dataset.noteKeep)].hidden=!keep.checked;onChange({redraw:true});sync()});
  section.addEventListener('click',event=>{const b=event.target.closest('[data-note-seek]');const m=getMoment();if(!b||!m)return;const n=m.cultureNotes[Number(b.dataset.noteSeek)],line=clipLines(m).find(l=>l.line===n.line);if(line)seek(line.start)});
  return {sync,find};
}
