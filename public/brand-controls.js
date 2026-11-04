import {drawCaptionFrame} from './caption-render.js';
import {captionStyleIds,captionStyles} from './caption-styles.js';
import {requestJson} from './projects.js';import {cleanCaptionLook,captionFonts} from './brand-kit.js';
export function createBrandControls({getSelected,edit,draw,navigate}){
 const $=id=>document.getElementById(id),panel=document.createElement('section');panel.className='brand-controls';panel.setAttribute('aria-label','Brand style');
 panel.innerHTML=`<h3>Your brand, every clip.</h3><label for="brandKitSelect">Saved brand styles<select id="brandKitSelect"><option value="">Custom style</option></select></label><div class="brand-fields"><label for="captionFont">Font<select id="captionFont">${captionFonts.map(font=>'<option>'+font+'</option>').join('')}</select></label><label for="captionPosition">Placement<select id="captionPosition"><option value="bottom">Bottom</option><option value="middle">Middle</option><option value="top">Top</option></select></label><label for="captionColor">Text colour<input id="captionColor" type="color" value="#ffffff"></label><label for="captionAccent">Highlight colour<input id="captionAccent" type="color" value="#caff45"></label><label for="captionBackground">Caption background<input id="captionBackground" type="color" value="#151419"></label><label for="captionScale">Caption size<input id="captionScale" type="range" min="0.7" max="1.5" step="0.05" value="1"></label></div><button id="manageBrandKits" type="button" class="cd-btn cd-btn-secondary">Manage Brand Kit</button>`;
 $('styleInspector').append(panel);
 $('manageBrandKits').onclick=()=>{const m=getSelected();if(m){$('brandPresetStyle').value=m.captionStyle;$('brandUseClip').checked=true;preview()}navigate('brand')};
 const page=$('brandKitPage');
 page.innerHTML=`<div class="brand-kit-editor"><h2>Create a preset</h2><form id="brandKitForm"><label>Preset name<input id="brandKitName" class="cd-input" maxlength="80" placeholder="e.g. My show" required></label><label>Caption style<select id="brandPresetStyle">${captionStyleIds.map(id=>'<option value="'+id+'">'+captionStyles[id].label+'</option>').join('')}</select></label><label><input id="brandUseClip" type="checkbox"> Use the open clip’s font, colours and placement</label><button id="saveBrandKit" class="cd-btn cd-btn-primary" type="submit">Save preset</button></form><p id="brandStatus" role="status"></p></div><figure class="brand-preview"><img src="/assets/story-paper.webp" width="900" height="900" alt=""><canvas id="brandPreviewCanvas" width="480" height="480" aria-label="Sample caption in the selected style">This is the moment.</canvas><figcaption>Sample caption</figcaption></figure><section class="brand-saved"><h2>Saved looks</h2><ul id="brandKitList"></ul></section>`;
 function preview(){
  const canvas=$('brandPreviewCanvas'),context=canvas.getContext('2d'),m=getSelected();
  const styleId=$('brandPresetStyle').value;
  context.clearRect(0,0,canvas.width,canvas.height);
  drawCaptionFrame(context,{cue:{start:0,end:2,text:'This is the moment.'},time:1,styleId,look:$('brandUseClip').checked?m?.captionLook:{position:'middle'}});
 }
 $('brandPresetStyle').onchange=preview;
 $('brandUseClip').onchange=preview;
 preview();
 let brands=[];
 async function list(){try{brands=(await requestJson('/api/brands')).brands;const chosen=$('brandKitSelect').value;$('brandKitSelect').replaceChildren(new Option('Custom style',''),...brands.map(brand=>new Option(brand.name,brand.id)));$('brandKitSelect').value=chosen;
 const entries=brands.map(brand=>{const li=document.createElement('li');li.textContent=brand.name+' · '+(captionStyles[brand.captionStyle]?.label||'Punch');return li});
 if(!entries.length){const li=document.createElement('li');li.textContent='Your saved presets will appear here.';entries.push(li)}
 $('brandKitList').replaceChildren(...entries);
 }catch(error){$('brandStatus').textContent=error.message}}
 const keys={captionFont:'font',captionPosition:'position',captionColor:'color',captionAccent:'accent',captionBackground:'background',captionScale:'scale'};
 for(const [id,key]of Object.entries(keys))$(id).oninput=()=>{const m=getSelected();if(!m)return;edit('brand-'+key,()=>{m.captionLook={...m.captionLook,[key]:key==='scale'?Number($(id).value):$(id).value};$('brandKitSelect').value='';draw()})};
 $('brandKitSelect').onchange=()=>{const brand=brands.find(brand=>brand.id===$('brandKitSelect').value),m=getSelected();if(!brand||!m)return;edit('brand-kit',()=>{m.captionStyle=brand.captionStyle==='karaoke'&&($('captionStyle').querySelector('[value=karaoke]')?.disabled)?'punch':brand.captionStyle;m.captionLook=structuredClone(brand.look);$('captionStyle').value=m.captionStyle;sync(m);draw()})};
 $('brandKitForm').onsubmit=async event=>{
  event.preventDefault();
  const m=getSelected(),captionStyle=$('brandPresetStyle').value,button=$('saveBrandKit');
  button.disabled=true;
  try{
   if($('brandUseClip').checked&&!m)throw Error('Open a clip to copy its look, or clear the checkbox.');
   await requestJson('/api/brands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('brandKitName').value,captionStyle,look:cleanCaptionLook($('brandUseClip').checked?m.captionLook:{},captionStyle)})});
   $('brandKitName').value='';await list();$('brandStatus').textContent='Preset saved. Choose it from Saved brand styles in Studio.';
  }catch(error){$('brandStatus').textContent=error.message}
  finally{button.disabled=false}
 };
 function sync(m){const look=cleanCaptionLook(m.captionLook,m.captionStyle);for(const [id,key]of Object.entries(keys))$(id).value=look[key]}
 void list();return {sync};
}
