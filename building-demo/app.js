import {planRoute,cueFor,nodes,catalog} from './routing.js';
import {floors,selectBuilding,activeId,model} from './active-building.js';
import {places,outdoorRoute} from './campus.js';
import {BuildingViewer} from './viewer.js?v=6';
import {amenities,refreshAmenities,accessibility} from './amenities.js';
import {createSearch,rankPlaces} from './place-search.js';
import {destinationItems,sourceItems,routeSteps,stepGuide,headingAhead,maneuverSvg,maneuverKind,formatDistance,arrivalTime,floorLabel} from './nav-guide.js';

const $=id=>document.getElementById(id);
let viewer,path=[],steps=[],step=0,index=0,mode='overview',playing=false,progress=0,outdoor=false,journeyStarted=false,campusMap,routeLayer,last=0,lastKind='';
const floorName=floorLabel;
const options=(el,items,value)=>{
  el.replaceChildren(...items.map(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.name;return option;}));
  if(items.some(item=>String(item.id)===String(value)))el.value=value;
};
const destinations=()=>[...catalog.filter(item=>item.routable),...amenities.filter(item=>item.routable)];
const destKind=()=>$('destinationType').value==='emergency'?'exit':$('destinationType').value;
const cleanName=name=>name.replace(/\s*·\s*(?:mapped )?approach$/i,'');
const profile=()=>$('profile').value;
const routeOptions={avoidStairs:true,mode:'comfort'};

function populate(id,floor,preferred){
  let list=(id==='source'?catalog.filter(item=>item.routable):destinations()).filter(item=>item.floor===Number(floor));
  if(id==='destination')list=$('destinationType').value==='rooms'?list.filter(item=>!item.kind):list.filter(item=>item.kind===destKind());
  options($(id),list.map(item=>({...item,name:cleanName(item.name)})),preferred);
}

// ---- Search fields -------------------------------------------------------
let destItems=[],srcItems=[];
function refreshItems(){destItems=destinationItems();srcItems=sourceItems();fromSearch.refresh();toSearch.refresh();}
const buildingItems=places.map(p=>{const score=p.id==='morgridge'?95:p.score;return {id:p.id,title:p.name,subtitle:p.category||'Research & teaching',badge:score?`${score}`:'',kind:'building',keywords:p.details?.join(' ')||''};});
const buildingSearch=createSearch($('buildingSearch'),{items:()=>buildingItems,onPick:item=>{if(item.id!==$('buildingChoice').value){$('buildingChoice').value=item.id;changeBuilding();}},emptyText:'No mapped building with that name yet'});
const fromSearch=createSearch($('fromSearch'),{items:()=>srcItems,recentKey:()=>'gogo-recent-from-'+activeId,suggestions:()=>['entrance',...srcItems.filter(i=>i.kind==='entrance'&&i.id!=='entrance').map(i=>i.id),...srcItems.filter(i=>i.kind==='elevator').map(i=>i.id)],onPick:pickSource});
const toSearch=createSearch($('toSearch'),{items:()=>destItems,recentKey:()=>'gogo-recent-to-'+activeId,suggestions:()=>[...destItems.filter(i=>i.kind==='bathroom').slice(0,2),...destItems.filter(i=>i.kind==='exit').slice(0,1),...destItems.filter(i=>i.kind==='room').slice(0,5)].map(i=>i.id),onPick:pickDestination});

