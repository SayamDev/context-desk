import {requestJson} from './projects.js';
import {usableMoments} from './workspaces.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const duration=seconds=>{
  const total=Math.max(0,Math.floor(Number(seconds)||0));
  const minutes=Math.floor(total/60),remainder=String(total%60).padStart(2,'0');
  return minutes>=60?Math.floor(minutes/60)+':'+String(minutes%60).padStart(2,'0')+':'+remainder:minutes+':'+remainder;
};
const hasFullVideo=project=>Boolean(project.sourceId&&project.status==='ready'&&!project.trashed);
const clipsLabel=count=>count+' saved '+(count===1?'clip':'clips');
function projectCover(project,featured=false){
  const full=hasFullVideo(project);
  const label=full?'Watch full video':'Open project';
  const image=project.thumbnail?'<img src="'+escape(project.thumbnail)+'" alt="" loading="lazy">':'<span class="cd-thumb-fill"></span>';
  return `<button type="button" class="${featured?'home-session-image':'home-project-image'}" data-home-open="${project.id}" data-home-view="${full?'full':'clips'}" aria-label="${label}: ${escape(project.title)}">${image}<span class="home-project-duration">${full?'Full video · '+duration(project.duration):'Open project'}</span></button>`;
}
function projectClips(project){
  return project.clipCount?`<button type="button" class="cd-btn cd-btn-secondary home-view-clips" data-home-open="${project.id}" data-home-view="clips">View ${clipsLabel(project.clipCount)}</button>`:'<p>No clips saved yet.</p>';
}

