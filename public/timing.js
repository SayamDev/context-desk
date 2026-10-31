// The same caption clock is used by preview, edited video and SRT export.
export function syncedCues(cues,offset=0,duration=Infinity){
  const shift=Number.isFinite(Number(offset))?Number(offset):0;
  return cues.map((cue,index)=>({...cue,index,start:Math.max(0,cue.start+shift),end:Math.min(duration,cue.end+shift)})).filter(cue=>cue.end>cue.start&&cue.start<duration);
}
export function shouldRestart(position,start,end){return !Number.isFinite(position)||position<start-.02||position>=end-.06}
export function speechCues(data,duration){
  const cues=[];
  if(data.words?.length){
    let group=[];const flush=()=>{if(!group.length)return;const start=Math.max(0,group[0].start),end=Math.min(duration,group.at(-1).end);if(end-start>=.1)cues.push({start,end,text:group.map(w=>w.text).join(' ').replace(/\s+([,.!?;:])/g,'$1'),words:group});group=[]};
    for(const word of data.words.filter(w=>w.text&&Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.end>w.start&&w.start<duration).sort((a,b)=>a.start-b.start)){if(group.length&&(word.start-group.at(-1).end>.45||group.length>=6))flush();group.push({...word});if(/[.!?؟]$/.test(word.text)&&group.length>=2)flush()}flush();
  }else for(const turn of data.turns||[]){
    const start=Math.max(0,Number(turn.startMs)/1000),end=Math.min(duration,Number(turn.endMs)/1000),words=String(turn.text||'').trim().split(/\s+/).filter(Boolean);
    if(!words.length||!Number.isFinite(start)||!Number.isFinite(end)||end-start<.1)continue;
    for(let i=0;i<words.length;i+=6)cues.push({start:start+(end-start)*i/words.length,end:start+(end-start)*Math.min(words.length,i+6)/words.length,text:words.slice(i,i+6).join(' ')});
  }
  let last=0;return cues.map(c=>{c.start=Math.max(c.start,last);last=c.end;return c}).filter(c=>c.end-c.start>=.1).map(c=>{const words=c.text.normalize('NFKC').replace(/[\p{P}\p{S}]/gu,' ').toLocaleLowerCase().split(/\s+/).filter(Boolean);return words.some((w,i)=>w.length>=3&&w===words[i-1])?{...c,uncertain:true,reviewReason:'Repeated word — listen against the source before approving.'}:c});
}
export function srtDocument(cues){
  const time=s=>{const ms=Math.max(0,Math.round(s*1000));return [Math.floor(ms/3600000),Math.floor(ms%3600000/60000),Math.floor(ms%60000/1000)].map(n=>String(n).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0')};
  return cues.map((c,i)=>`${i+1}\n${time(c.start)} --> ${time(c.end)}\n${c.text}\n`).join('\n');
}
