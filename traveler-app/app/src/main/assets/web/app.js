import {planRoute,cueFor,nodes,catalog} from './routing.js';
import {floors,selectBuilding,activeId,model} from './active-building.js';
import {places,outdoorRoute} from './campus.js';
import {BuildingViewer as Viewer2D} from './viewer-2d.js?v=0.15';
import {amenities,refreshAmenities,accessibility} from './amenities.js';
import {bestCatalogMatch,cleanSpeech as clean,floorFromSpeech,floorOnlyRequest} from './voice-parse.js';
import {createSearch} from './place-search.js';
import {destinationItems,sourceItems,routeSteps,stepGuide,headingAhead,maneuverSvg,maneuverKind,formatDistance,arrivalTime} from './nav-guide.js';
const $=id=>document.getElementById(id);
document.documentElement.classList.add('map2d');
let path=[],steps=[],step=0,shownIndex=null,lastKind='',index=0,screen='home',outdoorStage=false,campusMap,routeLayer;
// Map views: '2d' (flat canvas, default), '3d' (orbiting building model) and 'pov' (first person).
// The Three.js viewer is imported only when a 3D view is first chosen, so startup is unchanged,
// and any WebGL failure falls back to the 2D map.
const MAP_VIEWS=['2d','3d','pov'];
let viewer2d=null,viewer3d=null,loading3d=null,failed3d=false,mapView='2d',noteTimer=0,showAll3d=false;
const headingAt=i=>headingAhead(path,i)??(i>0?headingAhead(path,i-1):null);
function faceRoute(){if(!viewer3d||!path.length)return;const yaw=headingAt(index);if(yaw!==null){viewer3d.pitch=viewer3d.povPitch;viewer3d.turnTo(yaw);}}
function setShowAll3d(all){showAll3d=all;$('allFloors3d').setAttribute('aria-pressed',String(all));if(!viewer3d)return;viewer3d.setShowAll(all);const n=nodes[path[index]];viewer3d.view=all?'all':String(n?.floor??viewer3d.floor);viewer3d.updateVisibility();}
try{const saved=localStorage.getItem('gogo-map-view');if(MAP_VIEWS.includes(saved))mapView=saved;}catch{}
const activeViewer=()=>mapView!=='2d'&&viewer3d?viewer3d:viewer2d;
function ensure2D(){if(!viewer2d)viewer2d=new Viewer2D($('scene2d'),()=>{},()=>{});return viewer2d;}
function mapNote(text,ms=0){clearTimeout(noteTimer);$('mapNote').textContent=text||'';$('mapNote').hidden=!text;if(text&&ms)noteTimer=setTimeout(()=>{$('mapNote').hidden=true;},ms);}
function syncMapButtons(){for(const b of document.querySelectorAll('#mapViews button')){const view=b.dataset.view;b.setAttribute('aria-pressed',String(view===mapView));if(view!=='2d')b.disabled=failed3d;}}
function bindPinch(v){
 const layer=$('scene3d'),points=new Map();let span=0;
 layer.addEventListener('pointerdown',e=>{points.set(e.pointerId,[e.clientX,e.clientY]);span=0;},true);
 layer.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;points.set(e.pointerId,[e.clientX,e.clientY]);if(points.size<2)return;e.stopPropagation();if(v.mode!=='overview')return;const [a,b]=[...points.values()],next=Math.hypot(a[0]-b[0],a[1]-b[1]);if(span&&next)v.zoom=Math.max(.5,Math.min(1.8,v.zoom*span/next));span=next;},true);
 const end=e=>{points.delete(e.pointerId);span=0;};layer.addEventListener('pointerup',end,true);layer.addEventListener('pointercancel',end,true);
}
function fail3D(error){
 if(error)console.error(error);
 failed3d=true;loading3d=null;viewer3d=null;$('scene3d').hidden=true;
 mapNote('3D view is not available on this device. Showing the 2D map.',4000);
 mapView='2d';syncMapButtons();applyMapView();
}
function load3D(){
 if(viewer3d)return Promise.resolve(viewer3d);
 if(failed3d)return Promise.reject(Error('3D unavailable'));
 return loading3d??=import('./viewer-3d-mobile.js').then(({MobileBuildingViewer})=>{
  const v=new MobileBuildingViewer($('scene3d'),()=>{},()=>{});
  v.setShowAll(showAll3d);
  v.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  v.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(viewer3d===v)fail3D();});
  bindPinch(v);viewer3d=v;return v;
 }).catch(error=>{fail3D(error);throw error;});
}
function applyMapView(){
 const use3d=mapView!=='2d'&&!!viewer3d;
 $('scene2d').hidden=use3d;$('scene3d').hidden=!use3d;$('map3dControls').hidden=!(use3d&&mapView==='3d');$('povControls').hidden=!(use3d&&mapView==='pov');
 if(use3d)viewer3d.setMode(mapView==='pov'?'pov':'overview');else ensure2D().setMode('pov');
 if(screen==='journey'&&!outdoorStage&&path.length)renderCue(false);
 requestAnimationFrame(()=>activeViewer()?.resize());
}
function setMapView(view,save=true){
 if(!MAP_VIEWS.includes(view))return;
 if(view!=='2d'&&failed3d)view='2d';
 mapView=view;if(save)try{localStorage.setItem('gogo-map-view',view);}catch{}
 syncMapButtons();
 if(view==='2d'||viewer3d){mapNote('');applyMapView();return;}
 applyMapView();mapNote('Loading 3D view…');
 load3D().then(()=>{mapNote('');if(mapView===view)applyMapView();}).catch(()=>{});
}
function showOutdoor(){const r=outdoorRoute(activeId,$('profile').value,'comfort');if(!campusMap){campusMap=L.map('outdoorMap');L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).on('tileerror',()=>{$('tileStatus').hidden=false;}).addTo(campusMap);for(const p of places)L.circleMarker([p.lat,p.lng],{radius:8,color:'#173f4c',fillColor:'#72b9ac',fillOpacity:1}).addTo(campusMap).bindTooltip(p.name);L.circleMarker([43.0753,-89.3987],{radius:7,color:'#2779c4'}).addTo(campusMap).bindTooltip('Library Mall · starting point');}if(routeLayer)routeLayer.remove();routeLayer=L.polyline(r.points,{color:'#287d69',weight:6}).addTo(campusMap);requestAnimationFrame(()=>{campusMap.invalidateSize();campusMap.fitBounds(routeLayer.getBounds(),{padding:[35,35],maxZoom:17});});$('cueMeta').textContent='CAMPUS · DEMO ROUTE';$('instruction').textContent='Head to '+places.find(p=>p.id===activeId).name;$('detail').textContent=`Library Mall · approximately ${r.meters} m. Seeded accessibility-first route; follow local signs and conditions.`;$('next').textContent='Enter building';$('next').disabled=false;}
function stage(){ $('campusJourney').hidden=!outdoorStage;$('scene').hidden=outdoorStage;$('floorSelect').hidden=outdoorStage;if(outdoorStage)showOutdoor();else{ensure2D();setMapView(mapView,false);$('next').textContent='Next step';}}
const floorName=f=>floors.find(x=>x.id===f)?.name||`Floor ${f}`;
const options=(el,items,value)=>{el.replaceChildren(...items.map(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=x.name;return o;}));if(items.some(x=>String(x.id)===String(value)))el.value=value;};
function destinations(){return [...catalog.filter(c=>c.routable),...amenities.filter(c=>c.routable)];}
const destKind=()=>$('destinationType').value==='emergency'?'exit':$('destinationType').value;
const cleanName=name=>name.replace(/\s*·\s*(?:mapped )?approach$/i,'');
const syncDestinationField=()=>$('destinationField').hidden=$('destinationType').value!=='rooms';
function populate(id,f,preferred){let list=(id==='source'?catalog.filter(c=>c.routable):destinations()).filter(c=>c.floor===Number(f));if(id==='destination')list=$('destinationType').value==='rooms'?list.filter(c=>!c.kind):list.filter(c=>c.kind===destKind());options($(id),list.map(c=>({...c,name:cleanName(c.name)})),preferred);}

