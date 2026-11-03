import {createConnections} from './connections.js';
import {createDiscoveryTools} from './discovery-tools.js';
import {createLiveControls} from './live-controls.js';
import {badge,scoreMeter,createBulkBar,keepKbd,enhanceSegmented,enhanceCaptionLooks,createCommandPalette,toast,el,kbd,createTrim,audioPeaks,formatTime as clock} from './ds.js';
import {mountShell} from './shell.js';
import {createLiveBuffer} from './live-buffer.js';
import {frameFocus,splitGeometry} from './reframe-track.js';
import {lineIssues,dominantScript} from './subtitle-qa.js';
import {accentFor} from './caption-accents.js';
import {displayCues,captionModes,overlapIndexes} from './caption-display.js';
import {drawCaptionFrame} from './caption-render.js';
import {captionStyles,captionStyleIds} from './caption-styles.js';
import {cleanCuts,fillerCuts,removedSeconds,skipCut} from './silence.js';
import {createProductionTools} from './production-tools.js';
import {createHome} from './home.js';
import {createEditorTools} from './editor-tools.js';
import {createBrandControls} from './brand-controls.js';
import {cleanCaptionLook,captionFontSize,captionPlacement} from './brand-kit.js';
import {workspaceFromHash,workspaceHash,usableMoments} from './workspaces.js';
import {createGuide} from './guide.js';
import {thoughtCheck,findQuotes} from './clip-boundaries.js';
import {enhanceDestinations} from './destinations.js';
import {mountLayout,icon,setButtonLabel} from './layout.js';
import {clipState,visibleMoments,coverageSummary,sourcePosition,clampTrim,momentLanes} from './studio-ui.js';
import {createHistory,splitEdits} from './history.js';
import {languageBias,speechLanguages,dialectExamples} from './languages.js';
import {captionLanguages,captionVariants,romanizations,findVariant} from './locales.js';
import {createMemoryView} from './story-memory.js';
import {createJobsView} from './jobs.js';
import {mergeAnalysisCompletion} from './moment-results.js';
import {createProjectSession,recoverBrowserMoments,settingIds,savedMomentKeys,requestJson} from './projects.js';
import {createTranslationCache,translationKey} from './translation-cache.js';
import {syncedCues,shouldRestart,speechCues,srtDocument} from './timing.js';
import {assignMediaSource,bindPlayerControls} from './player.js';
import {captionTarget,inheritCaptionTarget,commitCaptionTranslation,translationQueue,outputLanguages,projectTrack} from './caption-policy.js';
import {socialPresets,socialExportIssue,lengthAdvice,crossPostTargets,hashtagCount,hashtagLimit,draftPostCaption,composePostCaption} from './social.js';
const $ = id => document.getElementById(id);
const program=$('program'), clipVideo=$('clipVideo'), stageCanvas=$('stageCanvas');
const state={sourceLoadToken:0,sourceUploadAbort:null,source:null,sourceName:'',sourceType:null,sourceUrl:null,screenStream:null,stageCrop:null,cropDraft:null,cropPicking:false,resumeAfterCrop:false,autoFrameJob:0,liveEpoch:0,recordStream:null,recording:null,scanning:false,windowTimer:null,frameTimer:null,moments:[],selected:null,cut:[],cutPreviewIndex:-1,cutPreviewBusy:false,lastDraftStart:-1,aspect:'landscape',meta:false,windowCount:0,aiCalls:0,staticSilentWindows:0,captureStalled:false,batchId:null,batchRunning:false,batchCancel:false,batchExporting:false,batchExports:[]};
let projectSession=null;const activities=new Map();
function setActivity(id,title,detail){activities.set(id,{title,detail,started:activities.get(id)?.started||Date.now()});renderActivity()}
function finishActivity(id){activities.delete(id);renderActivity()}
function renderActivity(){const current=[...activities.values()].at(-1);$('activityPanel').hidden=!current;if(!current)return;{const id=[...activities.keys()].at(-1),cancel=$('cancelImport'),btn=$('activityCancel');if(btn)btn.hidden=!(id==='import'&&cancel&&!cancel.hidden)}$('activityTitle').textContent=current.title;$('activityDetail').textContent=current.detail;$('activityElapsed').textContent=clock((Date.now()-current.started)/1000)}
setInterval(()=>{if(activities.size)renderActivity()},1000);
let renderHookLab=()=>{},syncAccents=()=>{},syncCaptionVariant=()=>{},syncLinkDrop=()=>{};const clipSelection=new Set(),shownScores=new Set();let bulkBar=null,visibleClipIds=[],lastSelected=null,inspectedId=null;
let layout=null,homeView=null,discoveryTools=null,liveControls=null,liveBuffer=null,connectionsView=null,libraryView='list',startupNavigation=true;const entryWorkspace=workspaceFromHash(location.hash);let requestedWorkspace=entryWorkspace;
function showWorkspace(view){
  if(startupNavigation&&projectSession?.restoring)view=requestedWorkspace;
  if(view==='edit'&&!state.selected)view='home';
  window.scrollTo({top:0});document.body.dataset.workspace=view;layout?.syncWorkspace(view);homeView?.sync(view);liveControls?.sync();liveBuffer?.sync();connectionsView?.sync();discoveryTools?.sync();
  if(!startupNavigation&&location.hash!==workspaceHash(view))history.pushState({workspace:view},'',workspaceHash(view));
  document.querySelectorAll('.workspace-nav button').forEach(button=>{if(button.dataset.workspace===view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')});
  const content={home:['Home','Start a recording or pick up a saved story.'],library:['Library','Your recordings, moments and edits.'],jobs:['Exports & activity','Processing progress and finished files.'],source:['Start a new story.','Paste a link or upload a recording. Clips appear as processing finishes.'],clips:['Clips','Find a story worth sharing. Every suggestion links back to the source.'],edit:['Studio','Your footage. Your words. Your final cut.']}[view];
  $('workspaceTitle').textContent=content[0];$('workspaceDescription').textContent=content[1];
  if(view!=='edit')clipVideo.pause();if(!['clips','source'].includes(view)&&state.sourceType==='file')program.pause();
  if(view==='library')void renderLibrary();projectSession?.changed();
}
function navigateWorkspace(view){requestedWorkspace=view;if(startupNavigation){showWorkspace(view);return}if(view==='edit'&&state.selected){if(document.body.dataset.workspace==='edit')return;return selectMoment(state.selected)}showWorkspace(view)}
document.querySelectorAll('.workspace-nav button').forEach(button=>button.onclick=()=>navigateWorkspace(button.dataset.workspace));
$('backToClips').onclick=()=>showWorkspace('clips');
const quickLanguages=document.createElement('div');quickLanguages.className='language-quick';for(const id of ['speechLanguage','liveCaptionLanguage']){const label=$(id).closest('label');if(id==='liveCaptionLanguage')label.firstChild.textContent='Output subtitles ';quickLanguages.append(label)}$('linkForm').querySelector('.link-launch-row').after(quickLanguages);
layout=mountLayout({navigate:navigateWorkspace,onFilter:()=>renderQueue(false),onView:view=>{libraryView=view;layout.setLibraryView(view);void saveLibraryPreferences()},onTrim:(edge,value)=>{const m=state.moments.find(m=>m.id===state.selected);if(!m)return;performEdit('trim-'+edge,()=>{const range=clampTrim(edge,value,m.trimIn,m.trimOut,m.end-m.start);$('trimIn').value=range.in;$('trimOut').value=range.out;validateTrim();layout.syncTimeline(m,formatTime)})},onSource:()=>reviewSource(state.selected)});
let importIntent='clips',pendingIntent='clips';try{if(localStorage.getItem('cd-intent')==='translate')importIntent='translate'}catch{/* Clips stay the default. */}
homeView=createHome({intent:()=>importIntent,onIntent:value=>{importIntent=value==='translate'?'translate':'clips';try{localStorage.setItem('cd-intent',importIntent)}catch{/* Not remembered when storage is blocked. */}document.body.dataset.intent=importIntent;$('openStream').replaceChildren(document.createTextNode(importIntent==='translate'?'Subtitle video →':'Make clips →'))},navigate:navigateWorkspace,openTrash:()=>{$('showProjectTrash').checked=true;showWorkspace('library')},getCurrent:()=>projectSession?.current,openProject:async id=>{setActivity('project-open','Opening your project','Restoring your video and saved edits…');try{await projectSession.open(id);navigateWorkspace(state.selected?'edit':'clips')}finally{finishActivity('project-open')}}});
const editorTools=createEditorTools({select:selectMoment,getSelected:()=>state.moments.find(m=>m.id===state.selected),edit:performEdit,draw:drawPreview});
const brandControls=createBrandControls({getSelected:()=>state.moments.find(m=>m.id===state.selected),edit:performEdit,draw:()=>{editorTools.sync(state.moments.find(m=>m.id===state.selected));drawPreview()}});
discoveryTools=createDiscoveryTools({requestJson:async(url,options)=>{if(url==='/api/moment-search')await projectSession.flush();return requestJson(url,options)},getProject:()=>projectSession?.current?{...projectSession.current,state:{...projectSession.current.state,aiCalls:state.aiCalls}}:null,getSelected:()=>state.moments.find(m=>m.id===state.selected),getMoments:()=>state.moments,onSelect:selectMoment,onMessage:message,onChanged:()=>projectSession?.changed(),onTranscriptEdit:async(result,source)=>{const before=editSnapshot();for(const segment of result.segments){segment.splitCreated=true;segment.manual=true;segment.status='manual';splitOriginals.set(segment.id,structuredClone(segment));state.moments.push(segment)}const ids=result.segments.map(m=>m.id),position=state.cut.indexOf(source.id);if(position>=0)state.cut.splice(position,1,...ids);else state.cut.push(...ids);state.selected=ids[0];editHistory.record(before,editSnapshot(),'transcript-cut');projectSession.changed();renderQueue();renderBatchResults();renderCut();await selectMoment(ids[0],{scroll:false});message(`${ids.length} editable segment${ids.length===1?'':'s'} added to your Story cut. Original footage and captions are retained.`)}});
liveBuffer=createLiveBuffer({getUrl:()=>$('streamUrl')?.value,getRecording:()=>state.source?.importId?{id:state.source.importId,title:state.sourceName||'',time:program.currentTime}:null,onMessage:message});liveBuffer.sync();
enhanceSegmented($('aspectSelect'),{label:'Format',labels:{portrait:['9:16','TikTok'],square:'1:1 Feed'.split(' '),fourfive:['4:5','Feed'],landscape:['16:9','YouTube']},order:['portrait','square','fourfive','landscape']});
// Beginner guide: progress is read from the project; each Next action jumps to the right place.
{const guide=createGuide({
  getState:()=>{const m=state.moments.find(x=>x.id===state.selected),clips=usableMoments(state.moments).length;
    const toCheck=m?activeCues(m).filter(c=>c.uncertain).length+(Number($('captionLineCount')?.textContent.match(/(\d+) to check/)?.[1])||0):0;
    return {hasSource:Boolean(state.source||state.moments.length),finding:Boolean(state.batchRunning||state.moments.some(x=>x.status==='analysing')),clips,selected:Boolean(m),toCheck,reviewed:Boolean(m?.captionReviewed?.[m.captionLanguage]),exported:Boolean(m?.exportedAt)}},
  run:async action=>{
    if(action==='add-video'){showWorkspace('home');$('streamUrl')?.focus();return}
    if(action==='find-clips'){if(!$('batchButton').disabled)$('batchButton').click();else showWorkspace('clips');return}
    if(action==='open-clip'){const best=[...usableMoments(state.moments)].sort((a,b)=>(b.analysis?.score||0)-(a.analysis?.score||0))[0];if(best){await selectMoment(best.id);showWorkspace('edit')}return}
    showWorkspace('edit');
    if(action==='check-subtitles'){$('captionTab')?.click();const w=document.querySelector('.caption-workspace');if(w)w.open=true;if(!$('captionQaNext')?.hidden)$('captionQaNext').click();else $('captionLines')?.scrollIntoView({block:'start',behavior:'smooth'})}
    if(action==='prepare-post'){$('exportTab')?.click();$('socialDestination')?.closest('section,div')?.scrollIntoView({block:'start',behavior:'smooth'})}
  }});
  const host=document.querySelector('.pagehead')?.parentElement;host?.prepend(guide.element);guide.render();setInterval(guide.render,1000);
  // Setup check: lists anything missing on this computer, what it blocks, and the exact fix.
  void requestJson('/api/health').then(({checks})=>{const missing=checks.filter(c=>!c.ok);if(!missing.length)return;
    const box=Object.assign(document.createElement('section'),{className:'setup-check'});box.setAttribute('aria-label','Setup check');
    box.append(Object.assign(document.createElement('h2'),{textContent:missing.some(c=>c.needed)?'Finish setting up this computer':'Optional extras you can turn on'}),
      ...missing.map(c=>{const row=document.createElement('div');row.className='setup-item'+(c.needed?' is-needed':'');row.append(Object.assign(document.createElement('strong'),{textContent:c.label+(c.needed?'':' (optional)')}),Object.assign(document.createElement('span'),{textContent:'Needed for: '+c.blocks}),Object.assign(document.createElement('code'),{textContent:c.fix}));return row}),
      Object.assign(document.createElement('p'),{textContent:'Tip: run npm run setup in the project folder; it installs what it can and lists the rest.'}));
    guide.element.after(box)}).catch(()=>{});}
// Caption style list comes from the shared catalogue (caption-styles.js).
$('captionStyle').replaceChildren(...captionStyleIds.map(id=>new Option(captionStyles[id].label,id)));
enhanceCaptionLooks($('captionStyle'),{getLook:()=>state.moments.find(x=>x.id===state.selected)?.captionLook||{}});
{const pick=$('liveCaptionLanguage');for(const language of captionLanguages)if(![...pick.options].some(o=>o.value===language||o.textContent===language))pick.add(new Option(language,language));
  const auto=$('autoGenerate')?.closest('label');if(auto&&!$('autoWholeSubtitles')){const label=Object.assign(document.createElement('label'),{className:'auto-generate'}),box=Object.assign(document.createElement('input'),{type:'checkbox',id:'autoWholeSubtitles',checked:true});label.append(box,document.createTextNode(' Translate the whole recording into my subtitle language'));auto.after(label)}}
// Clip-length presets (design system SegmentedControl) sized into clip finding.
{const target=$('clipTarget')?.closest('label');if(target&&!$('clipLength')){const label=Object.assign(document.createElement('label'),{className:'clip-length-label',textContent:'Clip length'}),select=Object.assign(document.createElement('select'),{id:'clipLength'});for(const [v,t] of [['auto','Auto'],['short','<30s'],['medium','30–60s'],['long','60–90s']])select.add(new Option(t,v));label.append(select);target.after(label);enhanceSegmented(select,{label:'Clip length'})}}
// LinkDrop meta row (auto scan, limits, paste shortcut) and drop-a-file onto the link field.
{const form=$('linkForm'),meta=el('div','cd-drop-meta'),auto=$('autoGenerate'),chip=el('span');const sync=()=>chip.replaceChildren(auto?.checked&&!state.meta?badge('warning','Auto scan needs your Meta key'):badge(auto?.checked?'volt':'neutral',auto?.checked?'Auto scan on':'Auto scan off'));syncLinkDrop=sync;sync();auto?.addEventListener('change',sync);
  meta.append(chip,el('span',undefined,'Up to 6 h · or drop a file'),kbd('⌘V'));form?.querySelector('.link-launch-row')?.after(meta);
  form?.addEventListener('dragover',event=>{if([...event.dataTransfer.items].some(i=>i.kind==='file')){event.preventDefault();form.classList.add('is-dropping')}});form?.addEventListener('dragleave',()=>form.classList.remove('is-dropping'));
  form?.addEventListener('drop',event=>{const file=event.dataTransfer.files?.[0];form.classList.remove('is-dropping');if(!file)return;event.preventDefault();const input=$('fileInput'),list=new DataTransfer();list.items.add(file);input.files=list.files;input.dispatchEvent(new Event('change',{bubbles:true}))});}
// Whole-recording subtitles: same languages, regions and romanised scripts as clip captions.
{const select=$('wholeLanguage');for(const language of captionLanguages)if(![...select.options].some(o=>o.value===language))select.add(new Option(language,language));
  const variant=Object.assign(document.createElement('select'),{id:'wholeVariant'}),label=Object.assign(document.createElement('label'),{htmlFor:'wholeVariant',textContent:'Region / dialect'});label.append(variant);
  const romanLabel=Object.assign(document.createElement('label'),{className:'caption-roman'}),roman=Object.assign(document.createElement('input'),{type:'checkbox',id:'wholeRoman'});romanLabel.append(roman,document.createElement('span'));
  (select.closest('label')||select).after(label,romanLabel);
  const sync=()=>{const list=captionVariants[select.value]||[];label.hidden=!list.length;variant.replaceChildren(...list.map(v=>new Option(v.label,v.id)));romanLabel.hidden=!romanizations[select.value];romanLabel.querySelector('span').textContent=romanizations[select.value]?`Romanised: ${romanizations[select.value].split(':')[0]}`:'';roman.checked=false};
  select.addEventListener('change',sync);sync();}
// Safe-zone overlay: where TikTok, Reels and Shorts draw their caption, buttons and top bar on vertical video.
{const frame=document.querySelector('.preview-frame'),zones=Object.assign(document.createElement('div'),{className:'safe-zones',hidden:true});zones.setAttribute('aria-hidden','true');
  zones.innerHTML='<span class="sz-top">Top bar</span><span class="sz-side">Buttons</span><span class="sz-bottom">Caption &amp; profile</span>';frame?.append(zones);
  const toggle=Object.assign(document.createElement('button'),{type:'button',id:'safeZones',textContent:'Safe zones'});toggle.setAttribute('aria-pressed','false');
  // Match the drawn picture inside the letterboxed frame (object-fit: contain).
  const place=()=>{const c=$('previewCanvas');if(zones.hidden||!c||!frame)return;const r=c.getBoundingClientRect(),f=frame.getBoundingClientRect(),k=Math.min(r.width/c.width,r.height/c.height),w=c.width*k,h=c.height*k;Object.assign(zones.style,{inset:'auto',left:`${r.left-f.left+(r.width-w)/2}px`,top:`${r.top-f.top+(r.height-h)/2}px`,width:`${w}px`,height:`${h}px`})};
  toggle.onclick=()=>{zones.hidden=!zones.hidden;toggle.setAttribute('aria-pressed',String(!zones.hidden));place()};document.querySelector('.transport')?.append(toggle);
  const canvas=$('previewCanvas');if(canvas){new ResizeObserver(place).observe(canvas);new MutationObserver(place).observe(canvas,{attributes:true,attributeFilter:['width','height']})}}
// Platform guidance beside the export destination: length advice, cross-posting and the post caption.
{const hint=$('socialExportHint');const advice=Object.assign(document.createElement('p'),{id:'socialAdvice',className:'social-advice'});const cross=Object.assign(document.createElement('div'),{id:'crossPost',className:'cross-post'});
  const captionLabel=Object.assign(document.createElement('label'),{htmlFor:'postCaption',className:'post-caption-label',textContent:'Post caption'});const caption=Object.assign(document.createElement('textarea'),{id:'postCaption',rows:3,maxLength:2200,placeholder:'Your hook, then up to five hashtags'});
  const captionMeta=Object.assign(document.createElement('div'),{className:'post-caption-meta'});const count=Object.assign(document.createElement('span'),{id:'postCaptionCount'});const copy=Object.assign(document.createElement('button'),{type:'button',className:'cd-btn cd-btn-sm cd-btn-secondary',textContent:'Copy caption'});captionMeta.append(count,copy);
  const kit=Object.assign(document.createElement('div'),{className:'post-kit'});const write=Object.assign(document.createElement('button'),{type:'button',id:'writePost',className:'cd-btn cd-btn-sm cd-btn-secondary',textContent:'Write post with AI'});
  const toggle=(id,text,checked)=>{const label=Object.assign(document.createElement('label'),{className:'post-kit-toggle'});const box=Object.assign(document.createElement('input'),{type:'checkbox',id,checked});label.append(box,' '+text);return label};
  const postTitle=Object.assign(document.createElement('p'),{id:'postTitle',className:'post-title',hidden:true});
  kit.append(write,toggle('postLink','Link the full video',true),toggle('postDisclose','Add AI-edited note',true));
  hint?.after(advice,cross,kit,postTitle,captionLabel,caption,captionMeta);
  write.onclick=async()=>{const m=state.moments.find(x=>x.id===state.selected);if(!m)return;if(!m.transcript){toast('This clip has no transcript yet. Transcribe it first.');return}
    write.disabled=true;write.textContent='Writing…';
    try{const response=await fetch('/api/post-kit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transcript:m.transcript,hook:m.hook,platform:$('socialDestination')?.selectedOptions?.[0]?.textContent||'',language:m.captionLanguage&&m.captionLanguage!=='Original'?m.captionLanguage:'English'})});const data=await response.json();if(!response.ok)throw Error(data.error||'Post copy failed.');
      m.postTitle=data.title;m.postCaption=composePostCaption({...data,link:$('postLink').checked?(m.sourceLink||state.sourcePageUrl||''):'',disclose:$('postDisclose').checked});caption.value=m.postCaption;projectSession?.changed();renderSocialGuidance();toast('Post copy ready. Review it before posting.')}
    catch(error){toast(error.message)}finally{write.disabled=false;write.textContent='Write post with AI'}};
  caption.oninput=()=>{const m=state.moments.find(x=>x.id===state.selected);if(m){m.postCaption=caption.value;projectSession?.changed()}renderSocialGuidance()};
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(caption.value);toast('Caption copied.')}catch{toast('Copy is blocked here. Select the text and copy it.')}};}
// Caption languages, regional variants and romanised scripts (locales.js).
{const select=$('captionLanguage');for(const language of captionLanguages)if(![...select.options].some(o=>o.value===language))select.add(new Option(language,language));
  const variantLabel=document.createElement('label');variantLabel.htmlFor='captionVariant';variantLabel.textContent='Region / dialect';const variant=document.createElement('select');variant.id='captionVariant';variantLabel.append(variant);
  const romanLabel=document.createElement('label');romanLabel.className='caption-check caption-roman';const roman=document.createElement('input');roman.type='checkbox';roman.id='captionRoman';romanLabel.append(roman,document.createTextNode(' '),document.createElement('span'));
  (select.closest('label')||select).after(variantLabel,romanLabel);
  const current=()=>state.moments.find(x=>x.id===state.selected);
  const retranslate=m=>{m.translationWarning='';projectSession?.changed();void translateMoment(m,m.captionLanguage,{force:true})};
  variant.onchange=()=>{const m=current();if(!m||m.captionLanguage==='Original')return;(m.captionVariants??={})[m.captionLanguage]=variant.value;retranslate(m)};
  roman.onchange=()=>{const m=current();if(!m||m.captionLanguage==='Original')return;(m.captionScripts??={})[m.captionLanguage]=roman.checked?'roman':'native';retranslate(m)};
  syncCaptionVariant=m=>{const language=m?.captionLanguage,list=captionVariants[language]||[];variantLabel.hidden=!list.length;romanLabel.hidden=!romanizations[language];
    variant.replaceChildren(...list.map(v=>new Option(v.label,v.id)));if(list.length)variant.value=findVariant(language,m.captionVariants?.[language]).id;
    romanLabel.querySelector('span').textContent=romanizations[language]?`Romanised: ${romanizations[language].split(':')[0]}`:'';roman.checked=m?.captionScripts?.[language]==='roman';};}
document.querySelector('.timeline-track')?.append($('timelineSelection'));
for(const [id,key] of [['openStream','↵'],['playPause','Space'],['restartClip','R'],['addToCut','A'],['exportButton','E']])keepKbd($(id),key);
for(const [id,key] of [['trimIn','I'],['trimOut','O']]){const label=$(id)?.closest('label');if(label)keepKbd(label,key)}
const clickIf=id=>()=>{const node=$(id);if(node&&!node.disabled)node.click()};
const palette=createCommandPalette(()=>[
  ...state.moments.filter(m=>!m.dismissed&&m.hook).map(m=>({group:'Clips',label:m.hook,hint:`${Number.isFinite(m.analysis?.rankingScore)?m.analysis.rankingScore+' · ':''}${formatTime(m.start+(m.trimIn||0))}`,run:()=>{showWorkspace('clips');inspectClip(m.id)}})),
  ...[...document.querySelectorAll('.workspace-nav [data-workspace]')].map(b=>({group:'Go to',label:b.textContent.replace(/\d+$/,'').trim(),enabled:()=>!b.disabled,run:()=>b.click()})),
  {group:'Actions',label:'Make clips from the pasted link',shortcut:'↵',enabled:()=>Boolean($('streamUrl')?.value.trim()),run:clickIf('openStream')},
  {group:'Actions',label:'Upload a video file',run:()=>$('fileInput')?.click()},
  {group:'Actions',label:'Start live buffer',hint:'records the pasted live link',run:()=>{document.querySelector('.workspace-nav [data-workspace=source]')?.click();liveBuffer.start()}},
  {group:'Actions',label:'Clip back 15 seconds',shortcut:'1',enabled:()=>liveBuffer.recording(),run:()=>liveBuffer.clip(15)},
  {group:'Actions',label:'Clip back 30 seconds',shortcut:'2',enabled:()=>liveBuffer.recording(),run:()=>liveBuffer.clip(30)},
  {group:'Actions',label:'Clip back 60 seconds',shortcut:'3',enabled:()=>liveBuffer.recording(),run:()=>liveBuffer.clip(60)},
  {group:'Actions',label:'Play or pause the clip',shortcut:'Space',enabled:()=>!$('playPause')?.disabled,run:clickIf('playPause')},
  {group:'Actions',label:'Add this clip to the story cut',shortcut:'A',enabled:()=>!$('addToCut')?.disabled,run:clickIf('addToCut')},
  {group:'Actions',label:'Export this clip',enabled:()=>!$('exportButton')?.disabled,run:clickIf('exportButton')},
  {group:'Clips',label:'Add selected clips to the story cut',hint:`${clipSelection.size} selected`,enabled:()=>clipSelection.size>0,run:addSelectionToCut},
  {group:'Clips',label:'Select every visible clip',shortcut:'⌘A',run:selectAllVisible},
  {group:'Clips',label:'Show discarded clips',run:()=>{$('momentFilter').value='dismissed';renderQueue(false)}},
  {group:'Actions',label:'Settings',run:clickIf('openSettings')}
]);
mountShell({openPalette:palette.open,openBrandKit:()=>{const m=state.moments.find(x=>x.id===state.selected)||state.moments.find(x=>!x.dismissed&&x.status!=='analysing');if(!m){showWorkspace('library');toast('Open a project with clips to style them with your brand kit.');return}const go=()=>{document.getElementById('styleTab')?.click();document.querySelector('.brand-controls')?.scrollIntoView({block:'start',behavior:'smooth'})};if(state.selected===m.id&&document.body.dataset.workspace==='edit')go();else selectMoment(m.id).then(go)}});
$('clipSort').onchange=()=>renderQueue(false);
$('momentFilter').addEventListener('change',()=>renderQueue(false));
liveControls=createLiveControls({requestJson,getProject:()=>projectSession?.current,onMessage:message,onJobs:()=>jobsView.refresh(),onChanged:async({projectId})=>{if(projectSession.current?.id===projectId){await projectSession.flush();await projectSession.open(projectId)}await homeView.refresh()},onReview:async projectId=>{await projectSession.open(projectId);$('momentFilter').value='all';renderQueue(false);showWorkspace('clips')}});
const productionTools=createProductionTools({requestJson,getProject:()=>projectSession?.current,getSelected:()=>state.moments.find(m=>m.id===state.selected),getCut:()=>state.cut.length?state.cut:[state.selected].filter(Boolean),getAspect:()=>state.aspect,flush:()=>projectSession.flush(),edit:performEdit,redraw:renderEditor,onJobs:async()=>{await jobsView.refresh();showWorkspace('jobs')},onMessage:message});
connectionsView=createConnections({requestJson,getProject:()=>projectSession?.current,onMessage:message});
showWorkspace('home');
window.addEventListener('popstate',()=>navigateWorkspace(workspaceFromHash(location.hash)));
bindPlayerControls(clipVideo,{volume:$('previewVolume'),mute:$('mutePreview'),speed:$('previewSpeed'),status:$('previewBufferStatus'),fullscreen:$('previewFullscreen'),surface:$('previewCanvas').parentElement});
function userCaptionDefault(){try{const value=localStorage.getItem('context-desk-output-language');return outputLanguages.includes(value)?value:'Original'}catch{return 'Original'}}
$('liveCaptionLanguage').value=userCaptionDefault();
const captionWork=translationQueue(2);let captionWaiting=0,captionFailed=0;
function projectCaptionTarget(){return $('liveCaptionLanguage').value||'Original'}
function applySocialPreset(){const preset=socialPresets[$('socialDestination').value];if(!preset?.aspect){$('socialExportHint').textContent='Your current edit and export settings.';return}performEdit('social-preset',()=>{state.aspect=preset.aspect;$('aspectSelect').value=preset.aspect;$('exportQuality').value=String(preset.quality);$('exportFormat').value=preset.format==='mp4'?'auto':preset.format;setPreviewSize();drawPreview()});$('socialExportHint').textContent=preset.hint+' · choose Fit to preserve the whole image or Fill to crop.'}
// Destination tiles with a phone-frame preview of the current frame and the post caption.
const destinations=enhanceDestinations($('socialDestination'),{getFrame:()=>{try{return $('previewCanvas').toDataURL('image/jpeg',.7)}catch{return null}},getCaption:()=>$('postCaption')?.value||''});
$('socialDestination').onchange=()=>{applySocialPreset();renderSocialGuidance();setTimeout(()=>destinations?.refresh(),300)};$('applySocialPreset').onclick=applySocialPreset;
function queueCaptionTarget(m){
  const language=inheritCaptionTarget(m,projectCaptionTarget()),owner=projectSession?.current?.id;
  if(projectSession?.restoring)return;
  // A matching whole-recording track repairs a missing clip track for free, even after an earlier failure.
  if(language!=='Original'&&!m.captionCues?.[language]?.length)void reuseWholeTrack(m,language);
  if(m.translationError)return;
  // Long tracks (e.g. a full recording) are only translated when the producer asks.
  if((m.captionCues?.Original?.length||0)>300)return;
  if(!owner||language==='Original'||m.captionCues?.[language]?.length||!m.captionCues?.Original?.length)return;
  const key=owner+':'+m.id+':'+language;
  if(m.captionQueued?.has(language)||m.translationPending?.has(language))return;
  m.captionQueued??=new Set();m.captionQueued.add(language);captionWaiting++;updateCaptionQueue();
  void captionWork.add(key,async()=>{if(projectSession?.current?.id!==owner||!state.moments.includes(m)||captionTarget(m,projectCaptionTarget())!==language)return;await translateMoment(m,language);if(m.translationError)captionFailed++}).catch(()=>{captionFailed++}).finally(()=>{m.captionQueued.delete(language);captionWaiting--;updateCaptionQueue();const visible=owner===projectSession?.current?.id&&state.moments.find(item=>item.id===m.id);if(visible&&visible!==m)queueMicrotask(()=>queueCaptionTarget(visible))});
}
function updateCaptionQueue(){$('languageQueueStatus').textContent=captionWaiting?`${captionWaiting} subtitle ${captionWaiting===1?'track':'tracks'} queued or translating · 2 at a time`:captionFailed?`${captionFailed} translation ${captionFailed===1?'attempt needs':'attempts need'} attention. Open the clip to retry.`:''}
function setProjectCaptionTarget(language){
  $('liveCaptionLanguage').value=language;captionFailed=0;updateSpeechSummary();
  for(const m of state.moments){inheritCaptionTarget(m,language);if(m.captionCues?.Original?.length)m.showCaptions=true;queueCaptionTarget(m)}
  try{localStorage.setItem('context-desk-output-language',language)}catch{}
  projectSession?.changed();if(state.selected)renderEditor();
}

$('codeSwitchLanguage').innerHTML+='<option>'+speechLanguages.join('</option><option>')+'</option>';
$('dialectHints').innerHTML=dialectExamples.map(value=>'<option value="'+value+'">').join('');
function speechChoices(){return languageBias([$('speechLanguage').value,$('codeSwitchLanguage').value]).join(', ')}
const openedSourceLinks=new Set();
const sourceUrls=new Set();
const batchExportUrls=new Set();
const deskTabId=crypto.randomUUID();
const playbackChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('context-desk-playback'):null;
function claimPlayback(active=program){for(const player of [program,clipVideo,$('wholePreview')])if(player&&player!==active&&!player.paused)player.pause();playbackChannel?.postMessage({type:'active',tabId:deskTabId})}
playbackChannel?.addEventListener('message',event=>{if(event.data?.type!=='active'||event.data.tabId===deskTabId)return;if(state.scanning)stopScan('Another Context Desk tab started scanning, so this one paused.');if(state.sourceType==='file'&&!program.paused)program.pause();clipVideo.pause();$('wholePreview')?.pause()});
const WINDOW_MS=24000;
const formatTime=seconds=>{const s=Math.max(0,Math.floor(seconds||0));return (s>=3600?String(Math.floor(s/3600))+':':'')+`${String(Math.floor(s/60)%(s>=3600?60:3600)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`};
const escapeHtml=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(text){$('monitorHint').textContent=text;}
function aiLimit(){return Number($('aiBudget').value)||0}
function updateBudgetUi(){const limit=aiLimit();$('budgetUsage').textContent=`${state.aiCalls} Of ${limit||'∞'} Sent`}
$('aiBudget').onchange=updateBudgetUi;
function updateSpeechSummary(){$('importPreferencesSummary').textContent=($('liveCaptionLanguage').value==='Original'?'Original speech':$('liveCaptionLanguage').value+' subtitles')+' · Language & clip preferences';const local=$('translationProvider').value==='voicestudio';$('translationMode').disabled=local;$('glossary').disabled=local;$('translationCapability').textContent=local?'VoiceStudio uses direct local translation. Style and glossary controls require Meta.':'Glossary and style apply to new translations. Use Translate again after changing them.';$('speechSummaryValue').textContent=`${$('speechProvider').value==='voicestudio'?'VoiceStudio local':'Meta Muse Voice'} · ${speechChoices()||'Auto detect'} · ${$('liveCaptionLanguage').value==='Original'?'original speech':$('liveCaptionLanguage').value+' draft'}`}
$('codeSwitchLanguage').onchange=updateSpeechSummary;$('speechLanguage').onchange=updateSpeechSummary;$('liveCaptionLanguage').onchange=()=>setProjectCaptionTarget($('liveCaptionLanguage').value);
$('speechProvider').onchange=()=>{updateSpeechSummary();if($('speechProvider').value==='voicestudio'&&!state.voiceStudio)message('Open VoiceStudio to use local transcription. Meta Muse Spark still analyses the video frames.')};
$('translationProvider').onchange=()=>{updateSpeechSummary();if($('translationProvider').value==='voicestudio'&&!state.voiceStudio)message('Open VoiceStudio to use local translation. Choose the source speech language too.');if(state.selected)renderEditor()};
function setSourceLabel(text){$('sourceLabel').textContent=text;}
function updateSourceQuality(){
  if(!state.source||!program.videoWidth){$('sourceQuality').hidden=true;return;}
  const crop=state.sourceType==='screen'?state.stageCrop:null;
  const width=Math.round(program.videoWidth*(crop?.w||1)),height=Math.round(program.videoHeight*(crop?.h||1));
  const fps=state.screenStream?.getVideoTracks()[0]?.getSettings()?.frameRate;
  const audio=state.sourceType==='screen'?(state.screenStream.getAudioTracks().length?'tab audio connected':'No tab audio'):'audio checked during scan';
  $('sourceQuality').textContent=`Source ${width} × ${height}${fps?' · '+Math.round(fps)+' FPS':''} · ${audio}${height<1080?' · 1080p export will upscale this picture':''}`;
  $('sourceQuality').hidden=false;
}
function updateButtons(){ renderWholeSubtitles();program.hidden=!state.source;if(!state.source){$('emptySource').querySelector('strong').textContent=state.moments.length?'Your recorded windows are saved.':'One source. All the possibilities.';$('emptySource').querySelector('p').textContent=state.moments.length?'Open a window below to review and edit its saved video and audio.':'Paste a video link above. We’ll prepare it and start looking for clips.';} $('sourceSummary').hidden=!state.source;$('sourceSummary').textContent=state.source?'Source · '+state.sourceName:''; $('fullFrame').disabled=state.sourceType!=='screen'; document.body.classList.toggle('is-scanning',state.scanning);document.body.classList.toggle('has-source',Boolean(state.source));$('scanButton').disabled=!state.source||(state.sourceType==='screen'&&!state.stageCrop); $('disconnectButton').disabled=!state.source; $('markButton').disabled=!state.scanning; $('autoCrop').disabled=state.sourceType!=='screen'; $('pickCrop').disabled=state.sourceType!=='screen'; $('applyCrop').disabled=!state.cropDraft; $('resetCrop').disabled=state.sourceType!=='screen'; $('scanButton').innerHTML=state.scanning?'Stop scan <b></b>':state.sourceType==='file'?'Scan as it plays <b></b>':'Start scan <b></b>'; $('liveIndicator').textContent=state.scanning?'● Monitoring':'● Standby'; $('liveIndicator').classList.toggle('on',state.scanning); }
// Shown when the server runs older code than the files on disk (or is too old to say): newer
// app files would call endpoints it lacks, so saves are refused and kept as a recovery copy.
function showServerStale(stale){let banner=$('serverStale');if(!stale){banner?.remove();return}if(banner)return;banner=Object.assign(document.createElement('div'),{id:'serverStale',className:'server-stale',role:'alert'});banner.append(Object.assign(document.createElement('strong'),{textContent:'Restart Context Desk to finish updating. '}),document.createTextNode('The local server is running older code. Stop it in its terminal (Ctrl+C) and start it again with npm run dev (or npm start). Until then, saving is paused and your edits are kept as a recovery copy in the Library.'));document.body.prepend(banner)}
window.addEventListener('context-desk:server-outdated',()=>showServerStale(true));
// Re-check when the tab regains focus, so a server that went out of date after loading is caught.
window.addEventListener('focus',()=>{fetch('/api/status').then(r=>r.json()).then(d=>showServerStale(!('codeStale' in d)||d.codeStale)).catch(()=>{})});
async function status(){setActivity('connect','Connecting your workspace','Checking Meta and local speech services…');try{const r=await fetch('/api/status'); const d=await r.json();state.meta=d.metaConfigured;state.voiceStudio=d.voiceStudioAvailable;showServerStale(!('codeStale' in d)||Boolean(d.codeStale));$('apiState').textContent=state.meta?'Meta configured':'Meta key needed';$('apiState').dataset.state=state.meta?'ok':'missing';syncLinkDrop();$('apiState').title=state.meta?(state.voiceStudio?'Muse Spark visual analysis enabled · VoiceStudio local speech available':'Muse Spark visual analysis enabled · open VoiceStudio for local speech'):'Add MODEL_API_KEY to .env to enable AI analysis';}catch{$('apiState').textContent='Server offline';$('apiState').dataset.state='offline';}finally{finishActivity('connect')}}
function cleanupSource(){$('wholePreview').pause();$('wholePreview').removeAttribute('src');$('wholePreview').load();$('wholePreview').hidden=true;state.sourceLoadToken++;state.sourceUploadAbort?.abort();state.sourceUploadAbort=null;finishActivity('source');stopScan();state.autoFrameJob++;state.batchCancel=true;state.batchRunning=false;state.batchId=null;$('batchPanel').hidden=!state.batchExports.length;$('batchResults').innerHTML='';$('batchButton').disabled=true;if(state.batchExports.length)batchProgress('Source disconnected. Rendered draft clips remain available below until this page closes.');if(state.sourceType==='screen')state.recordStream?.getVideoTracks().forEach(track=>track.stop());state.screenStream?.getTracks().forEach(t=>t.stop());state.screenStream=null;state.stageCrop=null;state.cropDraft=null;state.cropPicking=false;state.resumeAfterCrop=false;state.lastDraftStart=-1;$('monitor').classList.remove('video-cropped');$('cropMask').hidden=true;$('cropSelection').hidden=true;$('sourceCropRow').hidden=true;$('liveCaptions').hidden=true;$('sourceQuality').hidden=true;$('cropStatus').textContent='Auto frame looks for the moving player. You can draw the area yourself if it misses.';if(state.sourceUrl&&!state.moments.some(moment=>moment.url===state.sourceUrl)){URL.revokeObjectURL(state.sourceUrl);sourceUrls.delete(state.sourceUrl)}state.sourceUrl=null;state.source=null;state.sourceType=null;state.sourceName='';state.recordStream=null;program.srcObject=null;program.removeAttribute('src');program.controls=true;program.load();$('emptySource').hidden=false;setSourceLabel('No source');updateButtons();}
let importId=null,importCancelled=false,sourcePageUrl='';
async function loadVideoFile(file,{sourceLink='',auto=true}={}){
  if(!projectSession?.restoring){try{await finishCaptureForSwitch();await projectSession?.beforeSourceChange();editHistory.reset()}catch(error){message(error.message);return}}
  cleanupSource();if(!projectSession?.restoring){state.moments=[];state.cut=[];state.selected=null;state.batchExports=[];state.exportHistory=[];state.aiCalls=0;state.windowCount=0;}const loadToken=state.sourceLoadToken;setActivity('source','Opening your video','Preparing the picture and original audio…');
  state.sourceUrl=URL.createObjectURL(file);sourceUrls.add(state.sourceUrl);program.controls=true;program.muted=true;program.src=state.sourceUrl;state.source=file;state.sourceType='file';state.sourceName=file.name;state.sourcePageUrl=sourceLink;state.batchId=crypto.randomUUID();state.batchCancel=false;$('batchPanel').hidden=false;$('batchResults').innerHTML='';setSourceLabel(file.name);$('emptySource').hidden=true;updateButtons();
  try{await mediaReady(program);if(loadToken!==state.sourceLoadToken)return;if(program.duration>21600||file.size>20*1024*1024*1024)throw Error('Choose a recording up to 6 hours and 20 GB.');{ setActivity('source','Preparing your long recording','Copying the file into the local processing cache. The original stays on this computer.');state.sourceUploadAbort=new AbortController();const staged=await fetch('/api/import/upload',{method:'POST',signal:state.sourceUploadAbort.signal,headers:{'Content-Type':file.type||'video/mp4','X-Video-Duration':String(program.duration),'X-Video-Name':encodeURIComponent(file.name)},body:file});const job=await staged.json();if(loadToken!==state.sourceLoadToken)return;if(!staged.ok)throw Error(job.error||'The long recording could not be prepared.');state.source={importId:job.id,size:file.size,type:file.type,name:file.name};const previousUrl=state.sourceUrl;state.sourceUrl=job.mediaUrl;program.src=job.mediaUrl;await mediaReady(program);URL.revokeObjectURL(previousUrl);sourceUrls.delete(previousUrl);if(await projectSession.adopt(job.projectId||job.id))return;}$('batchButton').disabled=false;batchProgress(`${formatTime(program.duration)} ready · preparing your clip drop`);updateSourceQuality();await connectionReady;if(loadToken!==state.sourceLoadToken)return;renderQueue();showWorkspace('clips');if(auto&&pendingIntent==='translate'){finishActivity('source');batchProgress('Video ready. Subtitles for the whole video are below.');subtitleWholeVideo(projectCaptionTarget())}else if(auto&&$('autoGenerate').checked&&state.meta){finishActivity('source');await $('batchButton').onclick();}else batchProgress(state.meta?'Video ready. Choose Find clips to begin.':'Video ready. Add a Meta API key to enable automatic clip selection.');}
  catch(error){if(loadToken!==state.sourceLoadToken)return;showWorkspace('source');$('linkStatus').hidden=false;$('linkStatus').textContent=error.message||'This file could not be opened. Try an MP4 or WebM.';}
  finally{if(loadToken===state.sourceLoadToken)finishActivity('source')}
}
async function loadImportedVideo(job,sourceLink,{auto=true}={}){
  if(!projectSession?.restoring){try{await finishCaptureForSwitch();await projectSession?.beforeSourceChange();editHistory.reset()}catch(error){message(error.message);return}}
  cleanupSource();if(!projectSession?.restoring){state.moments=[];state.cut=[];state.selected=null;state.batchExports=[];state.exportHistory=[];state.aiCalls=0;state.windowCount=0;}const loadToken=state.sourceLoadToken;setActivity('source','Opening your recording','Streaming the video from this computer. Preparing a bounded clip scan…');
  state.sourceUrl=job.mediaUrl;state.source={importId:job.id,size:job.size,type:job.mime,name:job.title};state.sourceType='file';state.sourceName=job.title;state.sourcePageUrl=sourceLink;state.batchId=crypto.randomUUID();state.batchCancel=false;program.controls=true;program.muted=true;program.src=job.mediaUrl;$('emptySource').hidden=true;$('batchPanel').hidden=false;$('batchResults').innerHTML='';setSourceLabel(job.title);updateButtons();
  try{await mediaReady(program);if(loadToken!==state.sourceLoadToken)return;if(!projectSession?.restoring&&await projectSession.adopt(job.projectId||job.id))return;$('batchButton').disabled=false;updateSourceQuality();await connectionReady;if(loadToken!==state.sourceLoadToken)return;renderQueue();showWorkspace('clips');finishActivity('source');await afterImport(auto);}finally{if(loadToken===state.sourceLoadToken)finishActivity('source')}
}
// The home choice applies to imports started from Home; anywhere else they make clips.
const noteIntent=()=>{pendingIntent=document.body.dataset.workspace==='home'?importIntent:'clips'};
$('fileInput').onchange=async event=>{noteIntent();const files=[...(event.target.files||[])];if(importId)await $('cancelImport').onclick();for(const file of files)await loadVideoFile(file);};
function linkStatus(text){$('linkStatus').hidden=false;$('linkStatus').textContent=text}
$('linkForm').onsubmit=async event=>{
  event.preventDefault();if(importId)return;noteIntent();$('streamUrl').setAttribute('aria-invalid','false');importCancelled=false;$('captureFallback').hidden=true;$('openStream').disabled=true;$('cancelImport').hidden=false;setActivity('import','Loading your video','Checking the link and preparing the recording…');linkStatus('Checking your video link…');
  try{
    let url;try{url=new URL($('streamUrl').value.trim())}catch{throw Error('Paste a full video link beginning with https://.')}if(url.protocol!=='https:'||url.username||url.password)throw Error('Paste a public HTTPS video link.');sourcePageUrl=url.href;
    const response=await fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url.href})});let job=await response.json();if(!response.ok)throw Error(job.error||'Import could not start.');importId=job.id;
    while(!importCancelled){
      linkStatus(job.message);setActivity('import',job.status==='downloading'?'Preparing the recording':'Checking your video',job.message);
      if(job.status==='ready'){
        finishActivity('import');linkStatus('Video ready. Your clip scan is starting.');await loadImportedVideo(job,url.href);break;
      }
      if(job.status==='needs-capture'){linkStatus(job.message);$('captureFallback').hidden=false;break;}
      if(job.status==='error'||job.status==='cancelled')throw Error(job.message);
      await new Promise(resolve=>setTimeout(resolve,1000));if(importCancelled)break;const poll=await fetch('/api/import/'+job.id);job=await poll.json();if(!poll.ok)throw Error(job.error||'The import could not be checked.');
    }
  }catch(error){if(!importCancelled){$('streamUrl').setAttribute('aria-invalid','true');linkStatus(error.message||'This source could not be imported.');$('captureFallback').hidden=!sourcePageUrl;}}
  finally{finishActivity('import');importId=null;$('openStream').disabled=false;$('cancelImport').hidden=true;}
};
$('cancelImport').onclick=async()=>{importCancelled=true;if(importId)await fetch('/api/import/'+importId,{method:'DELETE'}).catch(()=>{});finishActivity('import');linkStatus('Import cancelled. Paste another link whenever you’re ready.');};
$('captureFallback').onclick=()=>{if(sourcePageUrl&&!openedSourceLinks.has(sourcePageUrl)){window.open(sourcePageUrl,'context-desk-source','noopener,noreferrer');openedSourceLinks.add(sourcePageUrl)}$('screenButton').click()};
$('screenButton').onclick=async()=>{
  let connectingStream;try{
    const stream=connectingStream=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser',frameRate:{ideal:60}},audio:{suppressLocalAudioPlayback:true},selfBrowserSurface:'exclude'});if(projectSession){await finishCaptureForSwitch();const resume=projectSession.current&&!projectSession.current.sourceId;if(!resume){await projectSession.beforeSourceChange();state.moments=[];state.cut=[];state.selected=null;state.batchExports=[];state.exportHistory=[];state.aiCalls=0;state.windowCount=0;await projectSession.createLive();}else await projectSession.flush();}setActivity('share','Connecting the live picture','Preparing automatic framing and scanning…');cleanupSource();state.screenStream=stream;state.liveElapsedOffset=Math.max(0,...state.moments.filter(m=>m.sourceType==='screen').map(m=>m.end));state.liveEpoch=performance.now();state.source=stream;state.sourceType='screen';state.sourceName='Shared video tab';program.muted=true;program.volume=0;program.controls=false;program.srcObject=stream;await program.play();if(!program.videoWidth)await mediaReady(program);
    stream.getVideoTracks()[0].addEventListener('ended',()=>{cleanupSource();message('The shared tab stopped. Captured clips remain available.');});setSourceLabel('Live tab connected');$('emptySource').hidden=true;$('sourceCropRow').hidden=false;updateButtons();beginCrop();state.resumeAfterCrop=true;updateSourceQuality();finishActivity('share');await detectAndApplyCrop();
  }catch(error){if(connectingStream!==state.screenStream)connectingStream?.getTracks().forEach(track=>track.stop());message(error.name==='NotAllowedError'?'Sharing was cancelled. Choose Connect live tab when you’re ready.':error.message||'The tab could not be connected.');linkStatus(error.name==='NotAllowedError'?'Browser sharing was cancelled. Your other clips are still available.':'Could not connect this tab. Try again with tab audio enabled.');}
  finally{finishActivity('share')}
};
$('disconnectButton').onclick=()=>{cleanupSource();message('Source disconnected. Captured windows remain available for this session.');};
$('scanButton').onclick=()=>state.scanning?stopScan('Scan paused. Captured moments remain ready to edit; press Start scan to continue.'):startScan();
$('markButton').onclick=()=>{if(state.recording?.state==='recording'){state.recording.manual=true;state.recording.stop();message('Moment marked. Finishing this window now.');}};
function sourceRect(){
  const width=$('monitor').clientWidth,height=$('monitor').clientHeight;
  const scale=Math.min(width/program.videoWidth,height/program.videoHeight);
  const visualWidth=program.videoWidth*scale,visualHeight=program.videoHeight*scale;
  return {left:(width-visualWidth)/2,top:(height-visualHeight)/2,width:visualWidth,height:visualHeight};
}
function cropPoint(event){
  const rect=sourceRect(),bounds=$('cropMask').getBoundingClientRect();
  return {x:Math.max(0,Math.min(1,(event.clientX-bounds.left-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-bounds.top-rect.top)/rect.height))};
}
function showCropDraft(){
  if(!state.cropDraft)return;
  const r=sourceRect(),c=state.cropDraft,selection=$('cropSelection');
  selection.style.left=`${r.left+c.x*r.width}px`;
  selection.style.top=`${r.top+c.y*r.height}px`;
  selection.style.width=`${c.w*r.width}px`;
  selection.style.height=`${c.h*r.height}px`;
  selection.hidden=false;
}
function beginCrop(){
  if(state.sourceType!=='screen'||!program.videoWidth)return;
  state.autoFrameJob++;
  state.resumeAfterCrop=state.scanning;
  if(state.scanning)stopScan();
  state.cropPicking=true;state.cropDraft=state.stageCrop?{...state.stageCrop}:null;
  $('monitor').classList.remove('video-cropped');
  $('cropMask').hidden=false;
  $('cropSelection').hidden=!state.cropDraft;
  if(state.cropDraft)showCropDraft();
  $('cropStatus').textContent='Drag across the shared tab to frame only the video picture. Then choose Use this area.';
  updateButtons();
}
let cropAnchor=null;
$('cropMask').addEventListener('pointerdown',event=>{
  if(!state.cropPicking)return;
  state.autoFrameJob++;
  cropAnchor=cropPoint(event);$('cropMask').setPointerCapture(event.pointerId);
  state.cropDraft={x:cropAnchor.x,y:cropAnchor.y,w:0,h:0};showCropDraft();
});
$('cropMask').addEventListener('pointermove',event=>{
  if(!cropAnchor)return;
  const point=cropPoint(event);
  state.cropDraft={x:Math.min(cropAnchor.x,point.x),y:Math.min(cropAnchor.y,point.y),w:Math.abs(point.x-cropAnchor.x),h:Math.abs(point.y-cropAnchor.y)};
  showCropDraft();
});
$('cropMask').addEventListener('pointerup',event=>{
  if(!cropAnchor)return;
  const point=cropPoint(event);
  state.cropDraft={x:Math.min(cropAnchor.x,point.x),y:Math.min(cropAnchor.y,point.y),w:Math.abs(point.x-cropAnchor.x),h:Math.abs(point.y-cropAnchor.y)};
  cropAnchor=null;showCropDraft();
  if(state.cropDraft.w<.08||state.cropDraft.h<.08){state.cropDraft=null;$('cropSelection').hidden=true;$('cropStatus').textContent='That area is too small. Drag around the whole video picture.';}
  else $('cropStatus').textContent='Preview the outlined player area, then choose Use this area.';
  updateButtons();
});
$('pickCrop').onclick=beginCrop;
$('autoCrop').onclick=()=>{beginCrop();detectAndApplyCrop()};
function frameSample(){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  context.drawImage(program,0,0,128,128);
  return context.getImageData(0,0,128,128).data;
}
function motionCrop(before,after){
  let minX=128,minY=128,maxX=-1,maxY=-1,count=0;
  for(let y=2;y<126;y+=2)for(let x=2;x<126;x+=2){
    const index=(y*128+x)*4;
    const difference=Math.abs(before[index]-after[index])+Math.abs(before[index+1]-after[index+1])+Math.abs(before[index+2]-after[index+2]);
    if(difference<64)continue;
    minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);count++;
  }
  const spanX=(maxX-minX)/128,spanY=(maxY-minY)/128;
  if(count<35||spanX<.22||spanY<.12)return null;
  const centerX=(minX+maxX)/256,centerY=(minY+maxY)/256;
  const sourceAspect=program.videoWidth/program.videoHeight;
  let width=Math.min(.98,Math.max(spanX*1.18,spanY*1.18*16/9/sourceAspect));
  let height=Math.min(.98,Math.max(spanY*1.18,width*sourceAspect*9/16));
  if(width*sourceAspect/height>2.1)width=height*2.1/sourceAspect;
  return {x:Math.max(0,Math.min(1-width,centerX-width/2)),y:Math.max(0,Math.min(1-height,centerY-height/2)),w:width,h:height};
}
async function detectAndApplyCrop(){
  if(state.sourceType!=='screen'||!state.cropPicking||program.readyState<2)return;
  const job=++state.autoFrameJob;setActivity('frame','Finding the video frame','Meta is locating the whole player. Keep the source tab playing.');$('autoCrop').disabled=true;$('cropStatus').textContent='Finding the player boundaries…';
  try{
    const canvas=document.createElement('canvas'),scale=Math.min(1,1280/program.videoWidth);canvas.width=Math.round(program.videoWidth*scale);canvas.height=Math.round(program.videoHeight*scale);canvas.getContext('2d').drawImage(program,0,0,canvas.width,canvas.height);
    const response=await fetch('/api/frame',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:canvas.toDataURL('image/jpeg',.72)})});const result=await response.json();if(!response.ok)throw Error(result.error||'Detection unavailable');if(job!==state.autoFrameJob||!state.cropPicking)return;
    if(result.found&&result.confidence>=.75){state.cropDraft={x:result.x,y:result.y,w:result.width,h:result.height};showCropDraft();$('applyCrop').click();$('cropStatus').textContent='Auto framed. Check the picture edges; use Draw area to adjust.';message('Player detected. Start scanning when the picture looks right.');}
    else throw Error('The player boundaries were uncertain.');
  }catch(error){if(job!==state.autoFrameJob||!state.cropPicking)return;const before=frameSample();await new Promise(resolve=>setTimeout(resolve,800));if(job!==state.autoFrameJob)return;const suggestion=motionCrop(before,frameSample());if(suggestion){state.cropDraft=suggestion;showCropDraft();$('cropStatus').textContent='Review this suggested area, then choose Use this area. You can redraw it.';}else $('cropStatus').textContent='Draw around the video picture, or choose Use full frame if you shared only the video. ';message(error.message+' Manual framing is ready.');}
  finally{finishActivity('frame');updateButtons();}
}
window.addEventListener('resize',()=>{if(state.cropPicking&&state.cropDraft)showCropDraft()});
$('fullFrame').onclick=()=>{state.cropDraft={x:0,y:0,w:1,h:1};$('applyCrop').click()};
$('resetCrop').onclick=()=>{if(state.sourceType!=='screen')return;state.stageCrop=null;state.cropDraft=null;beginCrop();updateButtons();};
$('applyCrop').onclick=async()=>{
  if(!state.cropDraft||state.sourceType!=='screen')return;
  state.stageCrop={...state.cropDraft};state.cropPicking=false;
  const rawWidth=Math.round(program.videoWidth*state.stageCrop.w),rawHeight=Math.round(program.videoHeight*state.stageCrop.h);
  const scale=Math.min(1,3840/rawWidth);
  stageCanvas.width=Math.max(2,Math.round(rawWidth*scale));stageCanvas.height=Math.max(2,Math.round(rawHeight*scale));
  $('cropMask').hidden=true;$('cropSelection').hidden=true;$('monitor').classList.add('video-cropped');
  $('cropStatus').textContent=`Clean feed · ${stageCanvas.width} × ${stageCanvas.height} · ${state.screenStream.getAudioTracks().length?'TAB AUDIO ON':'NO TAB AUDIO'}`;
  drawStage();updateButtons();updateSourceQuality();
  message('Video area framed. AI samples and exported clips use only this picture. You can edit moments while scanning continues.');
  if(state.resumeAfterCrop){state.resumeAfterCrop=false;await startScan();}
};
let stageDrawing=false;
function drawStage(){
  if(stageDrawing)return;
  stageDrawing=true;
  const loop=()=>{
    if(!state.stageCrop||state.sourceType!=='screen'){stageDrawing=false;return;}
    if(program.readyState>=2&&program.videoWidth&&program.videoHeight){
      const c=state.stageCrop;
      stageCanvas.getContext('2d',{alpha:false}).drawImage(program,c.x*program.videoWidth,c.y*program.videoHeight,c.w*program.videoWidth,c.h*program.videoHeight,0,0,stageCanvas.width,stageCanvas.height);
    }
    requestAnimationFrame(loop);
  };
  loop();
}
async function startScan(){
  if(!state.source||state.sourceType==='screen'&&!state.stageCrop)return;
  if(!window.MediaRecorder){message('This browser cannot record a live window. Use a current Chrome-based browser.');return;}
  state.staticSilentWindows=0;state.captureStalled=false;
  try{if(state.sourceType==='file'){program.muted=false;program.volume=1;if(program.ended)program.currentTime=0;state.recordStream=program.captureStream?.()||program.mozCaptureStream?.();if(!state.recordStream?.getVideoTracks().length){await program.play();state.recordStream=program.captureStream?.()||program.mozCaptureStream?.();}}else {
      // Capture only the framed picture; keep tab audio on the same recorded stream.
      if(state.recordStream&&state.recordStream!==state.screenStream)state.recordStream.getVideoTracks().forEach(track=>track.stop());
      const frameRate=Math.min(60,state.screenStream.getVideoTracks()[0]?.getSettings()?.frameRate||30);
      state.recordStream=new MediaStream([...stageCanvas.captureStream(frameRate).getVideoTracks(),...state.screenStream.getAudioTracks()]);
    }
    if(!state.recordStream?.getVideoTracks().length)throw Error('Could not capture this video. Try sharing its tab instead.');
    state.scanning=true;showWorkspace('clips');claimPlayback();updateButtons();message(state.meta?'Scanning: Meta receives each window until the visible AI limit is reached.':'Scanning: windows will be captured locally. Add a Meta key for automatic story suggestions.');startWindow();if(state.sourceType==='file'&&program.paused)await program.play();
  }catch(error){state.scanning=false;updateButtons();message(error.message||'Could not start scanning.');}
}
async function finishCaptureForSwitch(){if(state.sourceType!=='screen')return;const recorder=state.recording;if(recorder?.state==='recording')stopScan('Saving the current live window before switching…');if(recorder?.saved)await recorder.saved;await projectSession?.flush()}
function liveTime(){return (state.liveElapsedOffset||0)+(performance.now()-state.liveEpoch)/1000}
function stopScan(reason){state.scanning=false;clearTimeout(state.windowTimer);clearInterval(state.frameTimer);if(state.recording?.state==='recording'){state.recording.endTime=state.sourceType==='file'?program.currentTime:liveTime();state.recording.stop();}updateButtons();if(reason)message(reason);}
function grabFrame(frames,crop){if(program.readyState<2||!program.videoWidth||!program.videoHeight)return;const sx=crop?crop.x*program.videoWidth:0,sy=crop?crop.y*program.videoHeight:0,sw=crop?crop.w*program.videoWidth:program.videoWidth,sh=crop?crop.h*program.videoHeight:program.videoHeight;const c=document.createElement('canvas');const scale=Math.min(1,640/sw);c.width=Math.max(2,Math.round(sw*scale));c.height=Math.max(2,Math.round(sh*scale));c.getContext('2d').drawImage(program,sx,sy,sw,sh,0,0,c.width,c.height);frames.push(c.toDataURL('image/jpeg',.68));}
function startWindow(){
  if(!state.scanning)return;
  const mimeTypes=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].filter(MediaRecorder.isTypeSupported);
  const cleanCapture=state.sourceType==='screen',crop=null,captureArea=state.stageCrop?{...state.stageCrop}:null,track=state.recordStream?.getVideoTracks()[0],settings=track?.getSettings?.()||{};
  const sourcePixels={width:cleanCapture?stageCanvas.width:program.videoWidth,height:cleanCapture?stageCanvas.height:program.videoHeight,frameRate:Math.round(settings.frameRate||30),frameRateKnown:Boolean(settings.frameRate),audioTracks:state.recordStream?.getAudioTracks().length||0};
  const pixelCount=Math.max(640*360,sourcePixels.width*sourcePixels.height),captureBitrate=Math.min(12000000,Math.max(4000000,Math.round(pixelCount/(1280*720)*5000000*Math.sqrt(sourcePixels.frameRate/30))));
  let setupError;state.recording=null;
  for(const mimeType of [...mimeTypes,undefined]){try{state.recording=new MediaRecorder(state.recordStream,{...(mimeType?{mimeType}:{}),videoBitsPerSecond:captureBitrate,audioBitsPerSecond:192000});break;}catch(error){setupError=error;}}
  if(!state.recording){message(`Recording could not start (${setupError?.name||'unsupported format'}). Share the tab again or try a local video.`);stopScan();return;}
  const recorder=state.recording,frames=[],chunks=[],sourceName=state.sourceName,sourceType=state.sourceType,ownerProjectId=projectSession.current?.id;recorder.saved=new Promise((resolve,reject)=>{recorder.resolveSave=resolve;recorder.rejectSave=reject});recorder.saved.catch(()=>{});
  const start=sourceType==='file'?program.currentTime:liveTime();
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  recorder.onerror=event=>{message(`Recording stopped: ${event.error?.message||'the source became unavailable'}. Your captured windows remain in the queue.`);state.scanning=false;updateButtons()};
  recorder.onstop=()=>{clearTimeout(state.windowTimer);clearInterval(state.frameTimer);const blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'});const end=recorder.endTime??(sourceType==='file'?program.currentTime:liveTime());if(blob.size>1000)void processWindow(blob,frames,start,end,Boolean(recorder.manual),sourceName,sourceType,crop,sourcePixels,captureArea,ownerProjectId,recorder.resolveSave).catch(error=>{recorder.rejectSave(error);message('Live window could not be saved: '+error.message)});else recorder.resolveSave();if(state.recording!==recorder)return;if(state.scanning&&state.recordStream?.getVideoTracks().some(track=>track.readyState==='live')&&(sourceType!=='file'||!program.ended))startWindow();else if(state.scanning){stopScan();message(sourceType==='file'?'Video finished. Captured moments are ready to edit.':'The shared tab stopped. Share it again to continue scanning.');}};
  try{recorder.start();grabFrame(frames,captureArea);state.frameTimer=setInterval(()=>grabFrame(frames,captureArea),4000);state.windowTimer=setTimeout(()=>{if(recorder.state==='recording'){recorder.endTime=sourceType==='file'?program.currentTime:liveTime();recorder.stop();}},WINDOW_MS);}catch(error){message(`Recorder could not continue (${error.name||'unknown error'}). Captured windows remain available.`);stopScan();}
}
program.addEventListener('ended',()=>{if(state.scanning)stopScan(`Video finished at ${formatTime(program.duration)}. Captured windows are ready to edit.`);});
program.addEventListener('loadedmetadata',()=>{updateSourceQuality();renderWholeSubtitles();renderScanCoverage()});
program.addEventListener('play',()=>{if(state.sourceType==='file')claimPlayback()});
program.addEventListener('timeupdate',()=>{if(state.sourceType!=='screen')$('timecode').textContent=formatTime(program.currentTime)});
setInterval(()=>{$('clock').textContent=new Date().toLocaleTimeString('en-GB',{hour12:false});if(state.sourceType==='screen')$('timecode').textContent=formatTime(liveTime())},1000);
function batchProgress(text){$('batchProgress').textContent=text;if(state.batchRunning||state.batchExporting)setActivity('batch',state.batchExporting?'Rendering your clips':'Generating your clip drop',text)}
function batchMoments(){return state.moments.filter(moment=>moment.batchId&&(state.source?.importId?moment.blob?.importId===state.source.importId:moment.batchId===state.batchId))}
function renderBatchDownloads(){
  $('batchDownloads').innerHTML=state.batchExports.length?`<div class="batch-download-head"><strong>Rendered draft clips</strong><span>No unreviewed hooks or captions · open each clip to finish</span></div>${state.batchExports.map(exported=>`<a href="${exported.url}" download="${escapeHtml(exported.name)}">${escapeHtml(exported.name)} </a>`).join('')}`:'';
}
async function exportBatchDrafts(moments){
  if(state.batchExporting)return;state.batchExporting=true;renderBatchResults();
  try{for(const m of moments)await queueVideoExport([m],`context-desk-${Math.floor(m.start)}-draft`,{draft:true,openJobs:false});showWorkspace('jobs');batchProgress(`${moments.length} draft exports queued. Words and opening overlays are omitted until reviewed.`)}catch(error){batchProgress(error.message)}finally{state.batchExporting=false;renderBatchResults()}
}

