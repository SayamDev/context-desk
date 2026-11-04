// Caption languages, their regional variants and script rules. Shared by the browser
// (variant pickers) and the server (translation guidance and output checks).
// Each guide states concrete conventions a translator must follow for that audience.

export const captionVariants={
  English:[
    {id:'en-US',label:'American English',guide:'US spelling (color, organize, center), US vocabulary (apartment, truck, fall, soccer), dates month/day, double quotation marks.'},
    {id:'en-GB',label:'British English',guide:'UK spelling (colour, organise, centre, travelling), UK vocabulary (flat, lorry, autumn, football, mobile), dates day/month, single quotation marks.'},
    {id:'en-AU',label:'Australian English',guide:'UK-based spelling (colour, organise), Australian vocabulary where natural (arvo, servo, thongs = flip-flops) but do not force slang the speaker did not use.'},
    {id:'en-IN',label:'Indian English',guide:'UK-based spelling; keep lakh and crore as spoken; keep Indian English idiom and code-switched Hindi words the speaker used, unexplained.'}
  ],
  Spanish:[
    {id:'es-ES',label:'Spain',guide:'Castilian Spanish: vosotros for plural you, ordenador, móvil, coche, zumo, vale; leísmo acceptable for people.'},
    {id:'es-MX',label:'Mexico',guide:'Mexican Spanish: ustedes (never vosotros), computadora, celular, carro, jugo, platicar; avoid "coger" in its Spain sense.'},
    {id:'es-AR',label:'Argentina / Uruguay',guide:'Rioplatense Spanish with voseo: vos tenés, vos sabés, ustedes for plural; celular, auto, che only where the tone allows.'},
    {id:'es-CO',label:'Colombia',guide:'Colombian Spanish: ustedes, celular, carro; usted is common even between friends, keep it when the speaker uses it.'},
    {id:'es-US',label:'US Hispanic (neutral)',guide:'Neutral Latin American Spanish understood across US Hispanic audiences: ustedes, celular, carro; no regional slang.'}
  ],
  Portuguese:[
    {id:'pt-BR',label:'Brazil',guide:'Brazilian Portuguese: você, a gente, ônibus, celular, trem; progressive with gerund (estou fazendo); pronoun before the verb is natural (me disse).'},
    {id:'pt-PT',label:'Portugal',guide:'European Portuguese: tu or você by formality, autocarro, telemóvel, comboio; progressive with a + infinitive (estou a fazer); enclisis (disse-me).'}
  ],
  French:[
    {id:'fr-FR',label:'France',guide:'Metropolitan French: soixante-dix, quatre-vingt-dix; week-end, mail; vous for strangers.'},
    {id:'fr-CA',label:'Québec',guide:'Québécois French: courriel, magasiner, char (car) only if casual, fin de semaine; tu is common; keep Québec swear words and expressions the speaker used.'},
    {id:'fr-BE',label:'Belgium / Switzerland',guide:'Belgian and Swiss French: septante, nonante (Swiss also huitante); déjeuner = lunch, dîner = dinner.'},
    {id:'fr-AF',label:'West & Central Africa',guide:'African French as used in Côte d\'Ivoire, Senegal, Cameroon: keep local expressions and loanwords the speaker used; standard spelling.'}
  ],
  Arabic:[
    {id:'ar-MSA',label:'Modern Standard (Fusha)',guide:'Modern Standard Arabic for pan-Arab audiences; neutral vocabulary; Arabic punctuation (، ؛ ؟).'},
    {id:'ar-EG',label:'Egyptian',guide:'Egyptian colloquial written as Egyptians type it: إيه، ليه، عايز، كده، دلوقتي، مش، بتاع; ج pronounced g is still written ج.'},
    {id:'ar-LEV',label:'Levantine',guide:'Levantine colloquial (Syria, Lebanon, Jordan, Palestine): شو، ليش، بدي، هلق/هلأ، كتير، منيح، مش/مو.'},
    {id:'ar-GULF',label:'Gulf',guide:'Gulf colloquial (Saudi, UAE, Kuwait, Qatar): وش/ايش، ليش، أبي/أبغى، الحين، زين، وايد (Kuwait/UAE).'},
    {id:'ar-IQ',label:'Iraqi',guide:'Iraqi colloquial: شنو، ليش، أريد/أريدن، هسه، هواية، زين.'},
    {id:'ar-MA',label:'Moroccan Darija',guide:'Moroccan Darija in Arabic script: شنو/أش، علاش، بغيت، دابا، بزاف، واخا; keep French loanwords the speaker used.'},
    {id:'ar-DZ',label:'Algerian Darja',guide:'Use Algerian Arabic in Arabic script. Respect local variation and preserve intentional French code-switching.'},
    {id:'ar-TN',label:'Tunisian Derja',guide:'Use Tunisian Arabic in Arabic script. Respect local variation and preserve intentional French code-switching.'},
    {id:'ar-LY',label:'Libyan',guide:'Use Libyan colloquial Arabic. Follow the editor’s regional hint if provided.'},
    {id:'ar-SD',label:'Sudanese',guide:'Use Sudanese colloquial Arabic. Follow the editor’s regional hint if provided.'},
    {id:'ar-YE',label:'Yemeni',guide:'Use Yemeni colloquial Arabic. Follow the editor’s regional hint if provided.'}
  ],
  'Mandarin Chinese':[
    {id:'zh-CN',label:'Mainland (Simplified)',guide:'Simplified characters, Mainland vocabulary (软件, 视频, 信息, 出租车), full-width Chinese punctuation.'},
    {id:'zh-TW',label:'Taiwan (Traditional)',guide:'Traditional characters, Taiwan vocabulary (軟體, 影片, 資訊, 計程車), full-width punctuation 「」 quotes.'}
  ],
  Cantonese:[
    {id:'yue-HK',label:'Hong Kong (written Cantonese)',guide:'Written Cantonese in Traditional characters as typed in Hong Kong: 係、唔、咗、嘅、佢、乜嘢、點解; keep English code-switching the speaker used.'}
  ],
  German:[
    {id:'de-DE',label:'Germany',guide:'Standard German (Germany): ß where required, Januar, Tschüss.'},
    {id:'de-AT',label:'Austria',guide:'Austrian German: Jänner, heuer, Paradeiser and Erdäpfel only where natural; ß kept.'},
    {id:'de-CH',label:'Switzerland',guide:'Swiss Standard German: never ß (write ss), Velo, parkieren, Grüezi; Swiss quotation marks « ».'}
  ],
  Dutch:[
    {id:'nl-NL',label:'Netherlands',guide:'Netherlands Dutch: jij/jullie, informal register common.'},
    {id:'nl-BE',label:'Flemish (Belgium)',guide:'Belgian Dutch: gij/ge only if the speaker uses it, Flemish vocabulary (goesting, plezant) where spoken.'}
  ],
  Hindi:[{id:'hi-IN',label:'Hindi (India)',guide:'Everyday spoken Hindi, not Sanskritised formal Hindi; keep English words the speaker used (phone, office, sorry) as they are.'}],
  Urdu:[{id:'ur-PK',label:'Urdu (Pakistan)',guide:'Pakistani Urdu in Nastaliq-compatible Urdu script, right to left; keep English loanwords the speaker used.'}],
  Bengali:[
    {id:'bn-BD',label:'Bangladesh',guide:'Bangladeshi Bengali: পানি, গোসল, দাওয়াত where natural.'},
    {id:'bn-IN',label:'West Bengal (India)',guide:'West Bengal Bengali: জল, স্নান, নিমন্ত্রণ where natural.'}
  ],
  Tamil:[
    {id:'ta-IN',label:'Tamil Nadu',guide:'Spoken Tamil as used in Tamil Nadu media; keep English words the speaker used.'},
    {id:'ta-LK',label:'Sri Lanka',guide:'Sri Lankan Tamil vocabulary and phrasing where it differs from Tamil Nadu.'}
  ],
  Telugu:[{id:'te-IN',label:'Telugu (India)',guide:'Everyday spoken Telugu; keep English words the speaker used.'}],
  Kannada:[{id:'kn-IN',label:'Kannada (India)',guide:'Everyday spoken Kannada; keep English words the speaker used.'}],
  Marathi:[{id:'mr-IN',label:'Marathi (India)',guide:'Everyday spoken Marathi; keep English words the speaker used.'}],
  Turkish:[{id:'tr-TR',label:'Türkiye',guide:'Standard Turkish with correct dotted and dotless i (İ/i, I/ı); sen/siz by the speaker\'s formality.'}],
  Italian:[{id:'it-IT',label:'Italy',guide:'Standard Italian; tu/Lei by the speaker\'s formality.'}],
  Polish:[{id:'pl-PL',label:'Poland',guide:'Standard Polish with correct diacritics (ą ę ł ń ó ś ź ż); Pan/Pani for formal address.'}],
  Japanese:[
    {id:'ja-casual',label:'Casual (タメ口)',guide:'Natural casual Japanese for friends and streamers; no forced keigo.'},
    {id:'ja-polite',label:'Polite (です・ます)',guide:'Polite desu/masu register throughout.'}
  ],
  Korean:[
    {id:'ko-polite',label:'Polite (해요체)',guide:'Polite haeyo-che register throughout (요 endings), as Korean streamers address viewers.'},
    {id:'ko-casual',label:'Casual (반말)',guide:'Casual banmal between friends and streamers; no 요 endings unless the speaker used them.'}
  ],
  Indonesian:[{id:'id-ID',label:'Indonesia',guide:'Conversational Indonesian (gue/lo only if the speaker uses Jakarta slang); not Malaysian Malay.'}],
  Malay:[{id:'ms-MY',label:'Malaysia',guide:'Malaysian Malay (kereta, bas, awak/kau); not Indonesian.'}],
  Tagalog:[{id:'tl-PH',label:'Philippines (Taglish ok)',guide:'Conversational Tagalog; keep English code-switching (Taglish) where the speaker used it.'}],
  Vietnamese:[
    {id:'vi-N',label:'Northern (Hà Nội)',guide:'Northern Vietnamese vocabulary (bố, mẹ, ô tô, thìa).'},
    {id:'vi-S',label:'Southern (Sài Gòn)',guide:'Southern Vietnamese vocabulary (ba, má, xe hơi, muỗng).'}
  ],
  Thai:[{id:'th-TH',label:'Thailand',guide:'Conversational Thai with the speaker\'s gender particles (ครับ/ค่ะ) kept as spoken; no spaces between words except at phrase breaks.'}],
  Hebrew:[{id:'he-IL',label:'Israel',guide:'Modern Israeli Hebrew without niqqud, right to left.'}]
};
export const captionLanguages=Object.keys(captionVariants);

