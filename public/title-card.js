// Clip title cards: a still from the clip with its title set in the design system's voice
// (Archivo 900, one volt word, the signal tag), sized for YouTube, Shorts/TikTok or a square post.
// The card draws on a canvas from the clip's own video frame; nothing leaves this computer.
export const titleCardLooks=[{id:'punch',name:'Punch'},{id:'signal',name:'Signal'},{id:'clean',name:'Clean'}];
export const titleCardSizes={'16:9':[1280,720],'9:16':[1080,1920],'1:1':[1080,1080]};
const ink='#f3f1ec',desk='#0b0b0d',signal='#ff5a1f',onSignal='#140904',volt='#c9f23b';
const display='"Archivo", "Arial Black", sans-serif',mono='"Geist Mono", ui-monospace, monospace';
const quiet=new Set('a an and are as at be but by for from has have he her his i in is it its me my no not of on or our she so that the their them they this to was we were what when who will with you your'.split(' '));

// The word a viewer should read first: the longest word that is not a filler word.
export function pickHighlight(title){
  const words=String(title||'').split(/\s+/).map(w=>w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'')).filter(Boolean);
  return words.filter(w=>!quiet.has(w.toLowerCase())).sort((a,b)=>b.length-a.length)[0]||words[0]||'';
}

// Greedy line breaking at a font size; returns null when a single word is wider than the box.
export function wrapTitle(measure,title,maxWidth){
  const lines=[];let line='';
  for(const word of String(title).split(/\s+/).filter(Boolean)){
    if(measure(word)>maxWidth)return null;
    const next=line?line+' '+word:word;
    if(measure(next)<=maxWidth)line=next;else{lines.push(line);line=word}
  }
  if(line)lines.push(line);return lines;
}

// Largest size (step 2px) at which the title fits in maxLines inside maxWidth.
function fitTitle(ctx,title,{maxWidth,maxLines,start,min,weight=900}){
  for(let size=start;size>=min;size-=2){
    ctx.font=`${weight} ${size}px ${display}`;
    const lines=wrapTitle(text=>ctx.measureText(text).width,title,maxWidth);
    if(lines&&lines.length<=maxLines)return {size,lines};
  }
  ctx.font=`${weight} ${min}px ${display}`;return {size:min,lines:(wrapTitle(text=>ctx.measureText(text).width,title,maxWidth)||[title]).slice(0,maxLines)};
}

// Draws a frame to fill the box, cropping around focusX (0-100) like the clip's own framing.
function cover(ctx,frame,x,y,w,h,focusX=50){
  const fw=frame.videoWidth||frame.width,fh=frame.videoHeight||frame.height;if(!fw||!fh)return;
  const scale=Math.max(w/fw,h/fh),sw=w/scale,sh=h/scale,sx=Math.max(0,Math.min(fw-sw,fw*focusX/100-sw/2)),sy=(fh-sh)/2;
  ctx.drawImage(frame,sx,sy,sw,sh,x,y,w,h);
}

function words(ctx,line,x,y,highlight,base,accent){
  const target=highlight.toLowerCase();let cursor=x;
  for(const [i,word]of line.split(' ').entries()){
    const plain=word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'').toLowerCase();
    ctx.fillStyle=target&&plain===target?accent:base;const text=(i?' ':'')+word;ctx.fillText(text,cursor,y);cursor+=ctx.measureText(text).width;
  }
}

function tag(ctx,text,x,y,unit){
  if(!text)return;ctx.font=`500 ${Math.round(unit*1.15)}px ${mono}`;const label=text.toUpperCase(),pad=unit*.9,w=ctx.measureText(label).width+pad*2,h=unit*2.4;
  ctx.fillStyle=signal;roundRect(ctx,x,y,w,h,unit*.45);ctx.fill();ctx.fillStyle=onSignal;ctx.textBaseline='middle';ctx.fillText(label,x+pad,y+h/2+1);ctx.textBaseline='alphabetic';
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}