function renderScanCoverage(){
  const moments=batchMoments(),duration=Number.isFinite(program.duration)?program.duration:0,coverage=coverageSummary(moments,duration);
  $('scanCoverage').hidden=!duration;$('scanCoverage').textContent=duration?`${formatTime(coverage.checked)} of ${formatTime(duration)} story-checked · ${coverage.percent}% coverage · ${moments.length} sampled windows. Gaps have not been checked.`:'';
}

function renderBatchResults(){
  renderScanCoverage();
  if(!state.batchId)return;
  const target=Number($('clipTarget').value),all=batchMoments(),suggested=all.filter(moment=>moment.status==='suggested'||moment.approved).sort((a,b)=>(a.start-b.start)*($('clipDirection').value==='desc'?-1:1)).slice(0,target);
  if(!all.length){$('batchResults').innerHTML='';renderScanCoverage();return;}
  $('batchResults').innerHTML=suggested.length?`<div class="batch-result-heading"><strong>${suggested.length} suggested / producer-picked ${suggested.length===1?'moment':'moments'}</strong><span>Review them in Story discovery</span></div><div class="batch-actions"><button class="batch-render-button" id="renderBatchDrafts" ${state.batchRunning||state.batchExporting?'disabled':''}>${state.batchExporting?'Queuing drafts…':`Render ${suggested.length} clean drafts`}</button><button class="batch-plan-button" id="downloadBatchPlan">Download clip plan</button></div>`:'<div class="batch-no-match"><strong>No strong beat confirmed.</strong><p>Review the checked windows or run another pass. A target is not a guaranteed yield.</p></div>';
  const renderButton=$('renderBatchDrafts');if(renderButton)renderButton.onclick=()=>exportBatchDrafts(suggested);
  const plan=$('downloadBatchPlan');if(plan)plan.onclick=()=>{
    const entries=suggested.map(moment=>({source:moment.sourceName,sourceLink:moment.sourceLink,startSeconds:moment.start,endSeconds:moment.end,hook:moment.hook,beat:moment.analysis?.beatType,evidence:moment.analysis?.evidence,reason:moment.analysis?.reason,risk:moment.analysis?.riskNote,transcript:moment.transcript,sourceCaptionsVisible:Boolean(moment.sourceCaptionsVisible),sourceCaptionMask:Boolean(moment.sourceCaptionMask),editorReviewRequired:true}));
    download(new Blob([JSON.stringify({source:state.sourceName,generatedAt:new Date().toISOString(),clips:entries},null,2)],{type:'application/json'}),'context-desk-clip-plan.json');
  };
}
function batchSignal(audio,start,end){
  if(!audio)return 0;
  const channel=audio.getChannelData(0),rate=audio.sampleRate,parts=[];
  for(let section=0;section<3;section++){
    const from=Math.floor((start+(end-start)*section/3)*rate),to=Math.min(channel.length,Math.floor((start+(end-start)*(section+1)/3)*rate));
    let energy=0,count=0;for(let i=from;i<to;i+=240){energy+=channel[i]*channel[i];count++}
    parts.push(count?Math.sqrt(energy/count):0);
  }
  return Math.min(1,Math.max(...parts)*8+Math.max(...parts)-Math.min(...parts));
}
async function batchAudioData(audio,start,end){
  if(!audio)return {data:null,rms:null};
  const length=Math.floor((end-start)*16000),pcm=new Int16Array(length),ratio=audio.sampleRate/16000,channels=Array.from({length:audio.numberOfChannels},(_,index)=>audio.getChannelData(index));
  let energy=0;
  for(let i=0;i<length;i++){
    const sourceIndex=Math.floor(start*audio.sampleRate+i*ratio);
    const sample=channels.reduce((sum,channel)=>sum+(channel[sourceIndex]||0),0)/channels.length;
    energy+=sample*sample;pcm[i]=Math.max(-1,Math.min(1,sample))*32767;
  }
  const rms=Math.sqrt(energy/Math.max(1,length));if(rms<.001)return {data:null,rms};
  const buffer=new ArrayBuffer(44+pcm.byteLength),view=new DataView(buffer);
  const write=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i))};
  write(0,'RIFF');view.setUint32(4,36+pcm.byteLength,true);write(8,'WAVE');write(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,pcm.byteLength,true);
  pcm.forEach((value,index)=>view.setInt16(44+index*2,value,true));
  const data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(new Blob([buffer],{type:'audio/wav'}))});
  return {data,rms};
}
async function seekFrame(video,time,canvas){
  if(Math.abs(video.currentTime-time)>.04){
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{video.removeEventListener('seeked',ready);reject(Error('Could not seek this video. Try Scan as it plays.'))},8000);
      const ready=()=>{clearTimeout(timeout);resolve()};video.addEventListener('seeked',ready,{once:true});video.currentTime=time;
    });
  }
  const width=Math.min(640,video.videoWidth),height=Math.max(2,Math.round(width*video.videoHeight/video.videoWidth));
  canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(video,0,0,width,height);
  const small=document.createElement('canvas');small.width=48;small.height=27;small.getContext('2d').drawImage(canvas,0,0,48,27);
  return {image:canvas.toDataURL('image/jpeg',.66),pixels:small.getContext('2d',{willReadFrequently:true}).getImageData(0,0,48,27).data};
}
function frameChange(first,second){let sum=0;for(let index=0;index<first.length;index+=4)sum+=Math.abs(first[index]-second[index])+Math.abs(first[index+1]-second[index+1])+Math.abs(first[index+2]-second[index+2]);return Math.min(1,sum/(first.length/4)/110)}
function chooseBatchWindows(windows,count){
  const ranked=[...windows].sort((a,b)=>b.signal-a.signal),chosen=[],quarters=Math.min(4,count);
  for(let quarter=0;quarter<quarters;quarter++){
    const inQuarter=ranked.find(window=>Math.floor(window.start/windows.at(-1).end*quarters)===quarter&&!chosen.includes(window));
    if(inQuarter)chosen.push(inQuarter);
  }
  for(const window of ranked){if(chosen.length>=count)break;if(!chosen.includes(window))chosen.push(window)}
  return chosen.sort((a,b)=>a.start-b.start);
}
function createBatchMoment(window,audio){
  const id=crypto.randomUUID(),sourcePixels={width:program.videoWidth,height:program.videoHeight,frameRate:30,frameRateKnown:false,audioTracks:audio?.data?1:0};
  return {id,url:state.sourceUrl,blob:state.source,frames:window.frames,start:window.start,end:window.end,mediaStart:window.start,batchId:state.batchId,sourceName:state.sourceName,sourceType:'file',sourceCrop:null,sourceCaptureArea:null,sourcePixels,cleanCapture:false,sourceLink:state.sourcePageUrl||'',manual:false,status:state.meta?'analysing':'needs-key',analysis:null,transcript:'',trimIn:0,trimOut:window.end-window.start,hook:'',alternateHook:'',frameMode:'fit',zoom:1,focusX:50,focusY:50,showHook:false,captionLanguage:'Original',autoCaptionLanguage:$('liveCaptionLanguage').value,captionStyle:'punch',dialectNote:$('sourceDialect').value.trim(),captionCues:{Original:[]},captionReviewed:{},showCaptions:false,captionError:'',audioRms:audio?.rms??null,audioData:audio?.data||null};
}
$('clipTarget').onchange=()=>{$('batchButton').textContent=`Find ${$('clipTarget').value} clips across video `;renderBatchResults()};
$('batchButton').onclick=async()=>{
  if(state.sourceType!=='file'||!state.source?.importId)return;
  const current=jobsView.jobs.find(j=>j.kind==='discovery'&&j.projectId===projectSession.current?.id&&['queued','running'].includes(j.status));
  if(current){showWorkspace('jobs');return}
  const remaining=aiLimit()?Math.max(0,aiLimit()-state.aiCalls):100;
  if(!remaining){batchProgress('Your AI window limit is reached. Raise it in Scan settings or review existing clips.');return}
  const button=$('batchButton');button.disabled=true;setActivity('queue','Saving your discovery job','Your source and language choices are being saved before processing.');
  try{await projectSession.flush();const j=await requestJson('/api/discovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceId:state.source.importId,projectId:projectSession.current.id,depth:Number($('scanDepth').value),clipLength:$('clipLength')?.value||'auto',budget:Math.min(remaining,Number($('clipTarget').value)*3,100),speechProvider:$('speechProvider').value,translationProvider:$('translationProvider').value,speechLanguage:speechChoices(),keywords:$('speechKeywords').value,dialectNote:$('sourceDialect').value,translationMode:$('translationMode').value,glossary:$('glossary').value,memoryId:memoryView.id,context:$('showContext').value,storyLens:$('storyLens').value,language:$('liveCaptionLanguage').value,...(()=>{const options=discoveryTools.discoveryOptions();return {...options,strategy:options.strategy==='sampled'?'fast':options.strategy}})()})});state.batchId=j.id;projectSession.changed();await jobsView.refresh();batchProgress('Discovery queued. Open Jobs for progress; clips appear here as each check finishes.');}
  catch(error){batchProgress(error.message)}finally{button.disabled=false;finishActivity('queue')}
};

async function processWindow(blob,frames,start,end,manual,sourceName,sourceType,crop,sourcePixels,captureArea,ownerProjectId=projectSession.current?.id,onSaved=()=>{}){
  const id=crypto.randomUUID(),url=URL.createObjectURL(blob);
  const shouldAnalyze=state.meta&&!state.captureStalled&&(manual||!aiLimit()||state.aiCalls<aiLimit());
  const item={id,url,blob,frames:frames.slice(0,3),start,end,sourceName,sourceType,sourceCrop:crop,sourceCaptureArea:captureArea,sourcePixels,cleanCapture:sourceType==='screen',sourceLink:sourceType==='screen'?$('streamUrl').value.trim():'',manual,status:shouldAnalyze?'analysing':state.meta?'budgeted':'needs-key',analysis:null,transcript:'',trimIn:0,trimOut:Math.max(.1,(end-start)),hook:'',alternateHook:'',frameMode:'fit',zoom:1,focusX:50,focusY:50,showHook:true,captionLanguage:'Original',autoCaptionLanguage:$('liveCaptionLanguage').value,captionStyle:'punch',dialectNote:$('sourceDialect').value.trim(),captionCues:{Original:[]},captionReviewed:{},showCaptions:false,captionError:''};
  item.ownerProjectId=ownerProjectId;item.requestSettings={showContext:$('showContext').value,storyLens:$('storyLens').value,speechProvider:$('speechProvider').value,speechLanguage:speechChoices(),keywords:$('speechKeywords').value};
  if(ownerProjectId!==projectSession.current?.id){const asset=await projectSession.asset(blob);item.url=asset.url;item.blob={assetId:asset.id,size:asset.size,type:asset.type};item.status='captured';await saveDetachedMoment(ownerProjectId,item);onSaved();return}
  state.moments.unshift(item);state.windowCount++;renderQueue();
  await projectSession.asset(blob);projectSession.changed();await projectSession.flush();onSaved();
  const audioInfo=await audioAsWav(blob);
  item.audioRms=audioInfo?.rms??null;
  if(sourceType==='screen'){
    const stillPicture=frames.length>=2&&frames.every(frame=>frame===frames[0]);
    const silentAudio=!sourcePixels.audioTracks||audioInfo?.rms!==null&&audioInfo?.rms!==undefined&&audioInfo.rms<.001;
    state.staticSilentWindows=stillPicture&&silentAudio?state.staticSilentWindows+1:0;
    if(state.captureStalled||state.staticSilentWindows>=2){
      state.captureStalled=true;item.status='stalled';item.error='Shared picture stayed unchanged and audio was missing or silent. Check the source tab and tab-audio sharing before scanning again.';
      renderQueue();if(state.selected===id)renderEditor();
      if(state.scanning)stopScan('Capture appears stalled: picture unchanged and audio missing or silent across two windows. Scan paused to save Meta credits. Keep the video tab playing, share its audio, or load a local file.');
      return;
    }
    if(stillPicture&&silentAudio){
      item.status='silent';item.error='No audible audio or picture change in this window. Waiting for the next window before calling Meta.';
      renderQueue();if(state.selected===id)renderEditor();
      return;
    }
  }
  if(!shouldAnalyze){if(state.meta)message('AI window limit reached. Capture continues locally; raise the limit or mark a moment to request an analysis.');return;}
  try{await analyzeItem(item,audioInfo?.data||null);}
  catch(error){item.status='error';item.error=error.message;}
  if(projectSession.current?.id===ownerProjectId){renderQueue();if(state.selected===id)renderEditor();}
}
async function saveDetachedMoment(projectId,item,baseline=item){const asset=item.blob instanceof Blob?await projectSession.asset(item.blob):null;const value={};for(const key of savedMomentKeys)if(item[key]!==undefined)value[key]=item[key];if(asset){value.url=asset.url;value.blob={assetId:asset.id,size:asset.size,type:asset.type}}return await requestJson('/api/projects/'+projectId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'moment-result',moment:value,baseline})})}
async function analyzeItem(item,audio){
  const ownerProjectId=item.ownerProjectId||projectSession.current?.id,baseline=structuredClone(Object.fromEntries(['hook','alternateHook','captionCues','captionLanguage','showCaptions','captionError'].map(k=>[k,item[k]])));const requestToken=crypto.randomUUID(),activityId=item.id+':analysis:'+requestToken;item.analysisToken=requestToken;item.status='analysing';if(projectSession.current?.id===ownerProjectId){const visible=state.moments.find(m=>m.id===item.id);if(visible&&visible!==item){visible.analysisToken=item.analysisToken;visible.status='analysing'}projectSession.changed();await projectSession.flush()}const started=await requestJson('/api/projects/'+ownerProjectId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'analysis-start',momentId:item.id,analysisToken:requestToken})});if(projectSession.current?.id===ownerProjectId){state.aiCalls=started.aiCalls;updateBudgetUi()}
  setActivity(activityId,'Finding the story','Transcribing audio and checking the picture. You can keep navigating.');
  try{
  if(audio===undefined){if(item.batchId){audio=item.audioData;if(!audio&&item.blob?.importId){const result=await requestJson('/api/import/'+item.blob.importId+'/audio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start:item.start,end:item.end})});audio=result.data}}else{const blob=item.blob instanceof Blob?item.blob:await (await fetch(item.url)).blob();audio=(await audioAsWav(blob)).data}}
  const requestFrames=await Promise.all(item.frames.map(async frame=>frame.startsWith('data:')?frame:await blobDataUrl(await (await fetch(frame)).blob())));
  const previous=state.moments[state.moments.indexOf(item)+1];
  const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({frames:requestFrames,audio,...(item.requestSettings||{showContext:$('showContext').value,storyLens:$('storyLens').value,speechProvider:$('speechProvider').value,speechLanguage:speechChoices(),keywords:$('speechKeywords').value}),dialectNote:item.dialectNote,previousTranscript:previous?.transcript||''})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Analysis failed');if(item.analysisToken!==requestToken)return;
  item.analysis=data.analysis;item.transcript=data.transcript||'';item.speechError=data.speechError||'';item.speechSource=data.speechSource||'';item.detectedLanguage=data.detectedLanguage||'';item.timingSource=Array.isArray(data.words)&&data.words.length?'word':'estimated';
  item.sourceCaptionsVisible=data.analysis?.visibleSourceCaptions===true;
  if(item.sourceCaptionsVisible)item.sourceCaptionMask=true;
  let lastEnd=0;
  item.captionCues={Original:speechCues(data,item.end-item.start).map(cue=>{cue.start=Math.max(cue.start,lastEnd);if(cue.end-cue.start<.2)return null;lastEnd=cue.end;return cue}).filter(Boolean)};
  item.captionReviewed={};item.captionLanguage=captionTarget(item,item.autoCaptionLanguage);item.showCaptions=!item.batchId&&Boolean(item.captionCues.Original.length);
  item.status=data.analysis?data.analysis.worthClipping?'suggested':'not-selected':'error';
  item.error=data.analysisError||'';item.hook=data.analysis?.hook||'';item.alternateHook=data.analysis?.alternateHook||'';
  if(item.autoCaptionLanguage!=='Original'&&item.captionCues.Original.length){
    try{const translated=await translateCues(item,item.autoCaptionLanguage);item.captionCues[item.autoCaptionLanguage]=translated;item.captionLanguage=item.autoCaptionLanguage;item.captionError=translated.some(cue=>cue.text.length>100)?'Some translated lines are too long. Split and retime before export.':'';}
    catch(error){item.translationError=error.message||'Translation failed';}
  }
  showLiveDraft(item);
  }catch(error){if(item.analysisToken===requestToken){item.status='error';item.error=error.message}throw error}
  finally{finishActivity(activityId);if(item.analysisToken===requestToken)try{const saved=await saveDetachedMoment(ownerProjectId,item,baseline);if(projectSession.current?.id===ownerProjectId){const visible=state.moments.find(m=>m.id===item.id);if(visible&&visible!==item)Object.assign(visible,mergeAnalysisCompletion(visible,baseline,saved.moment));renderQueue();if(state.selected===item.id)renderEditor()}}catch(error){message('Analysis result not saved: '+error.message)}}
}

const momentTranslationCache=createTranslationCache();
async function translateCues(item,language,{force=false}={}){
  const cues=item.captionCues.Original.map(c=>({...c})),variant=findVariant(language,item.captionVariants?.[language])?.id||'',script=item.captionScripts?.[language]==='roman'?'roman':'native',dialect=[item.dialectNote||'',variant,script].join('|'),provider=$('translationProvider').value,sourceLanguage=item.detectedLanguage||speechChoices();
  const originalKey=translationKey(cues,language,dialect,provider,sourceLanguage,item.translationMode||$('translationMode').value,$('glossary').value);if(force)item.translationRevision=(item.translationRevision||0)+1;const key=originalKey+':'+(item.translationRevision||0);
  // /api/translate takes at most 30 lines, so long clips go in ordered batches (3 at a time).
  // Each batch is cached on the server, so a retry only pays for batches that failed.
  const result=await momentTranslationCache.get(item,key,async()=>{
    const batches=[];for(let i=0;i<cues.length;i+=25)batches.push(cues.slice(i,i+25));const parts=new Array(batches.length);let next=0,warning='',providerName='';
    const send=async index=>{const response=await fetch('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language,variant,script,provider,sourceLanguage,dialectNote:item.dialectNote||'',translationMode:item.translationMode||$('translationMode').value,glossary:$('glossary').value,cues:batches[index].map(({text,speaker})=>({text,...(speaker?{speaker}:{})})),refresh:force})});
      const data=await response.json();if(!response.ok)throw Error(data.error||'Translation failed');if(data.lines?.length!==batches[index].length)throw Error('Translation returned an incomplete batch. Retry translation.');parts[index]=data.lines;warning||=data.warning||'';providerName||=data.provider||''};
    await Promise.all(Array.from({length:Math.min(3,batches.length)},async()=>{while(next<batches.length)await send(next++)}));
    return {lines:parts.flat(),warning,provider:providerName};
  });
  if(translationKey(item.captionCues.Original,language,dialect,provider,sourceLanguage,item.translationMode||$('translationMode').value,$('glossary').value)!==originalKey)throw Error('The original changed during translation. Select the language again.');
  item.translationSource=result.provider||'';item.translationWarning=result.warning||'';
  // The translator flags lines it could not render with confidence; those need review before export.
  return cues.map((cue,index)=>{const {words,...timed}=cue,line=result.lines[index];return {...timed,text:line.text,...(line.uncertain?{uncertain:true,reviewReason:'The translator was not sure of this line. Listen to the original before approving.'}:{})}});
}
// A clip cut from a recording with a completed whole-recording track uses those lines
// (no new speech or translation requests). Returns true when it supplied the track.
async function reuseWholeTrack(m,language){
  if(m.captionCues?.[language]?.length)return false;
  const sourceId=m.blob?.importId||String(m.url||'').match(/^\/api\/import\/([a-f0-9-]{36})\/media$/)?.[1];if(!sourceId)return false;
  const jobs=wholeJobs.length?wholeJobs:await fetch('/api/subtitles').then(r=>r.json()).then(d=>d.jobs||[]).catch(()=>[]);
  const job=jobs.find(j=>j.sourceId===sourceId&&j.language===language&&j.status==='complete'&&j.cueCount>0);if(!job)return false;
  try{const response=await fetch('/api/subtitles/'+job.id+'/track'),track=await response.json();if(!response.ok)return false;
    const local=cues=>projectTrack(cues,m);
    const cues=local(track.cues);if(!cues.length)return false;m.captionCues[language]=cues;if(!m.captionCues.Original?.length)m.captionCues.Original=local(track.original);
    m.captionReviewed[language]=false;m.translationError='';m.translationSource='Whole-recording track';if(m.captionLanguage===language)m.showCaptions=true;projectSession?.changed();if(state.selected===m.id)renderEditor();return true}
  catch{return false}
}
async function translateMoment(m,language,{force=false,confirmed=false}={}){
  if(language!=='Original'&&!force&&await reuseWholeTrack(m,language))return;
  if(language==='Original'||!m.captionCues.Original.length)return;
  if(m.captionCues[language]?.length&&!force){m.showCaptions=true;if(state.selected===m.id&&m.captionLanguage===language)renderEditor();return}
  const lines=m.captionCues.Original.length;if(lines>300&&!confirmed&&!confirm(`Translating ${lines} lines takes about ${Math.ceil(lines/25)} translation requests.${m.captionCues[language]?.length?' Your current subtitles stay until it finishes.':''} Continue?`)){if(state.selected===m.id)renderEditor();return}
  if(m.translationPending?.has(language)&&!force)return;
  const owner=projectSession?.current?.id,original=JSON.stringify(m.captionCues.Original),previous=JSON.stringify(m.captionCues[language]);
  // The newest request wins: an older response never replaces a newer style or variant choice.
  m.translationPending??=new Map();const token={};m.translationPending.set(language,token);m.translationError='';
  const activity=m.id+':translation:'+language;setActivity(activity,'Translating to '+language,'Keeping the source timing and meaning. You can keep editing.');if(state.selected===m.id)renderEditor();
  try{const cues=await translateCues(m,language,{force}),result={original,previous,language,cues,provider:m.translationSource};if(m.translationPending.get(language)!==token||!commitCaptionTranslation(m,result))return;const current=owner===projectSession?.current?.id?state.moments.find(item=>item.id===m.id):null;if(current&&(current===m||commitCaptionTranslation(current,result))){projectSession.changed();await projectSession.flush()}}
  catch(error){if(m.captionLanguage===language&&m.translationPending.get(language)===token)m.translationError=(error.message||'Translation failed.')+(m.captionCues[language]?.length?' Your previous subtitles are still in use.':' Choose Retry translation.')}
  finally{if(m.translationPending.get(language)===token){m.translationPending.delete(language);finishActivity(activity);}if(owner===projectSession?.current?.id&&state.selected===m.id)renderEditor()}
}
function showLiveDraft(item){
  if(item.batchId||!state.scanning)return;
  if(item.start<state.lastDraftStart||!activeCues(item).length)return;
  state.lastDraftStart=item.start;$('liveCaptions').hidden=false;
  $('liveCaptionLabel').textContent=`Previous window · draft · ${item.captionLanguage.toUpperCase()} · ${formatTime(item.start)}–${formatTime(item.end)}`;
  const text=activeCues(item).map(cue=>cue.text).join(' ').slice(0,300);
  $('liveCaptionText').textContent=text;$('liveCaptionText').title='This is the previous analysed window, not subtitles synchronized to the live player. Open the clip for synchronized preview.';$('liveCaptionText').dir=/[\u0590-\u08ff]/.test(text)?'rtl':'ltr';
}
function splitTurnToCues(turn,duration){
  const start=Math.max(0,Number(turn.startMs)/1000),end=Math.min(duration,Number(turn.endMs)/1000),words=String(turn.text||'').trim().split(/\s+/).filter(Boolean);
  if(!words.length||!Number.isFinite(start)||!Number.isFinite(end)||end-start<.2)return [];
  const chunks=[];for(let i=0;i<words.length;i+=6)chunks.push(words.slice(i,i+6).join(' '));
  return chunks.map((text,index)=>({start:start+(end-start)*Math.floor(index*6)/words.length,end:start+(end-start)*Math.min(words.length,(index+1)*6)/words.length,text}));
}
function groupWordsToCues(words,duration){
  const cues=[],valid=words.filter(word=>word.text&&Number.isFinite(word.start)&&Number.isFinite(word.end)&&word.end>word.start&&word.start<duration);
  let group=[];
  const flush=()=>{if(!group.length)return;const start=group[0].start,end=Math.min(duration,group.at(-1).end);if(end-start>=.2)cues.push({start,end,text:group.map(word=>word.text).join(' ').replace(/\s+([,.!?;:])/g,'$1')});group=[]};
  for(const word of valid){if(group.length&&(word.start-group.at(-1).end>.45||group.length>=6))flush();group.push(word);if(/[.!?]$/.test(word.text)&&group.length>=2)flush()}
  flush();return cues;
}
async function audioAsWav(blob){
  let ctx;
  try{
    ctx=new AudioContext();
    const decoded=await ctx.decodeAudioData(await blob.arrayBuffer());
    const channels=Array.from({length:decoded.numberOfChannels},(_,index)=>decoded.getChannelData(index));
    const ratio=decoded.sampleRate/16000,length=Math.floor(channels[0].length/ratio);
    if(length<1600)return {data:null,rms:null};
    const pcm=new Int16Array(length);
    let energy=0;
    for(let i=0;i<length;i++){
      const sample=channels.reduce((sum,channel)=>sum+(channel[Math.floor(i*ratio)]||0),0)/channels.length;
      energy+=sample*sample;
      pcm[i]=Math.max(-1,Math.min(1,sample))*32767;
    }
    const rms=Math.sqrt(energy/length);
    if(rms<.001)return {data:null,rms};
    const buffer=new ArrayBuffer(44+pcm.length*2),view=new DataView(buffer);
    const write=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i))};
    write(0,'RIFF');view.setUint32(4,36+pcm.length*2,true);write(8,'WAVE');write(12,'fmt ');
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
    view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
    write(36,'data');view.setUint32(40,pcm.length*2,true);
    pcm.forEach((value,i)=>view.setInt16(44+i*2,value,true));
    const data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(new Blob([buffer],{type:'audio/wav'}))});
    return {data,rms};
  }catch{return {data:null,rms:null};}
  finally{if(ctx)await ctx.close();}
}

