// One moment-local clock for the canvas preview and FFmpeg crop expressions.
export function cleanFrameTrack(moment){
 if(moment.outputAspect&&moment.frameTracking?.aspect&&moment.frameTracking.aspect!==moment.outputAspect)return [];
 const points=Array.isArray(moment.frameKeyframes)?moment.frameKeyframes:[];
 if(points.length>64)return [];
 const valid=points.every(p=>p&&typeof p==='object'&&Number.isFinite(p.time)&&Number.isFinite(p.focusX)&&Number.isFinite(p.focusY)&&p.time>=0&&p.focusX>=0&&p.focusX<=100&&p.focusY>=0&&p.focusY<=100);
 if(!valid)return [];
 const ordered=[...points].map(p=>({...p,time:Number(p.time.toFixed(6))})).sort((a,b)=>a.time-b.time),clean=[];for(const point of ordered){if(clean.at(-1)?.time===point.time)clean[clean.length-1]=point;else clean.push(point)}return clean;
}
export function frameFocus(moment,time){
 const track=cleanFrameTrack(moment);if(!track.length)return {focusX:moment.focusX??50,focusY:moment.focusY??50};
 if(time<=track[0].time)return track[0];for(let i=1;i<track.length;i++){const a=track[i-1],b=track[i];if(time<b.time){if(b.sceneCut)return a;const f=(time-a.time)/(b.time-a.time);return {focusX:a.focusX+(b.focusX-a.focusX)*f,focusY:a.focusY+(b.focusY-a.focusY)*f}}}return track.at(-1);
}
export function frameExpression(moment,key){
 const track=cleanFrameTrack(moment);if(!track.length)return String(Math.min(100,Math.max(0,Number.isFinite(Number(moment[key]))?Number(moment[key]):50))/100);
 const n=value=>Number(value.toFixed(6)),clock=`(t+${n(moment.trimIn||0)})`;let expression=String(n(track.at(-1)[key]/100));
 for(let i=track.length-1;i>0;i--){const a=track[i-1],b=track[i],value=b.sceneCut?String(n(a[key]/100)):`(${n(a[key]/100)}+(${n((b[key]-a[key])/100)})*(${clock}-${n(a.time)})/${n(b.time-a.time)})`;expression=`if(lt(${clock},${n(b.time)}),${value},${expression})`}
 return `if(lt(${clock},${n(track[0].time)}),${n(track[0][key]/100)},${expression})`;
}
// Streamer split: facecam crop on top (38% of the frame), gameplay fills the rest.
// cam is {x,y,w} as source fractions; its height follows the top band's aspect.
export const splitCamDefault={x:.7,y:.04,w:.28};
export function splitGeometry(width,height,cam){
 const top=Math.round(height*.38/2)*2,n=(v,lo,hi,d)=>Number.isFinite(Number(v))?Math.min(hi,Math.max(lo,Number(v))):d,c=cam||{};
 return {top,bottom:height-top,cam:{x:n(c.x,0,.95,splitCamDefault.x),y:n(c.y,0,.95,splitCamDefault.y),w:n(c.w,.08,1,splitCamDefault.w)}};
}
