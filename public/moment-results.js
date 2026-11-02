const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// A model response owns analysis fields. Human edits made since the request's
// baseline own editable fields. Request tokens prevent older responses winning.
export function mergeAnalysisCompletion(current,baseline,result){
  if(current.analysisToken&&result.analysisToken&&current.analysisToken!==result.analysisToken)return current;
  const merged={...current};for(const key of ['analysis','status','transcript','speechError','speechSource','detectedLanguage','timingSource','translationSource','sourceCaptionsVisible','error'])if(result[key]!==undefined)merged[key]=result[key];
  for(const key of ['hook','alternateHook','captionCues','captionLanguage','showCaptions','captionError'])if(result[key]!==undefined&&equal(current[key],baseline?.[key]))merged[key]=structuredClone(result[key]);
  merged.captionReviewed={};return merged;
}