// Romanised scripts people actually type, offered only where the audience uses them.
export const romanizations={Hindi:'Hinglish: Hindi written in Latin letters as typed in chats (kya, nahi, yaar)',Urdu:'Roman Urdu as typed in Pakistan (kya, nahi, acha)',Arabic:'Arabizi: Arabic in Latin letters with digits (3 = ع, 7 = ح, 2 = ء)',Bengali:'Banglish: Bengali in Latin letters',Tamil:'Tanglish: Tamil in Latin letters','Mandarin Chinese':'Pinyin with tone marks',Cantonese:'Jyutping',Japanese:'Romaji (Hepburn)',Korean:'Revised Romanization',Thai:'Royal Thai General System romanisation'};

export function defaultVariant(language){return captionVariants[language]?.[0]?.id||''}
export function findVariant(language,id){const list=captionVariants[language]||[];return list.find(v=>v.id===id)||list[0]||null}

// Instruction block sent with every translation request.
export function translationGuide(language,variantId,script='native'){
  const variant=findVariant(language,variantId);if(!variant)return '';
  const roman=script==='roman'&&romanizations[language];
  return `Write for ${variant.label} ${language} audiences. ${variant.guide}${roman?` Write the output in ${romanizations[language]}, not in the native script.`:''} Translate the meaning the way a native subtitle writer from this region would, never word for word, and never mix in conventions from other regions.`;
}