function pickSource(item){$('sourceFloor').value=String(item.floor);populate('source',item.floor,item.id);plan();}
function pickDestination(item){
  $('destinationType').value=item.kind==='bathroom'?'bathroom':item.kind==='exit'?'exit':'rooms';
  $('destFloor').value=String(item.floor);populate('destination',item.floor,item.id);plan();
}
function syncSearches(){
  fromSearch.set(srcItems.find(i=>i.id===$('source').value));
  toSearch.set(destItems.find(i=>i.id===$('destination').value));
  buildingSearch.set(buildingItems.find(i=>i.id===$('buildingChoice').value));
  for(const chip of document.querySelectorAll('#quickChips .chip'))chip.setAttribute('aria-pressed','false');
}
function nearest(kind){
  const from=$('source').value;let best=null;
  for(const item of destItems.filter(i=>i.kind===kind)){
    const target=amenities.find(a=>a.id===item.id)?.routeId||item.id;
    const result=planRoute(from,target,profile(),'normal',routeOptions);
    if(result.path.length&&(!best||result.distance<best.distance))best={item,distance:result.distance};
  }
  return best?.item;
}
for(const chip of document.querySelectorAll('#quickChips .chip'))chip.onclick=()=>{
  const item=nearest(chip.dataset.quick);
  if(!item){showPreview(chip.dataset.quick==='bathroom'?'No restroom is mapped in this building yet.':'Nothing like that is mapped here yet.',true);return;}
  toSearch.set(item);pickDestination(item);chip.setAttribute('aria-pressed','true');
};
$('swap').onclick=()=>{
  const dest=destItems.find(i=>i.id===$('destination').value),src=srcItems.find(i=>i.id===$('source').value);if(!dest||!src)return;
  const amenity=amenities.find(a=>a.id===dest.id),newSource=srcItems.find(i=>i.id===(amenity?.routeId||dest.id));
  const newDest=destItems.find(i=>i.id===src.id)||destItems.find(i=>i.kind==='exit'&&amenities.find(a=>a.id===i.id)?.routeId===src.id);
  if(!newSource||!newDest)return;
  $('sourceFloor').value=String(newSource.floor);populate('source',newSource.floor,newSource.id);pickDestination(newDest);
};
for(const button of document.querySelectorAll('#profileButtons button'))button.onclick=()=>{$('profile').value=button.dataset.profile;$('profile').onchange();};
function syncProfileButtons(){for(const button of document.querySelectorAll('#profileButtons button'))button.setAttribute('aria-pressed',String(button.dataset.profile===profile()));}

