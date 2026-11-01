import {requestJson} from './projects.js';
import {socialHandoff} from './social.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function jobMarkup(j){
  const exporting=j.kind==='export',discovery=j.kind==='discovery',creative=j.kind==='creative',bundle=j.kind==='bundle',deep=discovery&&j.strategy==='transcript',active=j.status==='running',waiting=j.status==='queued';
  const resume=!j.legacyReadOnly&&['paused','error','interrupted','cancelled'].includes(j.status),base=exporting?'exports':discovery?'discovery':creative?'creative':bundle?'bundles':'subtitles';
  const title=j.sourceName||j.title||(creative?'AI cover':'Production job');
  const progress=creative?null:deep?(j.speechSectionsDone<j.speechSectionsTotal?j.speechSectionsDone/j.speechSectionsTotal:(j.checksTotal?j.checksDone/j.checksTotal:1)):exporting?j.completedSeconds/j.duration:discovery?(j.sectionsDone+j.checksDone)/(j.sectionsTotal+j.checksTotal):j.sectionsDone/j.sectionsTotal;
  const action=(name,label)=>`<button data-job="${j.id}" data-base="${base}" data-action="${name}">${label}</button>`;
  let open='';
  if(exporting&&j.output)open=`<label class="bundle-choice"><input type="checkbox" data-bundle-export="${j.id}" data-project="${j.projectId}"> Add to ZIP</label><a href="${escape(j.output.url)}" download="${escape(title)}.${j.output.type==='video/webm'?'webm':'mp4'}">Download video</a>${j.srt?`<a href="${escape(j.srt.url)}" download="context-desk.srt">Download SRT</a>`:''}`;
  else if(bundle&&j.output)open=`<a href="${escape(j.output.url)}" download="${escape(j.output.name||title+'.zip')}">Download ZIP (${j.exportCount} ${j.exportCount===1?'export':'exports'})</a>`;
  else if(creative&&j.output)open=`<a href="${escape(j.output.url)}" download="context-desk-${j.mode}.${j.output.type.split('/').at(-1)}">Download image</a>`;
  else if(discovery)open=`<button data-open="${j.projectId}">Open clips</button>${deep&&j.speechSectionsDone?`<a href="/api/discovery/${j.id}/transcript" download="context-desk-transcript.json">Download ${j.fullSourceTranscribed?'full':'partial'} transcript</a>`:''}`;
  else if(j.cueCount)open=`<a href="/api/subtitles/${j.id}/srt">Download draft SRT</a>`;
  const target=exporting&&j.output?socialHandoff(j.destination):null;
  const handoff=target?`<div class="social-handoff"><p>${escape(target.label)} export · ${j.captionLanguages?.length?'Subtitles: '+escape(j.captionLanguages.join(', ')):'Subtitles omitted'}. Download the video, then choose it in ${escape(target.label)}. Nothing has been posted.</p><a href="${target.upload}" target="_blank" rel="noopener noreferrer">Open ${escape(target.label)}</a><button data-share-file="${j.id}" ${typeof navigator!=='undefined'&&navigator.canShare&&navigator.share?'':'hidden'}>Share video file…</button><span data-share-status role="status"></span></div>`:'';
  const details=creative?`${j.requests||0} image request${j.requests===1?'':'s'} · ${escape(j.label||'AI-generated image · review before use')}`:deep?`${j.speechSectionsDone}/${j.speechSectionsTotal} source-audio sections · ${Math.round(j.coverageSeconds)}s transcribed · ${Math.round(j.unreviewedSeconds)}s not transcribed · ${j.checksDone}/${j.checksTotal} story checks · ${j.suggested} suggestions`:bundle?`${j.sectionsDone}/${j.sectionsTotal} files packaged · ${j.sectionsRemaining} remaining`:`${j.sectionsDone}/${j.sectionsTotal} ${exporting?'rendered clips':discovery?'picture samples':'sections'} · ${j.sectionsRemaining} remaining${discovery?' · '+j.checksDone+'/'+j.checksTotal+' story checks · '+j.suggested+' supported moments':''}`;
  const preview=j.output?(creative?`<details class="creative-preview"><summary>Review generated image</summary><img src="${escape(j.output.url)}" alt="AI-generated ${escape(j.mode)} draft"><p>Generated artwork. Check source fidelity, text and rights before use.</p></details>`:exporting?`<details class="export-preview"><summary>Preview finished video</summary><video src="${escape(j.output.url)}" controls playsinline preload="metadata"></video></details>`:''):'';
  return `<article class="job-row" data-job-row="${j.id}"><div class="job-title"><h3>${escape(title)}</h3><span>${exporting?'VIDEO EXPORT':discovery?deep?'WHOLE-VIDEO STORY PASS':'QUICK DISCOVERY':creative?'MUSE IMAGE':bundle?'EXPORT BUNDLE':'SUBTITLE TRACK'}${j.language?' · '+escape(j.language):''}</span><b class="job-state">${escape(j.status)}${j.queuePosition?' · position '+j.queuePosition:''}</b></div><div class="job-progress"><p>${escape(j.phase)}</p><progress max="1" ${Number.isFinite(progress)?`value="${progress}"`:j.status==='complete'?'value="1"':''}></progress><p>${details}</p>${exporting||creative||bundle?'':`<small>${j.speechRequests||0} speech · ${discovery?(j.storyRequests||0)+' story · ':''}${deep?(j.rankingRequests||0)+' story-ranking · ':''}${j.translationRequests||0} translation requests</small>`}${preview}${j.error?`<p class="job-error">${escape(j.error)}</p>`:''}</div><div class="job-actions">${open}${active||waiting?action('pause','Pause'):''}${resume?action('resume',j.inFlight?'Retry unfinished section':'Resume'):''}${waiting?action('first','Move first'):''}${active||waiting||resume&&j.status!=='cancelled'?action('cancel','Cancel'):''}${handoff}</div></article>`;
}

