// Design-system shell: left rail (logo, New video, nav, docked job, settings),
// top bar (compact link drop, command search) and the Discover grid header.
// Moves existing controls once; their handlers stay in app.js and layout.js.
import {el,kbd,enhanceSegmented} from './ds.js';
const mark='<svg class="brand-symbol" viewBox="0 0 28 28" aria-hidden="true" focusable="false"><path d="M3 3h9v7H3zM16 3h9v7h-9zM3 14h9v11H3zM16 14h9v11h-9z" fill="#ff5a1f"/><path d="m9 8 12 6-12 6z" fill="#0b0b0d"/></svg>';

export function mountShell({openPalette}){
  const $=id=>document.getElementById(id),one=s=>document.querySelector(s);
  const app=one('.app'),main=one('.main'),nav=one('.workspace-nav'),topbar=one('.topbar'),actions=one('.top-actions');
  if(!app||!main||!nav||one('.ds-rail'))return;
  one('.brand-symbol')?.replaceWith(document.createRange().createContextualFragment(mark));
  const rail=el('aside','ds-rail');rail.setAttribute('aria-label','Workspace');
  const brand=one('.wordmark');
  const newVideo=nav.querySelector('[data-workspace=source]');newVideo.classList.add('ds-new');
  const label=el('span','cd-label ds-rail-label','Workspace');
  // Design-system rail: Library, Clips, Exports, Brand kit. Home is the logo; Studio opens from a clip.
  const library=nav.querySelector('[data-workspace=library]');if(library&&!$('navLibraryCount')){const count=el('b');count.id='navLibraryCount';count.hidden=true;library.append(count)}
  const dock=el('div','ds-rail-dock');const activity=$('activityPanel');if(activity)dock.append(activity);
  if(activity){const cancel=el('button','cd-btn cd-btn-sm cd-btn-ghost','Cancel');cancel.type='button';cancel.id='activityCancel';cancel.hidden=true;cancel.onclick=()=>$('cancelImport')?.click();activity.append(cancel)}
  const settings=$('openSettings');if(settings)dock.append(settings);
  rail.append(brand,newVideo,label,nav,el('div','ds-rail-grow'),dock);
  app.insertBefore(rail,main);document.body.classList.add('ds-shell');

  // Top bar: paste a link from anywhere (LinkDrop compact) and open ⌘K search.
  const drop=el('form','cd-drop cd-drop-compact ds-topdrop');drop.setAttribute('aria-label','Paste a video link');
  const input=el('input','cd-input');input.type='url';input.placeholder='Paste a YouTube, Twitch or Kick link…';input.setAttribute('aria-label','Video link');input.autocomplete='off';input.required=true;
  const go=el('button','cd-btn cd-btn-sm cd-btn-primary','Make clips →');go.type='submit';
  drop.append(input,go);
  drop.onsubmit=event=>{event.preventDefault();const url=input.value.trim();if(!url)return;$('streamUrl').value=url;$('linkForm').requestSubmit();input.value='';};
  const search=el('button','cd-btn cd-btn-sm cd-btn-secondary ds-search','Search');search.type='button';search.append(kbd('⌘K'));search.onclick=openPalette;
  // Theme toggle: Studio (dark, default) or Daylight, remembered per browser.
  const theme=el('button','cd-btn cd-btn-sm cd-btn-ghost ds-theme');theme.type='button';
  const applyTheme=value=>{document.documentElement.dataset.theme=value;theme.textContent=value==='daylight'?'Studio theme':'Daylight theme';theme.setAttribute('aria-pressed',String(value==='daylight'));document.querySelector('meta[name=theme-color]')?.setAttribute('content',value==='daylight'?'#f5f3ee':'#0b0b0d');};
  let saved='studio';try{saved=localStorage.getItem('cd-theme')==='daylight'?'daylight':'studio'}catch{/* Storage can be blocked; Studio stays the default. */}
  applyTheme(saved);theme.onclick=()=>{const next=document.documentElement.dataset.theme==='daylight'?'studio':'daylight';applyTheme(next);try{localStorage.setItem('cd-theme',next)}catch{/* Not remembered when storage is blocked. */}};
  topbar.prepend(drop);actions.prepend(search,theme);
  // Skip link: focus the workspace content without touching the hash, which the app uses for routes.
  const skip=one('.skip-link');if(skip)skip.onclick=event=>{event.preventDefault();$('main')?.focus()};
  // Paste a link anywhere (outside a text field) to start finding clips.
  document.addEventListener('paste',event=>{
    const target=event.target;if(/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName||'')||target?.isContentEditable||document.querySelector('dialog[open]'))return;
    const text=event.clipboardData?.getData('text/plain')?.trim()||'';if(!/^https:\/\/\S+$/.test(text))return;
    event.preventDefault();$('streamUrl').value=text;$('linkForm').requestSubmit();
  });

  // Discover header: the count as the headline, filter chips and score sort.
  const queue=one('.queue-panel'),heading=queue?.querySelector('.panel-heading');
  if(heading){const headline=el('h2','ds-clips-headline');headline.id='clipHeadline';heading.after(headline);}
  const filter=$('momentFilter');if(filter){filter.add(new Option('Discarded','dismissed'));enhanceSegmented(filter,{label:'Show'})?.classList.add('ds-chips');}
  const sortLabel=el('label','ds-sort');const sort=el('select');sort.id='clipSort';sort.append(new Option('Best first','score'),new Option('Source order','time'));sortLabel.append(document.createTextNode('Sort '),sort);
  one('.moment-filters')?.append(sortLabel);enhanceSegmented(sort,{label:'Sort clips'});
  return {sort};
}