export const scripts={arabic:/[؀-ۿݐ-ݿ]/g,hebrew:/[֐-׿]/g,devanagari:/[ऀ-ॿ]/g,bengali:/[ঀ-৿]/g,tamil:/[஀-௿]/g,telugu:/[ఀ-౿]/g,kannada:/[ಀ-೿]/g,thai:/[฀-๿]/g,hangul:/[가-힯ᄀ-ᇿ]/g,kana:/[぀-ヿ]/g,han:/[一-鿿]/g,latin:/[A-Za-zÀ-ɏ]/g};
export const expected={Arabic:'arabic',Urdu:'arabic',Hebrew:'hebrew',Hindi:'devanagari',Marathi:'devanagari',Bengali:'bengali',Tamil:'tamil',Telugu:'telugu',Kannada:'kannada',Thai:'thai',Korean:'hangul',Japanese:'kana','Mandarin Chinese':'han',Cantonese:'han'};
// Characters that exist only in one Chinese script; a few of either is enough to tell.
const simplifiedOnly='们这说时会来对为发经过还见让认间问门马东车长开关头样实现学点话钱电国', traditionalOnly='們這說時會來對為發經過還見讓認間問門馬東車長開關頭樣實現學點話錢電國';
const count=(text,re)=>(text.match(re)||[]).length;

