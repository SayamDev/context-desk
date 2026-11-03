import {drawCaptionFrame} from './caption-render.js';
import {captionStyles} from './caption-styles.js';
// Context Desk design-system components for the studio's vanilla DOM.
// Markup and class names match the published system (cd-*), styled by ds.css.
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
export const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
export const formatTime=seconds=>{const s=Math.max(0,Math.floor(Number(seconds)||0)),h=Math.floor(s/3600),m=String(Math.floor(s/60)%60).padStart(2,'0'),x=String(s%60).padStart(2,'0');return h?`${h}:${m}:${x}`:`${m}:${x}`;};

export function kbd(key){return el('kbd','cd-kbd',key);}
// Adds a keycap hint to an existing button once, keeping its label intact.
export function addKbd(button,key){if(button&&!button.querySelector(':scope>.cd-kbd'))button.append(kbd(key));return button;}

export function badge(tone,text,dot=false){const node=el('span',`cd-badge cd-badge-${tone||'neutral'}`);if(dot)node.append(el('i'));node.append(document.createTextNode(text));return node;}

// Editorial score 0-100 as numeral + rising bars; counts up once when first shown.
export function scoreMeter(value,{size='md',label='Editorial score',animate=true}={}){
  const v=Math.round(Math.max(0,Math.min(100,Number(value)||0))),heat=v>=80?'hot':v>=60?'warm':'cool';
  const node=el('span',`cd-score ${heat}${size==='sm'?' cd-score-sm':''}`);node.setAttribute('role','meter');node.setAttribute('aria-valuemin','0');node.setAttribute('aria-valuemax','100');node.setAttribute('aria-valuenow',String(v));node.setAttribute('aria-label',`${label} ${v}`);
  const num=el('span','cd-score-num',animate&&!reduced()?'0':String(v)),bars=el('span','cd-score-bars');bars.setAttribute('aria-hidden','true');
  for(let i=0;i<10;i++){const bar=el('span',i<Math.round(v/10)?'on':'');bar.style.height=`${30+i*7}%`;bar.style.animationDelay=`${i*40}ms`;bars.append(bar);}
  node.append(num,bars);
  if(animate&&!reduced()){const t0=performance.now();const tick=t=>{const k=Math.min(1,(t-t0)/600);num.textContent=String(Math.round(v*(1-(1-k)**3)));if(k<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);}
  return node;
}

// Keeps an enhanced <select> the single source of truth: programmatic value writes refresh the control.
function watchSelect(select,refresh){
  const proto=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
  Object.defineProperty(select,'value',{configurable:true,get(){return proto.get.call(this);},set(v){proto.set.call(this,v);refresh();}});
  select.addEventListener('change',refresh);new MutationObserver(refresh).observe(select,{attributes:true,subtree:true,attributeFilter:['disabled']});select.classList.add('cd-enhanced');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
}
function choose(select,value){if(select.value===value||select.disabled)return;select.value=value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));}

// One-tap preset picker with a sliding thumb, built from a <select>.
export function enhanceSegmented(select,{label,hints={},labels={},order}={}){
  if(!select||select.dataset.enhanced)return null;select.dataset.enhanced='segmented';
  const root=el('div','cd-seg');root.setAttribute('role','radiogroup');root.setAttribute('aria-label',label||select.labels?.[0]?.textContent?.trim()||'Options');
  const thumb=el('span','cd-seg-thumb');thumb.setAttribute('aria-hidden','true');root.append(thumb);
  const options=order?order.map(v=>[...select.options].find(o=>o.value===v)).filter(Boolean):[...select.options],buttons=options.map(option=>{const custom=labels[option.value],b=el('button',undefined,custom?custom[0]:option.textContent.replace(/\s*\d+:\d+$/,'').trim());b.type='button';b.setAttribute('role','radio');const hint=custom?custom[1]:hints[option.value]||(option.textContent.match(/\d+:\d+$/)||[])[0];if(hint)b.append(el('small',undefined,hint));b.onclick=()=>choose(select,option.value);root.append(b);return b;});
  thumb.style.width=`calc((100% - 6px) / ${options.length})`;
  const refresh=()=>{const i=Math.max(0,options.findIndex(o=>o.value===select.value));thumb.style.transform=`translateX(${i*100}%)`;buttons.forEach((b,j)=>{b.setAttribute('aria-checked',String(j===i));b.tabIndex=j===i?0:-1;b.disabled=select.disabled||options[j].disabled;});};
  root.addEventListener('keydown',event=>{const d=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;if(!d)return;event.preventDefault();const i=Math.max(0,options.findIndex(o=>o.value===select.value)),n=(i+d+options.length)%options.length;choose(select,options[n].value);buttons[n].focus();});
  select.after(root);watchSelect(select,refresh);refresh();return root;
}