function showPreview(text,error=false){const el=$('routePreview');el.classList.toggle('error',error);el.textContent=text;}
function renderPreview(){
  if(!path.length){showPreview(destKind()==='bathroom'?'No restroom is mapped on this floor.':'No step-free route to that place yet. Try another destination.',true);return;}
  const g=stepGuide(path,steps,0,profile()),floorsUsed=new Set(path.map(id=>nodes[id].floor)).size;
  const el=$('routePreview');el.classList.remove('error');
  el.innerHTML=`<strong>${g.minutes} min</strong><span class="dot"></span>${formatDistance(g.total)}<span class="dot"></span>${floorsUsed>1?`${floorsUsed} floors · elevator`:'Same floor'}`;
  const amenity=amenities.find(a=>a.id===$('destination').value),note=$('placeNote');
  const text=amenity?.kind==='exit'?'This is a mapped building entrance, not a verified emergency evacuation route. In an emergency, follow posted signs and staff directions.':amenity?.kind==='bathroom'?'The route ends at the closest mapped point to the restrooms. Follow signs for the last few metres.':'';
  note.hidden=!text;note.querySelector('span').textContent=text;
}
function scoreFacts(){
  const count=kind=>destItems.filter(i=>i.kind===kind).length;
  const facts=[`${floors.length} floor${floors.length===1?'':'s'} mapped`,`${count('room')} rooms and places`,`${count('elevator')} elevator lobb${count('elevator')===1?'y':'ies'}`,`${count('bathroom')} restroom area${count('bathroom')===1?'':'s'}`,`${count('exit')} step-free entrance${count('exit')===1?'':'s'}`];
  $('scoreFacts').replaceChildren(...facts.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  const [value]=accessibility(activeId).score.split(' / ');$('accessibilityScore').innerHTML=`${value}<small> / 100</small>`;
}

// ---- Speech --------------------------------------------------------------
function stopSpeech(){if(window.GoGoNative)window.GoGoNative.stopSpeech();else window.speechSynthesis?.cancel();}
function currentCue(){return path.length?cueFor(path,index,profile()):{text:'Choose a route.',detail:''};}
function speak(){
  if(!$('voice').checked||profile()==='deaf'||!path.length)return;
  const text=$('instruction').textContent;
  if(window.GoGoNative)window.GoGoNative.speak(text);
  else if(window.speechSynthesis){stopSpeech();speechSynthesis.speak(new SpeechSynthesisUtterance(text));}
}

// ---- Map modes -------------------------------------------------------------
function setMode(next){
  mode=next;
  viewer?.setMode(next);
  for(const [id,value] of [['overview','overview'],['pov','pov'],['keyboard','manual']])$(id).classList.toggle('selected',next===value);
  $('walkHint').hidden=next!=='manual';
  if(next==='manual')viewer?.renderer.domElement.focus();
  setHeading();
}
function setHeading(){
  const yaw=headingAt(index)??headingAt(index-1);
  if(viewer&&mode==='pov'&&yaw!==null&&!viewer.glide){viewer.yaw=yaw;viewer.pitch=viewer.povPitch;}
}
const destinationTitle=()=>destItems.find(i=>i.id===$('destination').value)?.title||'';

const headingAt=i=>headingAhead(path,i);
function moveViewer(from,animate){
  const node=nodes[path[index]];if(!viewer||!node)return;
  viewer.setProgress?.(index);
  const yaw=headingAt(index)??headingAt(index-1);
  if(animate&&mode==='pov'&&from!==index&&from!=null){
    const a=Math.min(from,index),b=Math.max(from,index),points=path.slice(a,b+1).map(id=>nodes[id].p);if(from>index)points.reverse();
    viewer.view=String(node.floor);viewer.glideAlong(points,yaw);
  }else{viewer.setPosition(node.p);viewer.view=String(node.floor);if(mode==='pov'&&yaw!==null){viewer.yaw=yaw;viewer.pitch=viewer.povPitch??0;}}
  viewer.updateVisibility();
}
function renderCue(animate=false,from=null){
  if(!path.length){
    $('instruction').textContent='Choose a destination';$('navDistance').textContent='';$('navIcon').innerHTML=maneuverSvg('arrive');$('navThen').hidden=true;
    $('tripEta').textContent='–';$('tripMeta').textContent='No route';$('tripBar').style.width='0';$('tripDest').textContent='';$('tripFloor').textContent='';
    $('next').disabled=true;$('prev').disabled=true;return;
  }
  index=steps[step]?.i??0;
  const node=nodes[path[index]],g=stepGuide(path,steps,step,profile(),destinationTitle());
  $('cueMeta').textContent=`${floorName(node.floor)} · ${step+1} / ${steps.length}`;
  $('instruction').textContent=g.text;
  $('navDistance').textContent=g.arrived?floorName(node.floor):`${floorName(node.floor)} · step ${step+1} of ${steps.length-1}`;
  $('navIcon').innerHTML=maneuverSvg(g.kind);
  const banner=$('navBanner');banner.classList.toggle('arrived',g.arrived);
  if(lastKind!==g.kind+step){banner.classList.remove('changed');void banner.offsetWidth;banner.classList.add('changed');lastKind=g.kind+step;}
  $('navThen').hidden=!g.next;if(g.next){$('navThenIcon').innerHTML=maneuverSvg(maneuverKind(g.next));$('navThenText').textContent=g.leg>=1?`In ${formatDistance(g.leg)}, ${g.next[0].toLowerCase()+g.next.slice(1)}`:g.next;}
  $('tripEta').textContent=g.arrived?'Arrived':`${g.minutes} min`;
  $('tripMeta').textContent=g.arrived?'':`${formatDistance(g.meters)} · arrive ${arrivalTime(g.seconds)}`;
  $('tripBar').style.width=`${Math.round(g.progress*100)}%`;
  $('tripDest').textContent=destinationTitle();$('tripFloor').textContent=floorName(nodes[path.at(-1)].floor);
  $('next').disabled=false;$('next').textContent=g.arrived?'Finish':'Next step';$('prev').disabled=step===0;
  moveViewer(from,animate);
  $('floorSelect').value=String(node.floor);
}

function plan(){
  stopSpeech();playing=false;progress=0;index=0;step=0;
  const destination=amenities.find(item=>item.id===$('destination').value)?.routeId||$('destination').value;
  path=!$('source').value||!destination?[]:planRoute($('journeyType').value==='outdoor'?'entrance':$('source').value,destination,profile(),'normal',{avoidStairs:$('stepfree').checked,mode:'comfort'}).path;
  steps=routeSteps(path,profile());
  viewer?.setRoute(path);
  const start=nodes[$('journeyType').value==='outdoor'?'entrance':$('source').value];
  if(start){viewer?.setPosition(start.p);viewer&&(viewer.view=String(start.floor));$('floorSelect').value=String(start.floor);viewer?.updateVisibility();}
  $('start').disabled=!path.length;
  $('formStatus').textContent=path.length?'':destKind()==='bathroom'?'No bathroom mapped on this floor.':'No step-free route to that place. Try another floor.';
  syncSearches();renderPreview();
  renderCue();
  if(!journeyStarted&&viewer){viewer.view='all';viewer.zoom=floors.length>=6?.75:.82;$('floorSelect').value='all';viewer.updateVisibility();}
}

function refreshFloorControls(){
  const floorItems=floors.map(f=>({id:f.id,name:f.name}));
  options($('sourceFloor'),floorItems);
  options($('destFloor'),floorItems);
  options($('liftFloor'),floorItems);
  options($('floorSelect'),[{id:'all',name:'All floors'},...floorItems],'all');
}

function changeBuilding(){
  path=[];index=0;playing=false;progress=0;journeyStarted=false;
  selectBuilding($('buildingChoice').value);
  refreshAmenities();refreshItems();
  viewer?.loadBuilding();
  refreshFloorControls();
  const preferred=catalog.find(item=>item.id===(model()?.defaultRoom||'space-2-Library')&&item.routable)||catalog.find(item=>item.routable&&item.id!=='entrance')||catalog.find(item=>item.routable);
  $('sourceFloor').value=String(nodes.entrance.floor);
  $('destFloor').value=String(preferred.floor);
  $('destinationType').value='rooms';
  scoreFacts();
  populate('source',nodes.entrance.floor,'entrance');
  populate('destination',preferred.floor,preferred.id);
  showJourney(false);
  plan();
  if(viewer){viewer.view='all';viewer.zoom=floors.length>=6?.75:.82;viewer.updateVisibility();}
  $('floorSelect').value='all';
}

function showOutdoor(){
  const route=outdoorRoute(activeId,profile(),'comfort');
  if(!campusMap){
    campusMap=L.map('outdoorMap');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).on('tileerror',()=>{$('tileStatus').hidden=false;}).addTo(campusMap);
    for(const place of places)L.circleMarker([place.lat,place.lng],{radius:8,color:'#0a0a0a',fillColor:'#f4c542',fillOpacity:1}).addTo(campusMap).bindTooltip(place.name);
  }
  if(routeLayer)routeLayer.remove();
  if(route){routeLayer=L.polyline(route.points,{color:'#f4c542',weight:6}).addTo(campusMap);requestAnimationFrame(()=>{campusMap.invalidateSize();campusMap.fitBounds(routeLayer.getBounds(),{padding:[35,35],maxZoom:17});});}
  $('instruction').textContent=`Head to ${places.find(place=>place.id===activeId)?.name||'the building'}`;
  $('next').textContent='Enter building';
  $('next').disabled=!route;
}

