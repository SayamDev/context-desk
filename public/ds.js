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
export function enhanceSegmented(select,{label,hints={}}={}){
  if(!select||select.dataset.enhanced)return null;select.dataset.enhanced='segmented';
  const root=el('div','cd-seg');root.setAttribute('role','radiogroup');root.setAttribute('aria-label',label||select.labels?.[0]?.textContent?.trim()||'Options');
  const thumb=el('span','cd-seg-thumb');thumb.setAttribute('aria-hidden','true');root.append(thumb);
  const options=[...select.options],buttons=options.map(option=>{const b=el('button',undefined,option.textContent.replace(/\s*\d+:\d+$/,'').trim());b.type='button';b.setAttribute('role','radio');const hint=hints[option.value]||(option.textContent.match(/\d+:\d+$/)||[])[0];if(hint)b.append(el('small',undefined,hint));b.onclick=()=>choose(select,option.value);root.append(b);return b;});
  thumb.style.width=`calc((100% - 6px) / ${options.length})`;
  const refresh=()=>{const i=Math.max(0,options.findIndex(o=>o.value===select.value));thumb.style.transform=`translateX(${i*100}%)`;buttons.forEach((b,j)=>{b.setAttribute('aria-checked',String(j===i));b.tabIndex=j===i?0:-1;b.disabled=select.disabled||options[j].disabled;});};
  root.addEventListener('keydown',event=>{const d=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;if(!d)return;event.preventDefault();const i=Math.max(0,options.findIndex(o=>o.value===select.value)),n=(i+d+options.length)%options.length;choose(select,options[n].value);buttons[n].focus();});
  select.after(root);watchSelect(select,refresh);refresh();return root;
}

const lookSamples={punch:['NOBODY ','SAW',' IT'],pop:['Wait ','what','?!'],karaoke:['','And then',' she left'],clean:['','','That was the moment.'],fade:['','','Fading in, line by line.'],highlight:['They ','actually',' said it'],boxed:['','','Speaker 2: no way']};
// Caption style tiles with a live animated sample, built from a <select>.
export function enhanceCaptionLooks(select){
  if(!select||select.dataset.enhanced)return null;select.dataset.enhanced='looks';
  const root=el('div','cd-looks');root.setAttribute('role','radiogroup');root.setAttribute('aria-label','Caption look');
  const tiles=[...select.options].map(option=>{
    const tile=el('button',`cd-look cd-look-${option.value}`);tile.type='button';tile.setAttribute('role','radio');
    const [before,hit,after]=lookSamples[option.value]||['','',option.textContent],sample=el('span','cd-look-sample',before);if(hit)sample.append(el('b',undefined,hit));if(after)sample.append(document.createTextNode(after));
    tile.append(sample,el('span','cd-look-name',option.textContent.split('·')[0].trim()));tile.onclick=()=>choose(select,option.value);root.append(tile);return [option.value,tile];
  });
  const refresh=()=>tiles.forEach(([value,tile])=>{tile.setAttribute('aria-checked',String(value===select.value));tile.disabled=select.disabled||Boolean(select.querySelector(`option[value="${value}"]`)?.disabled);tile.title=tile.disabled&&value==='karaoke'?'Karaoke needs word-timed original captions':'';});
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
  input.placeholder='Search actions and screens…';input.setAttribute('role','combobox');input.setAttribute('aria-controls','cdCmdList');input.setAttribute('aria-expanded','true');list.id='cdCmdList';list.setAttribute('role','listbox');
  head.append(el('span','cd-cmd-glyph','⌘'),input,kbd('esc'));
  for(const [keys,text] of [[['↑','↓'],'move'],[['↵'],'run'],[['esc'],'close']]){const s=el('span');keys.forEach(k=>s.append(kbd(k)));s.append(document.createTextNode(' '+text));foot.append(s);}
  box.append(head,list,foot);dialog.append(box);document.body.append(dialog);
  let items=[],current=0;
  function render(){
    const q=input.value.trim().toLowerCase();items=commands().filter(c=>c.enabled?.()!==false&&(c.label+' '+(c.hint||'')+' '+(c.group||'')).toLowerCase().includes(q));current=Math.min(current,Math.max(0,items.length-1));
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