function renderQueue(markDirty=true){
  renderMomentMap();if(markDirty)projectSession?.changed();$('navClipCount').textContent=usableMoments(state.moments).length;
  document.querySelector('.workspace-nav [data-workspace="edit"]').disabled=!state.selected;
  document.body.classList.toggle('has-moment',Boolean(state.moments.length));document.body.classList.toggle('has-story',state.moments.length>=3||state.cut.length>0);
  const picks=usableMoments(state.moments);$('queueCount').textContent=picks.length+' clip suggestions · '+state.moments.length+' retained windows';editorTools.collection(state.moments,state.selected);discoveryTools?.sync();
  const moments=visibleMoments(state.moments,{query:$('momentSearch').value,filter:$('momentFilter').value,direction:$('clipDirection').value,sort:$('clipSort')?.value||'score'});visibleClipIds=moments.map(m=>m.id);
  if($('clipHeadline'))$('clipHeadline').textContent=picks.length?`${picks.length} ${picks.length===1?'clip':'clips'} found`:state.moments.length?'No clips suggested yet':'No clips yet';
  $('momentResultCount').textContent=moments.length+' of '+state.moments.length+' windows';
  const selectable=new Set(state.moments.map(m=>m.id));for(const id of clipSelection)if(!selectable.has(id))clipSelection.delete(id);
  $('queue').classList.add('cd-grid');$('queue').style.setProperty('--thumb-ratio',{portrait:'9 / 16',square:'1 / 1',fourfive:'4 / 5',landscape:'16 / 9'}[state.aspect]||'9 / 16');renderClipChips();$('queue').classList.toggle('has-selection',clipSelection.size>0);
  $('queue').innerHTML=moments.length?moments.map(m=>{const chosen=clipSelection.has(m.id),reading=m.status==='analysing',canWatch=state.sourceType==='file'&&m.blob?.importId===state.source?.importId;return `<article class="cd-card moment ${m.id===state.selected?'active':''} ${chosen?'is-selected':''} ${reading?'is-scanning':''}" data-card="${m.id}" tabindex="0" aria-label="${escapeHtml(m.hook||'Source window at '+formatTime(m.start))}">
    <div class="cd-thumb">${clipThumb(m)?`<img src="${escapeHtml(clipThumb(m))}" alt="Source frame at ${formatTime(m.start)}" loading="lazy">`:'<div class="cd-thumb-fill"></div>'}
    <div class="cd-thumb-top"><button type="button" class="cd-check" data-select-moment="${m.id}" role="checkbox" aria-checked="${chosen}" aria-label="Select this clip"></button><span class="cd-dur">${formatTime((m.trimOut??m.end-m.start)-(m.trimIn||0))}</span></div>
    ${reading?'':`<div class="cd-quick"><button type="button" class="cd-btn cd-btn-sm cd-btn-primary" data-export-moment="${m.id}">Export<kbd class="cd-kbd">E</kbd></button><button type="button" class="cd-btn cd-btn-sm cd-btn-secondary" data-discard-moment="${m.id}" aria-label="Discard clip">✕</button></div>`}</div>
    <div class="cd-card-body"><div class="cd-card-meta" data-card-status="${m.id}"></div>
    <h3 class="cd-card-title">${escapeHtml(m.hook||({'analysing':'Reading this moment…','interrupted':'Analysis interrupted','not-selected':'No strong beat found',error:'Analysis needs attention'}[m.status]||'Review this window'))}</h3>
    <p class="cd-card-why">${escapeHtml(m.analysis?.rankingReason||m.analysis?.reason||m.error||'Watch the original window and decide whether it deserves a clip.')}</p>
    <div class="cd-card-meta"><span class="cd-tc">${formatTime(m.start+(m.trimIn||0))} → ${formatTime(m.start+(m.trimOut??m.end-m.start))}</span><span>${escapeHtml((m.sourceName||state.sourceName||$('projectTitle')?.value||'').slice(0,24))}</span></div></div></article>`}).join(''):
    '<div class="queue-empty"><h3>'+(state.moments.length?'No matching windows':state.source?'Ready to find a story':'Add your first video')+'</h3><p>'+(state.moments.length?'Try another search or show all windows.':state.source?'Choose Find clips below the video. Source-linked results will appear here.':'Choose Add video to load a recording or connect a live tab.')+'</p></div>';
  for(const m of moments){const slot=$('queue').querySelector(`[data-card-status="${m.id}"]`);if(!slot)continue;const [tone,text,dot]=clipStatus(m);slot.append(badge(tone,text,dot));const score=m.analysis?.rankingScore;if(Number.isFinite(score))slot.append(scoreMeter(score,{size:'sm',animate:!shownScores.has(m.id)}));shownScores.add(m.id);}
  $('queue').querySelectorAll('[data-export-moment]').forEach(b=>b.onclick=event=>{event.stopPropagation();exportClip(b.dataset.exportMoment)});
  $('queue').querySelectorAll('[data-discard-moment]').forEach(b=>b.onclick=event=>{event.stopPropagation();discardClips([b.dataset.discardMoment])});
  $('queue').querySelectorAll('[data-review-source]').forEach(b=>b.onclick=event=>{event.stopPropagation();reviewSource(b.dataset.reviewSource)});
  $('queue').querySelectorAll('[data-select-moment]').forEach(b=>b.onclick=event=>{event.stopPropagation();toggleClipSelection(b.dataset.selectMoment)});
  $('queue').querySelectorAll('[data-card]').forEach(card=>{const id=card.dataset.card,m=state.moments.find(x=>x.id===id);
    card.onclick=event=>{if(event.shiftKey&&lastSelected){selectRange(lastSelected,id);return}if(clipSelection.size||event.metaKey||event.ctrlKey)toggleClipSelection(id);else inspectClip(id)};
    card.onkeydown=event=>{if(event.target!==card)return;if(event.key==='Enter'&&m.status!=='analysing'){event.preventDefault();selectMoment(id)}else if(event.key===' '){event.preventDefault();toggleClipSelection(id)}};});
  renderBulkBar();renderInspector();updateArcButton();
}
function clipStatus(m){
  return {scanning:['cue','Scanning',true],failed:['danger','Failed'],exported:['neutral','Exported ✓'],review:['warning',m.status==='suggested'||m.approved?'Review captions':'Needs attention'],ready:['volt','Ready'],other:['neutral','No strong beat']}[clipState(m)];
}
// Filter chips with live counts and the score sort chip (design-system Workspace header).
function renderClipHeader(){
  let head=$('clipHeadRow');const headline=$('clipHeadline');if(!headline)return;
  if(!head){head=document.createElement('div');head.id='clipHeadRow';head.className='ds-clip-head';const text=document.createElement('div');const label=document.createElement('span');label.className='cd-label';label.id='clipHeadLabel';headline.before(head);text.append(label,headline);
    const all=document.createElement('button');all.type='button';all.id='exportAllReady';all.className='cd-btn cd-btn-primary';all.onclick=()=>exportClips(state.moments.filter(m=>!m.dismissed&&clipState(m)==='ready'));head.append(text,all);}
  $('clipHeadLabel').textContent=$('projectTitle')?.value||state.sourceName||'';
  const ready=state.moments.filter(m=>!m.dismissed&&clipState(m)==='ready').length,all=$('exportAllReady');all.disabled=!ready;all.replaceChildren(document.createTextNode(ready?`Export all ready (${ready}) ↗`:'Export all ready ↗'),kbd('⇧E'));
}
function renderClipChips(){renderClipHeader();
  let row=$('clipChips');if(!row){row=document.createElement('div');row.id='clipChips';row.className='ds-chip-row';row.setAttribute('role','toolbar');row.setAttribute('aria-label','Filter clips');document.querySelector('.moment-filters')?.before(row)}
  const live=state.moments.filter(m=>!m.dismissed),count=k=>live.filter(m=>clipState(m)===k).length,current=$('momentFilter').value;
  const chips=[['all',`All ${live.length}`],['ready',`Ready ${count('ready')}`],['review',`Needs review ${count('review')}`],['exported',`Exported ${count('exported')}`],['dismissed',`Discarded ${state.moments.length-live.length}`]];
  row.replaceChildren(...chips.map(([value,label])=>{const b=document.createElement('button');b.type='button';b.className='ds-chip';b.textContent=label;b.setAttribute('aria-pressed',String(current===value||(value==='all'&&current==='supported')));b.onclick=()=>{$('momentFilter').value=value;renderQueue(false)};return b}));
  const sort=document.createElement('button');sort.type='button';sort.className='ds-chip';const score=($('clipSort')?.value||'score')==='score';sort.textContent=score?'Sort: score ↓':'Sort: source order';sort.onclick=()=>{$('clipSort').value=score?'time':'score';renderQueue(false)};row.append(sort);
}
function toggleClipSelection(id){clipSelection.has(id)?clipSelection.delete(id):clipSelection.add(id);lastSelected=id;renderQueue(false);$('queue').querySelector(`[data-card="${id}"]`)?.focus()}
function renderBulkBar(){
  bulkBar??=createBulkBar($('queue').parentElement);
  const chosen=state.moments.filter(m=>clipSelection.has(m.id)),cuttable=chosen.filter(m=>m.status!=='analysing'&&!state.cut.includes(m.id)),pickable=chosen.filter(m=>m.batchId&&!m.approved);
  const exportable=chosen.filter(m=>m.status!=='analysing');
  bulkBar.render(chosen.length,[
    {label:`Export ${exportable.length} ↗`,shortcut:'E',disabled:!exportable.length,run:()=>exportClips(exportable)},
    {label:'Captions',variant:'ghost',disabled:!exportable.length,run:()=>{for(const m of exportable){m.showCaptions=true}projectSession?.changed();renderQueue(false);toast(`Captions on for ${exportable.length} ${exportable.length===1?'clip':'clips'}.`)}},
    {label:'Reframe',variant:'ghost',run:()=>{$('aspectSelect').value=state.aspect==='portrait'?'landscape':'portrait';$('aspectSelect').dispatchEvent(new Event('change',{bubbles:true}));renderQueue(false);toast(`Format: ${state.aspect==='portrait'?'9:16':'16:9'}.`)}},
    {label:'Discard',variant:'danger',shortcut:'X',run:()=>discardClips(chosen.map(m=>m.id))}
  ],()=>{clipSelection.clear();renderQueue(false)});
}
function addSelectionToCut(){
  const room=100-state.cut.length,ids=state.moments.filter(m=>clipSelection.has(m.id)&&m.status!=='analysing'&&!state.cut.includes(m.id)).map(m=>m.id);
  if(!ids.length)return;if(ids.length>room){message(`The rough cut holds 100 windows. ${room} more fit.`);return}
  stopCutPreview();state.cut.push(...ids);clipSelection.clear();renderCut();renderQueue();message(`${ids.length} ${ids.length===1?'clip':'clips'} added to the story cut.`);
}
function selectRange(from,to){const a=visibleClipIds.indexOf(from),b=visibleClipIds.indexOf(to);if(a<0||b<0){toggleClipSelection(to);return}for(const id of visibleClipIds.slice(Math.min(a,b),Math.max(a,b)+1))clipSelection.add(id);lastSelected=to;renderQueue(false)}
function selectAllVisible(){for(const id of visibleClipIds)clipSelection.add(id);renderQueue(false)}
// Discard hides a clip (kept in the project) and offers Undo instead of a confirm dialog.
function discardClips(ids){
  const targets=state.moments.filter(m=>ids.includes(m.id)&&!m.dismissed);if(!targets.length)return;
  for(const m of targets){m.dismissed=true;clipSelection.delete(m.id)}if(targets.some(m=>m.id===inspectedId))inspectedId=null;renderQueue();
  toast(`${targets.length} ${targets.length===1?'clip':'clips'} discarded.`,{action:'Undo',run:()=>{for(const m of targets)delete m.dismissed;renderQueue()}});
}
function restoreClip(id){const m=state.moments.find(x=>x.id===id);if(!m)return;delete m.dismissed;renderQueue();toast('Clip restored.')}
function inspectClip(id){inspectedId=id;renderInspector();$('queue').querySelector(`[data-card="${id}"]`)?.focus()}
// Discover inspector: the clip in focus, its evidence and one-key actions, above the source monitor.
function renderInspector(){
  let box=$('clipInspector');const host=document.querySelector('.monitor-panel');if(!host)return;
  if(!box){box=el('section','ds-inspector');box.id='clipInspector';box.setAttribute('aria-label','Clip inspector');host.prepend(box)}
  const m=state.moments.find(x=>x.id===inspectedId);box.hidden=!m;if(!m){box.replaceChildren();box.dataset.clip='';return}
  if(box.dataset.clip===m.id&&box.dataset.rev===String(m.trimIn)+m.trimOut+m.captionStyle+state.aspect+clipState(m))return;
  box.dataset.clip=m.id;box.dataset.rev=String(m.trimIn)+m.trimOut+m.captionStyle+state.aspect+clipState(m);box.replaceChildren();
  const head=el('div','cd-row ds-inspector-head'),[tone,text,dot]=clipStatus(m);head.append(badge(tone,text,dot));
  if(Number.isFinite(m.analysis?.rankingScore))head.append(scoreMeter(m.analysis.rankingScore,{size:'sm',animate:false}));
  const title=el('h2','ds-inspector-title',m.hook||'Review this window');
  // Preview in the project format with the clip's caption look over its hook.
  const frame=el('div','ds-inspector-frame');frame.dataset.aspect=state.aspect;frame.style.aspectRatio={portrait:'9 / 16',square:'1 / 1',fourfive:'4 / 5',landscape:'16 / 9'}[state.aspect]||'9 / 16';
  if(clipThumb(m)){const img=el('img');img.src=clipThumb(m);img.alt=`Source frame at ${formatTime(m.start)}`;frame.append(img)}
  const words=String(m.hook||'').split(/\s+/).filter(Boolean).slice(0,4),hit=words.reduce((a,w,i)=>w.length>(words[a]||'').length?i:a,0),cap=el('span',`ds-inspector-caption cd-look-${m.captionStyle||'punch'}`);
  words.forEach((w,i)=>{cap.append(i===hit?el('b',undefined,w):document.createTextNode(w));if(i<words.length-1)cap.append(document.createTextNode(' '))});frame.append(cap,el('span','cd-dur',formatTime((m.trimOut??m.end-m.start)-(m.trimIn||0))));
  // Format, trim, caption look, export: the same controls as the design system's Workspace inspector.
  const format=el('div','cd-seg');format.setAttribute('role','radiogroup');format.setAttribute('aria-label','Format');const formats=[['portrait','9:16'],['square','1:1'],['landscape','16:9']],thumb=el('span','cd-seg-thumb');thumb.style.width='calc((100% - 6px) / 3)';format.append(thumb);
  formats.forEach(([value,label],idx)=>{const b=el('button',undefined,label);b.type='button';b.setAttribute('role','radio');b.setAttribute('aria-checked',String(state.aspect===value));if(state.aspect===value)thumb.style.transform=`translateX(${idx*100}%)`;b.onclick=()=>{$('aspectSelect').value=value;$('aspectSelect').dispatchEvent(new Event('change',{bubbles:true}));renderQueue(false)};format.append(b)});
  const window=m.end-m.start,trim=createTrim({duration:window,value:[m.trimIn||0,m.trimOut??window],onCommit:([a,b])=>{m.trimIn=a;m.trimOut=b;projectSession?.changed();
    // Re-rendering rebuilds the inspector; keep keyboard focus on the handle being nudged.
    const handle=['in','out'].find(side=>document.activeElement?.classList.contains('cd-handle-'+side));renderQueue(false);if(handle)document.querySelector('.ds-inspector .cd-handle-'+handle)?.focus()}});
  audioPeaks(m).then(p=>{if(p&&inspectedId===m.id)trim.setPeaks(p)});
  const looks=el('div','cd-looks');looks.setAttribute('role','radiogroup');looks.setAttribute('aria-label','Caption look');
  for(const [id,name,sample] of [['punch','Punch',['NO ','WAY','']],['pop','Pop',['','wait','?!']],['clean','Clean',['','','No way.']]]){const t=el('button',`cd-look cd-look-${id}`);t.type='button';t.setAttribute('role','radio');t.setAttribute('aria-checked',String((m.captionStyle||'punch')===id));const smp=el('span','cd-look-sample',sample[0]);if(sample[1])smp.append(el('b',undefined,sample[1]));if(sample[2])smp.append(document.createTextNode(sample[2]));t.append(smp,el('span','cd-look-name',name));t.onclick=()=>{m.captionStyle=id;projectSession?.changed();renderInspector()};looks.append(t)}
  const go=el('button','cd-btn cd-btn-lg cd-btn-primary ds-inspector-export','Export clip ↗');go.type='button';go.append(kbd('E'));go.disabled=m.status==='analysing';go.onclick=()=>exportClip(m.id);
  const more=el('details','ds-inspector-more');more.append(el('summary',undefined,'Evidence and more'));const why=el('dl','ds-inspector-evidence');
  for(const [label,value] of [['Why this moment',m.analysis?.rankingReason||m.analysis?.reason],['Direct evidence',m.analysis?.evidence],['Check before sharing',m.analysis?.riskNote],['Transcript',m.transcript&&m.transcript.slice(0,360)]])if(value)why.append(el('dt','cd-label',label),el('dd',undefined,value));
  const actions=el('div','cd-row');const open=el('button','cd-btn cd-btn-sm cd-btn-ghost','Open in Studio');open.type='button';open.append(kbd('↵'));open.onclick=()=>selectMoment(m.id);actions.append(open);
  more.append(why,actions);box.append(head,title,frame,format,trim.el,looks,go,more);
}
// After a link or file is ready: translate the title, start whole-recording subtitles and find clips,
// or say exactly which service is missing instead of waiting silently.
function missingServiceMessage(what){return `${what} needs the Meta key: add MODEL_API_KEY=… to the .env file in the Context Desk folder and restart the app. Or open VoiceStudio and choose it for speech and translation in Settings.`}
function wholeServiceReady(language){const vs=state.voiceStudio&&$('speechProvider').value==='voicestudio';return Boolean(state.meta||(vs&&(language==='Original'||$('translationProvider').value==='voicestudio')))}
async function translateTitle(target){
  const title=$('projectTitle')?.value?.trim();if(!title||target==='Original'||!state.meta)return;
  try{const r=await requestJson('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:target,translationMode:'natural',cues:[{text:title}]})});const text=r.lines?.[0]?.text?.trim();
    if(text&&text!==title){$('projectTitle').value=text;$('projectTitle').title=`Original title: ${title}`;$('projectTitle').dispatchEvent(new Event('input',{bubbles:true}));$('projectTitle').dispatchEvent(new Event('change',{bubbles:true}));projectSession?.changed()}}catch{/* Keep the original title. */}
}
// Home > Subtitles for the whole video: open the whole-recording track and start it, no clip scan.
function subtitleWholeVideo(target){
  $('openWholeSubtitles').onclick();
  if(!wholeServiceReady(target))return; // The section itself says which key or local engine it needs.
  $('wholeLanguage').value=target;if($('wholeLanguage').value!==target){$('wholeCost').textContent=`Whole-video subtitles are not available in ${target} yet. Choose a language here, then Generate full subtitles.`;return}
  $('wholeLanguage').dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>{if(!$('startWholeSubtitles').disabled)$('startWholeSubtitles').click()},400);
}
async function afterImport(auto){
  const target=projectCaptionTarget();
  void translateTitle(target);
  if(auto&&pendingIntent==='translate'){subtitleWholeVideo(target);return}
  if(auto&&target!=='Original'&&$('autoWholeSubtitles')?.checked&&wholeServiceReady(target)){$('wholeLanguage').value=target;$('wholeLanguage').dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>{if(!$('startWholeSubtitles').disabled)$('startWholeSubtitles').click()},400)}
  if(!auto||!$('autoGenerate').checked){batchProgress('Recording ready. Choose Find clips to begin.');return}
  if(!state.meta){batchProgress(missingServiceMessage('Finding clips'));toast('Recording ready. Clip finding needs your Meta key.');return}
  await $('batchButton').onclick();
}
async function exportClips(list){
  if(!list.length)return;
  try{for(const m of list){await queueVideoExport([m],`context-desk-${Math.floor(m.start)}-edit`,{openJobs:false});m.exportedAt=Date.now()}projectSession?.changed();renderQueue(false);
    toast(`${list.length} ${list.length===1?'export':'exports'} queued.`,{action:'Open Activity',run:()=>showWorkspace('jobs')})}
  catch(error){toast(error.message||'Export could not start.')}
}
function exportClip(id){const m=state.moments.find(x=>x.id===id);return m?exportClips([m]):undefined}
// Discover keyboard map: J/K move, Enter edit, Space select, E export, X discard, A add to cut, ⌘A select all, Esc clear.
document.addEventListener('keydown',event=>{
  if(document.body.dataset.workspace!=='clips'||document.querySelector('dialog[open]')||/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'')||document.activeElement?.isContentEditable)return;
  const key=event.key.toLowerCase(),focusId=document.activeElement?.closest?.('[data-card]')?.dataset.card||inspectedId;
  if((event.metaKey||event.ctrlKey)&&key==='a'){event.preventDefault();selectAllVisible();return}
  if(event.metaKey||event.ctrlKey||event.altKey)return;
  if(key==='j'||key==='k'){event.preventDefault();const i=visibleClipIds.indexOf(focusId),n=Math.max(0,Math.min(visibleClipIds.length-1,i<0?0:i+(key==='j'?1:-1)));if(visibleClipIds[n])inspectClip(visibleClipIds[n]);return}
  if(key==='escape'){if(clipSelection.size){clipSelection.clear();renderQueue(false)}else if(inspectedId){inspectedId=null;renderInspector()}return}
  if(key==='e'&&event.shiftKey&&!focusId){event.preventDefault();$('exportAllReady')?.click();return}
  if(!focusId)return;const m=state.moments.find(x=>x.id===focusId);if(!m)return;
  if(key==='x'){event.preventDefault();discardClips(clipSelection.size?[...clipSelection]:[focusId])}
  else if(key==='e'&&event.shiftKey){event.preventDefault();$('exportAllReady')?.click()}
  else if(key==='e'&&m.status!=='analysing'){event.preventDefault();exportClip(focusId)}
});
document.addEventListener('keydown',event=>{if(event.key.toLowerCase()==='a'&&!clipSelection.size&&inspectedId&&document.body.dataset.workspace==='clips'&&!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'')&&!event.metaKey&&!event.ctrlKey){clipSelection.add(inspectedId);addSelectionToCut();return}if(event.key.toLowerCase()==='a'&&clipSelection.size&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'')&&document.body.dataset.workspace!=='edit'){event.preventDefault();addSelectionToCut()}});
async function reviewSource(id){
  const m=state.moments.find(m=>m.id===id),position=sourcePosition(m,program.duration);
  if(position===null||state.sourceType!=='file'||m.blob.importId!==state.source?.importId){message('This live window has its own recording. Open Edit clip to review it.');return;}
  showWorkspace('clips');clipVideo.pause();claimPlayback(program);program.muted=false;program.currentTime=position;program.focus();try{await program.play();$('mapReadout').textContent='Playing original context at '+formatTime(position)}catch{$('mapReadout').textContent='Source at '+formatTime(position)+' · press Play in the player'};
}

