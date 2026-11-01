export const captionFonts=['Arial','Manrope','Verdana','Georgia'];
const colour=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value||'')?value.toLowerCase():fallback;
export function cleanCaptionLook(value={},style='punch'){
 const raw=value&&typeof value==='object'?value:{};
 return {font:captionFonts.includes(raw.font)?raw.font:'Arial',color:colour(raw.color,style==='highlight'?'#21162e':style==='pop'?'#e8ff76':'#ffffff'),accent:colour(raw.accent,'#caff45'),background:colour(raw.background,'#151419'),scale:Math.max(.7,Math.min(1.5,Number(raw.scale)||1)),position:['top','middle','bottom'].includes(raw.position)?raw.position:'bottom'};
}
export function assColour(hex,alpha='00'){const value=colour(hex,'#ffffff').slice(1);return '&H'+alpha+value.slice(4,6)+value.slice(2,4)+value.slice(0,2)}
export function captionFontSize(width,height,look){return Math.round(Math.min(width/12.8,height/13,58*(width/540))*cleanCaptionLook(look).scale)}
export function captionPlacement(position,height,blockHeight=0){return position==='top'?height*.1+blockHeight/2:position==='middle'?height/2:height-blockHeight/2-height*.055}