function setStage(isOutdoor){
  outdoor=isOutdoor;
  $('campusJourney').hidden=!outdoor;
  $('scene').hidden=outdoor;
  document.querySelector('.views').hidden=outdoor;
  if(outdoor)showOutdoor();
  else{renderCue();requestAnimationFrame(()=>viewer?.resize());}
}
function showJourney(on){
  journeyStarted=on;document.body.classList.toggle('navigating',on);
  $('back').hidden=!on;$('navThen').classList.toggle('show',on);
}
function endRoute(){
  showJourney(false);playing=false;stopSpeech();index=0;step=0;setStage(false);setMode('overview');
  if(viewer){viewer.view='all';viewer.zoom=floors.length>=6?.75:.82;viewer.updateVisibility();}
  $('floorSelect').value='all';renderCue();
}

function advance(){
  if(outdoor){setStage(false);setMode('pov');speak();return;}
  if(step+1>=steps.length){endRoute();return;}
  const from=index;step++;renderCue(true,from);speak();
}

// ---- Site menu (small screens) ------------------------------------------------
$('appMenu').onclick=()=>{const header=document.querySelector('.app-header'),open=header.classList.toggle('open');$('appMenu').setAttribute('aria-expanded',String(open));$('appMenu').setAttribute('aria-label',open?'Close menu':'Open menu');};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.app-header.open'))$('appMenu').click();});