let editorLoadId=0;
async function selectMoment(id,{scroll=true}={}){
  const m=state.moments.find(x=>x.id===id);if(!m)return;
  inheritCaptionTarget(m,projectCaptionTarget());queueCaptionTarget(m);
  const loadId=++editorLoadId;if(state.sourceType==='file'){if(state.scanning)stopScan('Playback scan paused while editing.');program.pause()}stopCutPreview();clipVideo.pause();state.selected=id;
  showWorkspace('edit');renderQueue();renderEditor();setActivity('preview','Loading clip preview','Opening the selected source window…');
  try{await mediaReady(clipVideo);if(loadId!==editorLoadId)return;await seekPreview(mediaTime(m,m.trimIn));if(loadId!==editorLoadId)return;setPreviewSize();updatePreviewTime();}
  catch(error){$('editorStatus').textContent=error.message||'Preview failed. Select the clip again.';}
  finally{if(loadId===editorLoadId)finishActivity('preview');}
  // Workspace navigation already positions the page before loading media.
  // A delayed scroll after metadata arrives would interrupt the next edit.
}
function seekPreview(time){return new Promise((resolve,reject)=>{if(Math.abs(clipVideo.currentTime-time)<.04&&clipVideo.readyState>=2){resolve();return}const timeout=setTimeout(()=>{cleanup();reject(Error('The video is taking too long to load. Try selecting the clip again.'))},10000);const cleanup=()=>{clearTimeout(timeout);clipVideo.removeEventListener('seeked',ready)};const ready=()=>{cleanup();resolve()};clipVideo.addEventListener('seeked',ready,{once:true});clipVideo.currentTime=time;});}

