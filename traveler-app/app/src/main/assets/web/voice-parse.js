export const cleanSpeech=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

const filler=/\b(?:a|an|at|building|campus|could|find|go|hall|i|in|inside|located|me|museum|navigate|of|please|take|the|to|want)\b/g;
const compact=value=>cleanSpeech(value).replace(filler,' ').replace(/\s+/g,' ').trim();

function editDistance(a,b){
 const previous=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  let diagonal=previous[0];previous[0]=i;
  for(let j=1;j<=b.length;j++){
   const above=previous[j],cost=a[i-1]===b[j-1]?0:1;
   previous[j]=Math.min(previous[j]+1,previous[j-1]+1,diagonal+cost);diagonal=above;
  }
 }
 return previous[b.length];
}

function similarity(a,b){
 if(!a||!b)return 0;if(a===b)return 1;
 if((a.includes(b)||b.includes(a))&&Math.min(a.length,b.length)>=4)return .94;
 return 1-editDistance(a,b)/Math.max(a.length,b.length);
}

/** Rank a spoken phrase against canonical UI options without inventing new values. */
export function bestCatalogMatch(value,items,{aliases={},minimum=.5}={}){
 const spoken=cleanSpeech(value),focused=compact(value),spokenTokens=focused.split(' ').filter(Boolean);
 const ranked=items.map(item=>{
  const names=[item.id,item.name,...(aliases[item.id]||[])].filter(Boolean).map(cleanSpeech);
  let score=0;
  for(const name of names){
   const short=compact(name)||name;
   if(new RegExp(`(?:^| )${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?: |$)`).test(spoken))score=Math.max(score,.99);
   score=Math.max(score,similarity(focused,short));
   const nameTokens=short.split(' ').filter(Boolean);
   if(nameTokens.length&&spokenTokens.length){
    const matched=nameTokens.map(target=>Math.max(...spokenTokens.map(token=>similarity(token,target))));
    const coverage=matched.reduce((sum,n)=>sum+n,0)/matched.length;
    score=Math.max(score,coverage*(nameTokens.length===1?1:.92));
   }
  }
  return {item,confidence:Math.max(0,Math.min(1,score))};
 }).sort((a,b)=>b.confidence-a.confidence);
 const best=ranked[0],second=ranked[1];
 if(!best||best.confidence<minimum)return null;
 return {...best,ambiguous:Boolean(second&&best.confidence<.9&&best.confidence-second.confidence<.08)};
}

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
