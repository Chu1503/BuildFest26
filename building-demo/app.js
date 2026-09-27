import {planRoute,cueFor,nodes,catalog} from './routing.js';
import {floors,selectBuilding,activeId,model} from './active-building.js';
import {places,outdoorRoute} from './campus.js';
import {BuildingViewer} from './viewer.js';
import {amenities,refreshAmenities} from './amenities.js';

const $=id=>document.getElementById(id);
let viewer,path=[],index=0,mode='overview',playing=false,progress=0,outdoor=false,campusMap,routeLayer,last=0;
const floorName=f=>floors.find(x=>x.id===f)?.name||(f===0?'Garden':`Floor ${f}`);
const options=(el,items,value)=>{
  el.replaceChildren(...items.map(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.name;return option;}));
  if(items.some(item=>String(item.id)===String(value)))el.value=value;
};
const destinations=()=>[...catalog.filter(item=>item.routable),...amenities.filter(item=>item.routable)];

function populate(id,floor,preferred){
  let list=(id==='source'?catalog.filter(item=>item.routable):destinations()).filter(item=>item.floor===Number(floor));
  if(id==='destination')list=$('destinationType').value==='rooms'?list.filter(item=>!item.kind):list.filter(item=>item.kind===$('destinationType').value);
  options($(id),list,preferred);
}

function stopSpeech(){if(window.GoGoNative)window.GoGoNative.stopSpeech();else window.speechSynthesis?.cancel();}
function currentCue(){return path.length?cueFor(path,index,$('profile').value):{text:'Choose a route.',detail:''};}
function speak(){
  if(!$('voice').checked||$('profile').value==='deaf'||!path.length)return;
  const cue=currentCue();
  if(window.GoGoNative)window.GoGoNative.speak(cue.text);
  else if(window.speechSynthesis){stopSpeech();speechSynthesis.speak(new SpeechSynthesisUtterance(cue.text));}
}

function setMode(next){
  mode=next;
  viewer?.setMode(next);
  for(const [id,value] of [['overview','overview'],['pov','pov'],['keyboard','manual']])$(id).classList.toggle('selected',next===value);
  $('walkHint').hidden=next!=='manual';
  if(next==='manual')viewer?.renderer.domElement.focus();
  setHeading();
}

function setHeading(){
  if(path[index+1])viewer?.setHeading(nodes[path[index]].p,nodes[path[index+1]].p);
}

function renderCue(){
  if(!path.length){$('cueMeta').textContent='READY';$('instruction').textContent='Choose a destination.';$('detail').textContent='';$('next').disabled=true;return;}
  const node=nodes[path[index]],cue=currentCue();
  $('cueMeta').textContent=`${floorName(node.floor)} · ${index+1} / ${path.length}`;
  $('instruction').textContent=cue.text;
  $('detail').textContent=$('profile').value==='blind'?(cue.detail||''):'';
  $('next').disabled=index===path.length-1;
  $('play').textContent=playing?'Pause preview':'Preview route';
  viewer?.setPosition(node.p);
  viewer&&(viewer.view=String(node.floor));
  $('floorSelect').value=String(node.floor);
  viewer?.updateVisibility();
  setHeading();
}

function plan(){
  stopSpeech();playing=false;progress=0;index=0;
  const emergency=$('destinationType').value==='emergency';
  const destination=amenities.find(item=>item.id===$('destination').value)?.routeId||$('destination').value;
  path=emergency||!$('source').value||!destination?[]:planRoute($('journeyType').value==='outdoor'?'entrance':$('source').value,destination,$('profile').value,'normal',{avoidStairs:$('stepfree').checked,mode:'comfort'}).path;
  viewer?.setRoute(path);
  const start=nodes[$('journeyType').value==='outdoor'?'entrance':$('source').value];
  if(start){viewer?.setPosition(start.p);viewer&&(viewer.view=String(start.floor));$('floorSelect').value=String(start.floor);viewer?.updateVisibility();}
  $('emergencyInfo').hidden=!emergency;
  $('start').hidden=emergency;
  $('start').disabled=!path.length;
  $('formStatus').textContent=emergency?'':path.length?'':$('destinationType').value==='bathroom'?'No bathroom mapped on this floor.':'Choose another destination.';
  renderCue();
}

function refreshFloorControls(){
  const floorItems=floors.map(f=>({id:f.id,name:f.name}));
  options($('sourceFloor'),floorItems);
  options($('destFloor'),floorItems);
  options($('liftFloor'),floorItems);
  options($('floorSelect'),[{id:'all',name:'All floors'},...floorItems],'all');
}

function changeBuilding(){
  selectBuilding($('buildingChoice').value);
  refreshAmenities();
  viewer?.loadBuilding();
  refreshFloorControls();
  const preferred=catalog.find(item=>item.id===(model()?.defaultRoom||'space-2-Library')&&item.routable)||catalog.find(item=>item.routable);
  $('buildingName').textContent=places.find(item=>item.id===activeId)?.name||'Building demo';
  $('sourceFloor').value=String(nodes.entrance.floor);
  $('destFloor').value=String(preferred.floor);
  $('destinationType').value='rooms';
  $('destinationField').hidden=false;
  populate('source',nodes.entrance.floor,'entrance');
  populate('destination',preferred.floor,preferred.id);
  $('emergencyText').textContent=activeId==='morgridge'?'Use posted exits. If you cannot use stairs, use the emergency phone by the elevators. Do not use elevators during a fire.':'Follow posted exit signs and building instructions. Do not use elevators during a fire.';
  setMode('overview');
  plan();
  if(viewer){viewer.view='all';viewer.zoom=.75;viewer.updateVisibility();}
  $('floorSelect').value='all';
}