function outputDimensions(quality='preview'){const side=quality===1080?1080:quality===720?720:540;return state.aspect==='portrait'?[side,Math.round(side*16/9)]:state.aspect==='square'?[side,side]:state.aspect==='fourfive'?[side,Math.round(side*5/4)]:[Math.round(side*16/9),side]}
// Sampled frame, or a still from the saved source near the clip's middle.
function clipThumb(m){if(m.frames?.[0])return m.frames[0];const id=String(m.url||'').match(/^\/api\/import\/([a-f0-9-]{36})\/media$/)?.[1];return id?`/api/import/${id}/frame?t=${Math.floor((m.mediaStart||0)+(m.trimIn+m.trimOut)/2)}`:''}
function mediaTime(moment,time){return (moment.mediaStart||0)+time}
function localTime(moment,time){return time-(moment.mediaStart||0)}
function activeCues(moment){return moment.captionCues[moment.captionLanguage]||[]}
function timedCues(moment){return syncedCues(activeCues(moment),moment.captionOffset||0,moment.end-moment.start)}
function cueText(cues){return cues.map(cue=>`${cue.start.toFixed(1)} --> ${cue.end.toFixed(1)} | ${cue.text}`).join('\n')}
function parseCues(raw,duration){
  const cues=[];let previousEnd=0;
  for(const [index,line] of raw.split(/\r?\n/).entries()){
    if(!line.trim())continue;
    const match=line.match(/^\s*(\d+(?:\.\d+)?)\s*-->\s*(\d+(?:\.\d+)?)\s*\|\s*(.+?)\s*$/);
    if(!match)return {error:`Line ${index+1}: use start --> end | spoken text.`};
    const start=Number(match[1]),end=Number(match[2]);
    if(start<previousEnd-.01||end<=start||end>duration+.15)return {error:`Line ${index+1}: check timing and keep lines in order within this window.`};
    if(match[3].length>100)return {error:`Line ${index+1}: split long captions into shorter timed lines (100 characters max).`};
    cues.push({start,end,text:match[3]});previousEnd=end;
  }
  return {cues};
}
function wrapLines(context,text,maxWidth){let words=text.split(/\s+/),lines=[],line='';for(const word of words){const trial=line?`${line} ${word}`:word;if(context.measureText(trial).width>maxWidth&&line){lines.push(line);line=word;}else line=trial;}if(line)lines.push(line);return lines}
function drawCaption(context,moment,sourceTime){
  if(!moment.showCaptions)return;
  const cue=displayCues(timedCues(moment),{mode:moment.captionMode==='accessible'?'accessible':'clean'}).find(c=>sourceTime>=c.start&&sourceTime<c.end);if(!cue)return;
  drawCaptionFrame(context,{cue,time:sourceTime,styleId:moment.captionStyle,look:moment.captionLook,offset:moment.captionOffset||0,accent:accentFor(moment,cue.text)});
}
function setPreviewSize(){const [width,height]=outputDimensions(),canvas=$('previewCanvas');if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}updateFrameControls()}
// Complete the thought: warns when the cut starts or ends mid-sentence, starts on a connecting
// word, or stops before the answer to a question, and fixes it in one undoable step.
{const box=Object.assign(document.createElement('div'),{id:'thoughtCheck',className:'thought-check',hidden:true});box.setAttribute('role','status');$('cutTools').before(box);let shown='';
  const setTrim=(m,a,b)=>performEdit('complete-thought',()=>{$('trimIn').value=a;$('trimOut').value=b;validateTrim();layout.syncTimeline(m,formatTime)});
  setInterval(()=>{const m=state.moments.find(x=>x.id===state.selected);if(!m||document.body.dataset.workspace!=='edit'){box.hidden=true;shown='';return}
    const key=[m.id,m.trimIn,m.trimOut,m.captionLanguage,activeCues(m).length].join('|');if(key===shown)return;shown=key;
    const r=thoughtCheck(timedCues(m),m.trimIn,m.trimOut,{windowEnd:m.end-m.start});box.hidden=!r.issues.length;if(!r.issues.length)return;
    const fix=Object.assign(document.createElement('button'),{type:'button',className:'cd-btn cd-btn-sm cd-btn-secondary',textContent:r.suggestion?`Complete the thought (+${r.suggestion.added}s)`:'Review the edges'});
    fix.onclick=()=>{if(r.suggestion)setTrim(m,r.suggestion.trimIn,r.suggestion.trimOut)};fix.disabled=!r.suggestion;
    box.replaceChildren(Object.assign(document.createElement('strong'),{textContent:'This clip may lose context. '}),document.createTextNode(r.issues.map(i=>i.text).join(' ')+' '),fix)},700);}
// Editor timeline: the story cut if it has clips, otherwise the selected clip.
$('timelineXmlButton').onclick=async()=>{const ids=(state.cut?.length?state.cut:[state.selected]).filter(Boolean);if(!ids.length||!projectSession?.current){toast('Select a clip first.');return}await projectSession.flush();location.href=`/api/timeline-xml/${projectSession.current.id}?moments=${ids.map(encodeURIComponent).join(',')}`};
// Find a quote: search the whole recording's subtitle track (Arabic or English) and turn a line
// into a clip with complete-the-thought edges and the track's existing captions (no new AI calls).
{const panel=Object.assign(document.createElement('section'),{className:'quote-search',hidden:true});panel.setAttribute('aria-label','Find a quote');
  panel.innerHTML='<h3>Find a quote</h3><p>Search everything that was said, in Arabic or English, and make a clip from that moment.</p>';
  const form=document.createElement('form'),input=Object.assign(document.createElement('input'),{type:'search',placeholder:'A word or phrase you remember…',ariaLabel:'Quote to find'}),go=Object.assign(document.createElement('button'),{type:'submit',className:'cd-btn cd-btn-secondary',textContent:'Search'}),results=Object.assign(document.createElement('ol'),{className:'quote-results'});
  form.append(input,go);panel.append(form,results);$('queue').before(panel);let track=null,trackFor='';
  const job=()=>wholeJobs.find(j=>j.sourceId===state.source?.importId&&j.status==='complete'&&j.cueCount>0);
  // Find what's shown: Apple Vision labels frames on this Mac (free), searched by word.
  const vis=Object.assign(document.createElement('div'),{className:'visual-search'}),visStatus=Object.assign(document.createElement('p'),{className:'visual-status'}),visIndex=Object.assign(document.createElement('button'),{type:'button',className:'cd-btn cd-btn-sm cd-btn-secondary',textContent:'Index what’s shown (free, on this Mac)'}),visForm=document.createElement('form'),visInput=Object.assign(document.createElement('input'),{type:'search',placeholder:'Something you can see: sunglasses, sofa, bottle, car…',ariaLabel:'What is shown'}),visGo=Object.assign(document.createElement('button'),{type:'submit',className:'cd-btn cd-btn-secondary',textContent:'Search'}),visResults=Object.assign(document.createElement('ol'),{className:'quote-results'});
  visForm.append(visInput,visGo);vis.append(Object.assign(document.createElement('h3'),{textContent:'Find what’s shown'}),visStatus,visIndex,visForm,visResults);panel.append(vis);
  let visState='none';const sourceId=()=>state.source?.importId;
  async function visRefresh(){const id=sourceId();if(!id)return;try{const d=await requestJson('/api/visual-index/'+id);visState=d.status;visStatus.textContent=d.status==='ready'?`Indexed ${d.frames} frames (one every 2 seconds). Labels are in English.`:d.status==='running'?d.progress+'…':d.status==='error'?'Indexing failed: '+d.error:'Not indexed yet. Takes about a minute per hour of video; nothing leaves this computer.';visIndex.hidden=d.status==='ready'||d.status==='running';visForm.hidden=d.status!=='ready'}catch{}}
  visIndex.onclick=async()=>{try{await requestJson('/api/visual-index/'+sourceId(),{method:'POST'});void visRefresh()}catch(error){toast(error.message)}};
  visForm.onsubmit=async event=>{event.preventDefault();try{const {results}=await requestJson('/api/visual-index/'+sourceId()+'/search?q='+encodeURIComponent(visInput.value));
    visResults.replaceChildren(...(results.length?results.map(hit=>{const li=document.createElement('li'),b=Object.assign(document.createElement('button'),{type:'button',className:'cd-btn cd-btn-sm cd-btn-secondary',textContent:'Make a clip'});b.onclick=()=>makeClip(hit);li.append(Object.assign(document.createElement('span'),{className:'cd-tc',textContent:formatTime(hit.start)}),Object.assign(document.createElement('span'),{className:'quote-text',textContent:`${Math.round(hit.end-hit.start)}s showing ${hit.labels.join(', ').replace(/_/g,' ')}`}),b);return li}):[Object.assign(document.createElement('li'),{className:'quote-none',textContent:'Nothing matching was seen. Try a simpler word for an object (Apple’s labels are things like “sunglasses”, “sofa”, “bottle”).'})]))}catch(error){toast(error.message)}};
  setInterval(()=>{panel.hidden=!sourceId();form.hidden=!job();panel.querySelector('p').hidden=!job();if(!panel.hidden&&(visState!=='ready'||!visStatus.textContent))void visRefresh()},2000);
  async function makeClip(hit){const j=job();if(j&&trackFor!==j.id){track=await requestJson('/api/subtitles/'+j.id+'/track');trackFor=j.id}const t=j?track:{cues:[],original:[],language:'Original',duration:program.duration};const duration=t.duration||j?.duration||program.duration,ws=Math.max(0,hit.start-45),we=Math.min(duration,hit.end+45),win={start:ws,end:we,mediaStart:ws};
    const cues={Original:projectTrack(t.original,win),...(t.language==='Original'?{}:{[t.language]:projectTrack(t.cues,win)})},local=t.language==='Original'?cues.Original:cues[t.language];
    let a=Math.max(0,hit.start-ws-.2),b=Math.min(we-ws,hit.end-ws+.3);const quoteIn=a,quoteOut=b;for(let pass=0;pass<3;pass++){const fixed=thoughtCheck(local,a,b,{windowEnd:we-ws}).suggestion;if(!fixed||quoteIn-fixed.trimIn>12||fixed.trimOut-quoteOut>15)break;a=fixed.trimIn;b=fixed.trimOut}
    const m={id:crypto.randomUUID(),url:state.sourceUrl,blob:state.source,frames:[],start:ws,end:we,mediaStart:ws,batchId:state.batchId,sourceName:state.sourceName,sourceType:'file',sourceLink:state.sourcePageUrl,manual:true,status:'manual',analysis:null,transcript:local.map(c=>c.text).join(' ').slice(0,2000),trimIn:+a.toFixed(2),trimOut:+b.toFixed(2),hook:'',alternateHook:'',frameMode:'fit',zoom:1,focusX:50,focusY:50,showHook:false,captionLanguage:t.language,captionStyle:'clean',dialectNote:$('sourceDialect').value,captionCues:cues,captionReviewed:{},showCaptions:true,captionOffset:0};
    performEdit('quote-clip',()=>{state.moments.push(m)});await selectMoment(m.id);showWorkspace('edit');toast('Clip made from your quote. Check where it starts and ends, then the subtitles.')}
  form.onsubmit=async event=>{event.preventDefault();const j=job();if(!j)return;go.disabled=true;
    try{if(trackFor!==j.id){track=await requestJson('/api/subtitles/'+j.id+'/track');trackFor=j.id}
      const hits=findQuotes(track,input.value);results.replaceChildren(...(hits.length?hits.map(hit=>{const li=document.createElement('li'),b=Object.assign(document.createElement('button'),{type:'button',className:'cd-btn cd-btn-sm cd-btn-secondary',textContent:'Make a clip'});b.onclick=()=>makeClip(hit);
        li.append(Object.assign(document.createElement('span'),{className:'cd-tc',textContent:formatTime(hit.start)}),Object.assign(document.createElement('span'),{className:'quote-text',textContent:hit.text}),Object.assign(document.createElement('span'),{className:'quote-original',dir:'auto',textContent:hit.original}),b);return li}):[Object.assign(document.createElement('li'),{className:'quote-none',textContent:'No line contains all of those words. Try fewer or different words, in Arabic or English.'})]))}
    catch(error){toast(error.message)}finally{go.disabled=false}};}
// Preview jumps over removed pauses and fillers, so it plays like the export.
function skipPreviewCut(clock){const m=previewMoment();if(!m?.cuts?.length)return;const next=skipCut(m.cuts,localTime(m,clock));if(next!==null)clipVideo.currentTime=mediaTime(m,next)}
function renderCutStatus(){const m=state.moments.find(x=>x.id===state.selected),cuts=m?.cuts||[];$('cutRestore').hidden=!cuts.length;for(const id of ['cutPauses','cutFillers'])$(id).disabled=!m;$('cutStatus').textContent=cuts.length?`${cuts.length} cut${cuts.length===1?'':'s'} · ${removedSeconds(cuts).toFixed(1)}s shorter`:''}
function addCuts(m,found,label){const before=m.cuts?.length||0,merged=cleanCuts([...(m.cuts||[]),...found],m.trimIn,m.trimOut);if(merged.length===before&&removedSeconds(merged)===removedSeconds(m.cuts)){toast(`No ${label} found in this clip.`);return false}m.cuts=merged;projectSession?.changed();renderCutStatus();drawPreview();toast(`Removed ${label}. Play the clip to check the cuts.`);return true}
$('cutPauses').onclick=async()=>{const m=state.moments.find(x=>x.id===state.selected);if(!m)return;const button=$('cutPauses');button.disabled=true;$('cutStatus').textContent='Listening for pauses…';
  try{await projectSession?.flush?.();const data=await requestJson('/api/silence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:m.persistedUrl||m.url,mediaStart:m.mediaStart||0,trimIn:m.trimIn,trimOut:m.trimOut})});performEdit('remove-pauses',()=>addCuts(m,data.cuts,'pauses'))}
  catch(error){toast(error.message)}finally{button.disabled=false;renderCutStatus()}};
$('cutFillers').onclick=()=>{const m=state.moments.find(x=>x.id===state.selected);if(!m)return;const offset=m.captionOffset||0,words=Object.values(m.captionCues||{}).flat().flatMap(cue=>cue?.words||[]).map(w=>({...w,start:w.start+offset,end:w.end+offset}));
  if(!words.length){toast('Word timings are needed. Transcribe this clip with word timing first.');return}performEdit('remove-fillers',()=>addCuts(m,fillerCuts(words),'ums and uhs'))};
$('cutRestore').onclick=()=>performEdit('restore-cuts',()=>{const m=state.moments.find(x=>x.id===state.selected);if(m){m.cuts=[];projectSession?.changed();renderCutStatus();drawPreview()}});
function updateFrameControls(){const m=state.moments.find(x=>x.id===state.selected),disabled=!m||m.frameMode==='fit',split=m?.frameMode==='split';for(const id of ['zoomRange','focusX','focusY'])$(id).disabled=disabled||(split&&id!=='focusX');$('splitCamControls').hidden=!split;if(split){const c=splitGeometry(1,1,m.splitCam).cam;$('camX').value=c.x;$('camY').value=c.y;$('camSize').value=c.w}}
for(const [id,key] of [['camX','x'],['camY','y'],['camSize','w']])$(id).oninput=e=>{const m=state.moments.find(x=>x.id===state.selected);if(m){m.splitCam={...splitGeometry(1,1,m.splitCam).cam,[key]:Number(e.target.value)};drawPreview()}};
function drawComposedFrame(context,video,moment,elapsed,clock=video.currentTime||0){
  const width=context.canvas.width,height=context.canvas.height;
  context.fillStyle='#101014';context.fillRect(0,0,width,height);
  if(video.readyState>=2&&video.videoWidth&&video.videoHeight){
    const crop=moment.sourceType==='screen'&&!moment.cleanCapture?moment.sourceCrop:null;
    const sx=crop?crop.x*video.videoWidth:0,sy=crop?crop.y*video.videoHeight:0;
    const sourceWidth=crop?crop.w*video.videoWidth:video.videoWidth,sourceHeight=crop?crop.h*video.videoHeight:video.videoHeight;
    if(moment.frameMode==='split'){
      const g=splitGeometry(width,height,moment.splitCam),c=g.cam,focus=frameFocus({...moment,outputAspect:state.aspect},localTime(moment,clock));
      const camW=sourceWidth*c.w,camH=Math.min(sourceHeight,camW*g.top/width),camX=Math.min(sourceWidth*c.x,sourceWidth-camW),camY=Math.min(sourceHeight*c.y,sourceHeight-camH);
      context.drawImage(video,sx+camX,sy+camY,camW,camH,0,0,width,g.top);
      const gameScale=Math.max(width/sourceWidth,g.bottom/sourceHeight),gameW=sourceWidth*gameScale,gameH=sourceHeight*gameScale;
      context.save();context.beginPath();context.rect(0,g.top,width,g.bottom);context.clip();
      context.drawImage(video,sx,sy,sourceWidth,sourceHeight,(width-gameW)*focus.focusX/100,g.top+(g.bottom-gameH)/2,gameW,gameH);context.restore();
      context.fillStyle='#0b0b0d';context.fillRect(0,g.top-1,width,2);
    }else{
    const scale=(moment.frameMode==='fill'?Math.max(width/sourceWidth,height/sourceHeight)*moment.zoom:Math.min(width/sourceWidth,height/sourceHeight));
    const drawnWidth=sourceWidth*scale,drawnHeight=sourceHeight*scale;
    const focus=frameFocus({...moment,outputAspect:state.aspect},localTime(moment,clock));
    const x=moment.frameMode==='fill'?(width-drawnWidth)*focus.focusX/100:(width-drawnWidth)/2;
    const y=moment.frameMode==='fill'?(height-drawnHeight)*focus.focusY/100:(height-drawnHeight)/2;
    context.drawImage(video,sx,sy,sourceWidth,sourceHeight,x,y,drawnWidth,drawnHeight);
    }
  }
  if(moment.sourceCaptionMask){
    context.fillStyle='#151419';
    context.fillRect(0,height*.76,width,height*.24);
  }
  if(moment.showHook&&moment.hook&&elapsed>=0&&elapsed<2.6){
    const fontSize=Math.round(Math.min(width/13,54));context.font=`800 ${fontSize}px Arial,sans-serif`;
    const maxWidth=width*.84,visible=wrapLines(context,moment.hook,maxWidth).slice(0,3),lineHeight=fontSize*1.08,pad=fontSize*.55;
    const boxHeight=visible.length*lineHeight+pad*2,top=moment.showCaptions&&activeCues(moment).length?height*.07:height-boxHeight-height*.06;
    context.fillStyle='#16141be8';context.fillRect(width*.06,top,width*.88,boxHeight);
    context.fillStyle='#fff';context.textBaseline='top';visible.forEach((text,index)=>context.fillText(text,width*.08,top+pad+index*lineHeight,maxWidth));
  }
  drawCaption(context,moment,localTime(moment,clock));
}
function previewMoment(){return state.cutPreviewIndex>=0?cutMoments()[state.cutPreviewIndex]:state.moments.find(x=>x.id===state.selected)}
function mediaReady(video){if(video.readyState>=HTMLMediaElement.HAVE_METADATA)return Promise.resolve();return new Promise((resolve,reject)=>{const cleanup=()=>{clearTimeout(timeout);video.removeEventListener('error',failed);video.removeEventListener('loadedmetadata',loaded)};const loaded=()=>{cleanup();resolve()};const failed=()=>{cleanup();reject(Error('This video could not be opened. Choose a supported MP4 or WebM.'))};const timeout=setTimeout(failed,12000);video.addEventListener('loadedmetadata',loaded,{once:true});video.addEventListener('error',failed,{once:true})})}
function drawPreview(clock=clipVideo.currentTime){const selected=previewMoment();if(selected)layout?.syncPlayhead(selected,localTime(selected,clock));const context=$('previewCanvas').getContext('2d'),m=previewMoment();if(m)drawComposedFrame(context,clipVideo,m,localTime(m,clock)-m.trimIn,clock);else{context.fillStyle='#101014';context.fillRect(0,0,context.canvas.width,context.canvas.height)}}
function updatePreviewTime(){layout?.syncTimeline(previewMoment(),formatTime);const m=previewMoment(),duration=m?m.trimOut-m.trimIn:0,position=m?Math.max(0,Math.min(duration,localTime(m,clipVideo.currentTime||0)-m.trimIn)):0;$('seekBar').min=0;$('seekBar').max=duration||100;$('seekBar').value=position;$('previewTime').textContent=`${formatTime(position)} / ${formatTime(duration)}`;drawPreview()}
clipVideo.addEventListener('loadedmetadata',()=>{const m=previewMoment();if(m)clipVideo.currentTime=Math.max(.01,mediaTime(m,m.trimIn));updatePreviewTime()});
let previewFrameHandle=null,previewFrameKind='',replayBusy=false;
function cancelPreviewFrame(){if(previewFrameHandle===null)return;if(previewFrameKind==='video')clipVideo.cancelVideoFrameCallback(previewFrameHandle);else cancelAnimationFrame(previewFrameHandle);previewFrameHandle=null}
function previewFrameLoop(){
  cancelPreviewFrame();if(clipVideo.paused)return;
  const render=(clock)=>{previewFrameHandle=null;skipPreviewCut(clock);drawPreview(clock);highlightCaption(clock);checkPreviewEnd(clock);if(!clipVideo.paused)previewFrameLoop()};
  if(clipVideo.requestVideoFrameCallback){previewFrameKind='video';previewFrameHandle=clipVideo.requestVideoFrameCallback((_,metadata)=>render(metadata.mediaTime))}
  else{previewFrameKind='animation';previewFrameHandle=requestAnimationFrame(()=>render(clipVideo.currentTime))}
}
async function restartPreview(){
  if(replayBusy)return;const m=state.moments.find(x=>x.id===state.selected);if(!m)return;
  replayBusy=true;const selected=m.id;
  try{if(state.cutPreviewIndex>=0)stopCutPreview();clipVideo.pause();await mediaReady(clipVideo);await seekPreview(mediaTime(m,m.trimIn));if(state.selected===selected){claimPlayback(clipVideo);await clipVideo.play()}}
  catch{$('editorStatus').textContent='Could not restart this clip. Select the clip again.'}
  finally{replayBusy=false}
}
function checkPreviewEnd(clock,ended=false){
  const m=previewMoment();if(!m||replayBusy||clock<mediaTime(m,m.trimOut)-.04)return;
  if(state.cutPreviewIndex>=0){if(!state.cutPreviewBusy)advanceCutPreview();return}
  if(clipVideo.paused&&!ended)return;
  clipVideo.pause();if($('loopClip').checked)restartPreview();
}
clipVideo.addEventListener('seeked',()=>{updatePreviewTime();highlightCaption(clipVideo.currentTime)});
clipVideo.addEventListener('loadeddata',updatePreviewTime);
clipVideo.addEventListener('timeupdate',()=>{updatePreviewTime();highlightCaption(clipVideo.currentTime);checkPreviewEnd(clipVideo.currentTime)});
clipVideo.addEventListener('ended',()=>checkPreviewEnd(clipVideo.currentTime,true));
clipVideo.addEventListener('play',()=>{setButtonLabel('playPause','Pause','pause');$('playPause').setAttribute('aria-label','Pause selected clip');previewFrameLoop()});
clipVideo.addEventListener('pause',()=>{cancelPreviewFrame();setButtonLabel('playPause','Play','play');$('playPause').setAttribute('aria-label','Play selected clip');drawPreview()});
$('restartClip').onclick=restartPreview;
$('playPause').onclick=async()=>{try{const m=previewMoment();if(!m)return;if(clipVideo.paused){if(state.cutPreviewIndex<0&&shouldRestart(clipVideo.currentTime,mediaTime(m,m.trimIn),mediaTime(m,m.trimOut)))await seekPreview(mediaTime(m,m.trimIn));claimPlayback(clipVideo);await clipVideo.play()}else clipVideo.pause()}catch{$('editorStatus').textContent='Preview could not play. Select the clip again.'}};
document.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey||/^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(document.activeElement?.tagName||'')||document.activeElement?.isContentEditable)return;
  const key=event.key.toLowerCase();if(document.activeElement?.tagName==='VIDEO'||(document.body.dataset.workspace!=='edit'&&key!=='m'))return;const m=state.moments.find(x=>x.id===state.selected);
  if(key==='r'&&m){event.preventDefault();restartPreview()}
  else if(event.code==='Space'&&m){event.preventDefault();$('playPause').click()}
  else if(key==='m'&&state.scanning)$('markButton').click();
  else if(key==='a'&&m&&!state.cut.includes(m.id))$('addToCut').click();
  else if(key==='e'&&m&&!$('exportButton').disabled){event.preventDefault();$('exportTab')?.click();$('exportButton').click()}
  else if((key==='i'||key==='o')&&m&&state.cutPreviewIndex<0){
    const id=key==='i'?'trimIn':'trimOut';$(id).value=Math.max(0,Math.min(m.end-m.start,localTime(m,clipVideo.currentTime))).toFixed(1);validateTrim();
  }
});
function stopCutPreview(){if(state.cutPreviewIndex<0)return;state.cutPreviewIndex=-1;state.cutPreviewBusy=false;clipVideo.pause();$('previewCut').textContent='Play story cut ';const selected=state.moments.find(x=>x.id===state.selected);if(selected){clipVideo.src=selected.url;clipVideo.load();clipVideo.currentTime=mediaTime(selected,selected.trimIn);drawPreview()}}
async function advanceCutPreview(){if(state.cutPreviewBusy)return;state.cutPreviewBusy=true;const next=state.cutPreviewIndex+1;if(next>=cutMoments().length){stopCutPreview();$('cutStatus').textContent='Story cut preview finished. Tighten the edit or export it.';return;}state.cutPreviewIndex=next;const m=cutMoments()[next];clipVideo.src=m.url;clipVideo.load();try{await mediaReady(clipVideo);if(state.cutPreviewIndex!==next)return;clipVideo.currentTime=Math.max(.01,mediaTime(m,m.trimIn));await clipVideo.play();$('previewCut').textContent=`Playing ${next+1}/${cutMoments().length}  `}catch(error){stopCutPreview();$('cutStatus').textContent=error.message}finally{state.cutPreviewBusy=false}}
$('previewCut').onclick=async()=>{if(state.cutPreviewIndex>=0){stopCutPreview();return;}if(!cutMoments().length)return;state.cutPreviewIndex=0;const m=cutMoments()[0];clipVideo.pause();clipVideo.src=m.url;clipVideo.load();try{await mediaReady(clipVideo);clipVideo.currentTime=Math.max(.01,mediaTime(m,m.trimIn));await clipVideo.play();$('previewCut').textContent=`Playing 1/${cutMoments().length}  `;document.querySelector('.editor')?.scrollIntoView({block:'nearest',behavior:'smooth'});}catch(error){stopCutPreview();$('cutStatus').textContent=error.message}};
$('seekBar').oninput=e=>{const m=previewMoment();if(m)clipVideo.currentTime=mediaTime(m,m.trimIn+Number(e.target.value));updatePreviewTime()};
$('aspectSelect').onchange=e=>{state.aspect=e.target.value;setPreviewSize();drawPreview()};
$('audioEnhance').onchange=e=>{const m=state.moments.find(m=>m.id===state.selected);if(m)m.audioEnhance=e.target.checked};
$('saveCoverFrame').onclick=()=>{const m=state.moments.find(m=>m.id===state.selected);if(!m||!validateCaptions(m))return;if(clipVideo.readyState<2||!clipVideo.videoWidth){message('Wait for the clip preview to load, then download its cover frame.');return}drawPreview();$('previewCanvas').toBlob(blob=>{if(blob)download(blob,'context-desk-cover-'+Math.floor(m.start)+'.png')},'image/png')};
$('frameMode').onchange=e=>{const m=state.moments.find(x=>x.id===state.selected);if(m){m.frameKeyframes=[];m.frameTracking=null;m.frameMode=e.target.value;updateFrameControls();drawPreview()}};
for(const [id,key] of [['zoomRange','zoom'],['focusX','focusX'],['focusY','focusY']])$(id).oninput=e=>{const m=state.moments.find(x=>x.id===state.selected);if(m){m.frameKeyframes=[];m.frameTracking=null;m[key]=Number(e.target.value);drawPreview()}};
$('showHook').onchange=e=>{const m=state.moments.find(x=>x.id===state.selected);if(m){m.showHook=e.target.checked;drawPreview()}};
$('focusPlayer').onclick=()=>performEdit('focus-player',()=>{const m=state.moments.find(x=>x.id===state.selected);if(!m)return;m.frameKeyframes=[];m.frameTracking=null;m.frameMode='fill';m.zoom=1.4;m.focusX=0;m.focusY=20;$('frameMode').value='fill';$('zoomRange').value=1.4;$('focusX').value=0;$('focusY').value=20;updateFrameControls();drawPreview();message('Main-video framing applied. Adjust zoom and position if your stream layout differs.');});
function renderSocialGuidance(){
  const m=state.moments.find(x=>x.id===state.selected),destination=$('socialDestination')?.value;if(!m||!$('socialAdvice'))return;
  $('socialAdvice').textContent=lengthAdvice(destination,(m.trimOut??m.end-m.start)-(m.trimIn||0));
  const targets=crossPostTargets(destination);$('crossPost').replaceChildren();
  if(targets.length){$('crossPost').append(Object.assign(document.createElement('span'),{className:'cd-label',textContent:'Same file also fits'}));for(const t of targets)$('crossPost').append(Object.assign(document.createElement('a'),{href:t.upload,target:'_blank',rel:'noopener noreferrer',className:'cd-btn cd-btn-sm cd-btn-ghost',textContent:t.label+' ↗'}))}
  const caption=$('postCaption');if(document.activeElement!==caption)caption.value=m.postCaption??draftPostCaption(m.hook);
  $('postTitle').hidden=!m.postTitle;$('postTitle').textContent=m.postTitle?'Title: '+m.postTitle:'';
  const tags=hashtagCount(caption.value);$('postCaptionCount').textContent=`${tags} of ${hashtagLimit} hashtags`;$('postCaptionCount').dataset.over=String(tags>hashtagLimit);
  if(tags>hashtagLimit)$('postCaptionCount').textContent+=' · Instagram allows five; extra tags show no lift in views';
}
function renderEditor(){
  projectSession?.changed();
  const m=state.moments.find(x=>x.id===state.selected);if(!m)return;
  if(!captionStyleIds.includes(m.captionStyle))m.captionStyle='punch';
  inheritCaptionTarget(m,projectCaptionTarget());
  queueCaptionTarget(m);
  if(state.cutPreviewIndex<0)assignMediaSource(clipVideo,m.url);
  $('clipTiming').textContent=`${m.sourceType==='screen'?'RECORDED LIVE · ':''}${formatTime(m.start)}–${formatTime(m.end)}`;
  for(const id of ['trimIn','trimOut','hook','alternateHook','exportButton','notesButton','saveSourceButton','addToCut','playPause','restartClip','loopClip','seekBar'])$(id).disabled=false;
  $('watchOriginal').disabled=state.sourceType!=='file'||m.blob?.importId!==state.source?.importId;
  $('saveSourceButton').textContent=m.batchId?'Save full original':'Save raw window';
  $('approveBatch').hidden=!m.batchId;$('approveBatch').textContent=m.approved?'Remove from clip drop −':'Add to clip drop ';
  $('trimIn').value=m.trimIn.toFixed(1);$('trimOut').value=m.trimOut.toFixed(1);
  $('trimIn').max=Math.max(0,m.trimOut-.2);$('trimOut').max=Math.max(.2,m.end-m.start);
  $('hook').value=m.hook;$('alternateHook').value=m.alternateHook;renderHookLab();syncAccents(m);
  $('engineProvenance').textContent=[m.analysis?'Meta Muse Spark · story assessment':m.status==='analysing'?'Meta Muse Spark · pending':'No story assessment',m.speechSource||'No speech draft',m.translationSource||'No translation'].join('  /  ');
  $('clipQuality').textContent=m.sourcePixels?`${m.sourcePixels.width} × ${m.sourcePixels.height} · ${m.sourcePixels.frameRateKnown?m.sourcePixels.frameRate+' fps input':'frame rate unreported'} · ${!m.sourcePixels.audioTracks?'NO AUDIO TRACK':m.audioRms!==null&&m.audioRms!==undefined&&m.audioRms<.001?'AUDIO SILENT':m.audioRms!==null&&m.audioRms!==undefined?'audio detected':'audio track captured · level unverified'}${m.sourcePixels.height<1080?' · 1080p export upscales this capture':''}`:'Capture dimensions unavailable.';
  $('reason').textContent=m.analysis?.reason||m.error||'Manual review. No AI assessment has been made.';
  $('directEvidence').textContent=m.analysis?.evidence||'Watch the source window; no evidence summary is available.';
  $('contextNote').textContent=m.analysis?.contextNote||'Inspect the preceding and following source footage before sharing.';
  $('riskNote').textContent=m.analysis?.riskNote||'Check names, quotations, chronology and participant consent.';
  $('transcript').textContent=m.transcript||m.speechError||'No reliable transcript available for this window.';
  $('storyShape').textContent=m.analysis?['Setup · '+(m.analysis.setup||'Not established'),'Turn · '+(m.analysis.turn||'Not established'),'Payoff · '+(m.analysis.payoff||'Not established')].join('\n\n'):'Awaiting a source assessment.';
  $('editNote').textContent=m.analysis?.editNote||'Keep enough context to preserve the meaning. Review the start and ending before sharing.';
  $('sourceCaptionWarning').hidden=!(m.sourceType==='screen'||m.sourceCaptionsVisible);
  $('sourceCaptionWarning').textContent=m.sourceCaptionsVisible?'Source subtitles appear in sampled frames. These pixels are separate from Context Desk’s audio transcript. Check the preview and use the caption cover below only if needed.':'Context Desk creates its own audio transcript. If the shared player has captions on, turn them off there or cover the bottom strip here to avoid double subtitles.';
  $('editorStatus').textContent=m.status==='suggested'?'AI suggestion · producer approval required':m.status==='analysing'?'Meta is examining this window.':'Review the source window before exporting.';
  $('addToCut').disabled=state.cut.includes(m.id);
  $('addToCut').innerHTML=state.cut.includes(m.id)?'In story cut <b></b>':'Add this moment to story cut <b></b>';
  $('audioEnhance').checked=Boolean(m.audioEnhance);$('aspectSelect').value=state.aspect;$('frameMode').value=m.frameMode;renderCutStatus();$('zoomRange').value=m.zoom;$('focusX').value=m.focusX;$('focusY').value=m.focusY;$('showHook').checked=m.showHook;

  editorTools.collection(state.moments,state.selected);editorTools.sync(m);brandControls.sync(m);productionTools.sync();discoveryTools?.sync();
  $('captionTranslationMode').disabled=$('translationProvider').value==='voicestudio';$('captionTranslationMode').value=m.translationMode||$('translationMode').value;$('captionLanguage').value=m.captionLanguage;$('captionStyle').value=m.captionStyle;$('dialectNote').value=m.dialectNote;
  $('captionOverride').checked=Boolean(m.captionLanguageOverride);$('captionScopeStatus').textContent=m.captionLanguageOverride?`Clip override: ${m.captionLanguage}. Project output: ${projectCaptionTarget()}.`:`Project output: ${projectCaptionTarget()} · language changes apply to every clip.`;
  $('captionsInput').value=cueText(activeCues(m));$('captionMode').value=m.captionMode==='accessible'?'accessible':'clean';renderCaptionLines(m);$('captionOffset').value=(m.captionOffset||0).toFixed(1);updateCaptionSyncLabel(m);$('maskSourceCaptions').checked=Boolean(m.sourceCaptionMask);$('showCaptions').checked=m.showCaptions;$('captionReviewed').checked=Boolean(m.captionReviewed[m.captionLanguage]);
  $('translateButton').textContent=m.translationPending?.has(m.captionLanguage)?'TRANSLATING…':m.translationError?'Retry translation':'Translate again';
  $('translateButton').disabled=Boolean(m.translationPending?.has(m.captionLanguage))||(!state.meta&&!(state.voiceStudio&&$('translationProvider').value==='voicestudio'))||m.captionLanguage==='Original'||!m.captionCues.Original.length;
  $('reanalyseButton').disabled=!state.meta||!m.frames.length||m.status==='analysing';$('captionEmptyActions').hidden=Boolean(m.captionCues?.Original?.length||activeCues(m).length);$('emptyRecheckSpeech').disabled=$('reanalyseButton').disabled;
  $('srtButton').disabled=!activeCues(m).length;
  syncCaptionVariant(m);renderSocialGuidance();  $('captionStatus').textContent=m.translationPending?.has(m.captionLanguage)?m.captionLanguage+' subtitles are being prepared…':m.captionError||m.translationError||m.translationWarning||(!m.captionCues.Original.length?'No timed transcript yet. Add lines manually and check them against the audio.':m.captionLanguage==='Original'?((m.speechSource||'Speech')+' draft. '+(m.timingSource==='word'?'Word timings are available; still check dialect, words and sync.':'Short-line timing is estimated; check dialect, words and timing.')):activeCues(m).length?((m.translationSource||'Translation')+' draft. Compare every line with the original speech.'):m.captionLanguage+' subtitles queued. Original speech is kept in Story & evidence.');
  layout?.syncTimeline(m,formatTime);setPreviewSize();drawPreview();
}
function updateCaptionSyncLabel(m){const offset=m.captionOffset||0;$('captionSyncLabel').textContent=Math.abs(offset)<.01?'Original timing':`${Math.abs(offset).toFixed(1)} seconds ${offset<0?'earlier':'later'}`}
function changeCaptionSync(value,normalize=true){
  const m=state.moments.find(x=>x.id===state.selected);if(!m)return;
  m.captionOffset=Math.max(-10,Math.min(10,Math.round((Number(value)||0)*10)/10));m.captionReviewed={};$('captionReviewed').checked=false;if(normalize)$('captionOffset').value=m.captionOffset.toFixed(1);updateCaptionSyncLabel(m);renderCaptionLines(m);drawPreview();$('captionStatus').textContent='Sync updated for this clip and every language. Replay and review before export.';
}
$('captionOffset').oninput=e=>{if(e.target.value!==''&&Number.isFinite(e.target.valueAsNumber))changeCaptionSync(e.target.value,false)};
$('captionOffset').onchange=e=>changeCaptionSync(e.target.value);
$('captionsEarlier').onclick=()=>performEdit('caption-sync',()=>changeCaptionSync(Number($('captionOffset').value)-.1));
$('captionsLater').onclick=()=>performEdit('caption-sync',()=>changeCaptionSync(Number($('captionOffset').value)+.1));
// Jumps through lines the QA hints flagged, wrapping at the end.
{const next=Object.assign(document.createElement('button'),{type:'button',id:'captionQaNext',className:'cd-btn cd-btn-sm cd-btn-secondary',textContent:'Next line to check',hidden:true});$('captionLineCount').after(next);
  next.onclick=()=>{const lines=next.dataset.lines.split(',').map(Number),rows=[...document.querySelectorAll('.caption-line')],current=rows.findIndex(r=>r.classList.contains('is-qa-focus')),target=lines.find(i=>i>Number(rows[current]?.dataset.cue??-1))??lines[0],row=rows.find(r=>Number(r.dataset.cue)===target);rows[current]?.classList.remove('is-qa-focus');if(row){row.classList.add('is-qa-focus');row.scrollIntoView({block:'center'});row.querySelector('textarea')?.focus()}}}
