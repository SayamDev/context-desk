// V2 shell, adapted from the selected 12ui screen family. Existing controls are
// moved once, never cloned: their handlers and durable state remain canonical.
const iconPaths={play:'m9 5 11 7-11 7Z',pause:'M8 5v14M16 5v14',restart:'M4 10a8 8 0 1 1 1 8M4 4v6h6',export:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',back:'m14 6-6 6 6 6',up:'m6 15 6-6 6 6',down:'m6 9 6 6 6-6',close:'m6 6 12 12M18 6 6 18'};
export function icon(name){return '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+(iconPaths[name]||iconPaths.play)+'"/></svg>'}
export function setButtonLabel(id,label,name){const button=document.getElementById(id);button.innerHTML=icon(name);button.append(document.createTextNode(label));}
export function mountLayout({navigate,onFilter,onView,onTrim,onSource}){
  const $=id=>document.getElementById(id),one=s=>document.querySelector(s);
  const element=(tag,cls,html='')=>{const node=document.createElement(tag);node.className=cls;node.innerHTML=html;return node};
  const nav=one('.workspace-nav'),header=one('.topbar');
  one('.rail')?.remove();
  one('.wordmark').innerHTML='<svg class="brand-symbol" viewBox="0 0 40 44" aria-hidden="true"><path d="M6 15 31 3M6 28 34 14M10 40 34 28" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg><div>Context Desk<small>Every moment has context.</small></div>';
  const homeButton=element('button','','Home');homeButton.dataset.workspace='home';homeButton.type='button';nav.prepend(homeButton);
  const labels={home:'Home',library:'Projects',clips:'Discover',edit:'Studio',jobs:'Activity',source:'New video'};
  for(const value of ['home','library','clips','edit','jobs','source']){
    const button=nav.querySelector(`[data-workspace="${value}"]`),count=button.querySelector('b');
    button.replaceChildren(document.createTextNode(labels[value]));if(count)button.append(count);nav.append(button);
  }
  header.insertBefore(nav,one('.top-actions'));
  const trashNotice=element('aside','project-trash-notice','<p id="projectTrashMessage">This project is in Trash. Your media and edits are retained.</p><button id="restoreCurrentProject" type="button">Restore project</button>');trashNotice.id='projectTrashNotice';trashNotice.hidden=true;$('projectBar').after(trashNotice);
  const homeLink=element('a','brand-home');homeLink.href='#/home';homeLink.setAttribute('aria-label','Context Desk home');homeLink.append(...one('.wordmark').childNodes);one('.wordmark').append(homeLink);homeLink.onclick=event=>{event.preventDefault();navigate('home')};
  const settings=element('button','settings-trigger','Settings');settings.id='openSettings';settings.type='button';one('.top-actions').append(settings);
  one('.workspace-brand').remove();
  one('.library-heading h2').textContent='Your projects';
  one('.library-heading p').textContent='Pick up where you left off. Your media, moments and edits stay together.';
  const bundle=element('button','','Download selected ZIP');bundle.id='bundleSelected';bundle.type='button';bundle.disabled=true;one('#jobsPanel .library-heading').append(bundle);one('#jobsPanel .library-heading h2').textContent='Your work, in one place.';one('#jobsPanel .library-heading p').textContent='Follow processing and collect your finished videos. This page is here when you need it.';const jobDetails=element('details','job-overview-details','<summary>Queue overview</summary>');$('jobCounts').before(jobDetails);jobDetails.append($('jobCounts'));$('refreshJobs').textContent='Refresh';one('#jobsPanel .library-heading>div').hidden=true;
  $('newRecording').textContent='Add video';
  const modes=element('div','view-switch','<button type="button" id="libraryGrid" aria-pressed="false">Grid</button><button type="button" id="libraryList" aria-pressed="true">List</button>');one('.library-toolbar').append(modes);
  $('libraryGrid').onclick=()=>onView('grid');$('libraryList').onclick=()=>onView('list');
  const dialog=element('dialog','settings-dialog','<div class="dialog-heading"><div><h2 id="settingsTitle">Production settings</h2><p>Language, editorial direction and request limits.</p></div><button id="closeSettings" type="button">Close</button></div><div class="settings-body"></div>');
  dialog.id='settingsDialog';dialog.setAttribute('aria-labelledby','settingsTitle');document.body.append(dialog);
  for(const selector of ['.speech-details','.scan-settings']){
    const node=one(selector);if(node){node.open=false;dialog.querySelector('.settings-body').append(node)}
  }
  settings.onclick=()=>{dialog.querySelector('.settings-body').prepend(one('.language-quick'));dialog.showModal()};
  $('closeSettings').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{$('importPreferences').prepend(one('.language-quick'));settings.focus()});
  const preferences=element('details','import-preferences','<summary id="importPreferencesSummary">Language & clip preferences</summary>');preferences.id='importPreferences';
  for(const selector of ['.language-quick','.link-support','.auto-generate','.link-options','.link-rights']){const node=one(selector);if(node)preferences.append(node)}$('linkForm').append(preferences);
  $('linkForm').querySelector('label[for=streamUrl]').textContent='Paste a video link';$('openStream').replaceChildren(document.createTextNode('Find clips'));$('screenButton').type='button';$('screenButton').replaceChildren(document.createTextNode('Clip live'));
  for(const node of $('fileInput').closest('label').childNodes)if(node.nodeType===Node.TEXT_NODE)node.textContent='Upload video';
  // Quick language choices stay beside import; all advanced inputs live once in Settings.
  const setup=element('details','source-setup','<summary>Source & live controls</summary><div class="source-setup-content"></div>');setup.id='sourceSetup';setup.open=true;
  const setupBody=setup.querySelector('div');
  for(const selector of ['#linkForm','.source-controls','.capture-row']){const node=one(selector);if(node)setupBody.append(node)}
  const monitor=one('.monitor-panel');monitor.insertBefore(setup,$('monitor'));
  setupBody.append(one('.monitor-hint'));
  const map=$('momentMap');$('monitor').after(map);map.querySelector('p').textContent='Select a source window to inspect it. Filled sections were checked; empty space has not been reviewed.';
  const axis=element('div','map-axis');axis.id='mapAxis';$('momentMapTrack').before(axis);
  map.append($('scanCoverage'));
  map.insertAdjacentHTML('beforeend','<div class="map-legend"><span><i class="legend-supported"></i>Suggested</span><span><i class="legend-checked"></i>Checked</span><span><i></i>Not checked</span><span id="mapReadout">No windows yet</span></div>');
  const batch=$('batchPanel');monitor.append(batch);monitor.append(setup);
  one('.batch-head h2').textContent='Find the story';one('.batch-head p').textContent='Scan across your recording. Each suggestion stays linked to its source.';
  $('clipTarget').closest('label').firstChild.textContent='Moment target ';
  const queue=one('.queue-panel');queue.querySelector('.panel-heading>span').textContent='Story discovery';
  one('.queue-intro').replaceChildren();
  const filter=element('div','moment-filters','<label class="sr-only" for="momentSearch">Search retained moments</label><input id="momentSearch" type="search" placeholder="Search dialogue or evidence…"><label for="momentFilter">Show<select id="momentFilter"><option value="supported">Clip suggestions</option><option value="all">All saved windows</option><option value="attention">Needs attention</option></select></label><span id="momentResultCount" role="status"></span>');
  queue.insertBefore(filter,$('queue'));$('momentSearch').oninput=onFilter;$('momentFilter').onchange=onFilter;
  // Keep batch export actions, but one visible representation per moment.
  $('batchResults').classList.add('batch-summary');
  one('.editor-title h2').textContent='Studio';one('.editor-title').append($('historyStatus'));
  const preview=one('.clip-preview'),timeline=element('section','edit-timeline','<div class="timeline-heading"><h3>Trim the moment</h3><span id="trimDuration"></span></div><div class="timeline-track"><div id="timelineFrames" class="timeline-frames" aria-label="Sampled source frames"></div><div id="timelinePlayhead" class="timeline-playhead" aria-hidden="true"></div></div><div id="timelineRuler" class="timeline-ruler" aria-label="Source time ruler"></div><div class="timeline-selection" id="timelineSelection"></div><div class="trim-handles"><label>Start<input id="trimStartRange" type="range" min="0" max="1" step="0.1" value="0"></label><label>End<input id="trimEndRange" type="range" min="0" max="1" step="0.1" value="1"></label></div>');
  timeline.id='editTimeline';preview.querySelector('.trim-row').before(timeline);
  const playback=element('div','playback-options','<button id="mutePreview" type="button" aria-pressed="false">Mute</button><label for="previewVolume">Volume<input id="previewVolume" type="range" min="0" max="100" step="1" value="100"></label><label for="previewSpeed">Speed<select id="previewSpeed"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label><button id="previewFullscreen" type="button">Fullscreen</button><span id="previewBufferStatus" role="status"></span>');
  const playbackDetails=element('details','playback-details','<summary>Volume & playback settings</summary>');playbackDetails.id='playbackDetails';const widePlayback=matchMedia('(min-width:761px)');playbackDetails.open=widePlayback.matches;widePlayback.addEventListener('change',event=>{playbackDetails.open=event.matches});playbackDetails.append(playback,one('.shortcut-hint'));one('.transport').after(playbackDetails);
  for(const [id,edge] of [['trimStartRange','in'],['trimEndRange','out']])$(id).oninput=e=>onTrim(edge,Number(e.target.value));
  const viewSource=element('button','source-review','Watch original context');viewSource.id='watchOriginal';viewSource.type='button';viewSource.onclick=onSource;one('.editor-history').append(viewSource);
  one('.caption-workspace').open=true;
  // Match the prototype's viewer/timeline/caption hierarchy, retaining the original
  // editor ancestor so history and dirty-state listeners still cover these inputs.
  const caption=one('.caption-workspace'),story=one('.story-form');
  const tabs=element('div','inspector-tabs','<button id="captionTab" type="button" aria-pressed="true">Captions</button><button id="styleTab" type="button" aria-pressed="false">Style</button><button id="storyTab" type="button" aria-pressed="false">Story</button><button id="exportTab" type="button" aria-pressed="false">Export</button>');
  const storyPanel=element('div','story-panel');storyPanel.id='storyInspector';
  const exportPanel=element('div','studio-export');
  exportPanel.insertAdjacentHTML('afterbegin','<div class="social-export"><div><h3>Made for your next post.</h3><p>Choose a destination, export, then upload your finished file.</p></div><label for="socialDestination">Export for<select id="socialDestination"><option value="custom">Custom export</option><option value="tiktok">TikTok</option><option value="instagram">Instagram Reels</option><option value="facebook">Facebook Reels</option><option value="shorts">YouTube Shorts</option><option value="youtube">YouTube video</option></select></label><button id="applySocialPreset" type="button">Apply preset</button><p id="socialExportHint" role="status">Your current edit and export settings.</p></div>');
  for(const selector of ['.export-settings','.export-actions','#lastExport','#approveBatch','#addToCut','.export-hint']){const node=one(selector);if(node)exportPanel.append(node)}
  for(const child of [...story.children])if(child!==caption)storyPanel.append(child);storyPanel.prepend(viewSource);
  const stylePanel=element('section','style-panel','<h3>Make it your own.</h3><p>Caption styles and framing, with the same treatment in preview and export.</p><div id="captionTemplates" class="caption-templates"></div>');stylePanel.id='styleInspector';
  stylePanel.insertAdjacentHTML('beforeend','<section class="audio-controls"><h3>Let the words land.</h3><label><input id="audioEnhance" type="checkbox"> Enhance speech on export</label><p>Reduce steady noise and balance speech loudness. Preview the finished audio in Jobs.</p></section>');
  const framing=one('.frame-details');framing.open=true;stylePanel.append(framing);
  story.replaceChildren(tabs,caption,stylePanel,storyPanel,exportPanel);
  const panels={caption,style:stylePanel,story:storyPanel,export:exportPanel};
  function inspector(active){for(const [name,panel]of Object.entries(panels)){panel.hidden=name!==active;$(name+'Tab').setAttribute('aria-pressed',String(name===active))}}
  for(const name of Object.keys(panels))$(name+'Tab').onclick=()=>inspector(name);inspector('caption');
  const exportTrigger=element('button','studio-export-trigger',icon('export')+'Export');exportTrigger.id='studioExportTrigger';exportTrigger.type='button';exportTrigger.onclick=()=>{inspector('export');$('socialDestination').focus()};one('.editor-title').append(exportTrigger);
  const cover=element('button','','Download cover frame');cover.id='saveCoverFrame';cover.type='button';exportPanel.append(cover);
  const navigator=element('aside','studio-clips','<div class="studio-clips-heading"><h3>Clips</h3><span id="studioClipCount"></span></div><div id="studioClipList"></div>');navigator.setAttribute('aria-label','Switch clips');one('.editor-grid').prepend(navigator);
  const advanced=element('details','caption-advanced','<summary>Timing, dialect & advanced tools</summary>');
  const keep=new Set([caption.querySelector('summary'),one('.caption-options'),one('.caption-auto-hint'),one('.caption-line-heading'),$('captionLines'),$('captionStatus'),$('sourceCaptionWarning'),$('showCaptions').closest('label'),$('captionReviewed').closest('label')]);
  for(const child of [...caption.children])if(!keep.has(child))advanced.append(child);
  caption.append(advanced);const emptyActions=element('div','caption-empty-actions','<button id="emptyRecheckSpeech" type="button">Recheck speech</button><button id="emptyAddCaptions" type="button">Add timed captions</button>');emptyActions.id='captionEmptyActions';emptyActions.hidden=true;$('captionLines').after(emptyActions);$('emptyRecheckSpeech').onclick=()=>{advanced.open=true;$('reanalyseButton').click()};$('emptyAddCaptions').onclick=()=>{advanced.open=true;$('captionsInput').closest('details').open=true;$('captionsInput').focus();$('captionsInput').scrollIntoView({block:'center',behavior:'smooth'})};
  stylePanel.querySelector('#captionTemplates').after($('captionStyle').closest('label'));
  const languageScope=element('div','caption-scope','<p id="captionScopeStatus"></p><label><input id="captionOverride" type="checkbox"> Use a different language for this clip</label><span id="languageQueueStatus" role="status"></span>');
  one('.caption-options').before(languageScope);
  const modeLabel=$('captionTranslationMode').previousElementSibling;modeLabel.append($('captionTranslationMode'));
  one('.editor').after($('wholeSubtitles'));
  const originalEvidence=one('.evidence');originalEvidence.querySelector('summary').textContent='Source evidence & story shape';
  one('.more-exports summary').textContent='Other exports';
  $('backToClips').textContent='Discover';
  setButtonLabel('backToClips','Discover','back');setButtonLabel('playPause','Play','play');setButtonLabel('restartClip','Restart','restart');setButtonLabel('exportButton','Export clip','export');
  one('footer').innerHTML='<span>Context Desk · Open-source production studio</span><span>Local projects. Source-linked stories.</span>';
  // Newly mounted navigation uses the same owning workspace controller.
  nav.querySelectorAll('button').forEach(button=>button.onclick=()=>navigate(button.dataset.workspace));
  return {
    syncWorkspace(view){setup.open=view==='source';},
    inspector,
    setLibraryView(view){$('libraryRows').dataset.view=view;for(const [id,value] of [['libraryGrid','grid'],['libraryList','list']])$(id).setAttribute('aria-pressed',String(value===view));},
    syncPlayhead(moment,time){if(!moment)return;const duration=Math.max(.1,moment.end-moment.start);$('timelinePlayhead').style.left=Math.max(0,Math.min(100,time/duration*100))+'%';},
    syncTimeline(moment,format){
      if(!moment)return;const duration=Math.max(.1,moment.end-moment.start);const rulerKey=moment.id+'/'+moment.start+'/'+duration;if($('timelineRuler').dataset.key!==rulerKey){$('timelineRuler').dataset.key=rulerKey;$('timelineRuler').replaceChildren(...[0,.25,.5,.75,1].map(ratio=>{const label=document.createElement('span');label.textContent=format(moment.start+duration*ratio);return label}))}
      for(const [id,value] of [['trimStartRange',moment.trimIn],['trimEndRange',moment.trimOut]]){$(id).max=duration;$(id).value=value;$(id).setAttribute('aria-valuetext',format(value));}
      $('trimDuration').textContent=(moment.trimOut-moment.trimIn).toFixed(1)+'s selected';
      $('timelineSelection').style.marginLeft=moment.trimIn/duration*100+'%';$('timelineSelection').style.width=(moment.trimOut-moment.trimIn)/duration*100+'%';
      const signature=JSON.stringify([moment.id,moment.frames]);if($('timelineFrames').dataset.signature!==signature){$('timelineFrames').dataset.signature=signature;$('timelineFrames').replaceChildren();for(const source of moment.frames||[]){const img=document.createElement('img');img.src=source;img.alt='Sampled source frame';$('timelineFrames').append(img)}if(!moment.frames?.length)$('timelineFrames').textContent='Source frames unavailable';}
    }
  };
}