// ---- Start -----------------------------------------------------------------
options($('buildingChoice'),places.map(place=>({id:place.id,name:place.name})),'morgridge');
const params=new URLSearchParams(location.search);
if(places.some(p=>p.id===params.get('building')))$('buildingChoice').value=params.get('building');
selectBuilding($('buildingChoice').value);
refreshAmenities();
try{
  viewer=new BuildingViewer($('scene'),()=>{},near=>{if(!near)return;$('liftFloor').value=String(viewer.floor);$('liftDialog').showModal();});
}catch(error){$('renderError').hidden=false;console.error(error);}
try{const saved=localStorage.getItem('gogo-profile');if([...$('profile').options].some(o=>o.value===saved))$('profile').value=saved;}catch{}
syncProfileButtons();
changeBuilding();

for(const [id,value] of [['overview','overview'],['pov','pov'],['keyboard','manual']])$(id).onclick=()=>{if(value!=='overview'&&!journeyStarted)showJourney(true);setStage(false);setMode(value);if(value!=='overview')renderCue();};
$('back').onclick=endRoute;
$('start').onclick=()=>{plan();if(!path.length)return;showJourney(true);setStage($('journeyType').value==='outdoor');if(!outdoor){setMode('pov');renderCue();speak();}if(matchMedia('(max-width:900px)').matches)$('journey').scrollIntoView({behavior:'smooth',block:'start'});};
$('next').onclick=advance;
$('prev').onclick=()=>{if(outdoor||step===0)return;const from=index;step--;renderCue(true,from);speak();};
$('repeat').onclick=()=>{if(!outdoor)speak();};
$('floorSelect').onchange=()=>{setMode('overview');viewer&&(viewer.view=$('floorSelect').value);viewer?.updateVisibility();};
$('buildingChoice').onchange=changeBuilding;
$('journeyType').onchange=()=>{plan();};
$('sourceFloor').onchange=()=>{populate('source',$('sourceFloor').value,'e'+$('sourceFloor').value);plan();};
$('destFloor').onchange=()=>{populate('destination',$('destFloor').value);plan();};
for(const id of ['source','destination','stepfree'])$(id).onchange=plan;
$('profile').onchange=()=>{$('stepfree').checked=true;$('voice').checked=true;syncProfileButtons();try{localStorage.setItem('gogo-profile',profile());}catch{}plan();};
$('voice').onchange=()=>{if(!$('voice').checked)stopSpeech();};
$('rideLift').onclick=()=>{viewer?.useElevator(Number($('liftFloor').value));$('floorSelect').value=String(viewer.floor);$('liftDialog').close();};
$('closeLift').onclick=()=>$('liftDialog').close();
document.addEventListener('keydown',e=>{if(!journeyStarted||mode==='manual'||e.target.closest?.('input,select,textarea'))return;if(e.key==='ArrowRight'){e.preventDefault();advance();}if(e.key==='ArrowLeft'){e.preventDefault();$('prev').click();}});

// Deep links: index.html?building=union&from=entrance&to=room1-1&view=pov
{
  const from=srcItems.find(i=>i.id===params.get('from')),to=destItems.find(i=>i.id===params.get('to'));
  if(from)pickSource(from);if(to)pickDestination(to);
  const view={pov:'pov',explore:'keyboard',building:'overview'}[params.get('view')];
  if(params.get('start')==='1'&&path.length){$('start').click();const n=Number(params.get('step'));if(n>0){step=Math.min(n,steps.length-1);renderCue();}}
  if(view&&view!=='pov')$(view).click();
}

function frame(time){
  const dt=Math.min(.1,(time-last)/1000||0);last=time;
  if(!outdoor)viewer?.tick(dt,profile());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;stopSpeech();}});