$('resetCaptionSync').onclick=()=>performEdit('caption-sync',()=>changeCaptionSync(0));
function renderCaptionLines(m){
  const cues=activeCues(m),timed=timedCues(m),issues=new Map(lineIssues(cues,{language:m.captionLanguage,sourceScript:dominantScript(m.captionCues.Original||[]),originals:m.captionCues.Original||[]}).map(i=>[i.index,i.reasons]));
  $('captionLineCount').textContent=`${cues.length} lines${issues.size?` · ${issues.size} to check`:''}`;$('captionQaNext').hidden=!issues.size;$('captionQaNext').dataset.lines=[...issues.keys()].join(',');
  const overlaps=overlapIndexes(cues),speakers=[...new Set(['A','B',...cues.map(c=>c.speaker).filter(Boolean)])].sort();
  $('captionLines').innerHTML=cues.length?cues.map((cue,index)=>{
    const timing=timed.find(cue=>cue.index===index),start=timing?.start??0,unavailable=!timing||timing.end<=m.trimIn||start>=m.trimOut;
    // Editing-only speaker data: never burned in. Visible cue and line type decide what viewers see.
    const meta=`<div class="caption-line-meta"><label>Speaker <select class="caption-speaker" data-cue="${index}" aria-label="Speaker for caption ${index+1}">${['',...speakers].map(sp=>`<option value="${sp}" ${(cue.speaker||'')===sp?'selected':''}>${sp?'Speaker '+sp:'Unknown'}</option>`).join('')}</select></label><label>Type <select class="caption-kind" data-cue="${index}" aria-label="Line type for caption ${index+1}">${[['','Dialogue'],['sound','Sound description'],['background','Background speech']].map(([v,l])=>`<option value="${v}" ${(cue.kind||'')===v?'selected':''}>${l}</option>`).join('')}</select></label><input class="caption-cue-label" data-cue="${index}" maxlength="24" placeholder="Visible cue, e.g. (off-screen)" aria-label="Optional visible cue for caption ${index+1}" value="${escapeHtml(cue.cueLabel||'')}"></div>`;
    return `<div class="caption-line${overlaps.has(index)?' is-overlap':''}" data-cue="${index}">${meta}<button type="button" data-caption-jump="${index}" aria-label="Play from caption ${index+1} at ${start.toFixed(1)} seconds" ${unavailable?'disabled':''}>${start.toFixed(1)}s</button><textarea class="caption-line-text" rows="3" data-cue="${index}" aria-label="Caption ${index+1} text" dir="auto" maxlength="100">${escapeHtml(cue.text)}</textarea><button type="button" class="caption-flag ${cue.uncertain?'is-flagged':''}" data-caption-flag="${index}" aria-label="${cue.uncertain?'Resolve':'Flag'} uncertainty in caption ${index+1}">${cue.uncertain?'Review needed':'Flag'}</button>${cue.uncertain&&cue.reviewReason?`<small class="caption-original">${escapeHtml(cue.reviewReason)}</small>`:''}${issues.has(index)?`<small class="caption-qa">${issues.get(index).map(escapeHtml).join(' ')}</small>`:''}${m.captionLanguage!=='Original'?`<small class="caption-original" dir="auto">SOURCE · ${escapeHtml(m.captionCues.Original[index]?.text||'Original line unavailable')}</small>`:''}</div>`;
  }).join(''):'<p class="caption-lines-empty">'+(m.translationPending?.has(m.captionLanguage)?'Preparing '+escapeHtml(m.captionLanguage)+' subtitles…':m.translationError&&m.captionCues.Original?.length?escapeHtml(m.captionLanguage)+' subtitles are missing: '+escapeHtml(m.translationError)+' The original transcript ('+m.captionCues.Original.length+' lines) is safe.':m.captionCues.Original?.length?'No '+escapeHtml(m.captionLanguage)+' subtitles yet. The original transcript has '+m.captionCues.Original.length+' lines; choose Retry translation.':'No timed captions yet. Recheck the speech or add captions to this clip.')+'</p>';
}
function highlightCaption(clock){
  const m=previewMoment();if(!m)return;const time=localTime(m,clock),active=timedCues(m).find(cue=>time>=cue.start&&time<cue.end)?.index;
  document.querySelectorAll('.caption-line').forEach(row=>{const isActive=Number(row.dataset.cue)===active;if(row.classList.contains('is-current')!==isActive)row.classList.toggle('is-current',isActive)});
}
$('captionLines').onclick=async event=>{
  const flag=event.target.closest('[data-caption-flag]');if(flag){const m=state.moments.find(x=>x.id===state.selected),cue=activeCues(m)[Number(flag.dataset.captionFlag)];performEdit('caption-flag',()=>{cue.uncertain=!cue.uncertain;m.captionReviewed[m.captionLanguage]=false;renderEditor()});return}

  const button=event.target.closest('[data-caption-jump]');if(!button)return;const m=state.moments.find(x=>x.id===state.selected);if(!m)return;
  const cue=timedCues(m).find(cue=>cue.index===Number(button.dataset.captionJump));if(!cue)return;
  try{if(state.cutPreviewIndex>=0)stopCutPreview();clipVideo.pause();await seekPreview(mediaTime(m,Math.max(m.trimIn,cue.start)));claimPlayback(clipVideo);await clipVideo.play()}catch{$('captionStatus').textContent='This caption could not be previewed. Select the clip again.'}
};
// Speaker, line type and visible cue belong to the moment, not one language: apply to every track.
function setLineMeta(m,index,key,value){for(const cues of Object.values(m.captionCues||{})){const cue=cues?.[index];if(!cue)continue;if(value)cue[key]=value;else delete cue[key]}m.captionReviewed={};$('captionReviewed').checked=false;projectSession?.changed();drawPreview()}
$('captionLines').addEventListener('change',event=>{const m=state.moments.find(x=>x.id===state.selected);if(!m)return;const index=Number(event.target.dataset.cue);
  if(event.target.matches('.caption-speaker'))performEdit('caption-speaker',()=>{setLineMeta(m,index,'speaker',event.target.value);const overlaps=overlapIndexes(activeCues(m));for(const row of $('captionLines').querySelectorAll('.caption-line'))row.classList.toggle('is-overlap',overlaps.has(Number(row.dataset.cue)))});
  else if(event.target.matches('.caption-kind'))performEdit('caption-kind',()=>{setLineMeta(m,index,'kind',event.target.value)});
  else if(event.target.matches('.caption-cue-label'))performEdit('caption-cue-label',()=>setLineMeta(m,index,'cueLabel',event.target.value.trim()))});
