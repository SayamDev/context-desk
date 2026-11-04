import {needsTranslation} from './languages.js';
import {captionLanguages} from './locales.js';

export const outputLanguages=['Original',...captionLanguages];
export function captionTarget(moment,projectTarget,userDefault='Original'){
  const requested=[moment.captionLanguageOverride,projectTarget,userDefault,'Original'].find(value=>outputLanguages.includes(value));
  // Keep reviewed tracks and explicit per-clip choices intact.
  return !moment.captionLanguageOverride&&!moment.captionCues?.[requested]?.length&&!needsTranslation(requested,moment.detectedLanguage)?'Original':requested;
}
export function inheritCaptionTarget(moment,projectTarget,userDefault){
  const target=captionTarget(moment,projectTarget,userDefault);
  if(moment.captionLanguage!==target){moment.captionLanguage=target;moment.captionError='';moment.translationError=''}
  moment.autoCaptionLanguage=target;return target;
}
export function commitCaptionTranslation(moment,{original,previous,language,cues,provider}){
  if(!moment||JSON.stringify(moment.captionCues.Original)!==original||JSON.stringify(moment.captionCues[language])!==previous)return false;
  moment.captionCues[language]=structuredClone(cues);moment.captionReviewed[language]=false;
  if(provider)moment.translationSource=provider;
  if(moment.captionLanguage===language){moment.showCaptions=true;moment.captionError=cues.some(c=>c.text.length>100)?'Some translated lines need splitting before export.':''}
  return true;
}
// Only queued work is deduplicated; completed translations live on the moment.
export function translationQueue(limit=2){
  let active=0;const waiting=[],pending=new Map();
  const drain=()=>{while(active<limit&&waiting.length){const task=waiting.shift();active++;const finish=(callback,value)=>{active--;pending.delete(task.key);callback(value);drain()};Promise.resolve().then(task.work).then(value=>finish(task.resolve,value),error=>finish(task.reject,error))}};
  return {add(key,work){if(pending.has(key))return pending.get(key);let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});pending.set(key,promise);waiting.push({key,work,resolve,reject});drain();return promise}};
}

// Projects a whole-recording track (source seconds) onto one clip's window clock:
// keeps cues that overlap the window, clips their edges and shifts word timings too.
export function projectTrack(cues,moment){
  const base=moment.mediaStart??moment.start,length=moment.end-moment.start;
  return (cues||[]).filter(c=>c.end>base&&c.start<base+length).map(({boundaryReview,...c})=>({...c,start:Math.max(0,c.start-base),end:Math.min(length,c.end-base),...(c.words?{words:c.words.map(w=>({...w,start:w.start-base,end:w.end-base}))}:{})}));
}
