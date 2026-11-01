import {createHash} from 'node:crypto';
export function createDurableTranslationCache(store){
  const pending=new Map();
  return {run(context,request,{refresh=false}={}){
    const key=createHash('sha256').update(JSON.stringify(context)).digest('hex');
    if(pending.has(key))return pending.get(key);
    const saved=store.getRecord('caption_translation_v1',key);if(saved&&!refresh)return Promise.resolve({...saved,cacheHit:true});
    const attempt=store.getRecord('caption_translation_attempt',key);
    if(attempt&&!refresh)return Promise.reject(Error(attempt.status==='running'?'Translation was interrupted. Choose Retry translation to retry the unfinished provider request.':'Translation failed previously. Choose Retry translation to try again.'));
    store.putRecord('caption_translation_attempt',key,{status:'running',startedAt:Date.now()});
    const task=Promise.resolve().then(request).then(value=>{store.putRecord('caption_translation_v1',key,value);store.putRecord('caption_translation_attempt',key,{status:'complete'});return value}).catch(error=>{store.putRecord('caption_translation_attempt',key,{status:'failed'});throw error}).finally(()=>pending.delete(key));pending.set(key,task);return task;
  }};
}
