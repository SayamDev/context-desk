// First-visit intro: three short screens that say what Context Desk is for, what it can do and how to
// start. It opens once for someone with no projects; closing it in any way marks it as seen, and
// "Take the tour" on Home opens it again. The feature list is shared with Home's feature strip.
import {mountLoader} from './loader.js';

const icon=path=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
export const features=[
  {title:'Story clips, found for you',text:'Meta Muse Spark looks for a setup, a turn and a payoff, and cuts complete moments, not random seconds.',icon:icon('M4 5h16v14H4zM9 9l6 3-6 3z')},
  {title:'Arabic dialects in natural English',text:'Subtitles keep who says what to whom, with every unsure line flagged for you to check.',icon:icon('M4 6h9M8.5 4v2c0 4-2 7-4.5 8M6 10c1.5 2 3.5 3.5 6 4.5M13 20l4-9 4 9M14.5 17h5')},
  {title:'Culture notes on screen',text:'Slang, idioms and references explained in a line, so English viewers get the joke.',icon:icon('M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3zM9.5 20.5h5')},
  {title:'English dub in their own voices',text:'Each speaker is cloned from their own line and mixed under the original sound.',icon:icon('M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21')},
  {title:'Whole-episode tools',text:'Episode chapters, Ask the episode anything, and a one-minute trailer rendered for you.',icon:icon('M4 6h16M4 12h10M4 18h13M18 15l3 3-3 3')},
  {title:'Live stream clipping',text:'Clip YouTube, Twitch or Kick as it airs, with a monitor window and an alert for every new clip.',icon:icon('M5.5 8.5a8 8 0 0 0 0 7M18.5 8.5a8 8 0 0 1 0 7M8.5 10.5a4 4 0 0 0 0 3M15.5 10.5a4 4 0 0 1 0 3M12 12h.01')}
];
export const featureTiles=()=>features.map(f=>`<li class="cd-feature"><span class="cd-feature-icon">${f.icon}</span><strong>${f.title}</strong><span>${f.text}</span></li>`).join('');

const KEY='context-desk-welcomed';
export function createWelcome({onLink,onUpload,onLive}){
  const dialog=document.createElement('dialog');dialog.className='welcome';dialog.setAttribute('aria-labelledby','welcomeTitle');
  dialog.innerHTML=`<button type="button" class="welcome-close" aria-label="Close the intro">${icon('M6 6l12 12M18 6L6 18')}</button>
    <section class="welcome-step" data-step="0"><div class="welcome-mark" aria-hidden="true"></div><p class="welcome-kicker">Welcome to Context Desk</p>
      <h2 id="welcomeTitle">Arabic reality TV, <span class="home-accent">ready for English feeds.</span></h2>
      <p class="welcome-lead">Paste an episode or a live stream. Context Desk finds the moments that tell a story, subtitles them in natural English and explains the culture, ready to post.</p>
      <ol class="welcome-flow"><li><b>1</b><span>Paste a link or upload a video</span></li><li><b>2</b><span>Meta Muse finds the story moments</span></li><li><b>3</b><span>Check the English, then export</span></li></ol></section>
    <section class="welcome-step" data-step="1" hidden><p class="welcome-kicker">What it can do</p><h2>Everything a clip needs, in one place.</h2><ul class="cd-features welcome-features">${featureTiles()}</ul></section>
    <section class="welcome-step" data-step="2" hidden><p class="welcome-kicker">Start your first clip</p><h2>Where is your video?</h2>
      <div class="welcome-start"><button type="button" class="welcome-choice" data-start="link">${icon('M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1')}<strong>Paste a link</strong><span>YouTube, or a page with the video</span></button>
        <button type="button" class="welcome-choice" data-start="upload">${icon('M12 16V4M7 9l5-5 5 5M4 16v4h16v-4')}<strong>Upload a video</strong><span>An episode file, up to 6 hours</span></button>
        <button type="button" class="welcome-choice" data-start="live">${icon('M5.5 8.5a8 8 0 0 0 0 7M18.5 8.5a8 8 0 0 1 0 7M8.5 10.5a4 4 0 0 0 0 3M15.5 10.5a4 4 0 0 1 0 3M12 12h.01')}<strong>Clip a live stream</strong><span>Paste the YouTube, Twitch or Kick link</span></button></div>
      <p class="welcome-note">Your projects stay on this computer. Meta receives the audio and sampled frames it needs to understand the video.</p></section>
    <footer class="welcome-nav"><div class="welcome-dots" aria-hidden="true"><i></i><i></i><i></i></div><button type="button" class="cd-btn cd-btn-ghost" data-welcome="back">Back</button><button type="button" class="cd-btn cd-btn-primary" data-welcome="next" autofocus>Next</button></footer>`;
  document.body.append(dialog);
  const steps=[...dialog.querySelectorAll('.welcome-step')],dots=[...dialog.querySelectorAll('.welcome-dots i')],back=dialog.querySelector('[data-welcome=back]'),next=dialog.querySelector('[data-welcome=next]');let step=0;
  function show(n){step=Math.max(0,Math.min(steps.length-1,n));steps.forEach((s,i)=>{s.hidden=i!==step});dots.forEach((d,i)=>d.classList.toggle('is-on',i===step));back.hidden=step===0;next.textContent=step===steps.length-1?'Explore on my own':'Next';steps[step].querySelector('h2')?.focus?.()}
  // Seen is saved at once, not on the close event, which a file picker opening right after can delay.
  const markSeen=()=>{try{localStorage.setItem(KEY,'1')}catch{/* Shown again next time when storage is blocked. */}};
  const close=()=>{markSeen();if(dialog.open)dialog.close()};
  back.onclick=()=>show(step-1);
  next.onclick=()=>step===steps.length-1?close():show(step+1);
  dialog.querySelector('.welcome-close').onclick=close;
  dialog.addEventListener('close',markSeen);
  dialog.addEventListener('click',event=>{if(event.target===dialog)close()});
  dialog.querySelector('.welcome-start').onclick=event=>{const choice=event.target.closest('[data-start]')?.dataset.start;if(!choice)return;close();({link:onLink,upload:onUpload,live:onLive})[choice]?.()};
  function open(){show(0);if(!dialog.open)dialog.showModal();mountLoader(dialog.querySelector('.welcome-mark'))}
  // Only for someone new: an editor with projects already knows their way around.
  function maybeShow(hasProjects){let seen=false;try{seen=localStorage.getItem(KEY)==='1'}catch{/* Treat as new. */}if(!seen&&!hasProjects)open()}
  return {open,maybeShow};
}