// ---- Search fields, quick picks and route preview (same look as the website) ----
let destItems=[],srcItems=[];
const buildingItems=places.map(p=>({id:p.id,title:p.name,subtitle:p.category||'Research & teaching',badge:p.score?String(p.score):'',kind:'building',keywords:p.details?.join(' ')||''}));
const buildingSearch=createSearch($('buildingSearch'),{items:()=>buildingItems,onPick:item=>{if(item.id!==$('buildingChoice').value){$('buildingChoice').value=item.id;changeBuilding();}},emptyText:'No mapped building with that name yet'});
const fromSearch=createSearch($('fromSearch'),{items:()=>srcItems,recentKey:()=>'gogo-recent-from-'+activeId,suggestions:()=>['entrance',...srcItems.filter(i=>i.kind==='entrance'&&i.id!=='entrance').map(i=>i.id),...srcItems.filter(i=>i.kind==='elevator').map(i=>i.id)],onPick:pickSource});
const toSearch=createSearch($('toSearch'),{items:()=>destItems,recentKey:()=>'gogo-recent-to-'+activeId,suggestions:()=>[...destItems.filter(i=>i.kind==='bathroom').slice(0,2),...destItems.filter(i=>i.kind==='exit').slice(0,1),...destItems.filter(i=>i.kind==='room').slice(0,5)].map(i=>i.id),onPick:pickDestination});
function refreshItems(){destItems=destinationItems();srcItems=sourceItems();fromSearch.refresh();toSearch.refresh();}
function pickSource(item){$('sourceFloor').value=item.floor;populate('source',item.floor,item.id);plan();}
function pickDestination(item){$('destinationType').value=item.kind==='bathroom'?'bathroom':item.kind==='exit'?'exit':'rooms';syncDestinationField();$('destFloor').value=item.floor;populate('destination',item.floor,item.id);plan();}
function syncSearches(){fromSearch.set(srcItems.find(i=>i.id===$('source').value));toSearch.set(destItems.find(i=>i.id===$('destination').value));buildingSearch.set(buildingItems.find(i=>i.id===$('buildingChoice').value));for(const chip of document.querySelectorAll('#quickChips .chip'))chip.setAttribute('aria-pressed','false');}
function nearestOf(kind){const from=$('source').value;let best=null;for(const item of destItems.filter(i=>i.kind===kind)){const target=amenities.find(a=>a.id===item.id)?.routeId||item.id,r=planRoute(from,target,$('profile').value,'normal',{avoidStairs:true,mode:'comfort'});if(r.path.length&&(!best||r.distance<best.distance))best={item,distance:r.distance};}return best?.item;}
for(const chip of document.querySelectorAll('#quickChips .chip'))chip.onclick=()=>{const item=nearestOf(chip.dataset.quick);if(!item){showPreview(chip.dataset.quick==='bathroom'?'No restroom is mapped in this building yet.':'Nothing like that is mapped here yet.',true);return;}pickDestination(item);chip.setAttribute('aria-pressed','true');};
$('swap').onclick=()=>{const dest=destItems.find(i=>i.id===$('destination').value),src=srcItems.find(i=>i.id===$('source').value);if(!dest||!src)return;const amenity=amenities.find(a=>a.id===dest.id),newSource=srcItems.find(i=>i.id===(amenity?.routeId||dest.id)),newDest=destItems.find(i=>i.id===src.id)||destItems.find(i=>i.kind==='exit'&&amenities.find(a=>a.id===i.id)?.routeId===src.id);if(!newSource||!newDest)return;$('sourceFloor').value=newSource.floor;populate('source',newSource.floor,newSource.id);pickDestination(newDest);};
for(const button of document.querySelectorAll('#profileButtons button'))button.onclick=()=>{$('profile').value=button.dataset.profile;$('profile').onchange();};
function syncProfileButtons(){for(const button of document.querySelectorAll('#profileButtons button'))button.setAttribute('aria-pressed',String(button.dataset.profile===$('profile').value));}
function showPreview(text,error=false){const el=$('routePreview');el.classList.toggle('error',error);el.textContent=text;}
function renderPreview(){
 const note=$('placeNote');
 if(!path.length){showPreview(destKind()==='bathroom'?'No restroom is mapped on this floor.':'No step-free route to that place yet. Try another destination.',true);note.hidden=true;return;}
 const g=stepGuide(path,steps,0,$('profile').value),floorsUsed=new Set(path.map(id=>nodes[id].floor)).size,el=$('routePreview');el.classList.remove('error');
 el.innerHTML=`<strong>${g.minutes} min</strong><span class="dot"></span>${formatDistance(g.total)}<span class="dot"></span>${floorsUsed>1?`${floorsUsed} floors · elevator`:'Same floor'}`;
 const amenity=amenities.find(a=>a.id===$('destination').value);
 const text=amenity?.kind==='exit'?'This is a mapped building entrance, not a verified emergency evacuation route. In an emergency, follow posted signs and staff directions.':amenity?.kind==='bathroom'?'The route ends at the closest mapped point to the restrooms. Follow signs for the last few metres.':'';
 note.hidden=!text;note.querySelector('span').textContent=text;
}
function scoreFacts(){
 const count=kind=>destItems.filter(i=>i.kind===kind).length,plural=(n,one,many)=>`${n} ${n===1?one:many}`;
 const facts=[plural(floors.length,'floor mapped','floors mapped'),plural(count('room'),'room or place','rooms and places'),plural(count('elevator'),'elevator lobby','elevator lobbies'),plural(count('bathroom'),'restroom area','restroom areas'),plural(count('exit'),'step-free entrance','step-free entrances')];
 $('scoreFacts').replaceChildren(...facts.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
 const [value]=accessibility(activeId).score.split(' / ');$('accessibilityScore').innerHTML=`${value}<small> / 100</small>`;
}
function stopSpeech(){if(window.GoGoNative)window.GoGoNative.stopSpeech();else window.speechSynthesis?.cancel();}
function speak(){if(!$('voice').checked||$('profile').value==='deaf'||!path.length)return;const text=$('instruction').textContent;if(window.GoGoNative)window.GoGoNative.speak(text);else if(window.speechSynthesis){stopSpeech();speechSynthesis.speak(new SpeechSynthesisUtterance(text));}}
function showHome(){screen='home';stopSpeech();$('planner').hidden=false;$('journey').hidden=true;document.body.classList.remove('navigation');window.scrollTo(0,0);}
window.GoGoBack=()=>{if(screen==='journey'){showHome();return true;}return false;};
$('back').onclick=()=>{if(!window.GoGoBack()&&window.GoGoNative)window.GoGoNative.closeApp();};
function plan(){stopSpeech();index=0;const from=$('journeyType').value==='outdoor'?'entrance':$('source').value,to=amenities.find(a=>a.id===$('destination').value)?.routeId||$('destination').value;path=(!from||!to)?[]:planRoute(from,to,$('profile').value,'normal',{avoidStairs:$('stepfree').checked,mode:'comfort'}).path;steps=routeSteps(path,$('profile').value);step=0;shownIndex=null;$('start').disabled=!path.length;syncSearches();renderPreview();$('formStatus').textContent=path.length?'':destKind()==='bathroom'?'No bathroom mapped on this floor.':'No step-free route to that place. Try another floor.';}
function changeBuilding(){path=[];index=0;selectBuilding($('buildingChoice').value);refreshAmenities();refreshItems();viewer2d?.loadBuilding();if(viewer3d){viewer3d.loadBuilding();viewer3d.setMode(mapView==='pov'?'pov':'overview');}for(const id of ['sourceFloor','destFloor','floorSelect'])options($(id),floors.map(f=>({id:f.id,name:f.name})));const d=catalog.find(c=>c.id===(model()?.defaultRoom||'space-2-Library')&&c.routable)||catalog.find(c=>c.routable);$('sourceFloor').value=nodes.entrance.floor;$('destFloor').value=d.floor;$('destinationType').value='rooms';syncDestinationField();populate('source',nodes.entrance.floor,'entrance');populate('destination',d.floor,d.id);scoreFacts();plan();}
const destinationTitle=()=>destItems.find(i=>i.id===$('destination').value)?.title||'';
function renderCue(animate=true){
 index=steps[step]?.i??0;
 const n=nodes[path[index]],g=stepGuide(path,steps,step,$('profile').value,destinationTitle());
 $('cueMeta').textContent=`${floorName(n.floor)} · ${step+1} / ${steps.length}`;
 $('instruction').textContent=g.text;
 $('navDistance').textContent=g.arrived?floorName(n.floor):`${floorName(n.floor)} · step ${step+1} of ${steps.length-1}`;
 $('navIcon').innerHTML=maneuverSvg(g.kind);
 const banner=$('navBanner');banner.classList.toggle('arrived',g.arrived);
 if(lastKind!==g.kind+step){banner.classList.remove('changed');void banner.offsetWidth;banner.classList.add('changed');lastKind=g.kind+step;}
 $('navThen').hidden=!g.next;if(g.next){$('navThenIcon').innerHTML=maneuverSvg(maneuverKind(g.next));$('navThenText').textContent=g.leg>=1?`In ${formatDistance(g.leg)}, ${g.next[0].toLowerCase()+g.next.slice(1)}`:g.next;}
 $('tripEta').textContent=g.arrived?'Arrived':`${g.minutes} min`;
 $('tripMeta').textContent=g.arrived?'':`${formatDistance(g.meters)} · arrive ${arrivalTime(g.seconds)}`;
 $('tripBar').style.width=`${Math.round(g.progress*100)}%`;
 $('tripDest').textContent=destinationTitle();$('tripFloor').textContent=floorName(nodes[path.at(-1)].floor);
 $('next').disabled=false;$('next').textContent=g.arrived?'Finish':'Next step';$('prev').disabled=step===0;
 const from=shownIndex;shownIndex=index;
 const viewer=activeViewer();if(!viewer)return;
 const yaw=headingAt(index);
 if(viewer===viewer3d){
  if(viewer.path!==path)viewer.setRoute(path);viewer.setProgress(index);
  if(animate&&mapView==='pov'&&from!==null&&from!==index){const a=Math.min(from,index),b=Math.max(from,index),points=path.slice(a,b+1).map(id=>nodes[id].p);if(from>index)points.reverse();viewer.glideAlong(points,yaw);}
  else{viewer.setPosition(n.p);if(yaw!==null&&viewer.mode==='pov'){viewer.yaw=yaw;viewer.pitch=viewer.povPitch;}}
  viewer.view=showAll3d&&mapView==='3d'?'all':String(n.floor);viewer.updateVisibility();
 }
 else{viewer.setPosition(n.p);if(viewer.path!==path)viewer.setRoute(path);const ahead=path.slice(index+1).map(id=>nodes[id]).find(m=>m.floor===n.floor&&Math.hypot(m.p[0]-n.p[0],m.p[2]-n.p[2])>=2)||nodes[path[index+1]];if(ahead&&ahead.floor===n.floor)viewer.setHeading(n.p,ahead.p);}
 $('floorSelect').value=n.floor;
}
$('start').onclick=()=>{plan();if(!path.length)return;screen='journey';step=0;shownIndex=null;$('planner').hidden=true;$('journey').hidden=false;document.body.classList.add('navigation');outdoorStage=$('journeyType').value==='outdoor';stage();window.scrollTo(0,0);if(!outdoorStage)speak();};
$('floorSelect').onchange=()=>{const viewer=viewer2d;if(!viewer)return;viewer.view=$('floorSelect').value;viewer.follow=false;viewer.pan=[0,0];viewer.zoom=1;};
function nextStep(){if(outdoorStage){outdoorStage=false;stage();speak();return;}if(step+1<steps.length){step++;renderCue();speak();}else showHome();}
$('next').onclick=nextStep;
$('prev').onclick=()=>{if(outdoorStage||step===0)return;step--;renderCue();speak();};
$('repeat').onclick=()=>{if(!outdoorStage)speak();};
for(const button of document.querySelectorAll('#mapViews button'))button.onclick=()=>setMapView(button.dataset.view);
$('zoom3dIn').onclick=()=>{if(viewer3d)viewer3d.zoom=Math.max(.5,viewer3d.zoom/1.25);};
$('zoom3dOut').onclick=()=>{if(viewer3d)viewer3d.zoom=Math.min(1.8,viewer3d.zoom*1.25);};
$('allFloors3d').onclick=()=>setShowAll3d(!showAll3d);
$('faceRoute').onclick=faceRoute;
syncMapButtons();
$('journeyType').onchange=()=>{$('indoorSource').hidden=$('journeyType').value==='outdoor';plan();};
$('buildingChoice').onchange=changeBuilding;
$('sourceFloor').onchange=()=>{populate('source',$('sourceFloor').value,'e'+$('sourceFloor').value);plan();};
$('destFloor').onchange=()=>{populate('destination',$('destFloor').value);plan();};
$('destinationType').onchange=()=>{const kind=destKind();syncDestinationField();if(kind!=='rooms'&&!amenities.some(a=>a.kind===kind&&a.floor===Number($('destFloor').value))){const first=amenities.find(a=>a.kind===kind);if(first)$('destFloor').value=first.floor;}populate('destination',$('destFloor').value);plan();};
for(const id of ['source','destination','stepfree'])$(id).onchange=plan;
$('profile').onchange=()=>{$('stepfree').checked=true;syncProfileButtons();try{localStorage.setItem('gogo-profile',$('profile').value);}catch{}plan();};
$('voice').onchange=()=>{if(!$('voice').checked)stopSpeech();try{localStorage.setItem('gogo-voice',$('voice').checked?'on':'off');}catch{}};
try{if(localStorage.getItem('gogo-voice')==='off')$('voice').checked=false;}catch{}
options($('buildingChoice'),places.map(p=>({id:p.id,name:p.name})), 'morgridge');
try{const saved=localStorage.getItem('gogo-profile');if([...$('profile').options].some(o=>o.value===saved))$('profile').value=saved;}catch{}
changeBuilding();$('profile').onchange();showHome();syncProfileButtons();
// Links such as index.html?building=union&to=room1-1&view=pov&start=1 open a route directly (used for demos and screenshots).
{const q=new URLSearchParams(location.search);if(places.some(p=>p.id===q.get('building'))){$('buildingChoice').value=q.get('building');changeBuilding();}const to=destItems.find(i=>i.id===q.get('to'));if(to)pickDestination(to);if(MAP_VIEWS.includes(q.get('view')))setMapView(q.get('view'),false);if(q.get('start')==='1'&&path.length){$('start').click();const n=Number(q.get('step'));if(n>0){step=Math.min(n,steps.length-1);renderCue(false);}}}
let last=0;function frame(t){if(screen==='journey'&&!outdoorStage)activeViewer()?.tick(Math.min(.1,(t-last)/1000||0),$('profile').value);last=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSpeech();});