// Caption style tiles with a live animated sample, built from a <select>.
// Caption style tiles: each tile is drawn by the real caption renderer on a short loop,
// so it shows exactly what the preview and export will do. Loops run only while visible.
export function enhanceCaptionLooks(select,{getLook=()=>({})}={}){
  if(!select||select.dataset.enhanced)return null;select.dataset.enhanced='looks';
  const root=el('div','cd-looks');root.setAttribute('role','radiogroup');root.setAttribute('aria-label','Caption look');
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches,visible=new Set();let frame=null;
  const tiles=[...select.options].map(option=>{
    const tile=el('button',`cd-look cd-look-${option.value}`);tile.type='button';tile.setAttribute('role','radio');tile.dataset.style=option.value;
    const canvas=el('canvas','cd-look-canvas');canvas.width=240;canvas.height=120;canvas.setAttribute('aria-hidden','true');
    tile.append(canvas,el('span','cd-look-name',option.textContent.split('·')[0].trim()));tile.onclick=()=>choose(select,option.value);root.append(tile);return [option.value,tile,canvas];
  });
  const draw=t=>{for(const [value,,canvas] of tiles){if(!visible.has(canvas))continue;const c=canvas.getContext('2d'),style=captionStyles[value];c.fillStyle='#0b0b0d';c.fillRect(0,0,canvas.width,canvas.height);
    drawCaptionFrame(c,{cue:{start:0,end:2.8,text:style?.sample||value},time:still?1.4:t%2.8,styleId:value,look:{...getLook(),position:'middle',scale:1},fontSize:Math.round(23*(style?.size||1))})}};
  const loop=now=>{draw(now/1000);frame=visible.size&&!still?requestAnimationFrame(loop):null};
  const observer=new IntersectionObserver(entries=>{for(const e of entries)e.isIntersecting?visible.add(e.target):visible.delete(e.target);if(!frame)frame=requestAnimationFrame(loop)});
  for(const [,,canvas] of tiles)observer.observe(canvas);
  const refresh=()=>{tiles.forEach(([value,tile])=>{tile.setAttribute('aria-checked',String(value===select.value));tile.disabled=select.disabled||Boolean(select.querySelector(`option[value="${value}"]`)?.disabled)});if(!frame)frame=requestAnimationFrame(loop)};
  select.after(root);watchSelect(select,refresh);refresh();return root;
}

// Floating bulk action bar; render(count, actions) shows it, render(0) hides it.
export function createBulkBar(host){
  const bar=el('div','cd-bulk');bar.setAttribute('role','toolbar');bar.hidden=true;host.append(bar);
  return {render(count,actions=[],onClear){
    bar.hidden=!count;bar.replaceChildren();if(!count)return;bar.setAttribute('aria-label',`${count} selected`);
    bar.append(el('span','cd-bulk-count',`${count} selected`));
    actions.forEach((a,i)=>{const b=el('button',`cd-btn cd-btn-sm cd-btn-${a.variant||(i===0?'primary':'ghost')}`,a.label);b.type='button';b.disabled=Boolean(a.disabled);if(a.shortcut)b.append(kbd(a.shortcut));b.onclick=a.run;bar.append(b);});
    if(onClear){bar.append(el('span','cd-bulk-sep'));const x=el('button','cd-btn cd-btn-sm cd-btn-ghost','Clear');x.type='button';x.onclick=onClear;bar.append(x);}
  }};
}

