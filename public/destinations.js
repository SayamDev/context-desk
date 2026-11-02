// Export destination tiles and a post preview. Artwork is our own: the frame shape and the areas
// each app covers with its buttons and caption. Platform names are used descriptively; no platform
// logos (Meta's brand rules forbid showing Instagram/Facebook beside other networks, and logo packs
// need the account owner to accept each brand's terms). Posting is described as it really works.
// Safe areas on a 1080×1920 frame: TikTok from reformat.video's template; the others use bytecap.io's
// cross-platform box (900 × 1160 centred, bottom 484 px covered) (third-party measurements, see docs/research/2026-11-beginners-arabic-posting.md).
export const destinationInfo={
  tiktok:{frame:'9:16',safe:{top:108,bottom:320,left:60,right:120},length:'Vertical 9:16, 1080 × 1920',
    posting:'You post it: Export saves the file and opens TikTok’s upload page. Direct posting needs your own TikTok developer app, and posts stay private until TikTok audits that app.'},
  instagram:{frame:'9:16',safe:{top:276,bottom:484,left:90,right:90},length:'Vertical 9:16, 1080 × 1920',
    posting:'You post it: Export saves the file and opens Instagram. Direct publishing needs a professional (Business or Creator) account, a Meta app and Meta’s app review.'},
  facebook:{frame:'9:16',safe:{top:276,bottom:484,left:90,right:90},length:'3 to 90 seconds when published through Meta’s API',
    posting:'You post it: Export saves the file and opens Facebook Reels. Direct publishing only works for a Facebook Page with Meta’s permissions.'},
  shorts:{frame:'9:16',safe:{top:276,bottom:484,left:90,right:90},length:'Up to 3 minutes counts as a Short',
    posting:'You post it: Export saves the file and opens YouTube upload. Direct upload needs a Google Cloud project; until Google verifies it, uploads are private.'},
  youtube:{frame:'16:9',length:'Any length',posting:'You post it: Export saves the file and opens YouTube upload.'},
  custom:{frame:'yours',length:'Your own size and settings',posting:'Export saves the file to this computer.'}
};
const svg=(info)=>{
  if(info.frame==='16:9')return '<svg viewBox="0 0 64 40" aria-hidden="true"><rect x="2" y="4" width="60" height="34" rx="4" class="d-frame"/><rect x="6" y="8" width="52" height="26" rx="1" class="d-video"/></svg>';
  if(info.frame!=='9:16')return '<svg viewBox="0 0 64 40" aria-hidden="true"><rect x="10" y="6" width="44" height="30" rx="4" class="d-frame" stroke-dasharray="3 3"/></svg>';
  const s=info.safe,W=22,H=39,x=21,y=0.5,sx=v=>v/1080*W,sy=v=>v/1920*H;
  return `<svg viewBox="0 0 64 40" aria-hidden="true"><rect x="${x}" y="${y}" width="${W}" height="${H}" rx="3" class="d-frame"/><rect x="${x}" y="${y}" width="${W}" height="${sy(s.top)}" class="d-ui"/><rect x="${x}" y="${y+H-sy(s.bottom)}" width="${W}" height="${sy(s.bottom)}" class="d-ui"/><rect x="${x+W-sx(s.right)}" y="${y+sy(s.top)}" width="${sx(s.right)}" height="${H-sy(s.top)-sy(s.bottom)}" class="d-ui"/><rect x="${x+sx(s.left)}" y="${y+sy(s.top)}" width="${W-sx(s.left)-sx(s.right)}" height="${H-sy(s.top)-sy(s.bottom)}" class="d-safe"/></svg>`;
};
export function enhanceDestinations(select,{getFrame=()=>null,getCaption=()=>''}={}){
  if(!select||select.dataset.enhanced)return null;select.dataset.enhanced='destinations';
  const root=document.createElement('div');root.className='destinations';root.setAttribute('role','radiogroup');root.setAttribute('aria-label','Where will this be posted?');
  const tiles=[...select.options].map(option=>{const info=destinationInfo[option.value]||destinationInfo.custom,tile=document.createElement('button');tile.type='button';tile.className='destination';tile.setAttribute('role','radio');tile.dataset.value=option.value;
    tile.innerHTML=svg(info);tile.append(Object.assign(document.createElement('strong'),{textContent:option.textContent}),Object.assign(document.createElement('small'),{textContent:info.frame==='yours'?'Your settings':info.frame}));
    tile.onclick=()=>{if(select.value===option.value)return;select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));refresh()};return tile});
  const detail=document.createElement('div');detail.className='destination-detail';
  const phone=document.createElement('figure');phone.className='post-preview';const shot=document.createElement('img');shot.alt='Preview of your video in this frame';const overlay=document.createElement('div');overlay.className='post-preview-ui';overlay.setAttribute('aria-hidden','true');for(const side of ['top','bottom','right'])overlay.append(Object.assign(document.createElement('i'),{className:'ui-'+side}));
  const cap=document.createElement('figcaption');phone.append(shot,overlay,cap);
  const about=document.createElement('div');about.className='destination-about';
  const refreshButton=document.createElement('button');refreshButton.type='button';refreshButton.className='cd-btn cd-btn-sm cd-btn-ghost';refreshButton.textContent='Refresh preview';refreshButton.onclick=()=>refresh();
  detail.append(phone,about);root.append(...tiles,detail);
  function refresh(){
    const value=select.value,info=destinationInfo[value]||destinationInfo.custom;
    for(const tile of tiles)tile.setAttribute('aria-checked',String(tile.dataset.value===value));
    const vertical=info.frame==='9:16';phone.dataset.frame=vertical?'vertical':'wide';phone.hidden=info.frame==='yours';
    const frame=getFrame();if(frame)shot.src=frame;shot.hidden=!frame;
    // Shaded bands show where the app's buttons and caption sit; keep text inside the clear box.
    overlay.style.cssText=vertical&&info.safe?`--t:${info.safe.top/19.2}%;--b:${info.safe.bottom/19.2}%;--l:${info.safe.left/10.8}%;--r:${info.safe.right/10.8}%`:'';overlay.hidden=!(vertical&&info.safe);
    const text=getCaption().split('\n').filter(Boolean)[0]||'';cap.textContent=text?text.slice(0,90):'Your post caption appears here.';
    about.replaceChildren(Object.assign(document.createElement('h4'),{textContent:select.selectedOptions[0]?.textContent||''}),
      Object.assign(document.createElement('p'),{className:'destination-length',textContent:info.length}),
      Object.assign(document.createElement('p'),{className:'destination-posting',textContent:info.posting}),
      ...(vertical?[Object.assign(document.createElement('p'),{className:'destination-safe',textContent:'Shaded areas are covered by the app’s buttons and caption. Your subtitles stay in the clear area.'})]:[]),refreshButton);
  }
  select.after(root);select.closest('label')?.classList.add('destinations-label');refresh();return {refresh};
}