function showOutdoor(){
  const route=outdoorRoute(activeId,$('profile').value,'comfort');
  if(!campusMap){
    campusMap=L.map('outdoorMap');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).on('tileerror',()=>{$('tileStatus').hidden=false;}).addTo(campusMap);
    for(const place of places)L.circleMarker([place.lat,place.lng],{radius:8,color:'#173f4c',fillColor:'#72b9ac',fillOpacity:1}).addTo(campusMap).bindTooltip(place.name);
  }
  if(routeLayer)routeLayer.remove();
  if(route){routeLayer=L.polyline(route.points,{color:'#287d69',weight:6}).addTo(campusMap);requestAnimationFrame(()=>{campusMap.invalidateSize();campusMap.fitBounds(routeLayer.getBounds(),{padding:[35,35],maxZoom:17});});}
  $('cueMeta').textContent='CAMPUS';
  $('instruction').textContent=`Head to ${places.find(place=>place.id===activeId)?.name||'the building'}`;
  $('detail').textContent='';
  $('next').textContent='Enter building';
  $('next').disabled=!route;
}

function setStage(isOutdoor){
  outdoor=isOutdoor;
  $('campusJourney').hidden=!outdoor;
  $('scene').hidden=outdoor;
  document.querySelector('.views').hidden=outdoor;
  $('floorSelect').hidden=outdoor;
  if(outdoor)showOutdoor();
  else{$('next').textContent='Next step';renderCue();requestAnimationFrame(()=>viewer?.resize());}
}

function advance(){
  if(outdoor){setStage(false);setMode('pov');speak();return;}
  if(index+1>=path.length)return;
  index++;progress=0;playing=false;renderCue();speak();
}

options($('buildingChoice'),places.map(place=>({id:place.id,name:place.name})),'morgridge');
selectBuilding($('buildingChoice').value);
refreshAmenities();
try{
  viewer=new BuildingViewer($('scene'),()=>{},near=>{if(!near)return;$('liftFloor').value=String(viewer.floor);$('liftDialog').showModal();});
}catch(error){$('renderError').hidden=false;console.error(error);}
changeBuilding();

for(const [id,value] of [['overview','overview'],['pov','pov'],['keyboard','manual']])$(id).onclick=()=>{setStage(false);setMode(value);$('back').hidden=value==='overview';};
$('back').onclick=()=>{playing=false;setStage(false);setMode('overview');if(viewer){viewer.view='all';viewer.zoom=.75;viewer.updateVisibility();}$('floorSelect').value='all';$('back').hidden=true;};
$('start').onclick=()=>{plan();if(!path.length)return;$('back').hidden=false;setStage($('journeyType').value==='outdoor');if(!outdoor){setMode('pov');renderCue();speak();}};
$('next').onclick=advance;
$('repeat').onclick=()=>{if(!outdoor)speak();};
$('play').onclick=()=>{if(!path.length||outdoor)return;if(index===path.length-1)index=0;playing=!playing;progress=0;if(playing)setMode('pov');renderCue();};
$('floorSelect').onchange=()=>{setMode('overview');viewer&&(viewer.view=$('floorSelect').value);viewer?.updateVisibility();};
$('buildingChoice').onchange=changeBuilding;
$('journeyType').onchange=()=>{$('indoorSource').hidden=$('journeyType').value==='outdoor';plan();};
$('sourceFloor').onchange=()=>{populate('source',$('sourceFloor').value,'e'+$('sourceFloor').value);plan();};
$('destFloor').onchange=()=>{populate('destination',$('destFloor').value);plan();};
$('destinationType').onchange=()=>{
  const type=$('destinationType').value,emergency=type==='emergency';
  $('destinationField').hidden=emergency;
  if(['bathroom','exit'].includes(type)&&!amenities.some(item=>item.kind===type&&item.floor===Number($('destFloor').value))){const first=amenities.find(item=>item.kind===type);if(first)$('destFloor').value=String(first.floor);}
  populate('destination',$('destFloor').value);plan();
};
for(const id of ['source','destination','stepfree'])$(id).onchange=plan;
$('profile').onchange=()=>{$('stepfree').checked=['wheelchair','blind','mobility'].includes($('profile').value);$('voice').checked=$('profile').value!=='deaf';plan();};
$('voice').onchange=()=>{if(!$('voice').checked)stopSpeech();};
$('rideLift').onclick=()=>{viewer?.useElevator(Number($('liftFloor').value));$('floorSelect').value=String(viewer.floor);$('liftDialog').close();};
$('closeLift').onclick=()=>$('liftDialog').close();

function frame(time){
  const dt=Math.min(.1,(time-last)/1000||0);last=time;
  if(playing&&path[index+1]){
    const a=nodes[path[index]],b=nodes[path[index+1]];progress+=dt/3;
    viewer?.setPosition(a.p.map((value,i)=>value+(b.p[i]-value)*Math.min(1,progress)));
    if(progress>=1){index++;progress=0;if(index===path.length-1)playing=false;renderCue();}
  }
  if(!outdoor)viewer?.tick(dt,$('profile').value);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;stopSpeech();}});
