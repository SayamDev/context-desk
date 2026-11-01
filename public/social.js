// Original export recipes, not claims of platform account connectivity.
export const socialPresets={
  custom:{label:'Custom export'},
  tiktok:{label:'TikTok',aspect:'portrait',quality:1080,format:'mp4',upload:'https://www.tiktok.com/tiktokstudio/upload',hint:'Vertical 9:16 · MP4 · 1080 × 1920'},
  instagram:{label:'Instagram Reels',aspect:'portrait',quality:1080,format:'mp4',upload:'https://www.instagram.com/',hint:'Vertical 9:16 · MP4 · 1080 × 1920'},
  facebook:{label:'Facebook Reels',aspect:'portrait',quality:1080,format:'mp4',upload:'https://www.facebook.com/reels/create/',hint:'Vertical 9:16 · MP4 · 1080 × 1920'},
  shorts:{label:'YouTube Shorts',aspect:'portrait',quality:1080,format:'mp4',upload:'https://www.youtube.com/upload',hint:'Vertical 9:16 · MP4 · 1080 × 1920 · up to 3 minutes',maxDuration:180},
  youtube:{label:'YouTube video',aspect:'landscape',quality:1080,format:'mp4',upload:'https://www.youtube.com/upload',hint:'Landscape 16:9 · MP4 · 1920 × 1080'}
};
export function socialExportIssue(destination,{duration,aspect,format,quality}){
  const preset=socialPresets[destination];if(!preset?.aspect)return '';
  if(preset.maxDuration&&duration>preset.maxDuration)return 'YouTube Shorts are up to 3 minutes. Shorten this edit or choose YouTube video.';
  if(aspect!==preset.aspect||format!==preset.format||Number(quality)!==preset.quality)return `Settings changed. Reapply the ${preset.label} preset or choose Custom export.`;
  return '';
}
export function socialHandoff(destination){const p=socialPresets[destination];return p?.upload?p:null}

// Length and posting guidance from viral.app's 2026 study of 3.3M public short videos
// (Oct 2025 to Aug 2026, medians, same-account comparisons). Guidance, not platform rules.
export const platformBenchmarks={
  tiktok:{median:16,longer:'1 to 3 minute TikToks reached 10x their account median more often (7.5%) than shorter ones (4.5 to 5.7%).'},
  instagram:{median:18,longer:'Reel length showed no effect on views within the same account.'},
  facebook:{median:22,longer:''},
  shorts:{median:19,longer:'Shorts over a minute got 0.81x the views of the same channel\'s shorter Shorts.',softCap:60}
};
export function lengthAdvice(destination,duration){
  const b=platformBenchmarks[destination];if(!b||!Number.isFinite(duration))return '';
  const label=socialPresets[destination].label,seconds=Math.round(duration);
  if(b.softCap&&duration>b.softCap)return `${seconds}s. ${b.longer} Consider trimming under ${b.softCap}s.`;
  return `${seconds}s · typical ${label} length is ${b.median}s, and about 7 in 10 are under 30s.${b.longer?' '+b.longer:''}`;
}
// Vertical exports share one spec (9:16, 1080 × 1920, MP4), so the same file can go to every short-form app.
export function crossPostTargets(destination){
  const vertical=Object.entries(socialPresets).filter(([,p])=>p.aspect==='portrait');
  return vertical.some(([key])=>key===destination)?vertical.filter(([key])=>key!==destination).map(([key,p])=>({key,label:p.label,upload:p.upload})):[];
}
// Instagram allows at most five hashtags per post (Dec 2025); posts with 6+ have all but disappeared elsewhere too.
export const hashtagLimit=5;
export function hashtagCount(text){return (String(text||'').match(/(^|\s)#[\p{L}\p{N}_]+/gu)||[]).length}
export function draftPostCaption(hook,tags=[]){const clean=String(hook||'').trim().replace(/\s+/g,' ');return [clean,tags.slice(0,hashtagLimit).map(t=>'#'+t.replace(/[^\p{L}\p{N}_]/gu,'')).filter(t=>t.length>1).join(' ')].filter(Boolean).join('\n\n')}
