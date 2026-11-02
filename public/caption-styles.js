// One caption-style catalogue for the canvas preview, the style tiles and the FFmpeg/ASS
// export. Everything a style does is decided here as plain data plus `captionSegments`,
// so preview and export show the same words, colours and timing at every moment.
//
// Style fields
//   weight 400-900 · upper/lower case · size (x base) · italic
//   stroke (outline, x font size) · shadow (x font size) · glow (accent blur, neon)
//   box: 'line' draws a box behind each line ('accent' | 'background' | 'black')
//   chunk: words shown at once (0 = whole line)
//   active: how the word being spoken stands out ('color' | 'box' | 'scale' | 'fill' | 'none')
//   future: words not yet spoken ('show' | 'dim' | 'hide') · past: spoken words ('normal' | 'accent')
//   enter: animation when a line or chunk appears ('none' | 'pop' | 'fade')
//   hollow: outline-only letters (the active word fills in)
export const captionStyles={
  punch:{label:'Punchy',weight:900,upper:true,stroke:.16,active:'color',color:'#ffffff',sample:'Nobody saw it'},
  hormozi:{label:'Bold 3-word',weight:900,upper:true,stroke:.18,chunk:3,active:'color',accent:'#ffd400',enter:'pop',sample:'This changes everything'},
  beast:{label:'Big 2-word',weight:900,upper:true,size:1.18,stroke:.22,shadow:.06,chunk:2,active:'scale',accent:'#3cff6a',enter:'pop',sample:'Wait for it'},
  single:{label:'One word',weight:900,upper:true,size:1.4,stroke:.2,chunk:1,active:'none',enter:'pop',sample:'Unbelievable'},
  wordbox:{label:'Word box',weight:800,stroke:.12,chunk:4,active:'box',accent:'#ff5a1f',sample:'They actually said it'},
  karaoke:{label:'Karaoke',weight:800,stroke:.12,future:'dim',past:'accent',active:'color',sample:'And then she left'},
  pop:{label:'Pop',weight:900,stroke:.14,chunk:3,active:'scale',color:'#e8ff76',enter:'pop',sample:'Wait what?!'},
  typewriter:{label:'Typewriter',weight:700,stroke:.12,future:'hide',sample:'Here is what happened'},
  comic:{label:'Comic',weight:900,italic:true,stroke:.2,shadow:.08,color:'#ffe14d',enter:'pop',sample:'No way!'},
  neon:{label:'Neon',weight:700,glow:true,accent:'#59d0f5',enter:'fade',sample:'Lights on'},
  outline:{label:'Outline',weight:900,upper:true,hollow:true,stroke:.07,shadow:.04,active:'fill',sample:'Say that again'},
  highlight:{label:'Highlight',weight:800,box:'line',boxColor:'accent',color:'#21162e',sample:'They actually said it'},
  clean:{label:'Clean',weight:600,box:'line',boxColor:'background',sample:'That was the moment.'},
  boxed:{label:'Boxed',weight:600,box:'line',boxColor:'black',color:'#ffffff',sample:'Speaker 2: no way'},
  fade:{label:'Fade',weight:700,stroke:.12,enter:'fade',sample:'Fading in, line by line.'},
  cinema:{label:'Subtitle',weight:500,size:.82,shadow:.05,sample:'I never said that.'},
  minimal:{label:'Minimal',weight:500,lower:true,size:.86,shadow:.04,sample:'quietly, it worked'}
};
export const captionStyleIds=Object.keys(captionStyles);
export const styleOf=id=>({chunk:0,active:'none',future:'show',past:'normal',enter:'none',stroke:0,shadow:0,size:1,...(captionStyles[id]||captionStyles.punch)});