$('captionLines').oninput=event=>{
  if(!event.target.matches('.caption-line-text'))return;const m=state.moments.find(x=>x.id===state.selected);if(!m)return;const cue=activeCues(m)[Number(event.target.dataset.cue)];if(!cue)return;cue.text=event.target.value;delete cue.words;m.captionReviewed[m.captionLanguage]=false;$('captionReviewed').checked=false;
  if(m.captionLanguage==='Original'){for(const language of Object.keys(m.captionCues))if(language!=='Original')delete m.captionCues[language];m.captionReviewed={}}
  m.captionError=activeCues(m).some(cue=>!cue.text.trim())?'Caption text cannot be empty.':'';$('captionsInput').value=cueText(activeCues(m));$('captionStatus').textContent=m.captionError||'Words updated. Listen and review before export.';drawPreview();
};
$('captionLanguage').onchange=e=>{const m=state.moments.find(x=>x.id===state.selected);if(!m)return;if(!m.captionLanguageOverride){setProjectCaptionTarget(e.target.value);return}m.captionLanguageOverride=e.target.value;inheritCaptionTarget(m,projectCaptionTarget());m.captionError='';m.translationError='';if(activeCues(m).length)m.showCaptions=true;renderEditor();queueCaptionTarget(m)};
$('captionOverride').onchange=e=>{const m=state.moments.find(x=>x.id===state.selected);if(!m)return;m.captionLanguageOverride=e.target.checked?m.captionLanguage:null;inheritCaptionTarget(m,projectCaptionTarget());queueCaptionTarget(m);renderEditor()};
// Style switches only change how cues are drawn: no reload, seek or re-render of the video.
$('captionStyle').onchange=e=>{const m=state.moments.find(x=>x.id===state.selected);if(m&&m.captionStyle!==e.target.value)performEdit('caption-style',()=>{m.captionStyle=e.target.value;editorTools.sync(m);drawPreview()})};
// Keyword highlights + emoji, picked by Meta per line; works on the clip's visible lines only.
{const box=Object.assign(document.createElement('div'),{className:'caption-accents'}),make=Object.assign(document.createElement('button'),{type:'button',id:'makeAccents',className:'cd-btn cd-btn-sm cd-btn-secondary',textContent:'Highlight keywords + emoji'}),label=document.createElement('label'),toggle=Object.assign(document.createElement('input'),{type:'checkbox',id:'showAccents'});
  label.append(toggle,' Show accents');box.append(make,label);$('applyCaptionLook').before(box);
  const current=()=>state.moments.find(x=>x.id===state.selected);
  syncAccents=m=>{const has=Boolean(m?.captionAccents?.[m.captionLanguage]?.length);label.hidden=!has;toggle.checked=Boolean(m?.showAccents)&&has;make.textContent=has?'Pick accents again':'Highlight keywords + emoji'};
  toggle.onchange=()=>{const m=current();if(!m)return;performEdit('caption-accents',()=>{m.showAccents=toggle.checked});void document.fonts.load('20px "Noto Emoji"').then(()=>drawPreview())};
  make.onclick=async()=>{const m=current();if(!m)return;const lines=[...new Set(timedCues(m).filter(c=>c.end>m.trimIn&&c.start<m.trimOut).map(c=>c.text))];if(!lines.length){toast('This clip has no caption lines yet.');return}
    if(lines.length>400&&!confirm(`Picking accents for ${lines.length} lines takes ${Math.ceil(lines.length/100)} requests. Continue?`))return;
    make.disabled=true;make.textContent='Picking accents…';
    try{const accents=[];for(let i=0;i<lines.length;i+=100){const data=await requestJson('/api/caption-accents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lines:lines.slice(i,i+100)})});accents.push(...data.accents)}
      await document.fonts.load('20px "Noto Emoji"');performEdit('caption-accents',()=>{(m.captionAccents??={})[m.captionLanguage]=accents;m.showAccents=true});syncAccents(m);drawPreview();toast(`${accents.filter(a=>a.keyword).length} keywords and ${accents.filter(a=>a.emoji).length} emoji added. Edit a line to drop its accent.`)}
    catch(error){toast(error.message)}finally{make.disabled=false;syncAccents(current())}};}
$('applyCaptionLook').onclick=()=>performEdit('caption-look',()=>{const selected=state.moments.find(x=>x.id===state.selected);if(!selected)return;for(const m of state.moments){m.captionStyle=selected.captionStyle;m.captionLook=structuredClone(selected.captionLook||{})}$('captionStatus').textContent='Brand style applied to every clip. Words, timing and review status are unchanged.'});
$('dialectNote').oninput=e=>{const m=state.moments.find(x=>x.id===state.selected);if(m){m.dialectNote=e.target.value;for(const key of Object.keys(m.captionReviewed))m.captionReviewed[key]=false;$('captionReviewed').checked=false}};
$('captionsInput').oninput=e=>{const m=state.moments.find(x=>x.id===state.selected);if(!m)return;const parsed=parseCues(e.target.value,m.end-m.start);m.captionError=parsed.error||'';m.captionReviewed[m.captionLanguage]=false;$('captionReviewed').checked=false;if(!parsed.error){m.captionCues[m.captionLanguage]=parsed.cues;if(m.captionLanguage==='Original'){for(const language of Object.keys(m.captionCues)){if(language!=='Original')delete m.captionCues[language]}m.captionReviewed={}}}$('captionStatus').textContent=parsed.error||'Draft updated. Listen through and confirm every line before export.';if(!parsed.error)renderCaptionLines(m);drawPreview()};
$('captionMode').onchange=e=>{const m=state.moments.find(x=>x.id===state.selected);if(m)performEdit('caption-mode',()=>{m.captionMode=e.target.value==='accessible'?'accessible':'clean';drawPreview()})};
$('showCaptions').onchange=e=>{const m=state.moments.find(x=>x.id===state.selected);if(m){m.showCaptions=e.target.checked;drawPreview()}};
$('maskSourceCaptions').onchange=e=>{const m=state.moments.find(x=>x.id===state.selected);if(m){m.sourceCaptionMask=e.target.checked;drawPreview()}};
$('captionReviewed').onchange=e=>{const m=state.moments.find(x=>x.id===state.selected);if(!m)return;if(activeCues(m).some(c=>c.uncertain)||m.captionError||!timedCues(m).some(c=>c.end>m.trimIn&&c.start<m.trimOut)){e.target.checked=false;$('captionStatus').textContent=m.captionError||(activeCues(m).some(c=>c.uncertain)?'Resolve flagged subtitle lines before confirming review.':'No subtitles fall within this trim. Reset the sync offset or correct the line timings.');return}m.captionReviewed[m.captionLanguage]=e.target.checked};
$('reanalyseButton').onclick=async()=>{
  const m=state.moments.find(x=>x.id===state.selected);if(!m||!state.meta)return;
  const button=$('reanalyseButton');button.disabled=true;button.textContent='RECHECKING…';
  m.dialectNote=$('dialectNote').value.trim();m.autoCaptionLanguage=$('liveCaptionLanguage').value;m.translationError='';
  try{await analyzeItem(m);renderQueue();renderEditor();$('captionStatus').textContent='Fresh speech and story draft. Check every word, name, dialect and time against the audio.';}
  catch(error){m.error=error.message||'Recheck failed';$('captionStatus').textContent=m.error;}
  finally{button.textContent='Recheck speech + story';button.disabled=false;}
};
$('translateButton').onclick=()=>{const m=state.moments.find(x=>x.id===state.selected);if(m)void translateMoment(m,m.captionLanguage,{force:true})};
// Hook lab: three AI hooks with their own cover frame, for trial posts (A/B tests).
{const lab=Object.assign(document.createElement('div'),{className:'hook-lab'}),write=Object.assign(document.createElement('button'),{type:'button',id:'writeHooks',className:'cd-btn cd-btn-sm cd-btn-secondary',textContent:'Write 3 hooks to test'}),list=Object.assign(document.createElement('ol'),{id:'hookVariants',className:'hook-variants'});
  lab.append(write,list);($('hook').closest('label')||$('hook')).after(lab);
  const current=()=>state.moments.find(x=>x.id===state.selected);
  // Draws the framed picture at `time` with the hook burned in, at the export aspect.
  // Covers render from a private hidden video so the editor's player never jumps; one at a time, cached.
  const coverVideo=Object.assign(document.createElement('video'),{muted:true,preload:'auto',playsInline:true}),covers=new Map();let coverChain=Promise.resolve();
  function cover(m,variant){const key=[m.id,clipVideo.currentSrc,variant.text,variant.coverTime,$('previewCanvas').width,$('previewCanvas').height,m.frameMode,m.focusX,m.focusY,m.zoom].join('|');if(covers.has(key))return covers.get(key);
    const job=coverChain.then(async()=>{const src=clipVideo.currentSrc||clipVideo.src;if(!src)throw Error('Load the clip preview first.');if(coverVideo.src!==src){coverVideo.src=src;await new Promise((ok,fail)=>{coverVideo.onloadeddata=ok;coverVideo.onerror=()=>fail(Error('The cover frame could not load.'))})}
      coverVideo.currentTime=mediaTime(m,variant.coverTime);await new Promise(ok=>{coverVideo.onseeked=ok});const canvas=document.createElement('canvas');canvas.width=$('previewCanvas').width;canvas.height=$('previewCanvas').height;drawComposedFrame(canvas.getContext('2d'),coverVideo,{...m,hook:variant.text,showHook:true,showCaptions:false},0,coverVideo.currentTime);return canvas});
    coverChain=job.catch(()=>{});covers.set(key,job);job.catch(()=>covers.delete(key));return job}
  renderHookLab=()=>{const m=current();list.replaceChildren();if(!m?.hookVariants?.length)return;
    m.hookVariants.forEach((v,i)=>{const row=document.createElement('li');row.className='hook-variant'+(m.hook===v.text?' is-active':'');const img=document.createElement('img');img.alt=`Cover for hook ${String.fromCharCode(65+i)}`;void cover(m,v).then(c=>{img.style.aspectRatio=`${c.width}/${c.height}`;img.src=c.toDataURL('image/jpeg',.8)}).catch(()=>{});
      const body=document.createElement('div');body.append(Object.assign(document.createElement('strong'),{textContent:`${String.fromCharCode(65+i)} · ${['Curiosity','Quote','Stakes'][i]||'Hook'}`}),Object.assign(document.createElement('p'),{textContent:v.text}));
      const actions=document.createElement('div');actions.className='cd-row';
      const use=Object.assign(document.createElement('button'),{type:'button',className:'cd-btn cd-btn-sm cd-btn-secondary',textContent:m.hook===v.text?'In use':'Use this hook',disabled:m.hook===v.text});use.onclick=()=>performEdit('hook-variant',()=>{m.hook=v.text;m.showHook=true;$('hook').value=v.text;$('showHook').checked=true;renderQueue();drawPreview();renderHookLab()});
      const frame=Object.assign(document.createElement('button'),{type:'button',className:'cd-btn cd-btn-sm cd-btn-ghost',textContent:'Cover from playhead'});frame.onclick=()=>{v.coverTime=Math.min(m.trimOut,Math.max(m.trimIn,localTime(m,clipVideo.currentTime)));projectSession?.changed();renderHookLab()};
      const save=Object.assign(document.createElement('button'),{type:'button',className:'cd-btn cd-btn-sm cd-btn-ghost',textContent:'Download cover'});save.onclick=async()=>{try{(await cover(m,v)).toBlob(blob=>blob&&download(blob,`cover-${String.fromCharCode(97+i)}-${Math.floor(m.start)}.png`),'image/png')}catch(error){toast(error.message)}};
      actions.append(use,frame,save);body.append(actions);row.append(img,body);list.append(row)})};
  write.onclick=async()=>{const m=current();if(!m)return;if(!m.transcript||m.transcript==='Full-recording subtitle track'){const text=activeCues(m).filter(c=>c.end>m.trimIn&&c.start<m.trimOut).map(c=>c.text).join(' ').slice(0,2400);if(!text){toast('This clip has no transcript yet. Transcribe it first.');return}m.hookSource=text}
    write.disabled=true;write.textContent='Writing hooks…';
    try{const data=await requestJson('/api/hooks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transcript:m.hookSource&&(!m.transcript||m.transcript==='Full-recording subtitle track')?m.hookSource:m.transcript,hook:m.hook,language:m.captionLanguage&&m.captionLanguage!=='Original'?m.captionLanguage:'English'})});
      const span=m.trimOut-m.trimIn,times=[m.trimIn+Math.min(.3,span/10),m.trimIn+span/3,m.trimIn+span*2/3];m.hookVariants=data.hooks.map((h,i)=>({...h,coverTime:times[i]}));projectSession?.changed();renderHookLab();toast('Three hooks ready. Post one per trial and keep the winner.')}
    catch(error){toast(error.message)}finally{write.disabled=false;write.textContent='Write 3 hooks to test'}};}
$('hook').oninput=e=>{const m=state.moments.find(x=>x.id===state.selected);if(m){m.hook=e.target.value;renderQueue();renderCut();drawPreview();}};
$('alternateHook').oninput=e=>{const m=state.moments.find(x=>x.id===state.selected);if(m)m.alternateHook=e.target.value;};
$('trimIn').oninput=syncTrim;$('trimOut').oninput=syncTrim;
$('trimIn').onchange=validateTrim;$('trimOut').onchange=validateTrim;
function syncTrim(){const m=state.moments.find(x=>x.id===state.selected);if(!m)return false;const duration=Math.max(.2,m.end-m.start);const inPoint=Number($('trimIn').value),outPoint=Number($('trimOut').value);if($('trimIn').value===''||$('trimOut').value===''||!Number.isFinite(inPoint)||!Number.isFinite(outPoint)||inPoint<0||outPoint>duration+.05||outPoint-inPoint<.2)return false;m.trimIn=inPoint;m.trimOut=outPoint;renderCut();return true;}
function validateTrim(){if(syncTrim())return true;message('Keep IN before OUT, within the selected window.');renderEditor();return false;}
function validateCaptions(m){if(!m.showCaptions)return true;if(activeCues(m).some(c=>c.uncertain)){ $('captionStatus').textContent='Resolve every flagged subtitle line before export.';return false}if(activeCues(m).some(c=>c.uncertain)||m.captionError||!timedCues(m).some(c=>c.end>m.trimIn&&c.start<m.trimOut)||!m.captionReviewed[m.captionLanguage]){const error=m.captionError||(!timedCues(m).some(c=>c.end>m.trimIn&&c.start<m.trimOut)?'No subtitles fall within this trim. Reset sync or correct the timings.':'Listen through and confirm every subtitle line before export.');$('captionStatus').textContent=error;message(error);return false}return true}
$('notesButton').onclick=()=>{const m=state.moments.find(x=>x.id===state.selected);if(!m||!validateTrim())return;download(new Blob([JSON.stringify({source:m.sourceName,sourceLink:m.sourceLink,sourceCrop:m.sourceCrop,sourcePixels:m.sourcePixels,sourceTimeBasis:m.sourceType==='screen'?'elapsed seconds since tab share began':'video playhead seconds',sourceStartSeconds:m.start,sourceEndSeconds:m.end,trimIn:m.trimIn,trimOut:m.trimOut,outputFormat:state.aspect,frameMode:m.frameMode,zoom:m.zoom,focusX:m.focusX,focusY:m.focusY,showHook:m.showHook,sourceCaptionMask:Boolean(m.sourceCaptionMask),hook:m.hook,alternateHook:m.alternateHook,analysis:m.analysis,storyProvider:m.analysis?'Meta Muse Spark':null,speechProvider:m.speechSource||null,translationProvider:m.translationSource||null,timingSource:m.timingSource||null,transcript:m.transcript,captionLanguage:m.captionLanguage,captionStyle:m.captionStyle,captionOffset:m.captionOffset||0,captionCues:timedCues(m).map(({index,...cue})=>cue),captionsReviewed:Boolean(m.captionReviewed[m.captionLanguage]),exportedForReview:true},null,2)],{type:'application/json'}),`context-desk-${Math.floor(m.start)}-notes.json`);};
$('saveSourceButton').onclick=()=>{const m=state.moments.find(x=>x.id===state.selected);if(!m)return;if(m.blob instanceof Blob)download(m.blob,m.batchId?m.sourceName:`context-desk-${Math.floor(m.start)}-raw.${m.blob.type.includes('mp4')?'mp4':'webm'}`);else{const link=document.createElement('a');link.href=m.url;link.download=/\.(mp4|mov|webm|mkv)$/i.test(m.sourceName)?m.sourceName:m.sourceName+(m.blob.type?.includes('webm')?'.webm':'.mp4');link.click();}message(m.batchId?'The full original file was saved. Export clip creates the selected time range.':'Raw captured window saved with its original audio. This file remains usable after the shared tab stops.');};
function srtTime(seconds){const ms=Math.max(0,Math.round(seconds*1000)),hours=Math.floor(ms/3600000),minutes=Math.floor(ms%3600000/60000),secs=Math.floor(ms%60000/1000),millis=ms%1000;return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')},${String(millis).padStart(3,'0')}`}
function sequenceCues(moments){let offset=0;const cues=[];for(const m of moments){for(const cue of timedCues(m)){const start=Math.max(cue.start,m.trimIn),end=Math.min(cue.end,m.trimOut);if(end-start>.1)cues.push({start:offset+start-m.trimIn,end:offset+end-m.trimIn,text:cue.text});}offset+=m.trimOut-m.trimIn;}return cues}
function exportSrt(moments,name){if(!moments.length||moments.some(m=>!timedCues(m).some(c=>c.end>m.trimIn&&c.start<m.trimOut)||!m.captionReviewed[m.captionLanguage])){message('Listen through and confirm each subtitle track before exporting SRT.');return;}const lines=sequenceCues(moments).map((cue,index)=>`${index+1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}\n`).join('\n');download(new Blob([lines],{type:'text/plain;charset=utf-8'}),name);}
$('srtButton').onclick=()=>{const m=state.moments.find(x=>x.id===state.selected);if(m)exportSrt([m],`context-desk-${Math.floor(m.start)}.srt`)};
async function queueVideoExport(moments,name,{draft=false,openJobs=true}={}){
  setActivity('export-save','Saving your edit','Preparing a durable render job…');
  try{const destination=$('socialDestination').value,issue=socialExportIssue(destination,{duration:moments.reduce((n,m)=>n+m.trimOut-m.trimIn,0),aspect:state.aspect,quality:$('exportQuality').value,format:$('exportFormat').value==='webm'?'webm':'mp4'});if(issue)throw Error(issue);for(const m of moments)inheritCaptionTarget(m,projectCaptionTarget());await projectSession.flush();const j=await requestJson('/api/exports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:projectSession.current.id,momentIds:moments.map(m=>m.id),aspect:state.aspect,quality:$('exportQuality').value==='source'?'source':Number($('exportQuality').value),format:$('exportFormat').value==='webm'?'webm':'mp4',destination,draft,name})});await jobsView.refresh();if(openJobs)showWorkspace('jobs');return j}finally{finishActivity('export-save')}
}
$('exportButton').onclick=async()=>{const m=state.moments.find(x=>x.id===state.selected);if(!m||!validateTrim()||!validateCaptions(m))return;try{await queueVideoExport([m],`context-desk-${Math.floor(m.start)}-edit`);m.exportedAt=Date.now();projectSession?.changed()}catch(error){$('editorStatus').textContent=error.message}};

let lastExportUrl=null;
function download(blob,name){if(lastExportUrl)URL.revokeObjectURL(lastExportUrl);lastExportUrl=URL.createObjectURL(blob);const a=$('lastExport');a.href=lastExportUrl;a.download=name;a.textContent=`Download ${name.toUpperCase()}  `;a.hidden=false;a.click();void preserveExport(blob,name);}
window.addEventListener('pagehide',()=>{if(lastExportUrl)URL.revokeObjectURL(lastExportUrl);for(const url of sourceUrls)URL.revokeObjectURL(url);for(const url of batchExportUrls)URL.revokeObjectURL(url)});
$('approveBatch').onclick=()=>{const m=state.moments.find(x=>x.id===state.selected);if(!m?.batchId)return;m.approved=!m.approved;renderBatchResults();renderEditor();};
$('addToCut').onclick=()=>{
  const m=state.moments.find(x=>x.id===state.selected);
  if(!m||!validateTrim()||state.cut.includes(m.id))return;
  if(state.cut.length>=100){$('cutStatus').textContent='The rough cut holds 100 windows at most. Remove one to add another.';return;}
  stopCutPreview();state.cut.push(m.id);renderCut();renderEditor();
  document.querySelector('.cut-section').scrollIntoView({block:'nearest',behavior:'smooth'});
};
function cutMoments(){return state.cut.map(id=>state.moments.find(m=>m.id===id)).filter(Boolean)}
function arcWindows(){
  if(state.moments.length<3)return [];
  const index=Math.max(0,state.moments.findIndex(m=>m.id===state.selected));
  const start=Math.min(Math.max(0,index-1),state.moments.length-3);
  const windows=state.moments.slice(start,start+3).reverse();
  if(windows.some(m=>!m.transcript||m.status==='analysing'))return [];
  if(windows.some((m,i)=>i>0&&(m.sourceName!==windows[0].sourceName||Math.abs(m.start-windows[i-1].end)>2.5)))return [];
  return windows;
}
function updateArcButton(){$('suggestArc').disabled=!state.meta||arcWindows().length!==3}
$('suggestArc').onclick=async()=>{
  const windows=arcWindows();if(windows.length!==3)return;
  const button=$('suggestArc');button.disabled=true;button.textContent='Reading the arc…';
  try{
    const response=await fetch('/api/arc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context:$('showContext').value,windows:windows.map(m=>({start:m.start,end:m.end,transcript:m.transcript,evidence:m.analysis?.evidence||'',beat:m.analysis?.beatType||''}))})});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Story analysis failed');
    const arc=data.arc,panel=$('arcProposal');
    if(!arc.worthCutting){panel.innerHTML=`<span>NO STRONG ARC YET</span><h3>Keep watching.</h3><p>These three windows do not support a clear setup, turn and payoff. Mark a stronger moment or scan further.</p><p class="arc-caution">${escapeHtml(arc.risk||'No supported story beat found.')}</p>`;panel.hidden=false;return;}
    panel.innerHTML=`<span>STORY PROPOSAL · ${formatTime(windows[0].start)}–${formatTime(windows[2].end)}</span><h3>${escapeHtml(arc.hook)}</h3><div class="arc-steps"><div><b>01 SETUP</b><p>${escapeHtml(arc.setup)}</p></div><div><b>02 TURN</b><p>${escapeHtml(arc.turn)}</p></div><div><b>03 PAYOFF</b><p>${escapeHtml(arc.payoff)}</p></div></div><p class="arc-caution">EVIDENCE: ${escapeHtml(arc.evidence)}<br>CHECK: ${escapeHtml(arc.risk)}</p><button id="acceptArc">ADD 3 WINDOWS TO CUT</button><button id="dismissArc">DISMISS</button>`;
    panel.hidden=false;
    $('acceptArc').onclick=()=>{
      const additions=windows.filter(m=>!state.cut.includes(m.id));
      if(state.cut.length+additions.length>100){$('cutStatus').textContent='This cut can hold 100 windows. Remove one before adding this arc.';return;}
      stopCutPreview();state.cut.push(...additions.map(m=>m.id));
      if(!$('cutTitle').value.trim())$('cutTitle').value=arc.hook;
      if(!windows[0].hook)windows[0].hook=arc.hook;
      renderCut();renderQueue();renderEditor();panel.hidden=true;
    };
    $('dismissArc').onclick=()=>{panel.hidden=true};
  }catch(error){$('arcProposal').innerHTML=`<span>STORY CHECK FAILED</span><p>${escapeHtml(error.message||'Try again.')}</p>`;$('arcProposal').hidden=false;}
  finally{button.textContent='Find a story arc ';updateArcButton();}
};
function renderCut(){projectSession?.changed();document.body.classList.toggle('has-story',state.moments.length>=3||state.cut.length>0);
  const moments=cutMoments();
  $('cutCount').textContent=`${String(moments.length).padStart(2,'0')} Moments`;
  $('cutDuration').textContent=`${formatTime(moments.reduce((sum,m)=>sum+m.trimOut-m.trimIn,0))} In cut`;
  $('exportSequence').disabled=$('exportEdl').disabled=!moments.length;
  $('previewCut').disabled=!moments.length;
  $('exportCutSrt').disabled=!moments.length||moments.some(m=>!activeCues(m).length);
  $('cutList').innerHTML=moments.length?moments.map((m,i)=>`<div class="cut-item" draggable="true" data-id="${m.id}"><span class="cut-index">${String(i+1).padStart(2,'0')}</span><button class="cut-open" data-id="${m.id}"><strong>${escapeHtml(m.hook||m.analysis?.beatType||'Untitled source window')}</strong><small>${escapeHtml(m.sourceName)} · ${formatTime(m.start+m.trimIn)}–${formatTime(m.start+m.trimOut)}</small></button><div class="cut-order"><button aria-label="Move moment ${i+1} up" data-action="up" data-index="${i}" ${i===0?'disabled':''}>${icon('up')}</button><button aria-label="Move moment ${i+1} down" data-action="down" data-index="${i}" ${i===moments.length-1?'disabled':''}>${icon('down')}</button><button aria-label="Remove moment ${i+1}" data-action="remove" data-index="${i}">${icon('close')}</button></div></div>`).join(''):'<p class="cut-empty">Choose a window above, then add it to this cut.</p>';
  document.querySelectorAll('.cut-open').forEach(button=>button.onclick=()=>selectMoment(button.dataset.id));
  document.querySelectorAll('.cut-order button').forEach(button=>button.onclick=()=>{
    stopCutPreview();
    const index=Number(button.dataset.index);
    if(button.dataset.action==='remove')state.cut.splice(index,1);
    else{const other=index+(button.dataset.action==='up'?-1:1);[state.cut[index],state.cut[other]]=[state.cut[other],state.cut[index]];}
    renderCut();renderEditor();
  });
  document.querySelectorAll('.cut-item').forEach(row=>{
    row.ondragstart=event=>{event.dataTransfer.setData('text/plain',row.dataset.id);event.dataTransfer.effectAllowed='move';row.classList.add('dragging')};
    row.ondragend=()=>row.classList.remove('dragging');
    row.ondragover=event=>{event.preventDefault();row.classList.add('drag-over')};
    row.ondragleave=()=>row.classList.remove('drag-over');
    row.ondrop=event=>{event.preventDefault();row.classList.remove('drag-over');const from=state.cut.indexOf(event.dataTransfer.getData('text/plain')),to=state.cut.indexOf(row.dataset.id);if(from<0||to<0||from===to)return;stopCutPreview();const [id]=state.cut.splice(from,1);state.cut.splice(to,0,id);renderCut()};
  });
  if(moments.some((m,i)=>i>0&&m.sourceName===moments[i-1].sourceName&&m.start<moments[i-1].start))$('cutStatus').textContent='Story order differs from the source chronology. Review the context before sharing.';
}
function cutNotes(){return {title:$('cutTitle').value.trim(),outputFormat:state.aspect,exportedForReview:true,sequence:cutMoments().map((m,index)=>({order:index+1,source:m.sourceName,sourceLink:m.sourceLink,sourceCrop:m.sourceCrop,sourcePixels:m.sourcePixels,sourceTimeBasis:m.sourceType==='screen'?'elapsed seconds since tab share began':'video playhead seconds',sourceStartSeconds:m.start+m.trimIn,sourceEndSeconds:m.start+m.trimOut,frameMode:m.frameMode,zoom:m.zoom,focusX:m.focusX,focusY:m.focusY,showHook:m.showHook,sourceCaptionMask:Boolean(m.sourceCaptionMask),hook:m.hook,alternateHook:m.alternateHook,evidence:m.analysis?.evidence||'',contextNote:m.analysis?.contextNote||'',riskNote:m.analysis?.riskNote||'',storyProvider:m.analysis?'Meta Muse Spark':null,speechProvider:m.speechSource||null,translationProvider:m.translationSource||null,timingSource:m.timingSource||null,transcript:m.transcript,captionLanguage:m.captionLanguage,captionStyle:m.captionStyle,captionOffset:m.captionOffset||0,captionCues:timedCues(m).map(({index,...cue})=>cue),captionsReviewed:Boolean(m.captionReviewed[m.captionLanguage])}))}}
$('exportEdl').onclick=()=>download(new Blob([JSON.stringify(cutNotes(),null,2)],{type:'application/json'}),'context-desk-story-cut-notes.json');
$('exportCutSrt').onclick=()=>exportSrt(cutMoments(),'context-desk-story-cut.srt');
$('exportSequence').onclick=async()=>{const moments=cutMoments();if(!moments.length||moments.some(m=>!validateCaptions(m)))return;try{await queueVideoExport(moments,$('cutTitle').value||'context-desk-story-cut')}catch(error){$('cutStatus').textContent=error.message}};

let wholeJobs=[],wholeJob=null,wholePoll=null,wholeTrackUrl=null,wholePreparing=false;
function renderWholeSubtitles(){
  if(!$('wholeSubtitles'))return;$('wholeSubtitles').hidden=state.sourceType!=='file'&&!wholeJob;
  const duration=Number.isFinite(program.duration)?program.duration:0,sections=Math.ceil(duration/45);
  $('wholeCost').textContent=duration?`${formatTime(duration)} recording · up to ${sections} speech sections and ${$('wholeLanguage').value==='Original'?0:sections+' or more'} translation requests. This is separate from the clip-analysis budget. Only audio is used for this job; no visual-model pass.`:'Load the full recording to generate subtitles. Previous jobs and downloads are saved on this computer.';
  $('startWholeSubtitles').disabled=wholePreparing||state.sourceType!=='file'||wholeJob?.status==='running';if(!wholeServiceReady($('wholeLanguage').value)){$('startWholeSubtitles').disabled=true;queueMicrotask(()=>{$('wholeCost').textContent=missingServiceMessage('Translating the whole recording')})}$('startWholeSubtitles').textContent=wholePreparing?'Preparing local recording…':'Generate full subtitles';
  $('wholeJobStatus').hidden=!wholeJob&&!$('wholeError').textContent;$('wholeJobSelect').hidden=!wholeJobs.length;$('wholeJobLabel').hidden=!wholeJobs.length;
  $('wholeJobSelect').innerHTML=wholeJobs.map(job=>`<option value="${job.id}" ${wholeJob?.id===job.id?'selected':''}>${escapeHtml(job.sourceName)} · ${escapeHtml(job.language)} · ${job.status}</option>`).join('');
  if(!wholeJob)return;const j=wholeJob,hasLines=j.cueCount>0,currentSource=state.source?.importId===j.sourceId;
  $('wholePhase').textContent=j.sourceName+' / '+j.language+' · '+j.phase;$('wholeProgress').value=j.duration?j.completedSeconds/j.duration*100:0;
  $('wholeProgressText').textContent=`${formatTime(j.completedSeconds)} / ${formatTime(j.duration)} finished · ${j.sectionsDone}/${j.sectionsTotal} sections · ${j.cueCount} subtitle lines · ${j.speechRequests} speech / ${j.translationRequests} translation requests`;
  $('wholeError').hidden=!j.error;$('wholeError').textContent=j.error;$('pauseWholeSubtitles').hidden=j.status!=='running';$('resumeWholeSubtitles').hidden=j.legacyReadOnly||!['paused','error','interrupted','cancelled'].includes(j.status);$('resumeWholeSubtitles').textContent=j.status==='error'?'Retry unfinished section':'RESUME';
  for(const [id,original,format,accessible]of [['wholeSrt',false,'srt'],['wholeOriginalSrt',true,'srt'],['wholeVtt',false,'vtt'],['wholeOriginalVtt',true,'vtt'],['wholeAccessibleSrt',false,'srt',true]]){$(id).hidden=!hasLines;$(id).href='/api/subtitles/'+j.id+'/'+format+(original?'?original=1':accessible?'?mode=accessible':'')}
  $('restoreWholeSource').hidden=currentSource;
  $('reviewFullVideo').hidden=!currentSource||!hasLines;$('useWholeCaptions').hidden=!hasLines||!currentSource||!batchMoments().length;$('previewWholeSubtitles').hidden=true;
}
async function pollWholeJob(){
  clearTimeout(wholePoll);if(!wholeJob)return;const id=wholeJob.id;
  try{const response=await fetch('/api/subtitles/'+id),job=await response.json();if(!response.ok)throw Error(job.error);if(wholeJob?.id!==id)return;wholeJob=job;wholeJobs=wholeJobs.map(j=>j.id===id?job:j);renderWholeSubtitles();if(['queued','running'].includes(job.status))wholePoll=setTimeout(pollWholeJob,1500)}
  catch(error){$('wholeError').hidden=false;$('wholeError').textContent=(error.message||'Progress connection lost.')+' Completed sections stay on the local server. Reopen this panel to reconnect.'}
}
async function loadWholeJobs(){try{const response=await fetch('/api/subtitles'),data=await response.json();if(!response.ok)return;wholeJobs=data.jobs||[];wholeJob=wholeJobs.at(-1)||null;renderWholeSubtitles();if(wholeJob){void pollWholeJob()}}catch{}}
async function cacheWholeSource(){
  if(state.source?.importId)return state.source.importId;
  if(!(state.source instanceof Blob))throw Error('Load a recording first. A live tab cannot be translated as a complete recording until it is saved.');
  const file=state.source,token=state.sourceLoadToken;setActivity('whole-source','Preparing the full recording','Copying it into the local cache. This stays on your computer.');state.sourceUploadAbort=new AbortController();
  try{const response=await fetch('/api/import/upload',{method:'POST',signal:state.sourceUploadAbort.signal,headers:{'Content-Type':file.type||'video/mp4','X-Video-Duration':String(program.duration),'X-Video-Name':encodeURIComponent(state.sourceName)},body:file});const job=await response.json();if(!response.ok)throw Error(job.error);if(token!==state.sourceLoadToken)throw Error('The source changed. Start subtitles on the new recording.');state.source={importId:job.id,size:file.size,type:file.type,name:state.sourceName};return job.id}finally{finishActivity('whole-source')}
}
$('wholeLanguage').onchange=renderWholeSubtitles;
$('startWholeSubtitles').onclick=async()=>{
  if(wholePreparing)return;wholePreparing=true;$('wholeError').textContent='';renderWholeSubtitles();$('wholeError').hidden=true;
  try{const sourceId=await cacheWholeSource(),response=await fetch('/api/subtitles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceId,variant:$('wholeVariant').value,script:$('wholeRoman').checked?'roman':'native',language:$('wholeLanguage').value,speechProvider:$('speechProvider').value,translationProvider:$('translationProvider').value,speechLanguage:speechChoices(),keywords:$('speechKeywords').value.split(',').map(x=>x.trim()).filter(Boolean),dialectNote:$('sourceDialect').value,translationMode:$('translationMode').value,glossary:$('glossary').value})});const job=await response.json();if(!response.ok)throw Error(job.error);wholeJob=job;wholeJobs=wholeJobs.filter(j=>j.id!==job.id);wholeJobs.push(job);void pollWholeJob()}
  catch(error){$('wholeJobStatus').hidden=false;$('wholeError').hidden=false;$('wholeError').textContent=error.message||'Could not start subtitles.'}
  finally{wholePreparing=false;renderWholeSubtitles()}
};
for(const [id,action]of [['pauseWholeSubtitles','pause'],['resumeWholeSubtitles','resume']])$(id).onclick=async()=>{if(!wholeJob)return;try{const response=await fetch('/api/subtitles/'+wholeJob.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})}),job=await response.json();if(!response.ok)throw Error(job.error);wholeJob=job;void pollWholeJob()}catch(error){$('wholeError').hidden=false;$('wholeError').textContent=error.message}};
$('restoreWholeSource').onclick=async()=>{if(!wholeJob)return;try{const response=await fetch('/api/import/'+wholeJob.sourceId),job=await response.json();if(!response.ok||job.status!=='ready')throw Error('This cached recording is unavailable. Load the full video again. Completed subtitle downloads remain available.');await loadImportedVideo(job,'',{auto:false});$('wholeSubtitleDetails').open=true;renderWholeSubtitles()}catch(error){$('wholeError').hidden=false;$('wholeError').textContent=error.message}};
$('wholeJobSelect').onchange=e=>{wholeJob=wholeJobs.find(j=>j.id===e.target.value);$('wholePreview').pause();$('wholePreview').hidden=true;renderWholeSubtitles();void pollWholeJob()};
$('openWholeSubtitles').onclick=()=>{showWorkspace('clips');$('wholeSubtitleDetails').open=true;renderWholeSubtitles();$('wholeSubtitles').scrollIntoView({behavior:'smooth',block:'start'})};
$('wholeSubtitleDetails').ontoggle=()=>{if($('wholeSubtitleDetails').open)void pollWholeJob()};
async function fullTrack(){const response=await fetch('/api/subtitles/'+wholeJob.id+'/track'),data=await response.json();if(!response.ok)throw Error(data.error);return data}
$('previewWholeSubtitles').onclick=async()=>{try{const track=await fullTrack();if(wholeTrackUrl)URL.revokeObjectURL(wholeTrackUrl);wholeTrackUrl=URL.createObjectURL(new Blob(['WEBVTT\n\n'+srtDocument(track.cues).replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g,'$1.$2')],{type:'text/vtt;charset=utf-8'}));$('wholePreview').src=state.sourceUrl;$('wholeTrack').src=wholeTrackUrl;$('wholeTrack').label=track.language+' · draft';$('wholeTrack').track.mode='showing';$('wholePreview').hidden=false;$('wholePreview').scrollIntoView({behavior:'smooth',block:'nearest'})}catch(error){$('wholeError').hidden=false;$('wholeError').textContent=error.message}};
$('wholePreview').onplay=()=>claimPlayback($('wholePreview'));
$('reviewFullVideo').onclick=async()=>{try{const track=await fullTrack();if(track.sourceId!==state.source?.importId)throw Error('Open this recording first.');let m=state.moments.find(m=>m.id===track.id+'-full');if(!m){m={id:track.id+'-full',url:state.sourceUrl,blob:state.source,frames:[],start:0,end:track.duration,mediaStart:0,batchId:state.batchId,sourceName:state.sourceName,sourceType:'file',sourceLink:state.sourcePageUrl,manual:true,status:'manual',analysis:null,transcript:'Full-recording subtitle track',trimIn:0,trimOut:track.duration,hook:'',alternateHook:'',frameMode:'fit',zoom:1,focusX:50,focusY:50,showHook:false,captionLanguage:track.language,captionStyle:'clean',dialectNote:$('sourceDialect').value,captionCues:{Original:track.original,...(track.language==='Original'?{}:{[track.language]:track.cues})},captionReviewed:{},showCaptions:true,captionOffset:0};state.moments.push(m)}await selectMoment(m.id);document.querySelector('.caption-workspace').open=true;projectSession.changed()}catch(error){$('wholeError').hidden=false;$('wholeError').textContent=error.message}};
$('useWholeCaptions').onclick=async()=>{try{const track=await fullTrack();if(track.sourceId!==state.source?.importId)throw Error('This subtitle track belongs to a different recording.');for(const m of batchMoments()){const local=cues=>cues.filter(c=>c.end>m.start&&c.start<m.end).map(c=>({...c,start:Math.max(0,c.start-m.start),end:Math.min(m.end-m.start,c.end-m.start),words:c.words?.map(w=>({...w,start:w.start-m.start,end:w.end-m.start}))}));m.captionCues.Original=local(track.original);if(track.language!=='Original')m.captionCues[track.language]=local(track.cues);m.captionLanguage=track.language;m.captionOffset=0;m.captionReviewed={};m.showCaptions=true;m.captionError=activeCues(m).some(c=>c.text.length>100)?'Some translated lines need splitting before export.':'';}message('Full-video subtitles applied to clips from this recording. Review each clip before export.');if(state.selected)renderEditor()}catch(error){$('wholeError').hidden=false;$('wholeError').textContent=error.message}};
function blobDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)})}
function downloadSaved(url,name){const a=$('lastExport');a.href=url;a.download=name;a.textContent='Download '+name.toUpperCase();a.hidden=false;a.click()}
async function preserveExport(blob,name,batch=false){
  if(!projectSession?.current)return;const id=projectSession.current.id;
  try{const asset=await projectSession.asset(blob);if(projectSession.current?.id!==id)return;state.exportHistory??=[];state.exportHistory.push({name,url:asset.url,size:asset.size,type:asset.type,batch,createdAt:Date.now()});projectSession.changed();await projectSession.flush()}
  catch(error){message('The download is available, but saving export history failed: '+error.message)}
}
function projectSnapshot(){
  const settings={};for(const id of settingIds){const el=$(id);if(el)settings[id]=el.type==='checkbox'?el.checked:el.value}
  return {title:$('projectTitle').value||state.sourceName||'Untitled production',state:{version:1,storyMemoryId:memoryView.id,sourceId:state.source?.importId||projectSession.current?.sourceId||null,sourcePageUrl:state.sourcePageUrl||'',aspect:state.aspect,selected:state.selected,workspace:['home','source','clips','edit','library','jobs'].includes(document.body.dataset.workspace)?document.body.dataset.workspace:'clips',cut:[...state.cut],settings,exports:state.exportHistory||[],aiCalls:state.aiCalls,batchId:state.batchId,moments:state.moments.map(m=>{const copy={};for(const key of savedMomentKeys)if(m[key]!==undefined)copy[key]=key==='blob'?m[key]:structuredClone(m[key]);return copy})}};
}
async function restoreProject(p){
  editHistory.reset();const saved=p.state;await memoryView.list(saved.storyMemoryId||'');state.moments=recoverBrowserMoments(saved.moments||[]);state.cut=saved.cut||[];state.selected=saved.selected||null;state.aspect=saved.aspect||'landscape';state.aiCalls=saved.aiCalls||0;state.batchId=saved.batchId||crypto.randomUUID();state.batchCancel=true;state.exportHistory=saved.exports||[];state.batchExports=state.exportHistory.filter(e=>e.batch);
  $('liveCaptionLanguage').value=saved.settings?.liveCaptionLanguage||userCaptionDefault();
  for(const [id,value]of Object.entries(saved.settings||p.source?.settings||{})){const el=$(id);if(!el)continue;if(el.type==='checkbox')el.checked=Boolean(value);else el.value=value}
  const source=p.sourceId?await requestJson('/api/import/'+p.sourceId).catch(()=>null):null;
  if(source?.status==='ready'){try{await loadImportedVideo(source,p.state.sourcePageUrl||source.sourceUrl||'',{auto:false})}catch(error){cleanupSource();message('The source cannot play. Saved edits are retained: '+error.message)}}
  else{cleanupSource();message(p.sourceId?'Source media is unavailable. Saved clips and edits are retained. Restore the original recording before processing.':'Live session restored. Saved windows can play and export; connect a live tab again to capture new footage.');}
  state.batchId=saved.batchId||state.batchId;
  updateButtons();updateBudgetUi();updateSpeechSummary();renderQueue();renderBatchResults();renderCut();renderBatchDownloads();
  if(saved.workspace==='edit'&&state.selected&&state.moments.some(m=>m.id===state.selected))await selectMoment(state.selected,{scroll:false});else showWorkspace(['home','source','clips','library','jobs'].includes(saved.workspace)?saved.workspace:'clips');
  $('lastExport').hidden=true;const last=state.exportHistory.at(-1);if(last){$('lastExport').href=last.url;$('lastExport').download=last.name;$('lastExport').textContent='Download '+last.name.toUpperCase();$('lastExport').hidden=false}
}
let libraryProjects=[],libraryTimer;
let libraryRequest=0;
async function renderLibrary(){
  const request=++libraryRequest;$('libraryRows').setAttribute('aria-busy','true');$('libraryStatus').textContent='Loading projects…';
  try{const query=new URLSearchParams({sort:$('librarySort').value,direction:$('libraryDirection').value,search:$('librarySearch').value,trash:$('showProjectTrash').checked?'1':'0'}),data=await requestJson('/api/projects?'+query);if(request!==libraryRequest)return;libraryProjects=data.projects;{const b=$('navLibraryCount');if(b){b.textContent=String(libraryProjects.length);b.hidden=!libraryProjects.length}}layout.setLibraryView(libraryView);
    const field=$('librarySort').value,dir=$('libraryDirection').value==='asc'?1:-1;if(['duration','size','clips'].includes(field))libraryProjects.sort((a,b)=>(Number(a[field==='clips'?'clipCount':field])-Number(b[field==='clips'?'clipCount':field]))*dir||a.title.localeCompare(b.title));
    $('libraryStatus').textContent=libraryProjects.length+($('librarySearch').value.trim()?' matching ':' saved ')+(libraryProjects.length===1?'project':'projects');{const empty=$('emptyTrash'),inTrash=$('showProjectTrash').checked&&libraryProjects.length;empty.hidden=!inTrash;if(inTrash)empty.textContent=`Empty Trash (${formatSize(libraryProjects.reduce((sum,p)=>sum+(Number(p.size)||0),0))})`}
    $('libraryRows').innerHTML=libraryProjects.length?libraryProjects.map(p=>`<article class="library-row"><div class="library-thumb">${p.thumbnail?`<img src="${escapeHtml(p.thumbnail)}" alt="" loading="lazy">`:'<span>Preview unavailable</span>'}</div><div class="library-description"><button class="project-open" data-project-open="${p.id}">${escapeHtml(p.title)}</button><p>${escapeHtml(p.language)}${p.dialect?' · '+escapeHtml(p.dialect):''} · ${formatTime(p.duration)} · ${(p.size/1024/1024).toFixed(1)} MB</p><span class="project-state">${escapeHtml(p.status)} · ${p.windowCount??p.clipCount} retained windows</span></div><div class="library-clips"><strong>${p.clipCount}</strong><span>clips</span></div><time datetime="${new Date(p.updatedAt).toISOString()}">${new Date(p.updatedAt).toLocaleDateString(undefined,{day:'numeric',month:'short'})}</time><div class="library-row-actions">${p.recoveryCount?`<button data-recoveries="${p.id}">Review ${p.recoveryCount} recovery ${p.recoveryCount===1?'copy':'copies'}</button>`:''}${p.status==='missing'?`<button data-relink="${p.sourceId}">Restore source</button>`:''}<button class="project-trash" data-project-trash="${p.id}">${p.trashed?'Restore':'Move to Trash'}</button>${p.trashed?`<button class="project-delete" data-project-delete="${p.id}">Delete forever</button>`:''}</div></article>`).join(''):'<div class="library-empty"><h3>'+($('showProjectTrash').checked?'Trash is empty.':$('librarySearch').value.trim()?'No projects match this search.':'Your next production starts here.')+'</h3><p>'+($('showProjectTrash').checked?'Trashed projects keep their media until you choose otherwise.':$('librarySearch').value.trim()?'Try another title, source or language, or clear your search.':'Add a recording. Your clips, captions and edits will be saved on this computer.')+'</p></div>';
  }catch(error){if(request!==libraryRequest)return;$('libraryStatus').textContent='Could not load your Library: '+error.message}finally{if(request===libraryRequest)$('libraryRows').setAttribute('aria-busy','false')}
}
async function openRecoveryCopies(id){const data=await requestJson('/api/projects/'+id+'/recoveries');$('recoveryPanel').hidden=false;$('recoveryRows').innerHTML=data.recoveries.map(r=>`<div class="memory-fact"><strong>${escapeHtml(r.title)}</strong><p>${new Date(r.createdAt).toLocaleString()}</p><p>${escapeHtml(r.preview||'Saved project settings and edits')}</p><button data-restore-copy="${r.id}" data-project="${id}">${r.restoredProjectId?'Open restored project':'Restore as separate project'}</button></div>`).join('')||'<p>No recovery copies are available.</p>'}
$('closeRecoveries').onclick=()=>{$('recoveryPanel').hidden=true};$('recoveryRows').onclick=async event=>{const button=event.target.closest('[data-restore-copy]');if(!button)return;button.disabled=true;try{const p=await requestJson('/api/projects/'+button.dataset.project+'/recoveries/'+button.dataset.restoreCopy,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});await projectSession.open(p.id);$('recoveryPanel').hidden=true;showWorkspace('clips')}catch(error){$('libraryStatus').textContent=error.message;button.disabled=false}};
let relinkSourceId=null;
$('cancelRelink').onclick=()=>{$('relinkPanel').hidden=true;relinkSourceId=null};
$('relinkFile').onchange=async event=>{const file=event.target.files?.[0];if(!file||!relinkSourceId)return;const video=document.createElement('video'),url=URL.createObjectURL(file);video.src=url;setActivity('relink','Restoring source media','Verifying the original bytes and keeping your saved edits…');try{await mediaReady(video);await requestJson('/api/import/'+relinkSourceId+'/relink',{method:'POST',headers:{'Content-Type':file.type||'video/mp4','X-Video-Duration':String(video.duration),'X-Confirm-Original':String($('confirmOriginalSource').checked)},body:file});$('relinkPanel').hidden=true;await renderLibrary();$('libraryStatus').textContent='Source restored. Open the project to review its saved edits.'}catch(error){$('relinkDescription').textContent=error.message}finally{URL.revokeObjectURL(url);finishActivity('relink');event.target.value=''}};
$('newRecording').onclick=()=>showWorkspace('source');
for(const id of ['librarySort','libraryDirection','showProjectTrash'])$(id).onchange=()=>{void renderLibrary();void saveLibraryPreferences()};
$('librarySearch').oninput=()=>{$('libraryStatus').textContent='Searching projects…';clearTimeout(libraryTimer);libraryTimer=setTimeout(()=>{void renderLibrary();void saveLibraryPreferences()},200)};
async function saveLibraryPreferences(){const prefs=await requestJson('/api/preferences');await requestJson('/api/preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...prefs,view:libraryView,sort:$('librarySort').value,direction:$('libraryDirection').value,search:$('librarySearch').value})})}
// Permanent delete: only from Trash, always confirmed, and the open project closes if it goes.
function formatSize(bytes){return bytes>=1e9?(bytes/1e9).toFixed(1)+' GB':Math.max(0,Math.round(bytes/1e6))+' MB'}
async function afterDelete(ids,result){const freed=result.freedBytes?` Freed ${formatSize(result.freedBytes)}.`:'';if(ids.includes(projectSession?.current?.id)){location.href='/#/home';location.reload();return}await renderLibrary();$('libraryStatus').textContent=(result.message||'Deleted for good.')+freed}
async function deleteForGood(p){if(!p||!confirm(`Delete “${p.title}” for good?\n\nIts recording (${formatSize(Number(p.size)||0)}), clips, captions and edits are removed from this computer. This cannot be undone.`))return;
  setActivity('project-delete','Deleting for good','Removing the recording and its edits…');try{await afterDelete([p.id],await requestJson('/api/projects/'+p.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete'})}))}finally{finishActivity('project-delete')}}
$('emptyTrash').onclick=async()=>{const ids=libraryProjects.map(p=>p.id),size=libraryProjects.reduce((sum,p)=>sum+(Number(p.size)||0),0);if(!ids.length||!confirm(`Delete all ${ids.length} ${ids.length===1?'project':'projects'} in Trash for good?\n\nTheir recordings (${formatSize(size)}), clips, captions and edits are removed from this computer, along with any leftover recordings no project uses. This cannot be undone.`))return;
  setActivity('project-delete','Emptying Trash','Removing recordings and edits…');try{const result=await requestJson('/api/projects/trash/empty',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    await afterDelete(ids.filter(id=>!result.skipped.some(s=>s.id===id)),{...result,message:`Deleted ${result.deleted} ${result.deleted===1?'project':'projects'} for good.`+(result.skipped.length?` Kept ${result.skipped.map(s=>`“${s.title}” (${s.error})`).join(', ')}.`:'')})}
  catch(error){$('libraryStatus').textContent=error.message}finally{finishActivity('project-delete')}};
$('libraryRows').onclick=async event=>{const open=event.target.closest('[data-project-open]'),trash=event.target.closest('[data-project-trash]'),remove=event.target.closest('[data-project-delete]'),relink=event.target.closest('[data-relink]'),recoveries=event.target.closest('[data-recoveries]');try{if(recoveries){await openRecoveryCopies(recoveries.dataset.recoveries)}else if(relink){relinkSourceId=relink.dataset.relink;$('relinkDescription').textContent='Choose the same recording so existing timecodes stay valid. Exact saved fingerprints are checked when available.';$('relinkPanel').hidden=false;$('confirmOriginalSource').checked=false;}else if(open){setActivity('project-open','Opening saved project','Restoring your recording, clips and edits…');await projectSession.open(open.dataset.projectOpen);showWorkspace('clips')}else if(remove){await deleteForGood(libraryProjects.find(p=>p.id===remove.dataset.projectDelete))}else if(trash){const p=libraryProjects.find(p=>p.id===trash.dataset.projectTrash);await requestJson('/api/projects/'+p.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'trash',trashed:!p.trashed})});await renderLibrary()}}catch(error){$('libraryStatus').textContent=error.message}finally{finishActivity('project-open')}};
projectSession=createProjectSession({capture:projectSnapshot,restore:restoreProject,onStatus:(text,kind)=>{$('saveStatus').textContent=text;$('saveStatus').dataset.state=kind;$('retryProjectSave').hidden=kind!=='error'},onProject:p=>{$('projectBar').hidden=!p;$('projectTrashNotice').hidden=!p?.trashed;if(p){$('projectTitle').value=p.title;queueMicrotask(()=>{if(projectSession?.current?.id===p.id)for(const m of state.moments)queueCaptionTarget(m)})}},onSaved:p=>{for(const saved of p.state.moments||[]){const m=state.moments.find(m=>m.id===saved.id);if(m)m.frames=saved.frames}}});
$('restoreCurrentProject').onclick=async()=>{const p=projectSession.current;if(!p)return;try{await projectSession.flush();await requestJson('/api/projects/'+p.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'trash',trashed:false})});p.trashed=false;$('projectTrashNotice').hidden=true;void homeView.refresh()}catch(error){$('projectTrashMessage').textContent=error.message}};
$('retryProjectSave').onclick=()=>void projectSession.retry().catch(()=>{});
for(const type of ['input','change'])document.addEventListener(type,event=>{if(event.target.closest('#libraryPanel')||event.target.closest('#wholeSubtitles')||event.target.matches('#momentSearch,#momentFilter,#seekBar'))return;projectSession.changed()});

function orderedMoments(){return [...state.moments].sort((a,b)=>(a.start-b.start)*($('clipDirection').value==='desc'?-1:1))}
function renderMomentMap(){
  const duration=Number.isFinite(program.duration)?program.duration:Math.max(0,...state.moments.map(m=>m.end)),mapped=momentLanes(state.moments);
  $('mapAxis').innerHTML=duration?[0,.25,.5,.75,1].map(r=>'<span>'+formatTime(duration*r)+'</span>').join(''):'<span>No source time yet</span>';
  $('momentMapTrack').style.height=(mapped.lanes*32+16)+'px';
  $('momentMapTrack').innerHTML=duration?mapped.windows.map(({moment:m,lane})=>`<button title="${escapeHtml(m.hook||m.status)} · ${formatTime(m.start)}" aria-label="Review ${escapeHtml(m.status)} window at ${formatTime(m.start)}" data-map="${m.id}" class="${m.status==='suggested'?'supported':m.analysis?'checked':'unchecked'}" style="top:${lane*32+8}px;left:${Math.max(0,m.start/duration*100)}%;width:${Math.max(.3,Math.min(100-m.start/duration*100,(m.end-m.start)/duration*100))}%">${(m.end-m.start)/duration>.18?escapeHtml(formatTime(m.start)+'–'+formatTime(m.end)+' · '+m.status.replaceAll('-',' ')):''}</button>`).join(''):'';
  $('momentMapTrack').querySelectorAll('button').forEach(b=>b.onclick=()=>{const m=state.moments.find(m=>m.id===b.dataset.map);if(state.sourceType==='file'&&m.blob?.importId===state.source?.importId)void reviewSource(m.id);else void selectMoment(m.id)});
  $('mapReadout').textContent=state.moments.length+' source-linked windows · '+mapped.lanes+' '+(mapped.lanes===1?'lane':'lanes');
}

$('clipDirection').onchange=()=>{renderQueue();renderBatchResults()};
// Changing translation style keeps the current subtitles on screen until the new version is ready.
$('captionTranslationMode').onchange=async()=>{const m=state.moments.find(x=>x.id===state.selected);if(!m)return;const lines=m.captionCues.Original?.length||0;
  if(m.captionLanguage!=='Original'&&lines>300&&!confirm(`Re-translating ${lines} lines in this style takes about ${Math.ceil(lines/25)} translation requests. Your current subtitles stay until it finishes. Continue?`)){$('captionTranslationMode').value=m.translationMode||'faithful';return}
  m.translationMode=$('captionTranslationMode').value;if(m.captionLanguage!=='Original')await translateMoment(m,m.captionLanguage,{force:true,confirmed:true});else renderEditor()};
const memoryView=createMemoryView({trashToggle:$('showMemoryTrash'),trashButton:$('trashMemory'),select:$('storyMemorySelect'),rows:$('memoryFacts'),status:$('memoryStatus'),getSelected:()=>{const m=state.moments.find(x=>x.id===state.selected);return m?{...m,projectId:projectSession.current?.id}:null},onSelect:()=>projectSession?.changed()});
$('createMemory').onclick=()=>memoryView.create($('newMemoryTitle').value||'Story memory');$('addMemoryNote').onclick=()=>memoryView.add();$('addMemoryEvidence').onclick=()=>memoryView.add(true);$('saveMemory').onclick=()=>void memoryView.save().catch(()=>{});$('exportMemory').onclick=()=>memoryView.export();$('trashMemory').onclick=()=>memoryView.trash();

function performEdit(key,mutate){const before=editSnapshot();mutate();editHistory.record(before,editSnapshot(),key);projectSession.changed()}
const editKeys=['trimIn','trimOut','captionMode','hook','hookVariants','captionAccents','showAccents','alternateHook','frameMode','splitCam','cuts','zoom','focusX','focusY','showHook','captionLanguage','captionLanguageOverride','translationMode','captionStyle','captionLook','frameKeyframes','frameTracking','transcriptEdit','discoveryStrategy','audioEnhance','dialectNote','captionCues','captionReviewed','showCaptions','captionOffset','sourceCaptionMask','approved'];
function editSnapshot(){return {aspect:state.aspect,targetLanguage:projectCaptionTarget(),cut:[...state.cut],selected:state.selected,moments:state.moments.map(m=>({id:m.id,captionLanguageOverride:m.captionLanguageOverride||null,...Object.fromEntries(editKeys.filter(k=>m[k]!==undefined).map(k=>[k,structuredClone(m[k])]))}))}}
function applyEditSnapshot(value){const ids=new Set(value.moments.map(m=>m.id));state.moments=state.moments.filter(m=>!m.splitCreated||ids.has(m.id));for(const edit of value.moments){const m=state.moments.find(m=>m.id===edit.id);if(m)Object.assign(m,edit);else if(splitOriginals.has(edit.id))state.moments.push({...structuredClone(splitOriginals.get(edit.id)),...edit})}state.cut=value.cut.filter(id=>state.moments.some(m=>m.id===id));state.aspect=value.aspect;state.selected=value.selected;if(value.targetLanguage)$('liveCaptionLanguage').value=value.targetLanguage;renderQueue();renderCut();renderBatchResults();renderEditor();for(const m of state.moments)queueCaptionTarget(m);projectSession.changed()}
const splitOriginals=new Map();const editHistory=createHistory({apply:applyEditSnapshot,onChange:()=>{$('undoEdit').disabled=!editHistory.canUndo;$('redoEdit').disabled=!editHistory.canRedo;projectSession?.changed()}});
$('undoEdit').onclick=()=>editHistory.undo();$('redoEdit').onclick=()=>editHistory.redo();
let beforeEdit=null;const editable=event=>event.target.matches('.editor input,.editor textarea,.editor select,.cut-section input')&&!event.target.matches('#seekBar,#loopClip,#trimStartRange,#trimEndRange,#previewVolume,#previewSpeed');
for(const type of ['input','change']){document.addEventListener(type,event=>{if(editable(event))beforeEdit=editSnapshot()},true);document.addEventListener(type,event=>{if(editable(event)&&beforeEdit){const before=beforeEdit;beforeEdit=null;editHistory.record(before,editSnapshot(),event.target.id||event.target.getAttribute('aria-label'))}})}
$('splitClip').onclick=()=>{const m=state.moments.find(x=>x.id===state.selected);if(!m)return;const before=editSnapshot();try{const [first,second]=splitEdits(m,localTime(m,clipVideo.currentTime),crypto.randomUUID());Object.assign(m,first);second.splitCreated=true;splitOriginals.set(second.id,structuredClone(second));state.moments.push(second);if(state.cut.includes(m.id))state.cut.splice(state.cut.indexOf(m.id)+1,0,second.id);editHistory.record(before,editSnapshot(),'split');renderQueue();renderBatchResults();renderCut();renderEditor();$('historyStatus').textContent='Two editable trims created; source timing is preserved.'}catch(error){$('historyStatus').textContent=error.message}};
document.addEventListener('keydown',event=>{if(!(event.metaKey||event.ctrlKey)||event.key.toLowerCase()!=='z'||/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName||''))return;event.preventDefault();event.shiftKey?editHistory.redo():editHistory.undo()});

