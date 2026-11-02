// Canvas caption renderer: draws one frame of a cue from the shared style catalogue.
// Used by the editor preview, cover images and the style tiles, so a tile shows exactly
// what the preview and the export will show.
import {styleOf,captionSegments,layoutLines,fitFont,entrance,styleColours,dimColour} from './caption-styles.js';
import {captionFontSize,captionPlacement,cleanCaptionLook} from './brand-kit.js';
const ink='#111016';
export function drawCaptionFrame(context,{cue,time,styleId,look:rawLook,offset=0,accent=null,fontSize:fixedSize}){
  const style=styleOf(styleId),look=cleanCaptionLook(rawLook,styleId),segments=captionSegments(cue,styleId,{offset,keyword:accent?.keyword});
  const segment=segments.find(s=>time>=s.start&&time<s.end);if(!segment)return;
  const width=context.canvas.width,height=context.canvas.height,base=fixedSize||Math.round(captionFontSize(width,height,look)*style.size);
  const fontSize=fitFont(segment.words,{width,fontSize:base,style}),lines=layoutLines(segment.words,{width,fontSize,style}),colours=styleColours(style,look);
  const lineHeight=fontSize*1.15,blockHeight=lines.length*lineHeight,centerY=captionPlacement(look.position,height,blockHeight+fontSize*.4,width);
  const {scale,alpha}=entrance(segment.enter,time-segment.start),rtl=/[֐-ࣿ]/.test(cue.text);
  context.save();context.font=`${style.italic?'italic ':''}${style.weight} ${fontSize}px ${look.font},sans-serif`;context.textBaseline='middle';context.textAlign='left';context.lineJoin='round';
  context.translate(width/2,centerY);context.scale(scale,scale);context.globalAlpha=alpha;
  const space=context.measureText(' ').width,grow=w=>w.state==='active'&&style.active==='scale'?1.12:1;
  lines.forEach((indices,lineIndex)=>{
    const y=(lineIndex-(lines.length-1)/2)*lineHeight,words=indices.map(i=>segment.words[i]),widths=words.map(w=>context.measureText(w.text).width*grow(w)),total=widths.reduce((a,b)=>a+b,0)+space*(words.length-1);
    if(style.box==='line'){context.fillStyle=colours.box;context.globalAlpha=alpha*(style.boxColor==='black'?.85:.87);const pad=fontSize*.16;context.fillRect(-total/2-pad,y-lineHeight/2,total+pad*2,lineHeight);context.globalAlpha=alpha}
    let x=rtl?total/2:-total/2;
    words.forEach((w,i)=>{
      const wordWidth=widths[i],left=rtl?x-wordWidth:x;x=rtl?x-wordWidth-space:x+wordWidth+space;
      if(w.state==='future'&&style.future==='hide')return;
      context.save();context.translate(left,y);const s=grow(w);if(s!==1)context.scale(s,s);
      const lit=(w.state==='active'&&['color','fill','scale'].includes(style.active))||(w.state==='past'&&style.past==='accent')||w.keyword;
      let fill=style.hollow&&!(w.state==='active'&&style.active==='fill')?null:w.state==='future'&&style.future==='dim'?dimColour:lit?(style.box==='line'&&style.boxColor==='accent'?'#ffffff':colours.accent):colours.text;
      if(w.state==='active'&&style.active==='box'){context.strokeStyle=colours.accent;context.lineWidth=fontSize*.5;context.strokeText(w.text,0,0);fill=ink}
      else if(style.stroke&&!style.box){context.strokeStyle=style.hollow?colours.text:ink;context.lineWidth=fontSize*style.stroke*2;if(style.shadow){context.shadowColor='rgba(0,0,0,.65)';context.shadowOffsetX=context.shadowOffsetY=fontSize*style.shadow}context.strokeText(w.text,0,0);context.shadowColor='transparent'}
      if(fill){if(style.glow){context.shadowColor=colours.accent;context.shadowBlur=fontSize*.45}else if(style.shadow&&!style.stroke){context.shadowColor='rgba(0,0,0,.65)';context.shadowOffsetX=context.shadowOffsetY=fontSize*style.shadow}context.fillStyle=fill;context.fillText(w.text,0,0)}
      context.restore();
    });
  });
  if(accent?.emoji){context.font=`${Math.round(fontSize*1.25)}px "Noto Emoji"`;context.textAlign='center';context.fillStyle=style.box==='line'&&style.boxColor==='accent'?'#ffffff':colours.accent;context.fillText(accent.emoji,0,-blockHeight/2-fontSize*.75)}
  context.restore();
}