// Returns a plain-language warning when translated lines are in the wrong script or Chinese variant.
export function scriptIssue(language,lines,{variant,script='native'}={}){
  const text=lines.join(' '),letters=Object.values(scripts).reduce((n,re)=>n+count(text,re),0);if(letters<4)return '';
  const roman=script==='roman'&&romanizations[language],want=roman?'latin':expected[language]||'latin';
  const share=(want==='kana'?count(text,scripts.kana)+count(text,scripts.han):count(text,scripts[want]))/letters;
  if(share<.6)return roman?`Expected ${language} in Latin letters, but most of the text is in another script. Retranslate or edit.`:`Expected ${language} in its own script, but most of the text is not. Retranslate or edit.`;
  if((language==='Mandarin Chinese'||language==='Cantonese')&&!roman){
    const simp=[...text].filter(c=>simplifiedOnly.includes(c)).length,trad=[...text].filter(c=>traditionalOnly.includes(c)).length,traditional=variant==='zh-TW'||variant==='yue-HK';
    if(traditional&&simp>trad)return 'Expected Traditional characters, but the text uses Simplified ones. Retranslate or edit.';
    if(!traditional&&trad>simp)return 'Expected Simplified characters, but the text uses Traditional ones. Retranslate or edit.';
  }
  if(language==='German'&&variant==='de-CH'&&text.includes('ß'))return 'Swiss German never uses ß. Replace it with ss.';
  return '';
}

// Hesitation and filler words across caption languages. A line is filler-only when nothing else is said.
const fillers=['um','umm','uh','uhh','er','erm','ah','eh','hmm','mm','mhm','uh huh','like','you know','i mean','so','okay','ok',
  'este','eh','pues','o sea','bueno','é','tipo','né','então','euh','bah','ben','bon','quoi','äh','ähm','öhm','also','na ja','eh','ehm','allora','cioè','tipo',
  'yani','şey','ee','hani','yaani','yani','يعني','اه','امم','ايه','haan','matlab','acha','accha','toh','na','ano','eto','ett','あの','えっと','えー','음','어','그','那个','那個','嗯','呃','就是'];
const fillerSet=new Set(fillers);
export function isFillerOnly(text){
  const words=String(text||'').toLowerCase().normalize('NFKC').replace(/[\p{P}\p{S}]+/gu,' ').trim();if(!words)return false;
  let rest=` ${words} `;for(const f of [...fillerSet].sort((a,b)=>b.length-a.length))rest=rest.split(` ${f} `).join(' ');
  return !rest.trim();
}
