import {captionStyles,captionStyleIds} from './caption-styles.js';
import {usableMoments} from './workspaces.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=n=>`${Math.floor((n||0)/60)}:${String(Math.floor((n||0)%60)).padStart(2,'0')}`;
export function createEditorTools({select,getSelected,edit,draw,thumb=m=>m.frames?.[0]}){
 const $=id=>document.getElementById(id),styles=Object.fromEntries(captionStyleIds.map(id=>[id,captionStyles[id].label]));
 $('captionTemplates').innerHTML=Object.entries(styles).map(([style,label])=>`<button type="button" class="caption-template" data-style="${style}" aria-pressed="false"><span>${style==='highlight'?'The moment.':'Your words.'}</span><small>${label}</small></button>`).join('');
 $('captionTemplates').onclick=event=>{const button=event.target.closest('[data-style]'),m=getSelected();if(!button||!m||button.disabled)return;edit('caption-template',()=>{m.captionStyle=button.dataset.style;$('captionStyle').value=m.captionStyle;draw();sync(m)})};
 $('studioClipList').onclick=event=>{const button=event.target.closest('[data-studio-clip]');if(button)void select(button.dataset.studioClip)};
 let signature='';
 function sync(m){for(const button of $('captionTemplates').querySelectorAll('button')){button.setAttribute('aria-pressed',String(button.dataset.style===m.captionStyle));}}
 function collection(moments,selected){const clips=usableMoments(moments),current=moments.find(m=>m.id===selected);if(current&&!clips.includes(current))clips.push(current);$('studioClipCount').textContent=clips.length;
  const key=JSON.stringify(clips.map(m=>[m.id,m.hook,m.frames?.[0],m.start,m.trimIn,m.trimOut,m.id===selected]));if(key===signature)return;signature=key;
  $('studioClipList').innerHTML=clips.length?clips.map((m,index)=>`<button class="studio-clip-button" data-studio-clip="${m.id}" type="button" aria-current="${m.id===selected}" aria-label="Open clip ${index+1}: ${escape(m.hook||m.analysis?.beatType||'Source moment')}">${thumb(m)?`<img src="${escape(thumb(m))}" alt="" loading="lazy">`:''}<strong>${escape(m.hook||m.analysis?.beatType||'Source moment')}</strong><small>${time(m.start+m.trimIn)} · ${(m.trimOut-m.trimIn).toFixed(1)}s</small></button>`).join(''):'<p>No clips yet. Find a moment in Discover.</p>';
 }
 return {sync,collection};
}
