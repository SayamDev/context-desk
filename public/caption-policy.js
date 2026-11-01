export const outputLanguages=['Original','English','Arabic','French','Spanish','Hindi','Portuguese','German','Turkish','Urdu'];
export function captionTarget(moment,projectTarget,userDefault='Original'){
  return [moment.captionLanguageOverride,projectTarget,userDefault,'Original'].find(value=>outputLanguages.includes(value));
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
