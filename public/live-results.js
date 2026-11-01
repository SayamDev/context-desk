import {mergeAnalysisCompletion} from './moment-results.js';

// Durable live capture results are reconciled once. Explicit manual reanalysis
// owns its own request token and always takes precedence over older live work.
export function mergeLiveAnalysisCompletion(current,completion){
  if(!current||!completion||typeof completion.id!=='string'||!completion.id||!completion.result||typeof completion.result!=='object'||Array.isArray(completion.result)||current.liveAnalysisApplied===completion.id||current.analysisToken)return current;
  const merged=mergeAnalysisCompletion(structuredClone(current),completion.baseline,structuredClone(completion.result));
  // Generic analysis clears review flags. A human-reviewed language is still
  // reviewed when its exact cues survived the merge unchanged; replacement
  // captions must be reviewed again.
  for(const [language,reviewed]of Object.entries(current.captionReviewed||{})){
    if(JSON.stringify(merged.captionCues?.[language])===JSON.stringify(current.captionCues?.[language]))merged.captionReviewed[language]=structuredClone(reviewed);
  }
  merged.liveAnalysisApplied=completion.id;
  return merged;
}
