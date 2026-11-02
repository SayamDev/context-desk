// Review hints for subtitle drafts. Flags never block export or change text: they point a
// producer at lines worth checking against the audio (ASR loops, stray scripts, gaps).
import {scripts,expected} from './locales.js';
import {overlapIndexes} from './caption-display.js';
const words=text=>String(text||'').toLowerCase().replace(/[^\p{L}\p{N}\s']/gu,' ').split(/\s+/).filter(Boolean);
// A 2–4 word phrase three times in one line, or a long line that is mostly repeats.
// Single words repeated ("no, no, no") are normal speech and are not flagged.
export function repetition(text){
  const w=words(text);if(w.length<6)return false;
  if(w.length>=8&&new Set(w).size/w.length<.5)return true;
  for(let n=2;n<=4;n++){const seen=new Map();for(let i=0;i+n<=w.length;i++){const k=w.slice(i,i+n).join(' ');seen.set(k,(seen.get(k)||0)+1);if(seen.get(k)>=3)return true}}
  return false;
}
// Letters from a script that does not belong to this track (e.g. Hebrew inside Arabic).
export function strayScript(text,language,{original=false,sourceScript}={}){
  const want=original?sourceScript:expected[language]||'latin';if(!want)return '';
  for(const [name,re] of Object.entries(scripts)){if(name===want||(want==='kana'&&name==='han')||name==='latin')continue;const hits=(String(text).match(re)||[]).length;if(hits>=2)return name}
  return '';
}
export function lineIssues(cues,{language='Original',sourceScript='',originals=[]}={}){
  const issues=[],overlaps=overlapIndexes(cues);
  cues.forEach((cue,index)=>{
    const reasons=[],text=String(cue.text||'');
    if(overlaps.has(index))reasons.push('Two people speak at once here: check both lines and who said each.');
    if(/\[unclear\]/i.test(text))reasons.push('Part of this line was marked unclear: listen to the original before approving.');
    if(repetition(text))reasons.push('Repeated words: check the audio, speech recognition may have looped.');
    const stray=strayScript(text,language,{original:language==='Original',sourceScript});if(stray)reasons.push(`Contains ${stray} letters that do not belong in this track.`);
    if(language!=='Original'&&expected[language]===undefined&&(text.match(scripts.arabic)||[]).length+(text.match(scripts.hebrew)||[]).length>=3)reasons.push('Part of this line was not translated.');
    if(language!=='Original'&&originals[index]&&text.trim()===String(originals[index].text||'').trim()&&words(text).length>2)reasons.push('Identical to the original line: it may be untranslated.');
    const prev=cues[index-1];if(prev&&text.trim()&&text.trim()===String(prev.text||'').trim())reasons.push('Same text as the previous line.');
    if(prev&&cue.start<prev.end-.05&&(!cue.speaker||cue.speaker===prev.speaker))reasons.push('Overlaps the previous line.');
    if(reasons.length)issues.push({index,reasons});
  });
  return issues;
}
// Most common non-Latin script in the original track: the source language's own script.
export function dominantScript(cues){
  const text=cues.map(c=>c.text).join(' ');let best='',most=0;
  for(const [name,re] of Object.entries(scripts)){const n=(text.match(re)||[]).length;if(n>most){most=n;best=name}}
  return best;
}
