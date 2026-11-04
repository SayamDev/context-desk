import {drawCaptionFrame} from './caption-render.js';
import {captionStyleIds,captionStyles} from './caption-styles.js';
import {requestJson} from './projects.js';import {cleanCaptionLook,captionFonts} from './brand-kit.js';
export function createBrandControls({getSelected,edit,draw,navigate}){
 const $=id=>document.getElementById(id),panel=document.createElement('section');panel.className='brand-controls';panel.setAttribute('aria-label','Brand style');
 panel.innerHTML=`<h3>Your brand, every clip.</h3><label for="brandKitSelect">Saved brand styles<select id="brandKitSelect"><option value="">Custom style</option></select></label><div class="brand-fields"><label for="captionFont">Font<select id="captionFont">${captionFonts.map(font=>'<option>'+font+'</option>').join('')}</select></label><label for="captionPosition">Placement<select id="captionPosition"><option value="bottom">Bottom</option><option value="middle">Middle</option><option value="top">Top</option></select></label><label for="captionColor">Text colour<input id="captionColor" type="color" value="#ffffff"></label><label for="captionAccent">Highlight colour<input id="captionAccent" type="color" value="#caff45"></label><label for="captionBackground">Caption background<input id="captionBackground" type="color" value="#151419"></label><label for="captionScale">Caption size<input id="captionScale" type="range" min="0.7" max="1.5" step="0.05" value="1"></label></div><button id="manageBrandKits" type="button" class="cd-btn cd-btn-secondary">Manage Brand Kit</button>`;
 $('styleInspector').append(panel);
 $('manageBrandKits').onclick=()=>{const m=getSelected();if(m){$('brandPresetStyle').value=m.captionStyle;$('brandUseClip').checked=true;preview()}navigate('brand')};
 const page=$('brandKitPage');
 page.innerHTML=`
  <div class="brand-workbench">
   <div class="brand-kit-editor">
    <h2>Create a preset</h2>
    <p>Save a caption look you can use on other clips.</p>
    <form id="brandKitForm">
     <label>Preset name<input id="brandKitName" class="cd-input" maxlength="80" placeholder="e.g. My show" required></label>
     <label>Caption style<select id="brandPresetStyle">${captionStyleIds.map(id=>'<option value="'+id+'">'+captionStyles[id].label+'</option>').join('')}</select></label>
     <label><input id="brandUseClip" type="checkbox" aria-describedby="brandClipHint"> Copy the open clip’s custom styling</label>
     <p id="brandClipHint" class="brand-field-note"></p>
     <button id="saveBrandKit" class="cd-btn cd-btn-primary" type="submit">Save preset</button>
    </form>
    <p id="brandStatus" role="status"></p>
   </div>
   <figure class="brand-preview">
    <figcaption><strong>Caption preview</strong><span>9:16 sample frame</span></figcaption>
    <div class="brand-preview-frame"><img id="brandPreviewStill" alt="" hidden><canvas id="brandPreviewCanvas" width="360" height="640" aria-label="Sample caption in the selected style">Wait for it.</canvas></div>
   </figure>
  </div>
  <section class="brand-saved">
   <h2>Saved presets</h2>
   <p>Apply to the open clip here, or choose a preset under Style in Studio.</p>
   <ul id="brandKitList"><li>Loading presets…</li></ul>
  </section>`;
 function preview(){
  const canvas=$('brandPreviewCanvas');
  const context=canvas.getContext('2d');
  const moment=getSelected();
  const useClip=$('brandUseClip');
  useClip.disabled=!moment;
  if(!moment)useClip.checked=false;
  $('brandClipHint').textContent=moment
   ?'Includes the clip’s font, colours, size and placement.'
   :'Open a clip in Studio to copy its custom styling.';
  const still=$('brandPreviewStill');
  const source=/^\/api\/import\/([a-f0-9-]{36})\/media$/.exec(moment?.url||'');
  const stillUrl=source?'/api/import/'+source[1]+'/frame?t='+Math.max(0,Number(moment.start)||0)+'&w=360':null;
  if(stillUrl&&still.getAttribute('src')!==stillUrl){
   still.hidden=true;
   still.onload=()=>{still.hidden=false};
   still.onerror=()=>{still.hidden=true};
   still.src=stillUrl;
  }else if(!stillUrl){
   still.hidden=true;
   still.removeAttribute('src');
  }
  const styleId=$('brandPresetStyle').value;
  context.clearRect(0,0,canvas.width,canvas.height);
  drawCaptionFrame(context,{cue:{start:0,end:2,text:'Wait for it.'},time:1.75,styleId,look:useClip.checked?moment.captionLook:undefined});
 }
 $('brandPresetStyle').onchange=preview;
 $('brandUseClip').onchange=preview;
 preview();
 let brands=null;
 function renderList(){
  if(!brands)return;
  const entries=brands.map(brand=>{
   const row=document.createElement('li');
   const description=document.createElement('span');
   const name=document.createElement('strong');
   name.dir='auto';
   name.textContent=brand.name;
   const style=document.createElement('span');
   style.textContent=captionStyles[brand.captionStyle]?.label||'Punch';
   description.append(name,style);
   const apply=document.createElement('button');
   apply.type='button';
   apply.className='cd-btn cd-btn-secondary';
   apply.textContent='Apply to clip';
   apply.setAttribute('aria-label','Apply '+brand.name+' to clip');
   apply.disabled=!getSelected();
   apply.onclick=()=>{
    const moment=getSelected();
    if(!moment)return;
    $('brandKitSelect').value=brand.id;
    $('brandKitSelect').onchange();
    $('brandStatus').textContent='Applied '+brand.name+' to the open clip.';
    $('styleTab').click();
    navigate('edit');
   };
   row.append(description,apply);
   return row;
  });
  if(!entries.length){
   const empty=document.createElement('li');
   empty.textContent='Save your first preset above to reuse it on other clips.';
   entries.push(empty);
  }
  $('brandKitList').replaceChildren(...entries);
 }
 async function list(){
  try{
   brands=(await requestJson('/api/brands')).brands;
   const select=$('brandKitSelect');
   const chosen=select.value;
   select.replaceChildren(new Option('Custom style',''),...brands.map(brand=>new Option(brand.name,brand.id)));
   select.value=brands.some(brand=>brand.id===chosen)?chosen:'';
   renderList();
   return true;
  }catch(error){
   $('brandKitList').replaceChildren();
   $('brandStatus').textContent='Could not load saved presets. '+error.message;
  }
 }
 const keys={captionFont:'font',captionPosition:'position',captionColor:'color',captionAccent:'accent',captionBackground:'background',captionScale:'scale'};
 for(const [id,key]of Object.entries(keys))$(id).oninput=()=>{const m=getSelected();if(!m)return;edit('brand-'+key,()=>{m.captionLook={...m.captionLook,[key]:key==='scale'?Number($(id).value):$(id).value};$('brandKitSelect').value='';draw()})};
 $('brandKitSelect').onchange=()=>{const brand=brands?.find(brand=>brand.id===$('brandKitSelect').value),m=getSelected();if(!brand||!m)return;edit('brand-kit',()=>{m.captionStyle=brand.captionStyle==='karaoke'&&($('captionStyle').querySelector('[value=karaoke]')?.disabled)?'punch':brand.captionStyle;m.captionLook=structuredClone(brand.look);$('captionStyle').value=m.captionStyle;sync(m);draw()})};
 $('brandKitForm').onsubmit=async event=>{
  event.preventDefault();
  const m=getSelected(),captionStyle=$('brandPresetStyle').value,button=$('saveBrandKit');
  if(button.disabled)return;
  button.disabled=true;
  $('brandStatus').textContent='Saving preset…';
  try{
   if($('brandUseClip').checked&&!m)throw Error('Open a clip to copy its look, or clear the checkbox.');
   await requestJson('/api/brands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('brandKitName').value,captionStyle,look:cleanCaptionLook($('brandUseClip').checked?m.captionLook:{},captionStyle)})});
   $('brandKitName').value='';
   const refreshed=await list();
   $('brandStatus').textContent=refreshed?'Preset saved. Choose it from Saved brand styles in Studio.':'Preset saved. Reopen Context Desk to reload your presets.';
  }catch(error){$('brandStatus').textContent=error.message}
  finally{button.disabled=false}
 };
 function sync(m){const look=cleanCaptionLook(m.captionLook,m.captionStyle);for(const [id,key]of Object.entries(keys))$(id).value=look[key]}
 function open(){preview();renderList()}
 void list();return {sync,open};
}