// ⌘K / Ctrl+K command palette. commands() returns [{label, group, hint, shortcut, run, enabled}].
export function createCommandPalette(commands){
  const dialog=el('dialog','cd-cmd-dialog');dialog.setAttribute('aria-label','Command palette');
  const box=el('div','cd-cmd'),head=el('div','cd-cmd-input'),input=el('input'),list=el('ul','cd-cmd-list'),foot=el('div','cd-cmd-foot');
  input.placeholder='Search clips, sources or run an action…';input.setAttribute('role','combobox');input.setAttribute('aria-controls','cdCmdList');input.setAttribute('aria-expanded','true');list.id='cdCmdList';list.setAttribute('role','listbox');
  head.append(el('span','cd-cmd-glyph','⌘'),input,kbd('esc'));
  for(const [keys,text] of [[['↑','↓'],'move'],[['↵'],'run'],[['esc'],'close']]){const s=el('span');keys.forEach(k=>s.append(kbd(k)));s.append(document.createTextNode(' '+text));foot.append(s);}
  box.append(head,list,foot);dialog.append(box);document.body.append(dialog);
  let items=[],current=0;
  function render(){
    const q=input.value.trim().toLowerCase(),rank=g=>({Actions:0,Clips:1,'Go to':2}[g]??3);items=commands().sort((a,b)=>rank(a.group)-rank(b.group)).filter(c=>c.enabled?.()!==false&&(c.label+' '+(c.hint||'')+' '+(c.group||'')).toLowerCase().includes(q));current=Math.min(current,Math.max(0,items.length-1));
    list.replaceChildren();let group=null;
    if(!items.length){list.append(el('li','cd-cmd-empty','No matching action.'));return;}
    items.forEach((c,i)=>{if(c.group&&c.group!==group){group=c.group;const g=el('li','cd-cmd-group cd-label',group);g.setAttribute('role','presentation');list.append(g);}
      const row=el('li','cd-cmd-item');row.setAttribute('role','option');row.setAttribute('aria-selected',String(i===current));const name=el('span',undefined,c.label);if(c.hint)name.append(el('small',undefined,c.hint));row.append(name);if(c.shortcut)row.append(kbd(c.shortcut));
      row.onmouseenter=()=>{current=i;mark();};row.onclick=()=>run(i);list.append(row);});
  }
  function mark(){list.querySelectorAll('.cd-cmd-item').forEach((row,i)=>row.setAttribute('aria-selected',String(i===current)));list.querySelectorAll('.cd-cmd-item')[current]?.scrollIntoView({block:'nearest'});}
  function run(i){const c=items[i];if(!c)return;dialog.close();c.run();}
  function open(){input.value='';current=0;render();dialog.showModal();input.focus();}
  input.addEventListener('input',()=>{current=0;render();});
  dialog.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();current=(current+1)%Math.max(1,items.length);mark();}else if(event.key==='ArrowUp'){event.preventDefault();current=(current-1+items.length)%Math.max(1,items.length);mark();}else if(event.key==='Enter'){event.preventDefault();run(current);}});
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();dialog.open?dialog.close():open();}});
  return {open};
}

// Keeps a keycap on a button the app relabels (innerHTML/textContent rewrites).
export function keepKbd(button,key){
  if(!button)return;addKbd(button,key);
  new MutationObserver(()=>addKbd(button,key)).observe(button,{childList:true});
}

// Short-lived status message with an optional action (Undo instead of confirm dialogs).
let toastHost=null;
export function toast(text,{action,run,timeout=6000}={}){
  if(!toastHost){toastHost=el('div','cd-toasts');toastHost.setAttribute('role','status');toastHost.setAttribute('aria-live','polite');document.body.append(toastHost);}
  const node=el('div','cd-toast');node.append(el('span',undefined,text));let timer;
  const close=()=>{clearTimeout(timer);node.classList.add('is-leaving');setTimeout(()=>node.remove(),180);};
  if(action){const b=el('button','cd-btn cd-btn-sm cd-btn-secondary',action);b.type='button';b.onclick=()=>{close();run?.();};node.append(b);}
  toastHost.append(node);timer=setTimeout(close,timeout);return close;
}

// Real waveform peaks (0-1) for a clip window: short saved clips are decoded directly,
// imported recordings ask the server for just that section (up to 60 s).
const peakCache=new Map();
export async function audioPeaks(m,count=72){
  const key=`${m.url}|${m.start}|${m.end}|${count}`;if(peakCache.has(key))return peakCache.get(key);
  const task=(async()=>{
    let bytes;
    if(/^\/api\/import\/[\w-]+\/media$/.test(m.url||'')){const id=m.url.split('/')[3],r=await fetch(`/api/import/${id}/audio`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start:m.start,end:Math.min(m.end,m.start+60)})});if(!r.ok)throw Error('busy');bytes=await (await fetch((await r.json()).data)).arrayBuffer()}
    else if(/^\/api\/assets\//.test(m.url||'')){bytes=await (await fetch(m.url)).arrayBuffer()}else return null;
    const ctx=new (window.OfflineAudioContext||window.webkitOfflineAudioContext)(1,1,44100),audio=await ctx.decodeAudioData(bytes),data=audio.getChannelData(0),step=Math.max(1,Math.floor(data.length/count)),peaks=[];
    for(let i=0;i<count;i++){let sum=0;for(let j=i*step;j<Math.min(data.length,(i+1)*step);j+=4)sum+=data[j]*data[j];peaks.push(Math.sqrt(sum/(step/4)))}
    const max=Math.max(...peaks,1e-6);return peaks.map(p=>p/max);
  })().catch(()=>{peakCache.delete(key);return null});
  peakCache.set(key,task);return task;
}

