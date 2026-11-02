// "Complete the thought": finds clip edges that cut a sentence, start on a connecting word, or
// stop on a question whose answer follows, and proposes the nearest natural boundary instead.
// Works on the moment's window clock (the same clock as trimIn/trimOut and timed captions).
const ENDS=/[.!?؟…。][”"'’)\]]*\s*$/u,QUESTION=/[?؟][”"'’)\]]*\s*$/u,PAUSE=.7;
// Words that only make sense after something else was said.
const CONNECTOR=/^(?:and|but|so|because|or|then|also|which|that's why|و|بس|لكن|بعدين|وبعدين|عشان|علشان|لان|لأن|يعني|فـ?)(?=\s|$|[,،])/iu;
const LIMITS={back:8,forward:10,answer:12};
const sorted=cues=>(cues||[]).filter(c=>c&&Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start&&String(c.text||'').trim()).sort((a,b)=>a.start-b.start);
const endsSentence=(cues,i)=>ENDS.test(cues[i].text)||!cues[i+1]||cues[i+1].start-cues[i].end>=PAUSE;
// Unpunctuated speech (common in dialect ASR) has no sentence marks, so a clear breath (≥0.35 s)
// is also an acceptable edge, and the clearest breath is the fallback when no sentence ends nearby.
const SOFT=.35,gapAfter=(cues,i)=>cues[i+1]?cues[i+1].start-cues[i].end:Infinity,acceptable=(cues,i)=>endsSentence(cues,i)||gapAfter(cues,i)>=SOFT;
// Fallback candidates lie beyond the current edge, so a fix always moves it; with no pause at all,
// the furthest line within the limit is used.
function walk(cues,from,step,within){let best=-1,bestGap=-1,last=from;for(let i=from;i>=0&&i<cues.length;i+=step){if(!within(i))break;last=i;const edge=step>0?i:i-1;if(edge<0||endsSentence(cues,edge))return i;const g=gapAfter(cues,edge);if(i!==from&&g>bestGap){bestGap=g;best=i}}return best>=0?best:last}
export function thoughtCheck(rawCues,trimIn,trimOut,{windowEnd=Infinity}={}){
  const cues=sorted(rawCues),issues=[];let start=trimIn,end=trimOut;
  if(!cues.length||!(trimOut>trimIn))return {issues,suggestion:null};
  // Start: the first line the clip touches.
  // A line counts only if the clip includes a real part of it (not a 0.2 s sliver at the edge).
  let s=cues.findIndex(c=>c.end>trimIn+.3);
  if(s>=0&&cues[s].start<trimOut){
    const mid=trimIn>cues[s].start+.15,connector=CONNECTOR.test(String(cues[s].text).trim()),afterSentence=s===0||acceptable(cues,s-1);
    if(mid||connector||!afterSentence){
      issues.push(mid?{kind:'start-mid',text:'Starts in the middle of a sentence.'}:connector?{kind:'start-connector',text:`Starts on “${String(cues[s].text).trim().split(/\s+/)[0]}”, which needs what came before.`}:{kind:'start-mid',text:'Starts partway through a thought.'});
      let i=walk(cues,s,-1,j=>cues[s].start-cues[j].start<=LIMITS.back);
      if(i>0&&CONNECTOR.test(String(cues[i].text).trim())&&cues[s].start-cues[i-1].start<=LIMITS.back)i=walk(cues,i-1,-1,j=>cues[s].start-cues[j].start<=LIMITS.back);
      start=Math.max(0,Math.min(trimIn,cues[i].start-.15));
    }
  }
  // End: the last line the clip touches.
  let e=-1;for(let i=cues.length-1;i>=0;i--)if(cues[i].start<trimOut-.3){e=i;break}
  if(e>=0&&cues[e].end>trimIn){
    const mid=trimOut<cues[e].end-.15,open=!acceptable(cues,e);
    if(mid||open){
      issues.push({kind:'end-mid',text:'Ends before the sentence finishes.'});
      const i=walk(cues,e,1,j=>cues[j].end-cues[e].end<=LIMITS.forward);
      end=Math.max(trimOut,cues[i].end+.25);e=i;
    }
    // A question with its answer just after the cut: the clip only makes sense with the answer.
    const next=cues[e+1];
    if(QUESTION.test(cues[e].text)&&next&&next.start-cues[e].end<2){
      issues.push({kind:'end-question',text:'Ends on a question; the answer right after it is cut off.'});
      let i=e+1;while(i<cues.length-1&&!endsSentence(cues,i)&&cues[i+1].end-cues[e].end<=LIMITS.answer)i++;
      if(cues[i].end-cues[e].end<=LIMITS.answer)end=Math.max(end,cues[i].end+.25);
    }
  }
  end=Math.min(end,windowEnd);
  const changed=Math.abs(start-trimIn)>.05||Math.abs(end-trimOut)>.05;
  return {issues,suggestion:changed?{trimIn:+start.toFixed(2),trimOut:+end.toFixed(2),added:+((trimIn-start)+(end-trimOut)).toFixed(1)}:null};
}
// Arabic-aware matching for quote search: ignores diacritics, tatweel, alef/ya/ta-marbuta forms and case.
export function normalizeForSearch(text){
  return String(text||'').normalize('NFKD').replace(/[ً-ٰٟـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
// Lines of a whole-recording track that contain every word of the query (in either language).
export function findQuotes(track,query,{limit=20}={}){
  const words=normalizeForSearch(query).split(' ').filter(Boolean);if(!words.length)return [];
  const out=[],cues=track?.cues||[],original=track?.original||[];
  for(let i=0;i<Math.max(cues.length,original.length)&&out.length<limit;i++){
    const en=cues[i]?.text||'',src=original[i]?.text||'',hay=normalizeForSearch(en+' '+src);
    if(words.every(w=>hay.includes(w)))out.push({index:i,start:(cues[i]||original[i]).start,end:(cues[i]||original[i]).end,text:en,original:src});
  }
  return out;
}