export function createJobsView({panel,counts,status,onJobs,onOpen,onPlay=()=>{}}){
  let jobs=[],timer=null,loading=false;const rendered=new Map(),selectedExports=new Map();
  const bundleButton=document.getElementById('bundleSelected');
  const selectionNote=document.createElement('p');selectionNote.className='bundle-selection-note';selectionNote.setAttribute('role','status');bundleButton.after(selectionNote);
  const clearSelection=document.createElement('button');clearSelection.type='button';clearSelection.textContent='Clear selection';clearSelection.hidden=true;selectionNote.before(clearSelection);clearSelection.onclick=()=>{selectedExports.clear();syncSelection()};
  function syncSelection(){const project=selectedExports.values().next().value;for(const box of panel.querySelectorAll('[data-bundle-export]')){box.checked=selectedExports.has(box.dataset.bundleExport);box.disabled=Boolean(project&&box.dataset.project!==project);box.closest('label').title=box.disabled?'Clear this selection to choose exports from another project.':''}bundleButton.disabled=!selectedExports.size;bundleButton.textContent='Download selected ZIP'+(selectedExports.size?' ('+selectedExports.size+')':'');clearSelection.hidden=!selectedExports.size;selectionNote.textContent=selectedExports.size?'One project per ZIP. Clear the selection to choose another project.':''}
  panel.onchange=event=>{const box=event.target.closest('[data-bundle-export]');if(!box)return;if(box.checked&&selectedExports.size&&selectedExports.values().next().value!==box.dataset.project){box.checked=false;status.textContent='Select exports from one project for each ZIP.';return}if(box.checked)selectedExports.set(box.dataset.bundleExport,box.dataset.project);else selectedExports.delete(box.dataset.bundleExport);syncSelection()};
  bundleButton.onclick=async()=>{if(!selectedExports.size)return;bundleButton.disabled=true;try{await requestJson('/api/bundles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:selectedExports.values().next().value,exportIds:[...selectedExports.keys()],includeSubtitles:true,name:'Context Desk clips'})});await refresh()}catch(error){status.textContent=error.message}finally{bundleButton.disabled=!selectedExports.size}};
  function render(data){
    jobs=data.jobs;counts.innerHTML=Object.entries(data.counts).map(([key,n])=>`<div><strong>${n}</strong><span>${escape(key)}</span></div>`).join('');
    if(!jobs.length){panel.innerHTML='<div class="library-empty"><h3>Your queue is clear.</h3><p>Add one or several recordings. Processing continues while you edit, and completed results stay saved here.</p></div>';return}
    panel.querySelector('.library-empty')?.remove();
    // Keep completed rows mounted while another job reports progress. A poll
    // must never stop an export preview, close its controls or reset playback.
    for(const j of jobs.slice().reverse()){
      const signature=JSON.stringify(j);if(rendered.get(j.id)===signature)continue;
      const template=document.createElement('template');template.innerHTML=jobMarkup(j);const row=template.content.firstElementChild,current=panel.querySelector(`[data-job-row="${j.id}"]`);
      if(current)current.replaceWith(row);else{
        const following=jobs.filter(other=>other.createdAt<j.createdAt).sort((a,b)=>b.createdAt-a.createdAt).map(other=>panel.querySelector(`[data-job-row="${other.id}"]`)).find(Boolean);
        panel.insertBefore(row,following||null);
      }rendered.set(j.id,signature);const selected=panel.querySelector(`[data-bundle-export="${j.id}"]`);if(selected)selected.checked=selectedExports.has(j.id);
    }
    syncSelection();
  }
  panel.onclick=async event=>{
    const share=event.target.closest('[data-share-file]');if(share){const job=jobs.find(j=>j.id===share.dataset.shareFile),note=share.closest('.social-handoff').querySelector('[data-share-status]');share.disabled=true;try{if(!job?.output||job.output.size>100*1024*1024)throw Error('Download this video instead. File sharing is limited to 100 MB.');note.textContent='Preparing file…';const response=await fetch(job.output.url);if(!response.ok)throw Error('Could not read the saved export. Download it instead.');const file=new File([await response.blob()],job.sourceName+'.mp4',{type:job.output.type});if(!navigator.canShare?.({files:[file]}))throw Error('This browser cannot share video files. Use Download video.');await navigator.share({files:[file],title:job.sourceName});note.textContent='Share sheet closed. Check the destination app to finish posting.'}catch(error){note.textContent=error.name==='AbortError'?'Sharing cancelled. Your export is still saved.':error.message}finally{share.disabled=false}return}
    const open=event.target.closest('[data-open]');if(open){await onOpen(open.dataset.open);return}
    const button=event.target.closest('[data-job]');if(!button)return;button.disabled=true;
    try{await requestJson('/api/'+button.dataset.base+'/'+button.dataset.job,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:button.dataset.action})});await refresh()}catch(error){status.textContent=error.message;button.disabled=false}
  };
  panel.addEventListener('play',event=>{if(event.target.tagName==='VIDEO'){document.querySelectorAll('video').forEach(video=>{if(video!==event.target)video.pause()});onPlay(event.target)}},true);
  async function refresh(){
    clearTimeout(timer);if(loading)return;loading=true;
    try{const data=await requestJson('/api/jobs');render(data);status.textContent='Saved on this computer. Waiting jobs run one at a time per worker.';await onJobs(data.jobs)}catch(error){status.textContent='Progress connection lost. Your saved work is kept: '+error.message}
    finally{loading=false;timer=setTimeout(()=>void refresh(),jobs.some(j=>['queued','running'].includes(j.status))?1800:6000)}
  }
  return {refresh,get jobs(){return jobs}};
}