// TrimTimeline: waveform track, cue selection with draggable handles, I/O footer.
// A long window (a whole recording) zooms to the selection plus the same length of context on each
// side, so the clip is always a third of the bar; the view re-centres after each change.
export function createTrim({duration,value,peaks,markers=[],playhead,onInput,onCommit}){
  const root=el('div','cd-trim'),track=el('div','cd-trim-track'),sel=el('div','cd-trim-sel'),inner=el('div'),innerWave=el('div'),hin=el('button','cd-handle cd-handle-in'),hout=el('button','cd-handle cd-handle-out'),foot=el('div','cd-trim-foot');
  let range=[...value],view=[0,duration];
  const fit=()=>{const len=range[1]-range[0];view=duration>len*3?[Math.max(0,range[0]-len),Math.min(duration,range[1]+len)]:[0,duration];track.title=`Showing ${formatTime(view[0])}–${formatTime(view[1])}`};
  const pos=t=>(t-view[0])/(view[1]-view[0])*100;
  // Peaks cover the whole window; show the slice in view, resampled to a steady bar count.
  const wave=()=>{const w=el('div','cd-wave');w.setAttribute('aria-hidden','true');const all=peaks||Array(72).fill(.08),from=view[0]/duration*all.length,span=(view[1]-view[0])/duration*all.length,count=Math.min(72,Math.max(24,Math.round(span)));
    for(let i=0;i<count;i++){const p=all[Math.min(all.length-1,Math.floor(from+i/count*span))]??.08;w.append(Object.assign(el('i'),{style:`height:${Math.max(8,Math.round(p*100))}%`}))}return w};
  inner.style.cssText='position:absolute;inset:0;overflow:hidden';innerWave.style.cssText='position:absolute;top:0;bottom:0';
  hin.type=hout.type='button';sel.append(inner,hin,hout);
  const marks=markers.map(m=>{const d=el('span','cd-marker');d.title=m.label;return [m.t,d]}),head=Number.isFinite(playhead)?el('span','cd-playhead'):null;
  const place=()=>{for(const [t,d] of marks){d.hidden=t<view[0]||t>view[1];d.style.left=`${pos(t)}%`}if(head){head.hidden=playhead<view[0]||playhead>view[1];head.style.left=`${pos(playhead)}%`}};
  fit();track.append(wave(),...marks.map(([,d])=>d),sel);if(head)track.append(head);innerWave.append(wave());inner.append(innerWave);
  const inTime=el('span','cd-tc'),len=el('span','cd-label'),outTime=el('span','cd-tc'),left=el('span','cd-row'),right=el('span','cd-row');left.append(kbd('I'),inTime);right.append(outTime,kbd('O'));foot.append(left,len,right);root.append(track,foot);
  const draw=()=>{const L=pos(range[0]),W=pos(range[1])-L;sel.style.left=`${L}%`;sel.style.width=`${W}%`;innerWave.style.left=`${-L/W*100}%`;innerWave.style.width=`${100/W*100}%`;inTime.textContent=formatTime(range[0]);outTime.textContent=formatTime(range[1]);len.textContent=`${(range[1]-range[0]).toFixed(1)}s clip`;hin.setAttribute('aria-label','Trim in '+formatTime(range[0]));hout.setAttribute('aria-label','Trim out '+formatTime(range[1]))};
  const refit=()=>{const before=view.join();fit();if(view.join()!==before){track.querySelector('.cd-wave')?.replaceWith(wave());innerWave.replaceChildren(wave())}place();draw()};
  const set=(which,t)=>{t=Math.round(Math.max(0,Math.min(duration,t))*10)/10;range=which===0?[Math.min(t,range[1]-1),range[1]]:[range[0],Math.max(t,range[0]+1)];draw();onInput?.(range)};
  const commit=()=>{refit();onCommit?.(range)};
  const drag=which=>event=>{event.preventDefault();const r=track.getBoundingClientRect(),[a,b]=view,at=x=>a+Math.max(0,Math.min(1,(x-r.left)/r.width))*(b-a),grab=at(event.clientX)-range[which],move=ev=>set(which,at(ev.clientX)-grab),up=()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',up);commit()};addEventListener('pointermove',move);addEventListener('pointerup',up)};
  const nudge=which=>event=>{const d=event.key==='ArrowLeft'?-.1:event.key==='ArrowRight'?.1:0;if(!d)return;event.preventDefault();set(which,range[which]+d*(event.shiftKey?10:1));commit()};
  hin.onpointerdown=drag(0);hout.onpointerdown=drag(1);hin.onkeydown=nudge(0);hout.onkeydown=nudge(1);place();draw();
  return {el:root,set(v){range=[...v];refit()},setPeaks(p){peaks=p;track.querySelector('.cd-wave')?.replaceWith(wave());innerWave.replaceChildren(wave());draw()}};
}
