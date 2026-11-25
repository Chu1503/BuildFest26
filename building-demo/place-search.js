// Live place search shared by the website and the Android app.
// Renders an accessible combobox: results update on every keystroke, arrow keys move,
// Enter picks, Escape closes. Items are plain objects:
//   {id, title, subtitle, badge, kind, keywords}
// kind is one of room | bathroom | exit | elevator | entrance | building.

const norm=s=>String(s??'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const SYNONYMS={restroom:'bathroom',restrooms:'bathroom',bathroom:'bathroom',bathrooms:'bathroom',toilet:'bathroom',toilets:'bathroom',wc:'bathroom',washroom:'bathroom',loo:'bathroom',exit:'exit',exits:'exit',door:'exit',doors:'exit',out:'exit',leave:'exit',entrance:'entrance',entry:'entrance',lift:'elevator',lifts:'elevator',elevator:'elevator',elevators:'elevator'};

export const KIND_ICONS={
 room:'<path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21M3 21h18M14.5 12.5v.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
 bathroom:'<path d="M7 7.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Zm10 0a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM5 21v-6H3.8L5 10h4l1.2 5H9v6m6 0v-8h-1V9.5h6V13h-1v8M12 3v18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
 exit:'<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16l4-4-4-4M14 12H4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
 entrance:'<path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10m4-4 4-4-4-4m4 4H8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
 elevator:'<path d="M5.5 3h13A1.5 1.5 0 0 1 20 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3ZM9 10l3-3 3 3M9 14l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
 building:'<path d="M4 21V8l8-5 8 5v13M4 21h16M9 21v-5h6v5M9 11h.01M15 11h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
 recent:'<path d="M12 7v5l3 2M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
};
export const icon=(kind,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${KIND_ICONS[kind]||KIND_ICONS.room}</svg>`;

// Turns raw catalog labels ("B2550", "Lower bathrooms 1 · approach", "College Library · Floor 1 start")
// into names people would say out loud.
export function placeLabel(item,floorName=''){
 let name=String(item.name||'').replace(/\s*·\s*(?:mapped )?approach$/i,'').replace(/\s*·\s*exit$/i,'').trim();
 if(/\bstart$/i.test(name))name='Main entrance';
 if(/elevator lobby/i.test(name))name=name.split(' · ')[0];
 if(floorName&&name.toLowerCase().endsWith(' · '+floorName.toLowerCase()))name=name.slice(0,-(floorName.length+3));
 if(item.kind==='bathroom'){name=name.replace(/\bbathrooms?\b/i,'restrooms');if(floorName)name=name.replace(new RegExp('^'+floorName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s+','i'),'');if(/^restrooms?\b/i.test(name)||!name)name='Restrooms'+name.replace(/^restrooms?/i,'');name=name[0].toUpperCase()+name.slice(1);}
 if(/^[A-Z]?\d{3,5}[A-Z]?$/.test(name))name='Room '+name;
 return name;
}
export function placeKind(item){
 if(item.kind==='bathroom')return 'bathroom';
 if(item.kind==='exit')return 'exit';
 if(item.id==='entrance'||/entrance/i.test(item.name||''))return 'entrance';
 if(/^e\d+(?:-\d+)?$/.test(item.id)||/elevator/i.test(item.name||''))return 'elevator';
 return 'room';
}

function score(item,tokens,query){
 if(!tokens.length)return 1;
 let total=0;
 for(const t of tokens){
  const syn=SYNONYMS[t];
  if(syn&&(item.kind===syn||(syn==='exit'&&item.kind==='entrance'))){total+=70;continue;}
  if(item._title.startsWith(t))total+=55;
  else if((' '+item._title).includes(' '+t))total+=40;
  else if(item._title.includes(t))total+=22;
  else if((' '+item._extra).includes(' '+t))total+=14;
  else if(item._extra.includes(t))total+=6;
  else return 0;
 }
 if(item._title===query)total+=120;
 return total-item._title.length*.04;
}
function highlight(el,text,tokens){
 const lower=text.toLowerCase(),marks=[];
 for(const t of tokens){if(!t)continue;let at=-1;const re=new RegExp('(^|[^a-z0-9])'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));const m=re.exec(lower);if(m)at=m.index+m[1].length;else at=lower.indexOf(t);if(at>=0)marks.push([at,at+t.length]);}
 marks.sort((a,b)=>a[0]-b[0]);let pos=0;
 for(const [a,b] of marks){if(a<pos)continue;if(a>pos)el.append(text.slice(pos,a));const m=document.createElement('mark');m.textContent=text.slice(a,b);el.append(m);pos=b;}
 if(pos<text.length)el.append(text.slice(pos));
}

// Best matches for a free-text query (used by voice commands).
export function rankPlaces(items,text,limit=3){
 const query=norm(text),tokens=query?query.split(' '):[];if(!tokens.length)return [];
 return items.map(item=>({...item,_title:norm(item.title),_extra:norm([item.subtitle,item.badge,item.keywords,item.kind].join(' '))}))
  .map(item=>[score(item,tokens,query),item]).filter(([s])=>s>0).sort((a,b)=>b[0]-a[0]).slice(0,limit).map(([,item])=>item);
}

let uid=0;
export function createSearch(root,{items,onPick,suggestions,recentKey,emptyText='No matching places',limit=8}){
 const input=root.querySelector('input'),clear=root.querySelector('.search-clear'),list=document.createElement('ul'),id='search-list-'+(++uid);
 list.className='search-results';list.id=id;list.setAttribute('role','listbox');list.hidden=true;root.append(list);
 input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',id);input.autocomplete='off';input.spellcheck=false;
 let selected=null,shown=[],active=-1,indexed=null,source=null;
 const index=()=>{const all=items();if(all===source&&indexed)return indexed;source=all;indexed=all.map(item=>({...item,_title:norm(item.title),_extra:norm([item.subtitle,item.badge,item.keywords,item.kind].join(' '))}));return indexed;};
 const recents=()=>{if(!recentKey)return [];try{return JSON.parse(localStorage.getItem(recentKey())||'[]');}catch{return [];}};
 const remember=item=>{if(!recentKey)return;try{const ids=[item.id,...recents().filter(id=>id!==item.id)].slice(0,4);localStorage.setItem(recentKey(),JSON.stringify(ids));}catch{}};
 function row(item,tokens,i,recent){
  const li=document.createElement('li');li.id=id+'-'+i;li.setAttribute('role','option');li.className='search-option';li.dataset.kind=item.kind;
  li.innerHTML=icon(recent?'recent':item.kind,'search-option-icon');
  const text=document.createElement('span');text.className='search-option-text';const title=document.createElement('span');title.className='search-option-title';highlight(title,item.title,tokens);text.append(title);
  if(item.subtitle){const sub=document.createElement('span');sub.className='search-option-sub';sub.textContent=item.subtitle;text.append(sub);}
  li.append(text);
  if(item.badge){const badge=document.createElement('span');badge.className='search-option-badge';badge.textContent=item.badge;li.append(badge);}
  li.addEventListener('pointerdown',e=>e.preventDefault());li.addEventListener('click',()=>pick(item));
  return li;
 }
 function heading(text){const li=document.createElement('li');li.className='search-heading';li.setAttribute('role','presentation');li.textContent=text;return li;}
 function render(){
  const query=norm(input.value),tokens=query?query.split(' '):[],all=index();list.replaceChildren();shown=[];active=-1;
  if(!tokens.length||(selected&&input.value===selected.title)){
   const recentIds=recents(),recent=recentIds.map(r=>all.find(item=>item.id===r)).filter(Boolean);
   const extra=(suggestions?.()||[]).map(s=>all.find(item=>item.id===s)||s).filter(Boolean).filter(item=>!recent.includes(item));
   if(recent.length){list.append(heading('Recent'));for(const item of recent){list.append(row(item,[],shown.length,true));shown.push(item);}}
   const rest=(extra.length?extra:all).slice(0,limit-Math.min(recent.length,3));
   if(rest.length){list.append(heading(extra.length?'Suggested':'All places'));for(const item of rest){list.append(row(item,[],shown.length));shown.push(item);}}
  }else{
   const ranked=all.map(item=>[score(item,tokens,query),item]).filter(([s])=>s>0).sort((a,b)=>b[0]-a[0]).slice(0,limit).map(([,item])=>item);
   for(const item of ranked){list.append(row(item,tokens,shown.length));shown.push(item);}
   if(!ranked.length){const li=document.createElement('li');li.className='search-empty';li.setAttribute('role','presentation');li.textContent=emptyText;list.append(li);}
  }
  open();
 }
 function setActive(i){const options=list.querySelectorAll('.search-option');options[active]?.removeAttribute('aria-selected');active=shown.length?(i+shown.length)%shown.length:-1;const el=options[active];if(el){el.setAttribute('aria-selected','true');input.setAttribute('aria-activedescendant',el.id);el.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');}
 function open(){list.hidden=false;root.classList.add('open');input.setAttribute('aria-expanded','true');}
 function close(){list.hidden=true;root.classList.remove('open');input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
 function pick(item){selected=item;input.value=item.title;root.classList.toggle('filled',true);remember(item);close();input.blur();onPick(item);}
 input.addEventListener('focus',()=>{input.select();render();});
 input.addEventListener('input',()=>{root.classList.toggle('filled',!!input.value);render();});
 input.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'){e.preventDefault();if(list.hidden)render();setActive(active+1);}
  else if(e.key==='ArrowUp'){e.preventDefault();setActive(active-1);}
  else if(e.key==='Enter'){e.preventDefault();const item=shown[active>=0?active:0];if(item&&!list.hidden)pick(item);}
  else if(e.key==='Escape'){if(!list.hidden){e.preventDefault();close();input.value=selected?.title||'';}}
 });
 input.addEventListener('blur',()=>setTimeout(()=>{close();input.value=selected?.title||'';root.classList.toggle('filled',!!input.value);},120));
 clear?.addEventListener('pointerdown',e=>e.preventDefault());
 clear?.addEventListener('click',()=>{input.value='';root.classList.remove('filled');input.focus();render();});
 return {
  set(item){selected=item||null;if(document.activeElement!==input){input.value=item?.title||'';root.classList.toggle('filled',!!item);}},
  get value(){return selected;},
  refresh(){source=null;indexed=null;if(!list.hidden)render();},
  close,input
 };
}
