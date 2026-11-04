// Meta Muse Voice languageBias values, verified against official speech docs.
export const speechLanguages=['Arabic','Bengali','Dutch','English','French','German','Hebrew','Hindi','Indonesian','Italian','Japanese','Kannada','Korean','Malay','Mandarin Chinese','Marathi','Polish','Portuguese','Spanish','Tagalog','Tamil','Telugu','Thai','Turkish','Vietnamese'];
export function languageBias(value){const choices=Array.isArray(value)?value:String(value||'').split(',');return [...new Set(choices.map(s=>String(s).trim()).filter(s=>speechLanguages.includes(s)))].slice(0,3)}
export const languageCodes = {Arabic:'ar',Bengali:'bn',Dutch:'nl',English:'en',French:'fr',German:'de',Hebrew:'he',Hindi:'hi',Indonesian:'id',Italian:'it',Japanese:'ja',Kannada:'kn',Korean:'ko',Malay:'ms','Mandarin Chinese':'zh',Marathi:'mr',Polish:'pl',Portuguese:'pt',Spanish:'es',Tagalog:'tl',Tamil:'ta',Telugu:'te',Thai:'th',Turkish:'tr',Vietnamese:'vi',Urdu:'ur'};
export function speechCode(value){
  const label=String(value||'').trim().toLowerCase();
  return Object.entries(languageCodes).find(([name])=>name.toLowerCase()===label)?.[1]
    || label.match(/^([a-z]{2})(?:[-_][a-z0-9]{2,8})*$/)?.[1] || '';
}
export function needsTranslation(output,detected){
  return output!=='Original'&&(!speechCode(detected)||speechCode(output)!==speechCode(detected));
}
export const dialectExamples=['Modern Standard Arabic','Egyptian Arabic','Levantine Arabic','Gulf Arabic','Iraqi Arabic','Moroccan Darija','Algerian Arabic','Tunisian Arabic','Sudanese Arabic','Yemeni Arabic','British English','American English','Indian English','Québécois French','Brazilian Portuguese','Mexican Spanish'];
export const translationModes={faithful:'Faithful · preserve wording and ambiguity',natural:'Natural · fluent, same meaning',concise:'Caption concise · shorter, same meaning'};
export function normalizeTranslationMode(mode){return Object.hasOwn(translationModes,mode)?mode:'faithful'}
