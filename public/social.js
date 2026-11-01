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
