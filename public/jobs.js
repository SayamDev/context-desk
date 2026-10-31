import {requestJson} from './projects.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function jobMarkup(j){
  const exporting=j.kind==='export',discovery=j.kind==='discovery',active=j.status==='running',waiting=j.status==='queued';
  const resume=!j.legacyReadOnly&&['paused','error','interrupted','cancelled'].includes(j.status),base=exporting?'exports':discovery?'discovery':'subtitles';
  const progress=exporting?j.completedSeconds/j.duration:discovery?(j.sectionsDone+j.checksDone)/(j.sectionsTotal+j.checksTotal):j.sectionsDone/j.sectionsTotal;
  const action=(name,label)=>`<button data-job="${j.id}" data-base="${base}" data-action="${name}">${label}</button>`;
  const open=exporting?j.output?`<a href="${escape(j.output.url)}" download="${escape(j.sourceName)}.${j.output.type==='video/webm'?'webm':'mp4'}">Download video</a>${j.srt?`<a href="${escape(j.srt.url)}" download="context-desk.srt">Download SRT</a>`:''}`:'':discovery?`<button data-open="${j.projectId}">Open clips</button>`:j.cueCount?`<a href="/api/subtitles/${j.id}/srt">Download draft SRT</a>`:'';
  return `<article class="job-row" data-job-row="${j.id}">
    <div class="job-title"><span>${exporting?'VIDEO EXPORT':discovery?'STORY DISCOVERY':'SUBTITLE TRACK'}${j.language?' · '+escape(j.language):''}</span><h3>${escape(j.sourceName)}</h3><b class="job-state">${escape(j.status)}${j.queuePosition?' · position '+j.queuePosition:''}</b></div>
    <div class="job-progress"><p>${escape(j.phase)}</p><progress max="1" value="${Number.isFinite(progress)?progress:0}"></progress><p>${j.sectionsDone}/${j.sectionsTotal} ${exporting?'rendered clips':discovery?'picture samples':'sections'} · ${j.sectionsRemaining} remaining${discovery?' · '+j.checksDone+'/'+j.checksTotal+' story checks · '+j.suggested+' supported moments':''}</p>
      ${exporting?'':`<small>${j.speechRequests} speech · ${discovery?j.storyRequests+' story · ':''}${j.translationRequests} translation requests</small>`}
      ${j.output?`<details class="export-preview"><summary>Preview finished video</summary><video src="${escape(j.output.url)}" controls playsinline preload="metadata"></video></details>`:''}
      ${j.error?`<p class="job-error">${escape(j.error)}</p>`:''}
    </div><div class="job-actions">${open}${active||waiting?action('pause','Pause'):''}${resume?action('resume',j.inFlight?'Retry unfinished section':'Resume'):''}${waiting?action('first','Move first'):''}${active||waiting||resume&&j.status!=='cancelled'?action('cancel','Cancel'):''}</div>
  </article>`;
}
export function createJobsView({panel,counts,status,onJobs,onOpen,onPlay=()=>{}}){
  let jobs=[],timer=null,loading=false;const rendered=new Map();
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
      }rendered.set(j.id,signature);
    }
  }
  panel.onclick=async event=>{
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