export function createHome({navigate,openProject,getCurrent,openTrash,intent=()=>'clips',onIntent=()=>{}}){
  const $=id=>document.getElementById(id),panel=document.createElement('section');panel.id='homePanel';panel.className='home-panel';panel.setAttribute('aria-label','Home');
  panel.innerHTML=`<section class="home-start"><div class="home-start-copy"><h1>Make clips from<br><span class="home-accent">long videos.</span></h1><p>Find moments in a recording or live stream, then trim, subtitle and export your picks.</p><fieldset class="home-intent"><legend>What do you want to make?</legend><label><input type="radio" name="homeIntent" value="clips"> Clips</label><label><input type="radio" name="homeIntent" value="translate"> Subtitles for the whole video</label></fieldset><p class="home-intent-note" id="homeIntentNote" aria-live="polite"></p><div id="homeImport"></div><div id="homeSourceActions" class="home-source-actions"></div><button type="button" class="home-guide-link" data-open-desk-guide>How to make your first clip</button></div><div class="home-feature"><section class="home-story-board" aria-labelledby="homeStoryTitle"><h2 id="homeStoryTitle">What makes a clip?</h2><ol><li><strong>Setup</strong><span>Give viewers a reason to care.</span></li><li><strong>Turn</strong><span>Find the line or reaction that changes things.</span></li><li><strong>Payoff</strong><span>Keep what happens next.</span></li></ol><button type="button" class="cd-btn cd-btn-secondary" data-open-desk-guide>Open the editing guide</button></section><div class="home-session" id="homeSession" hidden></div></div></section><button type="button" class="home-scroll-cue" id="homeScrollCue" hidden><span id="homeScrollCueText">Your projects</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14m-6-6 6 6 6-6"/></svg></button><section class="home-projects"><div class="home-section-heading"><div><h2>Pick up your story.</h2><p>Your recordings, captions and edits are saved on this computer.</p></div><div class="home-project-actions"><button id="homeAllProjects" type="button">All projects</button><button id="homeTrash" type="button" hidden>Trash</button></div></div><p id="homeStatus" role="status">Loading your projects…</p><div id="homeRecent" class="home-recent"></div></section>`;
  // Impact strip: measured counts, plus a time-saved estimate that states its assumption.
  const impact=document.createElement('div');impact.className='home-impact';impact.hidden=true;impact.setAttribute('aria-label','What you have made');panel.querySelector('.home-start-copy').append(impact);
  document.querySelector('.pagehead').before(panel);
  const moved=[$('linkForm'),$('fileInput').closest('label'),$('screenButton')].map(node=>{const anchor=document.createComment('canonical home/source control');node.before(anchor);return {node,anchor}});
  // Clips or whole-video subtitles: the same link box and upload, a different result after import.
  const notes={clips:'We find complete moments and turn them into clips.',translate:'We subtitle the whole video in the language set below, ready to watch and download (SRT, VTT). No clip scan.'};
  const applyIntent=value=>{for(const radio of panel.querySelectorAll('[name=homeIntent]'))radio.checked=radio.value===value;$('homeIntentNote').textContent=notes[value];onIntent(value)};
  panel.querySelector('.home-intent').onchange=event=>applyIntent(event.target.value);applyIntent(intent());
  $('homeAllProjects').onclick=()=>navigate('library');
  $('homeTrash').onclick=openTrash;
  // Saved projects sit below the fold on most screens; the projects shortcut stays available until they scroll into view.
  const projectsSection=panel.querySelector('.home-projects');let projectsSeen=false,projectCount=0;
  const syncCue=()=>{$('homeScrollCue').hidden=!projectCount||projectsSeen||panel.hidden};
  new IntersectionObserver(([entry])=>{projectsSeen=entry.isIntersecting;syncCue()},{threshold:.2}).observe(projectsSection);
  $('homeScrollCue').onclick=()=>{projectsSection.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});projectsSection.querySelector('[data-home-open]')?.focus({preventScroll:true})};
  let request=0;
  panel.onclick=async event=>{const button=event.target.closest('[data-home-open]');if(!button)return;button.disabled=true;try{await openProject(button.dataset.homeOpen,button.dataset.homeView)}catch(error){$('homeStatus').textContent='Could not open project: '+error.message}finally{button.disabled=false}};
  async function refreshImpact(){try{const d=await requestJson('/api/impact'),made=d.shorts+d.exports;impact.hidden=!made;if(!made)return;
    const stat=(value,label)=>`<div class="home-impact-stat"><strong>${escape(value)}</strong><span>${escape(label)}</span></div>`,hours=d.estimatedMinutesSaved/60;
    impact.innerHTML=stat(d.shorts,d.shorts===1?'live Short':'live Shorts')+(d.averageReadySeconds!=null?stat(d.averageReadySeconds+'s','average from moment to ready'):'')+stat(d.exports,d.exports===1?'clip exported':'clips exported')+stat((hours>=1?hours.toFixed(1)+' h':d.estimatedMinutesSaved+' min'),'editing saved (estimate)')+`<p class="home-impact-note">Estimate assumes ${escape(d.assumption)}.</p>`}catch{impact.hidden=true}}
  async function refresh(){void refreshImpact();const current=++request;$('homeStatus').textContent='Loading your projects…';try{const [{projects},{projects:trash}]=await Promise.all([requestJson('/api/projects?sort=updated&direction=desc'),requestJson('/api/projects?trash=1')]);if(current!==request)return;
    projectCount=projects.length;{const saved=`${projects.length} saved ${projects.length===1?'project':'projects'}`;$('homeScrollCueText').innerHTML=`<span class="home-cue-long">Pick up your story · </span>${saved}`}syncCue();
    $('homeStatus').replaceChildren(document.createTextNode(projects.length?'':trash.length?`${trash.length} saved ${trash.length===1?'project is':'projects are'} in Trash. `:'Your first project starts with a link or a video file.'));
    $('homeTrash').hidden=!trash.length;
    $('homeTrash').textContent=`Trash (${trash.length})`;
    $('homeRecent').innerHTML=projects.slice(0,4).map(project=>`<article class="home-project">${projectCover(project)}<div class="home-project-copy"><h3 dir="auto">${escape(project.title)}</h3>${projectClips(project)}</div></article>`).join('');
    const saved=getCurrent();
    const last=projects.find(project=>project.id===saved?.id)||projects[0];
    $('homeSession').hidden=!last;
    if(last){
      const picks=saved?.id===last.id?usableMoments(saved.state?.moments||[]).slice(0,3):[];
      $('homeSession').innerHTML=`${projectCover(last,true)}<div class="home-session-info"><h2 dir="auto">${escape(last.title)}</h2>${projectClips(last)}</div>${picks.length?`<div class="home-story-strip">${picks.map(moment=>`<span><b>${escape(moment.analysis?.beatType||'Moment')}</b>${escape(moment.hook||moment.analysis?.setup||'Review this source window')}</span>`).join('')}</div>`:''}`;
    }
  }catch(error){if(current===request)$('homeStatus').textContent='Projects could not load. '+error.message}}
  return {refresh,sync(view){const home=view==='home';panel.hidden=!home;syncCue();for(const [i,{node,anchor}]of moved.entries()){if(home)(i===0?$('homeImport'):$('homeSourceActions')).append(node);else anchor.after(node)}if(home){$('linkForm').querySelector('.link-launch-row').after($('homeSourceActions'));void refresh()}else $('homeImport').after($('homeSourceActions'));}};
}
