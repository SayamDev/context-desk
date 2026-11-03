// Timers that keep running when the tab is in the background. Chrome slows page timers in hidden
// tabs (to once a minute after a while) and stops requestAnimationFrame entirely, which froze live
// capture whenever the editor switched tabs. A dedicated worker's timers are not throttled that
// way, and its messages wake the page as ordinary tasks.
const source=`const timers=new Map();onmessage=({data})=>{const {op,id,ms}=data;if(op==='clear'){clearTimeout(timers.get(id));clearInterval(timers.get(id));timers.delete(id);return}
  timers.set(id,op==='every'?setInterval(()=>postMessage(id),ms):setTimeout(()=>{timers.delete(id);postMessage(id)},ms))}`;
let worker=null,next=1;const callbacks=new Map(),repeating=new Set();
function ensure(){if(worker)return worker;try{worker=new Worker(URL.createObjectURL(new Blob([source],{type:'text/javascript'})));worker.onmessage=({data:id})=>{const fn=callbacks.get(id);if(!repeating.has(id))callbacks.delete(id);fn?.()}}catch{worker=false}return worker}
function schedule(op,fn,ms){const w=ensure();if(!w)return {fallback:op==='every'?setInterval(fn,ms):setTimeout(fn,ms)};const id=next++;callbacks.set(id,fn);if(op==='every')repeating.add(id);w.postMessage({op,id,ms});return {id}}
export const clock={
  after:(ms,fn)=>schedule('after',fn,ms),
  every:(ms,fn)=>schedule('every',fn,ms),
  clear(handle){if(!handle)return;if(handle.fallback!==undefined){clearTimeout(handle.fallback);clearInterval(handle.fallback);return}callbacks.delete(handle.id);repeating.delete(handle.id);worker?.postMessage({op:'clear',id:handle.id})}
};
