// What viewers see, from the editable subtitle track. Shared by the preview, the burned-in
// export and SRT files, so all three follow the same rules:
// - Speaker IDs (A, B…) are editing data and are never shown.
// - A line shows a speaker or off-screen cue only when an editor wrote one (cueLabel).
// - When two different speakers overlap, both lines show together, one per row, each with a dash.
// - kind 'sound' ([laughter], [music]) appears only in accessible captions.
// - kind 'background' (speech that may not matter) is left out of clean dialogue and shown as
//   "(in background) …" in accessible captions; an editor can turn it back into dialogue.
export const captionModes={clean:'Clean dialogue',accessible:'Accessible captions (speaker cues and sounds)'};
const OVERLAP=.3;
const labelled=(cue,mode)=>{const label=String(cue.cueLabel||'').trim(),text=String(cue.text||'').trim();
  if(cue.kind==='sound')return text.startsWith('[')?text:`[${text}]`;
  const body=cue.kind==='background'?`(in background) ${text}`:text;return label?`${label} ${body}`:body};
export function displayCues(cues,{mode='clean'}={}){
  const shown=(Array.isArray(cues)?cues:[]).filter(c=>c&&String(c.text||'').trim()&&c.end>c.start&&(mode==='accessible'||(c.kind!=='sound'&&c.kind!=='background')));
  const sorted=[...shown].sort((a,b)=>a.start-b.start),out=[],used=new Set();
  sorted.forEach((cue,i)=>{
    if(used.has(i))return;
    const partnerIndex=sorted.findIndex((other,j)=>j>i&&!used.has(j)&&cue.kind!=='sound'&&other.kind!=='sound'&&other.speaker&&cue.speaker&&other.speaker!==cue.speaker&&Math.min(cue.end,other.end)-Math.max(cue.start,other.start)>=OVERLAP);
    if(partnerIndex<0){out.push({...cue,text:labelled(cue,mode)});return}
    const other=sorted[partnerIndex];used.add(partnerIndex);
    // Two people at once: one row each, a dash per speaker, for as long as either is speaking.
    out.push({start:Math.min(cue.start,other.start),end:Math.max(cue.end,other.end),text:`- ${labelled(cue,mode)}\n- ${labelled(other,mode)}`,overlap:true,speakers:[cue.speaker,other.speaker],
      ...(cue.uncertain||other.uncertain?{uncertain:true}:{})});
  });
  // A merged overlap may run into the next line. A line wholly inside it joins as another dashed
  // row (never dropped); a line that runs past it starts when the overlap ends.
  out.sort((a,b)=>a.start-b.start);const merged=[];
  for(const cue of out){const prev=merged.at(-1);
    if(prev?.overlap&&cue.start<prev.end){if(cue.end<=prev.end){prev.text+=`\n- ${cue.text.replace(/^- /,'')}`;if(cue.uncertain)prev.uncertain=true;continue}cue.start=prev.end}
    merged.push(cue)}
  return merged.filter(c=>c.end-c.start>=.1);
}
// Lines where two different speakers overlap: these need a human check before export.
// Sweep in start order, comparing each line only with lines still running: fast on long tracks.
export function overlapIndexes(cues){
  const list=(cues||[]).map((c,i)=>({c,i})).filter(x=>x.c&&x.c.speaker).sort((a,b)=>a.c.start-b.c.start),hits=new Set();let active=[];
  for(const x of list){active=active.filter(y=>y.c.end-x.c.start>=OVERLAP);for(const y of active)if(y.c.speaker!==x.c.speaker&&Math.min(x.c.end,y.c.end)-x.c.start>=OVERLAP){hits.add(x.i);hits.add(y.i)}active.push(x)}
  return hits;
}
