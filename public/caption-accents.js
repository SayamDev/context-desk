// Caption accents: one emphasised keyword per line and an occasional emoji above it.
// Accents are keyed by the exact line text, so editing a line drops its accent instead
// of highlighting the wrong word.
const emojiPattern=/^\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*$/u;
export function cleanAccents(lines,raw){
  const out=[];let sinceEmoji=3;
  for(const item of Array.isArray(raw)?raw:[]){
    const line=lines[item?.index];if(typeof line!=='string')continue;
    const keyword=String(item.keyword||'').trim(),emoji=String(item.emoji||'').trim();
    const hasKeyword=keyword.length>=2&&keyword.length<=30&&line.includes(keyword),useEmoji=emojiPattern.test(emoji)&&sinceEmoji>=2;
    if(!hasKeyword&&!useEmoji){sinceEmoji++;continue}
    out.push({text:line,...(hasKeyword?{keyword}:{}),...(useEmoji?{emoji}:{})});sinceEmoji=useEmoji?0:sinceEmoji+1;
  }
  return out;
}
export function accentFor(moment,text){if(!moment?.showAccents)return null;return (moment.captionAccents?.[moment.captionLanguage]||[]).find(a=>a.text===text)||null}
// Splits a line around its keyword so a renderer can colour the middle part.
export function splitKeyword(text,keyword){const at=keyword?text.indexOf(keyword):-1;return at<0?null:[text.slice(0,at),keyword,text.slice(at+keyword.length)]}
