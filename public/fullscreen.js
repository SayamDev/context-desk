// Studio preview fullscreen: the picture at full resolution with its play bar. The bar and the
// button fade while the picture plays and return on any mouse movement or key press.
// Open with the corner button, the Fullscreen button, a double-click on the picture, or F.
const expand='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const shrink='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
export function mountPreviewFullscreen({frame,transport,buttons=[],onChange=()=>{}}){
  if(!frame?.requestFullscreen)return {toggle(){}};
  const home=document.createComment('transport'),corner=document.createElement('button');transport.before(home);
  corner.type='button';corner.className='preview-fullscreen-toggle';frame.append(corner);
  // The picture takes focus in fullscreen, so Space plays and pauses instead of pressing the button again.
  if(!frame.hasAttribute('tabindex'))frame.tabIndex=-1;
  const isOn=()=>document.fullscreenElement===frame;
  const label=()=>{corner.innerHTML=isOn()?shrink:expand;corner.setAttribute('aria-label',isOn()?'Exit fullscreen (F or Esc)':'Fullscreen (F)');corner.title=corner.getAttribute('aria-label')};
  const toggle=()=>isOn()?document.exitFullscreen():frame.requestFullscreen({navigationUI:'hide'}).catch(()=>{});
  let idle=null;const wake=()=>{frame.classList.remove('is-idle');clearTimeout(idle);if(isOn())idle=setTimeout(()=>frame.classList.add('is-idle'),2500)};
  for(const button of [corner,...buttons])if(button)button.onclick=toggle;
  frame.addEventListener('dblclick',event=>{if(!event.target.closest('button,input,select,label'))toggle()});
  frame.addEventListener('pointermove',wake);
  document.addEventListener('fullscreenchange',()=>{if(isOn()){frame.append(transport);frame.focus({preventScroll:true});wake()}else{home.after(transport);frame.classList.remove('is-idle');clearTimeout(idle)}label();onChange(isOn())});
  document.addEventListener('keydown',event=>{
    if(isOn())wake();
    if(event.key.toLowerCase()!=='f'||event.metaKey||event.ctrlKey||event.altKey||document.body.dataset.workspace!=='edit'||/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'')||document.activeElement?.isContentEditable)return;
    event.preventDefault();toggle();
  });
  label();return {toggle};
}