// Word timings: real ASR words when present, otherwise spread over the line by length
// (marked estimated) so word-by-word styles work on every track, including translations.
export function wordTimes(cue,offset=0){
  const real=(cue.words||[]).filter(w=>w&&String(w.text||'').trim()&&Number.isFinite(w.start)&&Number.isFinite(w.end));
  const rows=String(cue.text||'').trim().split('\n'),text=rows.flatMap(row=>row.trim().split(/\s+/).filter(Boolean));
  if(real.length&&real.length===text.length&&rows.length===1)return real.map((w,i)=>({text:text[i],start:Math.max(cue.start,w.start+offset),end:Math.min(cue.end,w.end+offset)}));
  const weights=text.map(w=>w.length+2),total=weights.reduce((a,b)=>a+b,0)||1,span=cue.end-cue.start;let at=cue.start;
  // Rows after the first start with br, so two-speaker subtitles keep one row per speaker.
  const breaks=new Set();rows.reduce((n,row)=>{if(n)breaks.add(n);return n+row.trim().split(/\s+/).filter(Boolean).length},0);
  return text.map((t,i)=>{const start=at;at+=span*weights[i]/total;return {text:t,start,end:at,estimated:true,...(breaks.has(i)?{br:true}:{})}});
}
const display=(style,text)=>style.upper?text.toLocaleUpperCase():style.lower?text.toLocaleLowerCase():text;
// Deterministic line breaking shared by both renderers (character budget, not pixels),
// so preview and export break lines at the same words.
export function layoutLines(words,{width,fontSize,style}){
  const budget=charBudget(width,fontSize,style),lines=[[]];let used=0;
  words.forEach((w,i)=>{const n=w.text.length;if(lines.at(-1).length&&(w.br||used+1+n>budget)){lines.push([]);used=0}lines.at(-1).push(i);used+=(used?1:0)+n});
  return lines;
}
const charBudget=(width,fontSize,style)=>Math.max(4,Math.floor(width*.86/(fontSize*(style.upper?.66:.54)*(style.weight>=800?1.05:1))));
// Fits the font so a chunk needs at most three lines and its longest word fits the width.
export function fitFont(words,{width,fontSize,style}){const longest=Math.max(...words.map(w=>w.text.length),1);let size=fontSize;while(size>12&&(layoutLines(words,{width,fontSize:size,style}).length>3||longest>charBudget(width,size,style)))size-=1;return size}

// Constant-look time slices for one cue: within a segment nothing changes except the
// entrance animation, so the export can emit one subtitle event per segment and the
// preview can draw any frame by finding its segment.
export function captionSegments(cue,styleId,{offset=0,keyword=''}={}){
  const style=styleOf(styleId),words=wordTimes(cue,offset).map(w=>({...w,text:display(style,w.text)}));if(!words.length)return [];
  // Multi-row subtitles (two speakers) always show whole, so neither speaker's row is split up.
  const rowsForced=words.some(w=>w.br);
  const kw=display(style,keyword||'').trim(),chunks=[];const size=rowsForced?words.length:(style.chunk||words.length);
  for(let i=0;i<words.length;i+=size)chunks.push(words.slice(i,i+size));
  const perWord=style.active!=='none'||style.future!=='show'||style.past!=='normal',segments=[];
  chunks.forEach((chunk,c)=>{
    const chunkStart=c?chunk[0].start:cue.start,chunkEnd=chunks[c+1]?chunks[c+1][0].start:cue.end;
    const marks=perWord?chunk.map((w,i)=>i?w.start:chunkStart):[chunkStart];
    marks.forEach((start,k)=>{const end=marks[k+1]??chunkEnd;if(end-start<.01)return;
      segments.push({start,end,enter:k===0?style.enter:'none',last:k===marks.length-1&&c===chunks.length-1,
        words:chunk.map((w,i)=>({text:w.text,...(w.br?{br:true}:{}),state:!perWord?'normal':i<k?'past':i===k?'active':'future',keyword:Boolean(kw)&&w.text.replace(/[^\p{L}\p{N}']/gu,'')===kw.replace(/[^\p{L}\p{N}']/gu,'')}))})});
  });
  return segments;
}
// Entrance scale/opacity for a segment `elapsed` seconds in (same curve as the ASS tags).
export function entrance(enter,elapsed){
  const t=Math.max(0,Math.min(1,elapsed/.2));
  return enter==='pop'?{scale:1+.12*Math.pow(1-t,2),alpha:1}:enter==='fade'?{scale:1,alpha:Math.min(1,elapsed/.15)}:{scale:1,alpha:1};
}
// Unspoken karaoke words use a solid grey (not transparency) so outlines never show through.
export const dimColour='#8f8d97';
export const styleColours=(style,look)=>({text:look.color,accent:look.accent,box:style.boxColor==='accent'?look.accent:style.boxColor==='black'?'#000000':look.background});