export function drawTitleCard(ctx,{frame,title,highlight=pickHighlight(title),label='',look='punch',focusX=50}){
  const {width:W,height:H}=ctx.canvas,unit=Math.min(W,H)/40,pad=unit*2.6,tall=H>W;
  ctx.save();ctx.fillStyle=desk;ctx.fillRect(0,0,W,H);ctx.letterSpacing='0px';
  const text=String(title||'').trim()||'Untitled clip';
  if(look==='signal'){
    const band=Math.round(H*(tall?.36:.4));if(frame)cover(ctx,frame,0,0,W,H-band,focusX);
    ctx.fillStyle=signal;ctx.fillRect(0,H-band,W,band);
    const fit=fitTitle(ctx,text.toUpperCase(),{maxWidth:W-pad*2,maxLines:3,start:Math.round(unit*(tall?5.2:4.6)),min:Math.round(unit*2)});
    ctx.font=`500 ${Math.round(unit*1.15)}px ${mono}`;ctx.fillStyle=onSignal;if(label)ctx.fillText(label.toUpperCase(),pad,H-band+pad*.9);
    ctx.font=`900 ${fit.size}px ${display}`;const lead=fit.size*.98,top=H-band+(band-lead*fit.lines.length)/2+fit.size*.82+(label?unit*.9:0);
    fit.lines.forEach((line,i)=>words(ctx,line,pad,top+i*lead,highlight.toUpperCase(),onSignal,ink));
  }else if(look==='clean'){
    if(frame)cover(ctx,frame,0,0,W,H,focusX);
    const fit=fitTitle(ctx,text,{maxWidth:W*(tall?.8:.62)-pad*2,maxLines:3,start:Math.round(unit*(tall?4.2:3.6)),min:Math.round(unit*1.8),weight:800});
    const lead=fit.size*1.08,boxW=Math.min(W-pad*2,Math.max(...fit.lines.map(l=>{ctx.font=`800 ${fit.size}px ${display}`;return ctx.measureText(l).width}))+pad*2),boxH=lead*fit.lines.length+pad*2+(label?unit*2.6:0);
    ctx.fillStyle='rgba(11,11,13,.9)';roundRect(ctx,pad,H-pad-boxH,boxW,boxH,unit);ctx.fill();
    ctx.fillStyle=volt;ctx.fillRect(pad*2,H-pad-boxH+pad*.9,unit*2.2,unit*.45);
    if(label){ctx.font=`500 ${Math.round(unit*1.1)}px ${mono}`;ctx.fillStyle='#a6a4ad';ctx.fillText(label.toUpperCase(),pad*2+unit*3,H-pad-boxH+pad*.9+unit*.5)}
    ctx.font=`800 ${fit.size}px ${display}`;const first=H-pad-boxH+pad+(label?unit*2.6:0)+fit.size*.85;
    fit.lines.forEach((line,i)=>words(ctx,line,pad*2,first+i*lead,highlight,ink,volt));
  }else{
    if(frame)cover(ctx,frame,0,0,W,H,focusX);
    const shade=ctx.createLinearGradient(0,H*.3,0,H);shade.addColorStop(0,'rgba(11,11,13,0)');shade.addColorStop(.55,'rgba(11,11,13,.72)');shade.addColorStop(1,'rgba(11,11,13,.95)');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
    const fit=fitTitle(ctx,text.toUpperCase(),{maxWidth:W-pad*2,maxLines:tall?4:3,start:Math.round(unit*(tall?5.6:5)),min:Math.round(unit*2.2)});
    ctx.font=`900 ${fit.size}px ${display}`;const lead=fit.size*.94,bottom=H-pad*(tall?2.4:1.1);
    fit.lines.forEach((line,i)=>words(ctx,line,pad,bottom-(fit.lines.length-1-i)*lead,highlight.toUpperCase(),ink,volt));
    tag(ctx,label,pad,pad,unit);
  }
  ctx.restore();
}

