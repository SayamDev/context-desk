// Caption timestamps remain in the original window clock. Edits change only
// source trims, so preview, rendered media and every retained track share a clock.
const MIN_PIECE=.2,MAX_CONTEXT=2,MAX_SELECTIONS=10000;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function mergeRanges(ranges){
  const merged=[];
  for(const range of [...ranges].sort((a,b)=>a.start-b.start||a.end-b.end)){
    const previous=merged.at(-1);
    if(previous&&range.start<=previous.end)previous.end=Math.max(previous.end,range.end);
    else merged.push({start:range.start,end:range.end});
  }
  return merged;
}
function complement(ranges,start,end){
  const remaining=[];let position=start;
  for(const range of ranges){if(range.start>position)remaining.push({start:position,end:range.start});position=Math.max(position,range.end)}
  if(position<end)remaining.push({start:position,end});return remaining;
}
function selectionItems(selection){
  if(Array.isArray(selection))return selection;
  if(!plain(selection)||Object.keys(selection).some(key=>!['indices','ranges'].includes(key))||!Array.isArray(selection.indices||[])||!Array.isArray(selection.ranges||[]))throw Error('Select timed transcript line indices or ranges.');
  return [...(selection.indices||[]),...(selection.ranges||[])];
}
export function editByTranscript(moment,selection,options={}){
  if(!plain(options)||Object.keys(options).some(key=>!['action','language','contextSeconds','createId','existingIds'].includes(key)))throw Error('Unsupported transcript edit option.');
  const {action,createId}=options;
  if(!['keep-selected','remove-selected'].includes(action))throw Error('Choose keep-selected or remove-selected as the transcript edit action.');
  if(typeof createId!=='function')throw Error('Supply a function that creates a new UUID for each edit segment.');
  const contextSeconds=options.contextSeconds??.12;
  if(!finite(contextSeconds)||contextSeconds<0||contextSeconds>MAX_CONTEXT)throw Error('Transcript context handles must be between 0 and 2 seconds.');
  if(!plain(moment)||typeof moment.id!=='string'||!moment.id||moment.id.length>100||!finite(moment.start)||!finite(moment.end)||moment.start<0||moment.end<=moment.start)throw Error('Choose a saved clip with valid source times and ID.');
  const windowDuration=moment.end-moment.start,trimIn=moment.trimIn??0,trimOut=moment.trimOut??windowDuration;
  if(!finite(trimIn)||!finite(trimOut)||trimIn<0||trimOut>windowDuration||trimOut-trimIn<MIN_PIECE)throw Error('The saved clip trim must be at least 0.2s and stay inside its source window.');
  const mediaOrigin=moment.mediaStart??0,offset=moment.captionOffset??0;
  if(!finite(mediaOrigin)||mediaOrigin<0)throw Error('The saved clip media clock is invalid.');
  if(!finite(offset))throw Error('The saved caption offset is invalid.');
  const language=options.language??moment.captionLanguage??'Original';
  if(typeof language!=='string'||language.length>50||!plain(moment.captionCues)||!Object.hasOwn(moment.captionCues,language)||!Array.isArray(moment.captionCues[language]))throw Error('Choose an available transcript caption track.');
  const cues=moment.captionCues[language];
  if(cues.length>10000)throw Error('The selected transcript track exceeds the edit line limit.');
  const validCues=cues.map((cue,index)=>plain(cue)&&finite(cue.start)&&finite(cue.end)&&cue.end>cue.start&&typeof cue.text==='string'&&cue.text.trim()?{index,start:Math.max(0,cue.start+offset),end:Math.min(windowDuration,cue.end+offset)}:null);
  const items=selectionItems(selection);if(!items.length)throw Error('Select one or more timed transcript lines.');
  if(items.length>MAX_SELECTIONS)throw Error('Too many transcript edit selections.');
  const selected=[],indices=new Set();let invalidLines=0;
  const addTimed=(start,end)=>{
    const clipped={start:Math.max(trimIn,start),end:Math.min(trimOut,end)};
    if(clipped.end>clipped.start&&validCues.some(cue=>cue&&cue.end>clipped.start&&cue.start<clipped.end))selected.push(clipped);else invalidLines++;
  };
  const addIndex=index=>{
    if(!Number.isInteger(index)||index<0||index>=cues.length)throw Error('A selected transcript line index is outside this track.');
    const cue=validCues[index];if(cue&&cue.end>cue.start)addTimed(cue.start,cue.end);else invalidLines++;
  };
  for(const item of items){
    if(typeof item==='number'){if(!Number.isInteger(item)||item<0||item>=cues.length)throw Error('A selected transcript line index is outside this track.');indices.add(item);continue}
    if(!plain(item))throw Error('Transcript selections must be line indices or timed ranges.');
    const keys=Object.keys(item);
    if(keys.length===2&&keys.includes('from')&&keys.includes('to')){
      if(!Number.isInteger(item.from)||!Number.isInteger(item.to)||item.from<0||item.to<item.from||item.to>=cues.length)throw Error('The transcript line index range is invalid.');
      for(let index=item.from;index<=item.to;index++)indices.add(index);
    }else if(keys.length===2&&keys.includes('start')&&keys.includes('end')){
      if(!finite(item.start)||!finite(item.end)||item.end<=item.start)throw Error('The transcript timing range is invalid.');
      addTimed(item.start,item.end);
    }else throw Error('The transcript selection range has unsupported fields.');
  }
  for(const index of indices)addIndex(index);
  const selectedRanges=mergeRanges(selected);
  if(!selectedRanges.length)throw Error('No valid timed transcript lines fall inside the current trim.');
  const kept=action==='keep-selected'?mergeRanges(selectedRanges.map(range=>({start:Math.max(trimIn,range.start-contextSeconds),end:Math.min(trimOut,range.end+contextSeconds)}))):complement(selectedRanges,trimIn,trimOut);
  const playable=kept.filter(range=>range.end-range.start>=MIN_PIECE),dropped=kept.filter(range=>range.end-range.start<MIN_PIECE);
  if(!playable.length)throw Error(action==='remove-selected'?'This removes the whole clip or leaves no playable 0.2s segment.':'The selected lines leave no playable 0.2s segment. Increase the context handle or select more speech.');
  const existing=options.existingIds??[];
  if(!(Array.isArray(existing)||existing instanceof Set)||existing.size>5000||existing.length>5000||[...existing].some(id=>typeof id!=='string'))throw Error('Existing segment IDs must be a bounded list or Set.');
  const used=new Set([moment.id,...existing].map(id=>id.toLowerCase())),ids=playable.map(()=>{
    const id=createId();if(typeof id!=='string'||!uuid.test(id))throw Error('Every transcript segment needs a valid new UUID.');
    const canonical=id.toLowerCase();if(used.has(canonical))throw Error('Transcript segment IDs must be unique; a duplicate ID was supplied.');used.add(canonical);return canonical;
  });
  const clockRange=range=>({...range,sourceStart:moment.start+range.start,sourceEnd:moment.start+range.end,mediaStart:mediaOrigin+range.start,mediaEnd:mediaOrigin+range.end});
  const timingSource=moment.timingSource||'estimated',notes=[`Transcript edit timings are draft ${timingSource} timings. Listen to the source and review each new cut boundary.`, 'Complete original ASR, translated tracks, wording, uncertainty flags and review records remain available independently in every segment.'];
  if(action==='keep-selected'&&contextSeconds)notes.push(`Selected speech includes up to ${contextSeconds}s of source context on each side, within the current trim.`);
  if(action==='remove-selected')notes.push('Removed the exact selected timing ranges. Context padding does not restore removed speech.');
  if(invalidLines)notes.push(`${invalidLines} selected line or range entries had no usable timing inside the current trim and were skipped.`);
  if(dropped.length)notes.push(`${dropped.length} remaining piece${dropped.length===1?' was':'s were'} shorter than 0.2s and omitted.`);
  const ranges=playable.map(clockRange),removedRanges=complement(playable,trimIn,trimOut).map(clockRange);
  const segments=playable.map((range,index)=>({...structuredClone(moment),id:ids[index],trimIn:range.start,trimOut:range.end,approved:false,transcriptEdit:{originalMomentId:moment.id,action,language,timingStatus:'draft',timingSource,contextSeconds:action==='keep-selected'?contextSeconds:0,sourceRange:clockRange(range),selectedRanges:structuredClone(selectedRanges),reviewRequired:true}}));
  return {segments,ranges,selectedRanges:structuredClone(selectedRanges),removedRanges,duration:playable.reduce((sum,range)=>sum+range.end-range.start,0),notes,timingSource,reviewRequired:true};
}