// JobProgress (design system): the running server job with its real percentage and steps, docked in the rail.
function renderJobDock(job){
  let box=$('jobDock');const dock=document.querySelector('.ds-rail-dock');if(!dock)return;
  if(!box){box=el('section','cd-job ds-job-dock');box.id='jobDock';box.setAttribute('role','status');box.setAttribute('aria-live','polite');dock.prepend(box)}
  box.hidden=!job;if(!job){box.replaceChildren();return}
  const total=Number(job.sectionsTotal)||0,done=Math.min(total,Number(job.sectionsDone)||0),pct=Math.round(total?done/total*100:(Number(job.duration)?Math.min(1,(Number(job.completedSeconds)||0)/job.duration)*100:0));
  const name={discovery:['Finding clips','Scan','Rank & save'],export:['Exporting','Render','Save'],subtitles:['Subtitles','Transcribe','Write SRT']}[job.kind]||['Working','Process','Finish'],queued=job.status==='queued',finishing=!queued&&total&&done>=total;
  const head=el('div','cd-job-head'),title=el('div');const t=el('p','cd-job-title');t.append(badge('signal','Live',true),document.createTextNode(` ${name[0]}`));title.append(t,el('p','cd-job-detail',`${job.clipTitle||job.sourceName||''}${job.phase?` · ${job.phase}`:''}`.replace(/^ · /,'')));
  const right=el('div','cd-row');right.append(el('span','cd-tc',clock((Date.now()-(job.createdAt||Date.now()))/1000)));head.append(title,right);
  const bar=el('div','cd-bar');bar.setAttribute('role','progressbar');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');bar.setAttribute('aria-valuenow',String(pct));const fill=el('span');fill.style.width=`${pct}%`;bar.append(fill);
  const steps=el('ol','cd-steps');for(const [label,state] of [['Queued',queued?'active':'done'],[total?`${name[1]} ${done}/${total}`:name[1],queued?'':finishing?'done':'active'],[name[2],finishing?'active':'']])steps.append(el('li',state,label));
  box.replaceChildren(head,el('span','cd-label ds-job-pct',`${pct}%`),bar,steps);
}
const jobsView=createJobsView({panel:$('jobRows'),counts:$('jobCounts'),status:$('jobsStatus'),onPlay:video=>claimPlayback(video),onOpen:async id=>{await projectSession.open(id);showWorkspace('clips')},onJobs:async jobs=>{
  const runningCount=jobs.filter(j=>['queued','running'].includes(j.status)).length;$('navJobCount').textContent=runningCount;$('navJobCount').hidden=!runningCount;renderJobDock(jobs.find(j=>['running','queued'].includes(j.status)));
  const active=jobs.filter(j=>j.kind==='discovery'&&j.projectId===projectSession?.current?.id),running=active.find(j=>['queued','running'].includes(j.status));
  state.batchRunning=Boolean(running);if(!running)finishActivity('batch');$('batchButton').textContent=running?'View processing job ':`Find ${$('clipTarget').value} clips across video `;
  if(!active.length||projectSession?.restoring)return;
  const p=await requestJson('/api/projects/'+projectSession.current.id);if(p.id!==projectSession.current?.id)return;
  const known=new Set(state.moments.map(m=>m.id)),fresh=p.state.moments.filter(m=>!known.has(m.id));if(fresh.length){for(const m of fresh)inheritCaptionTarget(m,projectCaptionTarget());state.moments.push(...fresh);for(const m of fresh)queueCaptionTarget(m);state.moments.sort((a,b)=>b.start-a.start);state.windowCount=state.moments.length;renderQueue();renderBatchResults();projectSession.changed()}
  const used=active.reduce((n,j)=>n+j.storyRequests,0);state.aiCalls=Math.max(state.aiCalls,used);updateBudgetUi();
  const last=active.at(-1);if(last)batchProgress(`${last.phase} · ${last.checksDone}/${last.checksTotal} story checks · ${last.suggested} supported moments. ${last.error||''}`);
}});
$('refreshJobs').onclick=()=>jobsView.refresh();
void jobsView.refresh();

let liveRefreshBusy=false;
async function refreshLiveMoments(){if(liveRefreshBusy||document.visibilityState==='hidden'||!projectSession?.current||projectSession.current.sourceId)return;const id=projectSession.current.id;liveRefreshBusy=true;try{const p=await requestJson('/api/projects/'+id);if(projectSession.current?.id!==id)return;let changed=false;for(const saved of p.state.moments||[]){const current=state.moments.find(m=>m.id===saved.id);if(!current){state.moments.push(saved);changed=true}else if(saved.liveAnalysisApplied&&saved.liveAnalysisApplied!==current.liveAnalysisApplied&&!current.analysisToken){for(const key of ['analysis','status','transcript','speechError','speechSource','detectedLanguage','timingSource','translationSource','sourceCaptionsVisible','error'])if(saved[key]!==undefined)current[key]=saved[key];const previousCues=structuredClone(current.captionCues||{});if(!current.captionCues?.Original?.length){const tracks={...saved.captionCues};for(const [language,cues]of Object.entries(current.captionCues||{}))if(cues?.length)tracks[language]=cues;current.captionCues=tracks;}if(!current.hook)current.hook=saved.hook;if(!current.alternateHook)current.alternateHook=saved.alternateHook;current.liveAnalysisApplied=saved.liveAnalysisApplied;for(const language of Object.keys(current.captionReviewed||{}))if(JSON.stringify(previousCues[language])!==JSON.stringify(current.captionCues[language]))current.captionReviewed[language]=false;queueCaptionTarget(current);changed=true}}if(changed){renderQueue();renderBatchResults();if(state.selected)renderEditor();projectSession.changed()}}catch{/* A disconnected poll cannot invalidate saved or in-progress edits. */}finally{liveRefreshBusy=false}}
setInterval(()=>void refreshLiveMoments(),3000);
async function restoreWorkspace(){setActivity('workspace','Opening your saved workspace','Restoring your projects, preferences and source media…');try{const prefs=await requestJson('/api/preferences');$('librarySort').value=prefs.sort||'updated';$('libraryDirection').value=prefs.direction||'desc';$('librarySearch').value=prefs.search||'';libraryView=prefs.view==='grid'?'grid':'list';layout.setLibraryView(libraryView);await projectSession.startup();await loadWholeJobs()}catch(error){message('Saved workspace could not be opened: '+error.message)}finally{startupNavigation=false;const target=requestedWorkspace;if(target==='edit'&&state.selected)await selectMoment(state.selected,{scroll:false});else showWorkspace(target==='edit'?'home':target);finishActivity('workspace');history.replaceState({workspace:document.body.dataset.workspace},'',workspaceHash(document.body.dataset.workspace))}}

void restoreWorkspace();
const connectionReady=status();updateButtons();updateBudgetUi();updateSpeechSummary();renderCut();setPreviewSize();drawPreview();