// Studio's Export tab: live preview, look, size, title, highlighted word, tag, and the actions.
// The card's settings live on the clip (titleCardSpec); a saved card becomes the clip's picture.
export function mountTitleCardPanel({panel,getMoment,video,defaultLabel,defaultTitle=()=>'',localTime,onChange,saveAsset,download,toast}){
  const section=document.createElement('section');section.className='title-card';section.setAttribute('aria-labelledby','titleCardHeading');
  section.innerHTML=`<div class="title-card-head"><h3 id="titleCardHeading">Title card</h3><p>A cover picture for the post: a frame from this clip with its title set big.</p></div>
    <canvas id="titleCardCanvas" class="title-card-canvas" role="img" aria-label="Title card preview"></canvas>
    <div class="title-card-looks" role="group" aria-label="Title card look">${titleCardLooks.map(l=>`<button type="button" class="cd-btn cd-btn-sm cd-btn-secondary" data-card-look="${l.id}" aria-pressed="false">${l.name}</button>`).join('')}</div>
    <div class="title-card-fields"><label>Size<select id="titleCardSize"><option value="16:9">16:9 · YouTube</option><option value="9:16">9:16 · Shorts, TikTok, Reels</option><option value="1:1">1:1 · Square post</option></select></label>
    <label>Title<input id="titleCardTitle" maxlength="90" dir="auto"></label>
    <label>Highlight<select id="titleCardHighlight"></select></label>
    <label>Tag<input id="titleCardLabel" maxlength="28" placeholder="Episode 32"></label></div>
    <div class="cd-row title-card-actions"><button type="button" id="titleCardFrame" class="cd-btn cd-btn-sm cd-btn-ghost">Use frame at playhead</button><button type="button" id="titleCardSave" class="cd-btn cd-btn-sm cd-btn-secondary">Use as clip picture</button><button type="button" id="titleCardDownload" class="cd-btn cd-btn-sm cd-btn-primary">Download PNG</button></div>
    <p class="title-card-status" id="titleCardStatus" role="status"></p>`;
  panel.prepend(section);
  const $=id=>section.querySelector('#'+id),canvas=$('titleCardCanvas'),still=document.createElement('canvas');let stillFor='',fontsReady=null,drawing=0;
  const spec=m=>{m.titleCardSpec??={look:'punch',size:'16:9',title:m.hook||m.postTitle||m.analysis?.hook||defaultTitle(),highlight:'',label:defaultLabel(),time:null};return m.titleCardSpec};
  // The still is copied from the editor's video when the card opens or on request, so the card never makes the player jump.
  function grab(m){if(video.readyState<2||!video.videoWidth)return false;still.width=video.videoWidth;still.height=video.videoHeight;still.getContext('2d').drawImage(video,0,0);stillFor=m.id;spec(m).time=localTime(m,video.currentTime);return true}
  async function draw(){
    const m=getMoment();if(!m)return;const s=spec(m),run=++drawing,[w,h]=titleCardSizes[s.size]||titleCardSizes['16:9'];
    fontsReady??=Promise.all(['900 64px Archivo','800 64px Archivo','500 20px "Geist Mono"'].map(f=>document.fonts?.load(f).catch(()=>{})));await fontsReady;if(run!==drawing)return;
    if(stillFor!==m.id)grab(m);canvas.width=w;canvas.height=h;canvas.style.aspectRatio=`${w}/${h}`;
    drawTitleCard(canvas.getContext('2d'),{frame:stillFor===m.id?still:null,title:s.title,highlight:s.highlight||pickHighlight(s.title),label:s.label,look:s.look,focusX:m.focusX??50});
    $('titleCardStatus').textContent=stillFor===m.id?'':'Play or seek the clip once to pick up its picture.';
  }
  function sync(){
    const m=getMoment();section.hidden=!m;if(!m)return;const s=spec(m);if(!s.title.trim()&&document.activeElement!==$('titleCardTitle'))s.title=m.hook||m.postTitle||m.analysis?.hook||defaultTitle();
    for(const b of section.querySelectorAll('[data-card-look]'))b.setAttribute('aria-pressed',String(b.dataset.cardLook===s.look));
    $('titleCardSize').value=s.size;if(document.activeElement!==$('titleCardTitle'))$('titleCardTitle').value=s.title;$('titleCardLabel').value=s.label;
    const options=[...new Set(s.title.split(/\s+/).map(w=>w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'')).filter(Boolean))];
    $('titleCardHighlight').innerHTML='<option value="">Automatic</option>'+options.map(w=>`<option>${w.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</option>`).join('')+'<option value="-">No highlight</option>';
    $('titleCardHighlight').value=s.highlight===' '?'-':s.highlight;void draw();
  }
  const edit=fn=>()=>{const m=getMoment();if(!m)return;fn(spec(m),m);onChange();sync()};
  section.addEventListener('click',event=>{const look=event.target.closest('[data-card-look]');if(look)edit(s=>{s.look=look.dataset.cardLook})()});
  $('titleCardSize').onchange=edit(s=>{s.size=$('titleCardSize').value});
  $('titleCardTitle').oninput=edit(s=>{s.title=$('titleCardTitle').value;if(s.highlight&&s.highlight!==' '&&!s.title.includes(s.highlight))s.highlight=''});
  $('titleCardHighlight').onchange=edit(s=>{const v=$('titleCardHighlight').value;s.highlight=v==='-'?' ':v});
  $('titleCardLabel').oninput=edit(s=>{s.label=$('titleCardLabel').value});
  $('titleCardFrame').onclick=()=>{const m=getMoment();if(!m)return;if(!grab(m)){toast('Wait for the clip preview to load, then try again.');return}onChange();void draw();toast('Title card picture updated from the playhead.')};
  const blob=type=>new Promise(resolve=>canvas.toBlob(resolve,type,.9));
  $('titleCardDownload').onclick=async()=>{const m=getMoment();if(!m)return;await draw();const file=await blob('image/png');if(file)download(file,`title-card-${spec(m).size.replace(':','x')}-${Math.floor(m.start)}.png`)};
  $('titleCardSave').onclick=async()=>{const m=getMoment();if(!m)return;const button=$('titleCardSave');button.disabled=true;try{await draw();const file=await blob('image/jpeg');if(!file)throw Error('The title card could not be drawn.');const saved=await saveAsset(file);m.titleCard=saved.url;onChange({picture:true});toast('Saved. This title card is now the clip’s picture in Clips.')}catch(error){toast(error.message||'The title card could not be saved.')}finally{button.disabled=false}};
  return {sync,draw,grabWhenReady(){const m=getMoment();if(m&&stillFor!==m.id&&grab(m))void draw()}};
}
