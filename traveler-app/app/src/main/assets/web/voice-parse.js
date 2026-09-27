export const cleanSpeech=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function floorFromSpeech(value){
 const q=cleanSpeech(value);
 const digit=(q.match(/\bfloor\s*(\d{1,2})(?:st|nd|rd|th)?\b/)||q.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+floor\b/)||q.match(/^\s*(\d{1,2})(?:st|nd|rd|th)?\s*$/)||[])[1];
 if(digit!==undefined)return Number(digit);
 const words={basement:0,garden:0,ground:1,first:1,one:1,second:2,two:2,third:3,three:3,fourth:4,four:4,fifth:5,five:5,sixth:6,six:6,seventh:7,seven:7};
 const found=Object.entries(words).find(([word])=>new RegExp(`\\b${word}(?: floor| level)?\\b`).test(q));
 return found?found[1]:null;
}

export function floorOnlyRequest(value){
 const q=cleanSpeech(value);
 return floorFromSpeech(q)!==null&&!/\b\d{3,5}[a-z]?\b/.test(q)&&!/(bathroom|restroom|entrance|exit|elevator|stairs|lobby|library|auditorium|cafe|room)/.test(q);
}
