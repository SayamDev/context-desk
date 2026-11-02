// Beginner guide: four steps from a video to a post, with one clear next action at a time.
// The steps are worked out from what the project already contains, so the guide never asks
// for something that is already done. Simple mode folds advanced panels away; nothing is removed.
export const guideSteps=[
  {id:'video',label:'Add a video'},
  {id:'clip',label:'Pick a clip'},
  {id:'subtitles',label:'Check English subtitles'},
  {id:'post',label:'Prepare the post'}
];
// state: {hasSource, finding, clips, selected, toCheck, reviewed, exported}
export function guideStatus(state){
  const s=state||{};
  if(!s.hasSource)return {step:0,action:'add-video',cta:'Add a video',hint:'Paste a YouTube, Twitch or Kick link, or upload a file.'};
  if(!s.clips)return s.finding?{step:1,action:null,cta:'Finding clips…',hint:'Clips appear here as soon as they are ready. You can keep working.'}:{step:1,action:'find-clips',cta:'Find clips',hint:'We look for complete moments with a clear start and finish.'};
  if(!s.selected)return {step:1,action:'open-clip',cta:'Open the top clip',hint:`${s.clips} ${s.clips===1?'clip is':'clips are'} ready. The top one has the strongest evidence.`};
  if(!s.reviewed)return {step:2,action:'check-subtitles',cta:s.toCheck?`Check subtitles · ${s.toCheck} ${s.toCheck===1?'line needs':'lines need'} a look`:'Check the subtitles',hint:'Read each line against the speech, fix anything wrong, then tick “I checked every line”.'};
  if(!s.exported)return {step:3,action:'prepare-post',cta:'Prepare the post',hint:'Choose where it goes. We size it, keep text in the safe area and write a caption.'};
  return {step:4,action:'prepare-post',cta:'Post it yourself',hint:'Your video is saved. Posting happens in the platform’s own app or website; nothing is posted for you.'};
}
export function createGuide({getState,run}){
  const bar=document.createElement('nav');bar.className='guide';bar.setAttribute('aria-label','Your progress');
  const list=document.createElement('ol');list.className='guide-steps';
  const side=document.createElement('div');side.className='guide-side';
  const hint=document.createElement('p');hint.className='guide-hint';
  const next=document.createElement('button');next.type='button';next.className='cd-btn cd-btn-secondary guide-next';// Secondary: each screen keeps its own single primary action.
  const simple=document.createElement('label');simple.className='guide-simple';const box=document.createElement('input');box.type='checkbox';simple.append(box,' Simple mode');
  side.append(hint,next,simple);bar.append(list,side);
  let stored=null;try{stored=localStorage.getItem('context-desk-simple')}catch{/* Storage can be blocked; Simple mode defaults on. */}
  box.checked=stored!=='off';document.body.classList.toggle('simple-mode',box.checked);
  box.onchange=()=>{document.body.classList.toggle('simple-mode',box.checked);try{localStorage.setItem('context-desk-simple',box.checked?'on':'off')}catch{/* Not remembered this time. */}};
  let action=null;next.onclick=()=>{if(action)run(action)};
  function render(){
    const status=guideStatus(getState());action=status.action;
    list.replaceChildren(...guideSteps.map((step,i)=>{const li=document.createElement('li');li.className=i<status.step?'is-done':i===status.step?'is-current':'';if(i===status.step)li.setAttribute('aria-current','step');
      const n=document.createElement('span');n.className='guide-n';n.textContent=i<status.step?'✓':String(i+1);n.setAttribute('aria-hidden','true');li.append(n,document.createTextNode(step.label));return li}));
    next.textContent=status.cta;next.disabled=!status.action;hint.textContent=status.hint;
  }
  return {element:bar,render};
}
