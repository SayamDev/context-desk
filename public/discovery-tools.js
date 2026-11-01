import {editByTranscript} from './transcript-edits.js';
import {syncedCues} from './timing.js';

const PAGE_SIZE=80;
const time=value=>{const seconds=Math.max(0,Number(value)||0);return `${Math.floor(seconds/60)}:${(seconds%60).toFixed(1).padStart(4,'0')}`};
const post=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
export function createDiscoveryTools({requestJson,getProject,getSelected=()=>null,getMoments=()=>[],onSelect=()=>{},onMessage=()=>{},onChanged=()=>{},onTranscriptEdit}={}){
  if(typeof requestJson!=='function'||typeof getProject!=='function')throw Error('Discovery tools need a request helper and current saved project.');
  const doc=globalThis.document,$=id=>doc.getElementById(id);
  if(!$('batchPanel')||!$('momentSearch')||!$('captionLines'))throw Error('Mount the discovery tools after the workspace layout and caption inspector.');
  if($('discoveryStrategy'))throw Error('Discovery tools are already mounted.');
  const node=(tag,text='',attributes={})=>{const element=doc.createElement(tag);if(text)element.textContent=text;for(const [key,value] of Object.entries(attributes)){if(key==='class')element.className=value;else element.setAttribute(key,value)}return element};
  const button=(text,id)=>{const element=node('button',text,{id,type:'button'});element.type='button';return element};
  const status=id=>node('p','',{id,role:'status','aria-live':'polite'});
  const label=(text,input)=>{const element=node('label',text,{'for':input.id});element.append(input);return element};
  const number=(id,value,min,max,step=1)=>{const input=node('input','',{id,type:'number',min,max,step});input.type='number';input.value=String(value);return input};
  const option=(value,text)=>{const item=node('option',text,{value});item.value=value;return item};
  let destroyed=false,projectId='',previewFlight=null,previewEpoch=0,searchFlight=null,searchEpoch=0,lastFailure=null,transcriptSignature='',selection=new Set(),eligible=[],page=0,editFlight=false;
  const externalListeners=[];
  const listen=(element,event,callback)=>{element?.addEventListener(event,callback);externalListeners.push([element,event,callback])};
  const selectedMoment=()=>{const selected=getSelected();return typeof selected==='string'?getMoments().find(moment=>moment.id===selected):selected};

  const discovery=node('section','',{id:'discoveryToolOptions',class:'discovery-tool-options','aria-label':'Discovery strategy and request preview'});
  const strategy=node('select','',{id:'discoveryStrategy','aria-describedby':'discoveryModeHelp'});
  strategy.append(option('sampled','Sampled discovery · bounded shortlist'),option('transcript','Deep discovery · full source transcript'));strategy.value='sampled';
  const minimum=number('discoveryClipMin',15,10,45),maximum=number('discoveryClipMax',90,30,120),modeHelp=node('p','',{id:'discoveryModeHelp',class:'depth-help'});
  const lengths=node('div','',{class:'brand-fields'});lengths.append(label('Minimum clip seconds',minimum),label('Maximum clip seconds',maximum));
  const previewButton=button('Preview request limits · no AI call','discoveryPreviewButton'),previewStatus=status('discoveryPreviewStatus');
  discovery.append(label('How to find stories',strategy),modeHelp,lengths,previewButton,previewStatus);$('batchPanel').insertBefore(discovery,$('batchPanel').children[1]||null);
  function discoveryOptions(){
    const clipMinSeconds=Number(minimum.value),clipMaxSeconds=Number(maximum.value);
    if(!minimum.value||!maximum.value||!Number.isFinite(clipMinSeconds)||clipMinSeconds<10||clipMinSeconds>45||!Number.isFinite(clipMaxSeconds)||clipMaxSeconds<30||clipMaxSeconds>120||clipMaxSeconds<clipMinSeconds)throw Error('Choose a minimum from 10–45 seconds and a maximum from 30–120 seconds, with maximum at least minimum.');
    return {strategy:strategy.value==='transcript'?'transcript':'sampled',clipMinSeconds,clipMaxSeconds};
  }
  function modeDescription(){const deep=strategy.value==='transcript';modeHelp.textContent=deep?'Transcribe every source-audio section before ranking complete stories. Speech and ranking requests are additional to your visual story-check limit. Preview the bounds before starting.':'Sample pictures across the source and transcribe a bounded shortlist. Unchecked speech can contain stories this mode misses.';lengths.hidden=!deep}
  function optionsChanged(){previewEpoch++;previewStatus.textContent='Options changed. Preview the request limits before starting.';modeDescription()}
  strategy.onchange=optionsChanged;minimum.onchange=optionsChanged;maximum.onchange=optionsChanged;
  for(const id of ['aiBudget','clipTarget','scanDepth'])listen($(id),'change',()=>{previewEpoch++;previewStatus.textContent='Limits changed. Preview again for the current settings.'});
  async function preview(){
    if(destroyed||previewFlight)return;
    const project=getProject(),sourceId=project?.sourceId||project?.state?.sourceId;
    if(!project?.id||!sourceId){previewStatus.textContent='Open a saved recording before previewing discovery requests.';return}
    let options;try{options=discoveryOptions()}catch(error){previewStatus.textContent=error.message;return}
    const limit=Number($('aiBudget')?.value)||0,used=Math.max(0,Number(project.state?.aiCalls)||0),remaining=limit?Math.max(0,limit-used):100,budget=Math.min(100,remaining,(Number($('clipTarget')?.value)||5)*3);
    if(budget<1){previewStatus.textContent='Your story-check limit is reached. Raise the limit or review existing clips.';return}
    const flight={projectId:project.id,sourceId,epoch:++previewEpoch};previewFlight=flight;previewButton.disabled=true;previewStatus.textContent='Calculating saved-source request bounds…';discovery.setAttribute('aria-busy','true');
    try{
      const result=await requestJson('/api/discovery-preview',post({sourceId,projectId:project.id,...options,strategy:options.strategy==='transcript'?'transcript':'fast',budget,depth:Number($('scanDepth')?.value)||80}));
      if(destroyed||previewFlight!==flight||flight.epoch!==previewEpoch||getProject()?.id!==flight.projectId)return;
      const count=key=>Math.max(0,Number(result[key])||0),coverage=Number.isFinite(result.scanSeconds)?`${time(result.scanSeconds)} of source audio`:options.strategy==='transcript'?'the selected source audio':'the sampled shortlist';
      previewStatus.textContent=`Up to ${count('speechRequestsMax')} speech + ${count('rankingRequestsMax')} ranking + ${count('storyRequestsMax')} visual story requests, covering ${coverage}. ${result.fullSource?'Full source audio is included. ':''}Translation depends on retained dialogue. Cached work may reduce usage. This preview makes no AI call; provider prices are not estimated.`;
    }catch(error){if(!destroyed&&flight.epoch===previewEpoch&&getProject()?.id===flight.projectId)previewStatus.textContent=error.message||'Could not preview discovery limits.'}
    finally{if(previewFlight===flight){previewFlight=null;previewButton.disabled=!getProject()?.sourceId;discovery.setAttribute('aria-busy','false')}}
  }
  previewButton.onclick=preview;modeDescription();

  const searchPanel=node('details','',{id:'semanticMomentSearch',class:'semantic-moment-search','aria-label':'Search retained source meaning'}),searchForm=node('form','',{id:'semanticMomentForm'});
  const query=node('input','',{id:'semanticMomentQuery',type:'search',maxlength:300,placeholder:'e.g. a change of mind, funniest reaction','aria-describedby':'semanticMomentHelp'});query.type='search';query.maxLength=300;
  const searchButton=node('button','Search moments',{id:'semanticMomentSubmit',type:'submit'});searchButton.type='submit';
  const retryButton=button('Retry search · another request','semanticMomentRetry');retryButton.hidden=true;
  const searchHelp=node('p','Search saved transcripts and source evidence by meaning. One explicit search request; changing this text makes no request.',{id:'semanticMomentHelp',class:'depth-help'}),searchStatus=status('semanticMomentStatus'),coverage=node('p','',{id:'semanticMomentCoverage',class:'depth-help'}),results=node('ol','',{id:'semanticMomentResults'});
  searchForm.append(label('Ask your saved moments',query),searchButton,retryButton);searchPanel.append(node('summary','Find a moment by description'),searchForm,searchHelp,searchStatus,coverage,results);($('momentSearch').closest('.moment-filters')||$('momentSearch')).after(searchPanel);
  const updateSearchButtons=()=>{const available=Boolean(getProject()?.id),busy=Boolean(searchFlight);searchButton.disabled=!available||busy;retryButton.disabled=!available||busy;searchForm.setAttribute('aria-busy',String(busy))};
  function clearResults(){results.replaceChildren();coverage.textContent=''}
  query.oninput=()=>{searchEpoch++;lastFailure=null;retryButton.hidden=true;clearResults();searchStatus.textContent=searchFlight?'The current request may still finish. Choose Search again for the changed query.':'Choose Search moments to search this saved project.'};
  function renderSearch(result,requestProject){
    clearResults();const scope=result.coverage||{},candidate=Math.max(0,Number(scope.candidateMoments)||0),retained=Math.max(0,Number(scope.retainedMoments)||0);
    coverage.textContent=`Searched saved text for ${candidate} of ${retained} retained moments. ${scope.omittedMoments?`${Number(scope.omittedMoments)} evidence-bearing moments were outside this shortlist. `:''}${scope.truncatedMoments?`${Number(scope.truncatedMoments)} source excerpts were shortened. `:''}No new footage was inspected. Untimed quotes can fall outside the current edit trim.`;
    const currentMoments=new Map(getMoments().map(moment=>[moment.id,moment]));let shown=0;
    for(const match of (Array.isArray(result.matches)?result.matches:[]).slice(0,20)){
      const moment=currentMoments.get(match.momentId);if(!moment||!Array.isArray(match.evidence)||!match.evidence.length)continue;
      const row=node('li','',{class:'semantic-moment-result'}),open=button(`${time(match.source?.start??moment.start)} · Open source moment`,'semanticResult-'+shown++);
      open.onclick=async()=>{if(getProject()?.id!==requestProject||!getMoments().some(item=>item.id===match.momentId)){searchStatus.textContent='This search belongs to an earlier saved source. Search the current project again.';return}try{await onSelect(match.momentId)}catch(error){searchStatus.textContent=error.message||'Could not open this moment.'}};
      row.append(open,node('p',String(match.reason||'Saved source match.')));
      for(const evidence of match.evidence.slice(0,6)){if(typeof evidence.quote!=='string'||typeof evidence.field!=='string')continue;const quote=node('blockquote',evidence.quote,{dir:'auto'});quote.append(node('cite',evidence.field.startsWith('captionCues.')?'Caption track · '+evidence.field.slice(12):'Source field · '+evidence.field));row.append(quote)}
      if(typeof moment.url==='string'&&/^\/api\/(?:import\/[a-f0-9-]{36}\/media|assets\/[a-f0-9]{64})$/.test(moment.url)&&match.source?.url===moment.url){const link=node('a','Open saved source media',{href:moment.url+'#t='+Math.max(0,Number(match.source.mediaStart)||0),target:'_blank',rel:'noopener noreferrer'});row.append(link)}
      results.append(row);
    }
    searchStatus.textContent=shown?`${shown} source-supported search match${shown===1?'':'es'}. ${result.cacheHit?'Reused the saved search result.':'Review the cited wording against the source.'}`:'No source-supported matches in the provided saved excerpts. Try a more specific phrase or review another source range.';
  }
  async function runSearch(retry=false){
    if(destroyed||searchFlight)return;
    const current=getProject(),text=query.value.trim();if(!current?.id){searchStatus.textContent='Open a saved project before searching moments.';return}if(!text){searchStatus.textContent='Enter a phrase to search your retained moments.';query.focus();return}
    if(retry&&(!lastFailure||lastFailure.projectId!==current.id||lastFailure.query!==text)){searchStatus.textContent='Choose Search moments for this new query.';return}
    const flight={projectId:current.id,query:text,epoch:++searchEpoch};searchFlight=flight;retryButton.hidden=true;clearResults();searchStatus.textContent=retry?'Retrying the saved-source search with a new provider request…':'Searching retained source text…';updateSearchButtons();
    try{
      const result=await requestJson('/api/moment-search',post({projectId:current.id,query:text,retry:retry===true}));
      if(destroyed||searchFlight!==flight||flight.epoch!==searchEpoch||getProject()?.id!==flight.projectId||query.value.trim()!==flight.query)return;
      lastFailure=null;renderSearch(result,flight.projectId);
    }catch(error){if(!destroyed&&flight.epoch===searchEpoch&&getProject()?.id===flight.projectId&&query.value.trim()===flight.query){lastFailure={projectId:flight.projectId,query:flight.query};searchStatus.textContent=error.message||'Search stopped. Retry explicitly to send another request.';retryButton.hidden=false}}
    finally{if(searchFlight===flight){searchFlight=null;updateSearchButtons()}}
  }
  searchForm.onsubmit=event=>{event.preventDefault();return runSearch(false)};retryButton.onclick=()=>runSearch(true);

  const transcript=node('details','',{id:'transcriptEditTools',class:'transcript-edit-tools memory-panel'}),selectionHelp=node('p','Select lines from the displayed track, then keep or remove their video. Cut timings are draft: listen at every new boundary.',{id:'transcriptEditHelp'});
  const transcriptStatus=status('transcriptSelectionStatus'),transcriptList=node('div','',{id:'transcriptSelectionLines',role:'group','aria-label':'Choose transcript lines to cut'}),context=number('transcriptEditContext',.12,0,2,.01);
  const selectedStatus=status('transcriptSelectedCount'),selectPage=button('Select shown lines','transcriptSelectPage'),clearSelection=button('Clear selection','transcriptClearSelection'),keep=button('Keep selected speech','transcriptKeepSelected'),remove=button('Remove selected speech','transcriptRemoveSelected'),previousPage=button('Previous lines','transcriptPreviousPage'),nextPage=button('Next lines','transcriptNextPage'),pageStatus=node('span','',{id:'transcriptPageStatus'});
  const actions=node('div','',{class:'memory-actions'}),pagination=node('div','',{class:'memory-actions'});actions.append(keep,remove);pagination.append(previousPage,pageStatus,nextPage);
  transcript.append(node('summary','Cut video using transcript lines'),selectionHelp,label('Keep extra context on each side · seconds',context),selectedStatus,selectPage,clearSelection,transcriptList,pagination,actions,transcriptStatus);$('captionLines').after(transcript);
  function updateSelection(){const count=selection.size;selectedStatus.textContent=`${count} line${count===1?'':'s'} selected`;keep.disabled=remove.disabled=!count||editFlight||typeof onTranscriptEdit!=='function';clearSelection.disabled=!count||editFlight;selectPage.disabled=!eligible.length||editFlight;previousPage.disabled=!page||editFlight;nextPage.disabled=(page+1)*PAGE_SIZE>=eligible.length||editFlight}
  function renderTranscriptPage(){
    transcriptList.replaceChildren();const from=page*PAGE_SIZE,visible=eligible.slice(from,from+PAGE_SIZE);
    for(const line of visible){const checkbox=node('input','',{id:'transcriptCue-'+line.index,type:'checkbox','data-cue-index':line.index});checkbox.type='checkbox';checkbox.checked=selection.has(line.index);checkbox.disabled=editFlight;checkbox.onchange=()=>{if(checkbox.checked)selection.add(line.index);else selection.delete(line.index);updateSelection()};const row=label(`${line.index+1}. ${time(line.start)}–${time(line.end)} · ${line.text}${line.uncertain?' · uncertainty flagged':''}`,checkbox);row.className='transcript-choice';transcriptList.append(row)}
    pageStatus.textContent=eligible.length?`Lines ${from+1}–${Math.min(from+PAGE_SIZE,eligible.length)} of ${eligible.length} inside this trim`:'No available lines';updateSelection();
  }
  selectPage.onclick=()=>{for(const line of eligible.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE))selection.add(line.index);renderTranscriptPage()};clearSelection.onclick=()=>{selection.clear();renderTranscriptPage()};previousPage.onclick=()=>{if(page){page--;renderTranscriptPage()}};nextPage.onclick=()=>{if((page+1)*PAGE_SIZE<eligible.length){page++;renderTranscriptPage()}};
  async function applyTranscript(action){
    if(editFlight||!selection.size||typeof onTranscriptEdit!=='function')return;
    const moment=selectedMoment(),currentProject=getProject();if(!moment||!currentProject?.id)return;
    const currentSignature=signatureFor(moment);if(currentSignature!==transcriptSignature){sync();transcriptStatus.textContent='The transcript changed. Select its current lines before cutting.';return}
    editFlight=true;updateSelection();transcript.setAttribute('aria-busy','true');
    try{
      if(typeof globalThis.crypto?.randomUUID!=='function')throw Error('Secure UUID generation is unavailable in this browser.');
      const result=editByTranscript(moment,[...selection],{action,language:moment.captionLanguage||'Original',contextSeconds:Number(context.value),createId:()=>globalThis.crypto.randomUUID(),existingIds:getMoments().map(item=>item.id)});
      if(getProject()?.id!==currentProject.id||selectedMoment()?.id!==moment.id)throw Error('The selected project or clip changed before this edit.');
      await onTranscriptEdit(result,moment);await onChanged();selection.clear();renderTranscriptPage();transcriptStatus.textContent=`Created ${result.segments.length} ordered edit segment${result.segments.length===1?'':'s'} · ${time(result.duration)}. Review their draft cut boundaries.`;onMessage(transcriptStatus.textContent);
    }catch(error){transcriptStatus.textContent=error.message||'Transcript edit could not be applied.';onMessage(transcriptStatus.textContent)}
    finally{editFlight=false;transcript.setAttribute('aria-busy','false');renderTranscriptPage()}
  }
  keep.onclick=()=>applyTranscript('keep-selected');remove.onclick=()=>applyTranscript('remove-selected');
  function signatureFor(moment){return JSON.stringify([getProject()?.id,moment?.id,moment?.captionLanguage,moment?.captionOffset,moment?.trimIn,moment?.trimOut,moment?.start,moment?.end,moment?.captionCues?.[moment?.captionLanguage||'Original']])}
  function sync(){
    if(destroyed)return;const current=getProject(),id=current?.id||'';
    if(id!==projectId){projectId=id;searchEpoch++;previewEpoch++;searchFlight=null;lastFailure=null;retryButton.hidden=true;clearResults();searchStatus.textContent=id?'Search the current saved project by meaning.':'Open a saved project to search moments.';previewStatus.textContent='Preview the request limits before starting.'}
    previewButton.disabled=Boolean(previewFlight)||!current?.sourceId;updateSearchButtons();
    const moment=selectedMoment(),signature=signatureFor(moment);if(signature===transcriptSignature)return;
    const hadSelection=selection.size>0;transcriptSignature=signature;selection.clear();page=0;
    const language=moment?.captionLanguage||'Original',cues=moment?.captionCues?.[language],duration=moment?moment.end-moment.start:0;
    eligible=Array.isArray(cues)?syncedCues(cues,moment.captionOffset||0,duration).filter(cue=>Number.isFinite(cue.start)&&Number.isFinite(cue.end)&&typeof cue.text==='string'&&cue.text.trim()&&cue.end>moment.trimIn&&cue.start<moment.trimOut).map(cue=>({...cue,start:Math.max(moment.trimIn,cue.start),end:Math.min(moment.trimOut,cue.end)})):[];
    transcriptStatus.textContent=!moment?'Select a saved clip to edit its video by transcript.':!eligible.length?'No timed transcript lines are available in the displayed track inside this trim.':hadSelection?'Transcript or track changed. Select the current lines again.':`${language} track · ${moment.timingSource==='word'?'saved word timings':'estimated line timings'}. New cut boundaries require source review.`;
    renderTranscriptPage();
  }
  listen($('captionLanguage'),'change',()=>queueMicrotask(sync));listen($('captionLines'),'input',()=>queueMicrotask(sync));
  const observer=typeof MutationObserver==='function'?new MutationObserver(sync):null;observer?.observe($('captionLines'),{childList:true,subtree:true,characterData:true});
  sync();
  return {discoveryOptions,sync,preview,search:runSearch,destroy(){destroyed=true;searchEpoch++;previewEpoch++;observer?.disconnect();for(const [element,event,callback] of externalListeners)element?.removeEventListener(event,callback);discovery.remove();searchPanel.remove();transcript.remove()}};
}
