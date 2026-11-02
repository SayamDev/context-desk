// Silence and filler cutting. Cuts are removed ranges on the moment's window clock
// (the same clock as trimIn/trimOut); export drops them, preview skips over them.
const MIN_CUT=.1;
// FFmpeg silencedetect log lines: "silence_start: 1.2" / "silence_end: 2.9 | silence_duration: 1.7".
export function parseSilence(text,end){
  const ranges=[];let open=null;
  for(const m of String(text).matchAll(/silence_(start|end): (-?[\d.]+)/g)){const t=Math.max(0,Number(m[2]));if(m[1]==='start')open=t;else if(open!==null){ranges.push({start:open,end:t});open=null}}
  if(open!==null&&Number.isFinite(end)&&end>open)ranges.push({start:open,end});
  return ranges;
}
// Leave a short breath on each side so speech never sounds clipped.
export function silenceCuts(ranges,{breath=.15,min=.5}={}){
  return ranges.map(r=>({start:r.start+breath,end:r.end-breath})).filter(r=>r.end-r.start>=min);
}
// Pure hesitation sounds only; real words like "like" or "so" change meaning and stay.
export const fillerPattern=/^(?:u+h+|u+m+|uh+m+|e+r+m*|a+h+|h+m+|m{2,}|e+h+|ehm|äh+m*|euh+|eh+|este+|pues+|ano+|えー+|あの+|えっと|嗯+|呃+|음+|어+)$/iu;
export function fillerCuts(words,{pad=.04}={}){
  return (Array.isArray(words)?words:[]).filter(w=>w&&Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.end>w.start&&fillerPattern.test(String(w.text||'').replace(/[^\p{L}]/gu,''))).map(w=>({start:Math.max(0,w.start-pad),end:w.end+pad}));
}
export function cleanCuts(cuts,trimIn,trimOut){
  const sorted=(Array.isArray(cuts)?cuts:[]).filter(c=>c&&Number.isFinite(c.start)&&Number.isFinite(c.end)).map(c=>({start:Math.max(trimIn,c.start),end:Math.min(trimOut,c.end)})).filter(c=>c.end-c.start>=MIN_CUT).sort((a,b)=>a.start-b.start),merged=[];
  for(const c of sorted){const last=merged.at(-1);if(last&&c.start<=last.end)last.end=Math.max(last.end,c.end);else merged.push({...c})}
  // Never cut the whole clip: keep at least one second of it.
  const removed=merged.reduce((a,c)=>a+c.end-c.start,0);return trimOut-trimIn-removed<1?[]:merged.slice(0,400).map(c=>({start:+c.start.toFixed(3),end:+c.end.toFixed(3)}));
}
export const removedSeconds=cuts=>(cuts||[]).reduce((a,c)=>a+c.end-c.start,0);
// FFmpeg select expression; t counts from trimIn because the input is seeked there.
export function selectExpression(cuts,trimIn){return 'not('+cuts.map(c=>`between(t,${+(c.start-trimIn).toFixed(3)},${+(c.end-trimIn).toFixed(3)})`).join('+')+')'}
// Where preview playback should jump to when it lands inside a cut, or null.
export function skipCut(cuts,time){const c=(cuts||[]).find(c=>time>=c.start&&time<c.end-.02);return c?c.end:null}
