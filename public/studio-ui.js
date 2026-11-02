// Read-only presentation helpers. Project/session modules remain the state owners.
// One state per clip, shared by badges, filter chips and counts (design-system statuses).
const attention=['error','interrupted','needs-key','budgeted','stalled'];
export function clipState(m){
  if(m.status==='analysing')return 'scanning';
  if(m.status==='error')return 'failed';
  if(m.exportedAt)return 'exported';
  if(attention.includes(m.status)||(m.showCaptions&&!m.captionReviewed?.[m.captionLanguage]&&m.captionLanguage&&m.captionLanguage!=='Original'))return 'review';
  if(m.status==='suggested'||m.approved||m.manual)return 'ready';
  return 'other';
}
export function visibleMoments(moments,{query='',filter='all',direction='asc',sort='time'}={}){
  const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return moments.filter(m=>{
    if((filter==='dismissed')!==Boolean(m.dismissed))return false;
    if(['ready','review','exported'].includes(filter)&&clipState(m)!==filter)return false;
    if(filter==='supported'&&m.status!=='suggested'&&!m.approved&&!m.manual)return false;
    if(filter==='attention'&&!['error','interrupted','needs-key','budgeted','stalled'].includes(m.status))return false;
    const text=[m.hook,m.transcript,m.analysis?.evidence,m.analysis?.reason,m.analysis?.beatType].filter(Boolean).join(' ').toLocaleLowerCase();
    return words.every(word=>text.includes(word));
  }).sort((a,b)=>sort==='score'&&(Number.isFinite(a.analysis?.rankingScore)||Number.isFinite(b.analysis?.rankingScore))?(b.analysis?.rankingScore??-1)-(a.analysis?.rankingScore??-1)||a.start-b.start:(a.start-b.start)*(direction==='desc'?-1:1));
}

export function coverageSummary(moments,duration){
  if(!Number.isFinite(duration)||duration<=0)return {checked:0,percent:0,intervals:[]};
  const intervals=[];
  for(const m of moments.filter(m=>m.analysis).sort((a,b)=>a.start-b.start)){
    const start=Math.max(0,Math.min(duration,Number(m.start)||0)),end=Math.max(start,Math.min(duration,Number(m.end)||0));
    if(end<=start)continue;
    const last=intervals.at(-1);
    if(last&&start<=last[1])last[1]=Math.max(last[1],end);else intervals.push([start,end]);
  }
  const checked=intervals.reduce((sum,[start,end])=>sum+end-start,0);
  return {checked,percent:Math.round(checked/duration*100),intervals};
}

export function sourcePosition(moment,duration){
  if(!moment?.blob?.importId||!Number.isFinite(duration)||duration<=0)return null;
  return Math.max(0,Math.min(duration,Number(moment.start)||0));
}

export function clampTrim(edge,value,start,end,duration){
  const max=Math.max(.2,Number(duration)||.2),out=Math.min(max,Math.max(.2,Number(end)||max)),inside=Math.max(0,Math.min(out-.2,Number(start)||0));
  return edge==='in'?{in:Math.round(Math.max(0,Math.min(out-.2,Number(value)||0))*10)/10,out}:{in:inside,out:Math.round(Math.max(inside+.2,Math.min(max,Number(value)||0))*10)/10};
}

// Greedy interval lanes make repeated passes at the same time independently
// inspectable. Sorting a copy keeps the editor's selected/list order untouched.
export function momentLanes(moments){
  const ends=[],windows=[];
  for(const moment of [...moments].sort((a,b)=>a.start-b.start||a.end-b.end||String(a.id).localeCompare(String(b.id)))){
    let lane=ends.findIndex(end=>end<=moment.start);if(lane<0)lane=ends.length;
    ends[lane]=moment.end;windows.push({moment,lane});
  }
  return {windows,lanes:Math.max(1,ends.length)};
}