// ---- Installed app (iPhone / Android home screen) -----------------------------------
const standalone=document.documentElement.classList.contains('standalone');
if('serviceWorker' in navigator&&!window.GoGoNative&&(location.protocol==='https:'||location.hostname==='localhost'))
  addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
{
  const dismissed=()=>{try{return localStorage.getItem('gogo-install-dismissed')==='1';}catch{return false;}};
  const hide=()=>{$('installCard').hidden=true;try{localStorage.setItem('gogo-install-dismissed','1');}catch{}};
  const ios=document.documentElement.classList.contains('ios'),phone=matchMedia('(max-width:1000px)').matches;
  if(ios&&!standalone&&phone&&!dismissed())$('installCard').hidden=false;
  let deferred=null;
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;if(standalone||dismissed())return;$('installText').textContent='Add GoGo to your home screen. It opens full screen and works offline.';$('installButton').hidden=false;$('installCard').hidden=false;});
  $('installButton').onclick=async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice.catch(()=>{});deferred=null;hide();};
  $('installClose').onclick=hide;
  addEventListener('appinstalled',hide);
}

// ---- Voice commands (where the browser supports speech recognition) ----------------
{
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognizer=null,toastTimer=0;
  const toast=(text,ms=3200)=>{clearTimeout(toastTimer);$('voiceToast').textContent=text;$('voiceToast').hidden=false;if(ms)toastTimer=setTimeout(()=>{$('voiceToast').hidden=true;},ms);};
  const say=text=>{toast(text);if(profile()==='deaf'||!$('voice').checked)return;if(window.speechSynthesis){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(text));}};
  const clean=t=>t.toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
  function command(raw){
    const q=clean(raw);
    if(!q){say('Sorry, I did not catch that.');return;}
    if(/^(next|next step|continue|go on)$/.test(q)){if(path.length){if(!journeyStarted)$('start').click();else advance();}return;}
    if(/^(back|previous|go back|previous step)$/.test(q)){$('prev').click();return;}
    if(/^(repeat|again|say again|say that again|what now)$/.test(q)){if(path.length)say($('instruction').textContent);return;}
    if(/^(stop|end|end route|cancel|finish)$/.test(q)){endRoute();say('Route ended.');return;}
    if(/^(start|go|lets go|start navigation)$/.test(q)){$('start').click();return;}
    const quick=/(restroom|bathroom|toilet|washroom)/.test(q)?'bathroom':/\bexit|way out\b/.test(q)?'exit':/\b(elevator|lift)\b/.test(q)?'elevator':null;
    if(quick&&/(nearest|closest|find|where|need|take me|go to)/.test(q)||quick&&q.split(' ').length<=2){document.querySelector(`#quickChips [data-quick="${quick}"]`).click();if(path.length){say(`Route to ${destinationTitle()}.`);$('start').click();}return;}
    const target=q.replace(/^(please |ok |okay )?(take me to|navigate to|directions to|go to|get me to|find|where is|show me|i need|i want to go to)\s+/,'').replace(/\b(the|please|room)\b/g,' ').trim();
    const [best]=rankPlaces(destItems,target,1);
    if(!best){say(`I couldn't find ${target} in this building.`);return;}
    pickDestination(best);
    if(path.length){say(`Going to ${best.title}.`);$('start').click();}else say(`There's no step-free route to ${best.title} yet.`);
  }
  if(Recognition){
    const button=$('voiceButton');button.hidden=false;
    button.onclick=()=>{
      if(recognizer){recognizer.abort();return;}
      recognizer=new Recognition();recognizer.lang=navigator.language||'en-US';recognizer.interimResults=false;recognizer.maxAlternatives=1;
      recognizer.onstart=()=>{button.setAttribute('aria-pressed','true');toast('Listening… try "take me to the library" or "next"',0);};
      recognizer.onresult=e=>{const text=e.results[0][0].transcript;toast(`"${text}"`);command(text);};
      recognizer.onerror=e=>toast(e.error==='not-allowed'||e.error==='service-not-allowed'?'Allow microphone access to use voice commands.':'Sorry, I did not catch that.');
      recognizer.onend=()=>{button.setAttribute('aria-pressed','false');recognizer=null;};
      try{recognizer.start();}catch{recognizer=null;toast('Voice commands are not available right now.');}
    };
  }
}