// Voice assistant: local navigation commands stay deterministic; Ollama only interprets
// open-ended requests against the currently loaded building catalog.
let assistantRequest=0,pendingRequest='',missingRequest=null,pendingQuestion=null,voiceActive=false,confirmedLocation=null,pendingDestination=null;
const DEFAULT_PHONE_OLLAMA_URL='http://192.168.1.110:11434',BROWSER_OLLAMA_URL='http://127.0.0.1:11434',OLLAMA_MODEL='qwen3:4b';
const BUILDING_ALIASES={morgridge:['morgridge'],union:['union','the union'],library:['college library'],discovery:['discovery'],chazen:['chazen']};
const BrowserSpeech=window.SpeechRecognition||window.webkitSpeechRecognition;
let browserRecognizer=null,browserSpeechToken=0,browserWakeEnabled=true;
function openAssistant(){
 voiceActive=true;$('voiceFab').classList.add('active');$('voiceWave').classList.add('active');$('voiceFab').setAttribute('aria-label','Stop voice assistant');
}
function stopVoiceSession(){if(window.GoGoNative?.stopVoice)window.GoGoNative.stopVoice();else{browserWakeEnabled=false;++browserSpeechToken;if(browserRecognizer)try{browserRecognizer.abort();}catch{}browserRecognizer=null;window.speechSynthesis?.cancel();}}
function dismissVoiceVisual(){voiceActive=false;$('voiceFab').classList.remove('active');$('voiceWave').classList.remove('active','listening');$('voiceFab').setAttribute('aria-label','Talk to GoGo');}
function closeAssistant(){pendingQuestion=null;stopVoiceSession();dismissVoiceVisual();}
function setAssistantStatus(text,listening=false){$('assistantStatus').textContent=text;$('voiceWave').classList.toggle('active',voiceActive);$('voiceWave').classList.toggle('listening',voiceActive&&listening);}
function assistantSpeak(text){if($('profile').value==='deaf')return;if(window.GoGoNative)window.GoGoNative.speak(String(text));else if(window.speechSynthesis){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(String(text)));}}
function assistantReply(text){setAssistantStatus(text||'Ready');assistantSpeak(text);}
function configuredOllamaUrl(){try{return localStorage.getItem('gogo-ollama-url')||(window.GoGoNative?DEFAULT_PHONE_OLLAMA_URL:BROWSER_OLLAMA_URL);}catch{return window.GoGoNative?DEFAULT_PHONE_OLLAMA_URL:BROWSER_OLLAMA_URL;}}
function promptAndListen(text,field,data={}){pendingQuestion={field,data};openAssistant();setAssistantStatus('GoGo is speaking',false);if(window.GoGoNative?.promptAndListen){window.GoGoNative.promptAndListen(text);return;}if(window.speechSynthesis){const utterance=new SpeechSynthesisUtterance(text);utterance.onend=()=>startBrowserSpeech(false);speechSynthesis.cancel();speechSynthesis.speak(utterance);}else startBrowserSpeech(false);}
function wakePhrase(text){const q=clean(text);return /^(hey|hi|okay) (gogo|go go|google|go)( |$)/.test(q);}
function browserAck(){try{const Audio=window.AudioContext||window.webkitAudioContext,context=new Audio(),osc=context.createOscillator(),gain=context.createGain();osc.frequency.value=880;gain.gain.setValueAtTime(.0001,context.currentTime);gain.gain.exponentialRampToValueAtTime(.16,context.currentTime+.015);gain.gain.exponentialRampToValueAtTime(.0001,context.currentTime+.16);osc.connect(gain).connect(context.destination);osc.start();osc.stop(context.currentTime+.18);osc.onended=()=>context.close();}catch{}}
function startBrowserSpeech(wake){
 if(!BrowserSpeech){if(!wake)setAssistantStatus('Voice recognition is unavailable in this browser.');return;}
 const token=++browserSpeechToken;if(browserRecognizer)try{browserRecognizer.abort();}catch{}
 const recognition=new BrowserSpeech();browserRecognizer=recognition;let delivered=false;
 recognition.lang=navigator.language||'en-US';recognition.interimResults=wake;recognition.continuous=false;recognition.maxAlternatives=3;
 recognition.onstart=()=>{if(!wake)setAssistantStatus('Listening…',true);};
 recognition.onresult=event=>{const texts=[];for(let i=event.resultIndex;i<event.results.length;i++)for(let j=0;j<event.results[i].length;j++)texts.push(event.results[i][j].transcript);if(wake&&texts.some(wakePhrase)){delivered=true;++browserSpeechToken;try{recognition.abort();}catch{}browserAck();window.GoGoWakeDetected();setTimeout(()=>startBrowserSpeech(false),350);}else if(!wake&&event.results[event.results.length-1].isFinal){delivered=true;window.GoGoVoiceResult(texts[0]||'');}};
 recognition.onerror=event=>{if(token!==browserSpeechToken)return;if(wake&&event.error==='not-allowed')browserWakeEnabled=false;if(!wake)setAssistantStatus(event.error==='not-allowed'?'Allow microphone access, then tap Talk again.':'I did not catch that. Tap Talk to try again.');};
 recognition.onend=()=>{if(browserRecognizer===recognition)browserRecognizer=null;if(token!==browserSpeechToken)return;if(browserWakeEnabled)setTimeout(()=>startBrowserSpeech(true),wake?500:delivered?1800:900);};
 try{recognition.start();}catch{if(!wake)setAssistantStatus('Tap Talk again to start the microphone.');}
}
function mappedContext(){
 const place=places.find(p=>p.id===activeId);
 const current=path.length?{text:$('instruction').textContent||stepGuide(path,steps,step,$('profile').value).text}:null;
 return {currentLocation:{confirmed:Boolean(confirmedLocation),building:confirmedLocation?.building||place?.name||activeId,floor:confirmedLocation?.floorName||floorName(Number($('sourceFloor').value)),place:confirmedLocation?.place||$('source').selectedOptions[0]?.textContent||''},selectedDestination:{floor:floorName(Number($('destFloor').value)),place:$('destination').selectedOptions[0]?.textContent||''},accessPreference:$('profile').selectedOptions[0].textContent,navigationActive:screen==='journey',currentCue:current?.text||'',floors:floors.map(f=>({id:f.id,name:f.name})),destinations:destinations().map(d=>({name:d.name,floor:d.floor,kind:d.kind||'room'})),rules:['A starting building, floor, and mapped place must be verbally confirmed before a new route.','Only mapped destinations may be used for navigation.','Infer a mapped room floor from the catalog.','A floor-only destination request requires a short room or place follow-up.','Ask exactly one short spoken question for each missing fact.']};
}
function chooseDestination(d){
 $('destFloor').value=d.floor;$('destinationType').value=d.kind&&['bathroom','exit'].includes(d.kind)?d.kind:'rooms';populate('destination',d.floor,d.id);$('destination').value=d.id;plan();
 if(!path.length){showMissing(`A compatible route to ${d.name} is not mapped for the current starting point and access preference.`);return false;}
 $('start').click();dismissVoiceVisual();return true;
}
function findDestination(query){
 const q=clean(query),number=(q.match(/\b\d{3,5}[a-z]?\b/)||[])[0],list=destinations();
 let matches=list.filter(d=>number&&clean(d.name).includes(number));
 if(!matches.length)matches=list.filter(d=>{const n=clean(d.name);return n.length>3&&(q.includes(n)||n.includes(q.replace(/^(take me to|go to|navigate to|find) /,'')));});
 if(!matches.length&&/bathroom|restroom/.test(q)){const requested=floorFromSpeech(q),floor=requested!==null?requested:Number($('sourceFloor').value);matches=list.filter(d=>d.kind==='bathroom'&&(requested===null||d.floor===requested)).sort((a,b)=>(a.floor===floor?-1:0)-(b.floor===floor?-1:0));}
 if(!matches.length&&!floorOnlyRequest(q)){const ranked=bestCatalogMatch(q,list,{minimum:.58});if(ranked&&!ranked.ambiguous)matches=[ranked.item];}
 return matches[0]||null;
}
function buildingFromSpeech(value){const match=bestCatalogMatch(value,places,{aliases:BUILDING_ALIASES,minimum:.5});return match&&!match.ambiguous?match.item:null;}
function findMappedPlace(query,list,floor=null){const q=clean(query),number=(q.match(/\b\d{3,5}[a-z]?\b/)||[])[0];let candidates=floor===null?list:list.filter(d=>d.floor===Number(floor));let matches=candidates.filter(d=>number&&clean(d.name).includes(number));if(!matches.length)matches=candidates.filter(d=>{const n=clean(d.name);return n.length>2&&(q.includes(n)||n.includes(q.replace(/^(i am at|near|room|the) /,'')));});if(!matches.length&&/\b(entrance|entry)\b/.test(q))matches=candidates.filter(d=>d.id==='entrance'||/entrance|entry/.test(clean(d.name)));if(!matches.length){const ranked=bestCatalogMatch(q,candidates,{minimum:.58});if(ranked&&!ranked.ambiguous)matches=[ranked.item];}return matches[0]||null;}
function findSource(query,floor=null){return findMappedPlace(query,catalog.filter(c=>c.routable),floor);}
function beginLocationCheck(destination=null){confirmedLocation=null;pendingDestination=destination;promptAndListen('Where are you now? Say the building, floor, and nearest room or mapped place.','sourceLocation',{buildingId:null,floor:null,placeId:null});}
function beginVoiceInteraction(){if(screen==='journey'){openAssistant();if(window.GoGoNative?.startVoice)window.GoGoNative.startVoice();else{browserWakeEnabled=true;startBrowserSpeech(false);}return;}beginLocationCheck();}
function finishSourceLocation(data){
 const building=places.find(p=>p.id===data.buildingId),place=catalog.find(c=>c.id===data.placeId);
 $('sourceFloor').value=data.floor;populate('source',data.floor,data.placeId);$('source').value=data.placeId;plan();
 confirmedLocation={building:building?.name||activeId,floor:data.floor,floorName:floorName(data.floor),place:place?.name||$('source').selectedOptions[0]?.textContent||''};
 if(pendingDestination){const destination=pendingDestination;pendingDestination=null;chooseDestination(destination);return;}
 if(data.destinationFloor!==null&&data.destinationFloor!==undefined){promptAndListen(`Okay, ${floorName(data.destinationFloor)}. Which room or place?`,'destinationOnFloor',{floor:data.destinationFloor});return;}
 promptAndListen('Okay. Where do you want to go?','destination');
}
function updateSourceLocation(raw,pending){
 const q=clean(raw),data={...pending.data};
 const destinationClause=(q.match(/\b(?:want|going|navigate|take me|go)\b.*?\bto\b\s+(.+)$/)||[])[1];
 const sourceText=destinationClause?q.slice(0,q.lastIndexOf(destinationClause)).replace(/\b(?:and|i|want|going|navigate|take me|go|to)\s*$/,''):q;
 const building=buildingFromSpeech(sourceText||q);if(building)data.buildingId=building.id;
 if(!data.buildingId){promptAndListen('Which building are you in?','sourceLocation',data);return true;}
 if(data.buildingId!==activeId){$('buildingChoice').value=data.buildingId;changeBuilding();}
 let floor=floorFromSpeech(sourceText);let place=findSource(sourceText,floor);
 if(place&&floor===null)floor=place.floor;if(floor!==null)data.floor=floor;if(place)data.placeId=place.id;
 if(destinationClause){const requested=findDestination(destinationClause);if(requested)pendingDestination=requested;else if(floorOnlyRequest(destinationClause))data.destinationFloor=floorFromSpeech(destinationClause);}
 if(data.floor===null||data.floor===undefined||!floors.some(f=>f.id===Number(data.floor))){promptAndListen(`Okay, ${places.find(p=>p.id===data.buildingId)?.name}. Which floor are you on?`,'sourceLocation',data);return true;}
 if(!data.placeId){place=findSource(sourceText,data.floor);if(place)data.placeId=place.id;}
 if(!data.placeId){promptAndListen(`What room or mapped place are you near on ${floorName(data.floor)}?`,'sourceLocation',data);return true;}
 finishSourceLocation(data);return true;
}
function answerPendingQuestion(raw){
 const pending=pendingQuestion;if(!pending)return false;pendingQuestion=null;const q=clean(raw);
 if(pending.field==='sourceLocation')return updateSourceLocation(q,pending);
 if(pending.field==='destinationFloor'){
  const floor=floorFromSpeech(q);const matches=destinations().filter(d=>d.kind===pending.data.kind&&d.floor===floor);
  if(matches.length){chooseDestination(matches[0]);return true;}
  promptAndListen(`I do not have that destination on ${floor!==null?floorName(floor):'that floor'}. Which floor do you need?`,'destinationFloor',pending.data);return true;
 }
 if(pending.field==='destination'){
  const destination=findDestination(q);if(destination){chooseDestination(destination);return true;}
  const requestedFloor=floorFromSpeech(q);if(requestedFloor!==null&&floorOnlyRequest(q)){promptAndListen(`Okay, ${floorName(requestedFloor)}. Which room or place?`,'destinationOnFloor',{floor:requestedFloor});return true;}
  promptAndListen('Which mapped room or destination do you need?','destination');return true;
 }
 if(pending.field==='destinationOnFloor'){
  const destination=findDestination(q);if(destination){if(destination.floor!==Number(pending.data.floor)){promptAndListen(`${destination.name} is on ${floorName(destination.floor)}. Say yes to navigate there, or name another room.`,'confirmDestination',{destinationId:destination.id,floor:pending.data.floor});return true;}chooseDestination(destination);return true;}
  promptAndListen(`I do not have that room on ${floorName(pending.data.floor)}. Which mapped room or place do you need?`,'destinationOnFloor',pending.data);return true;
 }
 if(pending.field==='confirmDestination'){
  if(/\b(yes|correct|okay|ok|continue)\b/.test(q)){const destination=destinations().find(d=>d.id===pending.data.destinationId);if(destination)chooseDestination(destination);return true;}
  const destination=findDestination(q);if(destination){chooseDestination(destination);return true;}
  promptAndListen(`Which room or place on ${floorName(pending.data.floor)}?`,'destinationOnFloor',{floor:pending.data.floor});return true;
 }
 return false;
}
function runLocalCommand(raw){
 const q=clean(raw.replace(/hey\s+go\s*go/ig,''));
 if(!q)return {handled:true,text:'How can I help?'};
 if(/\b(next|continue|next step)\b/.test(q)&&screen==='journey'){if(outdoorStage){outdoorStage=false;stage();}else if(step+1<steps.length){step++;renderCue();}dismissVoiceVisual();return {handled:true,text:$('instruction').textContent||'You are at the end of the route.'};}
 if(/\b(repeat|say that again|current direction)\b/.test(q)&&screen==='journey'){dismissVoiceVisual();return {handled:true,text:$('instruction').textContent};}
 if(/where am i|current location|starting point/.test(q)){const source=$('source').selectedOptions[0]?.textContent||'the selected starting point';return {handled:true,text:`Your selected location is ${source} in ${places.find(p=>p.id===activeId)?.name}.`};}
 if(/what('| i)?s next|next direction/.test(q)&&path.length)return {handled:true,text:screen==='journey'?$('instruction').textContent:stepGuide(path,steps,0,$('profile').value,destinationTitle()).text};
 const profiles=[['blind',/blind|low vision/],['wheelchair',/wheelchair/],['deaf',/deaf|hard of hearing/]];
 const profile=profiles.find(([,re])=>re.test(q));if(profile){$('profile').value=profile[0];$('profile').onchange();return {handled:true,text:`Access preference set to ${$('profile').selectedOptions[0].textContent}.`};}
 const building=buildingFromSpeech(q);if(building&&building.id!==activeId){$('buildingChoice').value=building.id;changeBuilding();confirmedLocation=null;beginLocationCheck();return {handled:true,text:''};}
 if(/bathroom|restroom/.test(q)&&floorFromSpeech(q)===null){const bathroomFloors=[...new Set(destinations().filter(d=>d.kind==='bathroom').map(d=>d.floor))];if(bathroomFloors.length>1){promptAndListen('Which floor do you need the bathroom on?','destinationFloor',{kind:'bathroom'});return {handled:true,text:''};}}
 const destination=findDestination(q);if(destination){chooseDestination(destination);return {handled:true,text:''};}
 const requestedFloor=floorFromSpeech(q);if(requestedFloor!==null&&floorOnlyRequest(q)){promptAndListen(`Okay, ${floorName(requestedFloor)}. Which room or place?`,'destinationOnFloor',{floor:requestedFloor});return {handled:true,text:''};}
 if(/\b(go|navigate|take me|directions|route)\b/.test(q)){promptAndListen('What room or destination do you need?','destination');return {handled:true,text:''};}
 return {handled:false};
}
function showMissing(text){missingRequest={query:pendingRequest||'Unknown request',detail:text,building:places.find(p=>p.id===activeId)?.name||activeId,createdAt:new Date().toISOString()};const saved=savedMissing();saved.push(missingRequest);try{localStorage.setItem('gogo-missing-data',JSON.stringify(saved.slice(-100)));}catch{}setAssistantStatus(text||'More map data is needed');}
function savedMissing(){try{return JSON.parse(localStorage.getItem('gogo-missing-data')||'[]');}catch{return [];}}
function askOllama(query){
 pendingRequest=query;setAssistantStatus('Thinking…');const id='voice-'+(++assistantRequest);
 const context=mappedContext();
 const server=configuredOllamaUrl();if(window.GoGoNative?.askOllama){window.GoGoNative.askOllama(id,server,OLLAMA_MODEL,query,JSON.stringify(context));return;}
 const system=`You are GoGo, a fast and concise indoor accessibility navigation interpreter. Resolve natural speech to the closest canonical option in the supplied building context. Tolerate omitted words such as hall or building, abbreviations, word-order changes, and minor speech-to-text errors. When the request provides most of the needed detail and one catalog option is clearly closest, choose it instead of asking the user to repeat. Ask exactly one short question only when a required fact is absent, the request is under half complete, or two options are genuinely ambiguous. Use only supplied values; never invent a room, floor, elevator, obstacle, or route. Infer mapped room floors from the destination catalog. A floor-only destination request must ask which room or place on that floor. Navigation actions are validated by the app. Reply with JSON only using: {"speech":"short spoken response","action":"none|next|repeat|navigate|ask","destination":"exact mapped name or empty","question":"one short follow-up question or empty","missingData":"specific absent map detail or empty"}. Building context: ${JSON.stringify(context)}`;
 fetch(server+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:OLLAMA_MODEL,stream:false,think:false,format:'json',messages:[{role:'system',content:system},{role:'user',content:query}]})}).then(async response=>{if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();}).then(result=>window.GoGoAssistantReply(id,result.message?.content||'','')).catch(()=>window.GoGoAssistantReply(id,'','Start Ollama and check the server URL in Settings.'));
}
function submitAssistant(text){const value=String(text||'').trim();if(!value)return;openAssistant();pendingRequest=value;if(answerPendingQuestion(value))return;const local=runLocalCommand(value);if(local.handled){if(local.text)assistantReply(local.text);return;}askOllama(value);}
window.GoGoAssistantReply=(requestId,reply,error)=>{
 if(error){assistantReply('I could not reach the local voice assistant.');setAssistantStatus('Voice assistant unavailable');return;}
 let data;try{data=JSON.parse(String(reply).replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{assistantReply(String(reply).slice(0,400));return;}
 if(data.action==='ask'||data.question){promptAndListen(data.question||'What destination do you need?','destination');return;}
 if(data.action==='navigate'&&!data.destination){promptAndListen('What room or destination do you need?','destination');return;}
 if(data.missingData){showMissing(String(data.missingData));assistantReply(data.speech||'That detail is not in this building map yet.');return;}
 if(data.action==='next'&&screen==='journey'&&!$('next').disabled)$('next').click();
 if(data.action==='repeat'&&screen==='journey')$('repeat').click();
 if(data.destination){const d=findDestination(String(data.destination));if(!d){showMissing(`The destination “${data.destination}” is not in the mapped room catalog.`);}else{chooseDestination(d);return;}}
 assistantReply(data.speech||'Done.');if(data.action!=='ask')dismissVoiceVisual();
};
window.GoGoVoiceResult=text=>{setAssistantStatus('Processing…');submitAssistant(text);};
window.GoGoVoiceStatus=(text,listening)=>setAssistantStatus(text,Boolean(listening));
window.GoGoWakeDetected=beginVoiceInteraction;
$('voiceFab').onclick=()=>{if(voiceActive){closeAssistant();return;}beginVoiceInteraction();};
$('settingsButton').onclick=()=>{$('ollamaServer').value=configuredOllamaUrl();$('settingsPanel').hidden=false;$('settingsBackdrop').hidden=false;};
function closeSettings(){$('settingsPanel').hidden=true;$('settingsBackdrop').hidden=true;}
$('settingsClose').onclick=closeSettings;$('settingsBackdrop').onclick=closeSettings;
$('settingsSave').onclick=()=>{const value=$('ollamaServer').value.trim().replace(/\/$/,'');if(value&&!/^https?:\/\//i.test(value)){$('ollamaServer').focus();return;}try{if(value)localStorage.setItem('gogo-ollama-url',value);else localStorage.removeItem('gogo-ollama-url');}catch{}closeSettings();};
setTimeout(()=>{if(window.GoGoNative?.setWakeWord)window.GoGoNative.setWakeWord(true);else startBrowserSpeech(true);},500);
