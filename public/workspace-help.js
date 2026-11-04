const helpTopics={
  home:['Start with a recording','Paste a video link or upload a file. Choose Clips to find moments, or Subtitles for the whole video to caption the full recording. For a broadcast in progress, use Clip live and share the tab with audio.'],
  library:['Pick up a project','Open a saved recording to see its Clips, Full video, Studio and Exports. Start a separate recording with New project.'],
  source:['Add your source','Paste a link or upload a video. For a live stream, share the playing tab with audio, check the frame and start clipping.'],
  clips:['Choose a moment','Open a suggestion to watch it with its source context. The Moment Map shows which parts of the recording have been checked. Open a clip in Studio to edit it.'],
  edit:['Review before you export','Play the clip, adjust the start and end, and check subtitles against the speech. Use Style for framing and captions, then Export clip to render the video.'],
  full:['Work with the whole recording','Use this view to watch the original video, review its subtitles or jump to chapter timestamps. Use Clips for shorter edits.'],
  exports:['Find the finished file','Open Watch video to check the result, Download video to save it, or Publish to choose a destination. Subtitle and chapter files go with the matching video.'],
  jobs:['Follow work in the background','Check what’s processing or needs attention. Use Exports to collect finished files. The bell flags new results as they arrive.'],
  brand:['Save a reusable look','Choose your caption style and brand settings here. Apply the saved preset to a clip in Studio.']
};
const jobLabels={export:'Video export',subtitles:'Whole-video subtitles',discovery:'Clip discovery',creative:'Artwork',bundle:'ZIP download'};
const interesting=new Set(['complete','error','interrupted']);
const create=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text||''});
const storageKey='cd-workspace-notices';
export function mountWorkspaceHelp({navigate,openJob}){
  const utilities=document.querySelector('.top-actions'),main=document.querySelector('.main');
  const trigger=create('button','Guide');trigger.type='button';trigger.className='cd-btn cd-btn-sm cd-btn-secondary desk-guide-trigger';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','deskGuide');
  const guide=create('section');guide.id='deskGuide';guide.className='desk-guide';guide.hidden=true;guide.setAttribute('aria-labelledby','deskGuideTitle');
  guide.innerHTML='<div class="desk-guide-intro"><div><h2 id="deskGuideTitle" tabindex="-1">How to use Context Desk</h2><p id="deskGuideContext"></p></div><button type="button">Close guide</button></div><ol class="desk-guide-path"><li><strong>Add video</strong><span>Paste a link, upload or connect live.</span></li><li><strong>Pick a clip</strong><span>Watch the moment in context.</span></li><li><strong>Edit in Studio</strong><span>Trim and check the subtitles.</span></li><li><strong>Open Exports</strong><span>Watch, download or publish.</span></li></ol>';
  const top=main.querySelector('.topbar');if(top)top.after(guide);else main.prepend(guide);
  function syncGuide(){const [title,copy]=helpTopics[document.body.dataset.workspace]||helpTopics.home;guide.querySelector('#deskGuideContext').textContent=title+' — '+copy}
  function toggleGuide(open){guide.hidden=!open;trigger.setAttribute('aria-expanded',String(open));if(open){syncGuide();guide.querySelector('h2').focus()}else trigger.focus()}
  trigger.onclick=()=>toggleGuide(guide.hidden);guide.querySelector('button').onclick=()=>toggleGuide(false);
  document.querySelector('.home-panel')?.addEventListener('click',event=>{if(event.target.closest('[data-open-desk-guide]'))toggleGuide(true)});
  const bell=create('button');bell.type='button';bell.className='cd-btn cd-btn-sm cd-btn-secondary desk-bell';bell.setAttribute('popovertarget','deskNotices');
  bell.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
  const badge=create('span');badge.className='desk-notice-count';badge.setAttribute('aria-hidden','true');bell.append(badge);utilities.prepend(trigger,bell);
  const pop=create('section');pop.id='deskNotices';pop.className='desk-notices';pop.setAttribute('popover','auto');pop.setAttribute('aria-labelledby','deskNoticeTitle');
  pop.innerHTML='<header><h2 id="deskNoticeTitle">Notifications</h2><button type="button" data-read-all>Mark all read</button></header><p data-notice-empty></p><ul></ul><button type="button" data-open-activity>View Activity</button>';
  document.body.append(pop);
  const read=pop.querySelector('[data-read-all]'),list=pop.querySelector('ul'),empty=pop.querySelector('[data-notice-empty]');
  const announce=create('div');announce.className='sr-only';announce.setAttribute('role','status');document.body.append(announce);
  let entries=[],previous=null;
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))entries=saved.slice(0,20)}catch{}
  function render(){
    const unread=entries.filter(item=>!item.read).length;
    badge.textContent=String(unread);badge.hidden=!unread;bell.setAttribute('aria-label',unread?'Notifications, '+unread+' unread':'Notifications');read.disabled=!unread;
    empty.hidden=Boolean(entries.length);empty.textContent='No new updates. Finished work and items that need attention will appear here.';
    list.replaceChildren(...entries.map(entry=>{
      const row=create('li'),button=create('button');button.type='button';button.append(create('strong',entry.title),create('span',entry.name+(entry.read?'':' · Unread')));
      button.onclick=async()=>{button.disabled=true;try{await openJob(entry.job);entry.read=true;pop.hidePopover();save()}catch{announce.textContent='Could not open that project.';empty.hidden=false;empty.textContent='Could not open that project. You can still check Activity.';button.disabled=false}};
      row.append(button);return row;
    }));
  }
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(entries))}catch{}render()}
  read.onclick=()=>{for(const entry of entries)entry.read=true;save();pop.querySelector('[data-open-activity]').focus()};
  pop.querySelector('[data-open-activity]').onclick=()=>{pop.hidePopover();navigate('jobs')};
  render();
  return {syncGuide,update(jobs){
    const current=new Map(jobs.map(job=>[job.id,job.status]));if(!previous){previous=current;return}
    const fresh=[];
    for(const job of jobs){
      if(!jobLabels[job.kind]||!interesting.has(job.status)||previous.get(job.id)===job.status)continue;
      if(job.status==='complete'&&job.kind==='export'&&!job.output)continue;
      const key=job.id+':'+job.status;
      if(entries.some(entry=>entry.key===key))continue;
      const title=jobLabels[job.kind]+(job.status==='complete'?' ready':' needs attention');
      fresh.push({key,title,name:job.clipTitle||job.sourceName||job.title||'Context Desk',job:{id:job.id,kind:job.kind,status:job.status,projectId:job.projectId},read:false});
    }
    previous=current;if(!fresh.length)return;
    entries=[...fresh,...entries].slice(0,20);announce.textContent=fresh.length===1?fresh[0].title:fresh.length+' new workspace updates';save();
  }};
}
