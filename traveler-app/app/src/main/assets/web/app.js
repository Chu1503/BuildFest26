import {planRoute,cueFor,nodes,catalog} from './routing.js';
import {floors,selectBuilding,activeId,model} from './active-building.js';
import {places,outdoorRoute} from './campus.js';
import {BuildingViewer} from './viewer-2d.js';
import {amenities,refreshAmenities,accessibility} from './amenities.js';
const $=id=>document.getElementById(id);
document.documentElement.classList.add('map2d');
let viewer,path=[],index=0,screen='home',outdoorStage=false,campusMap,routeLayer;
function showOutdoor(){const r=outdoorRoute(activeId,$('profile').value,'comfort');if(!campusMap){campusMap=L.map('outdoorMap');L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).on('tileerror',()=>{$('tileStatus').hidden=false;}).addTo(campusMap);for(const p of places)L.circleMarker([p.lat,p.lng],{radius:8,color:'#173f4c',fillColor:'#72b9ac',fillOpacity:1}).addTo(campusMap).bindTooltip(p.name);L.circleMarker([43.0753,-89.3987],{radius:7,color:'#2779c4'}).addTo(campusMap).bindTooltip('Library Mall · starting point');}if(routeLayer)routeLayer.remove();routeLayer=L.polyline(r.points,{color:'#287d69',weight:6}).addTo(campusMap);requestAnimationFrame(()=>{campusMap.invalidateSize();campusMap.fitBounds(routeLayer.getBounds(),{padding:[35,35],maxZoom:17});});$('cueMeta').textContent='CAMPUS · DEMO ROUTE';$('instruction').textContent='Head to '+places.find(p=>p.id===activeId).name;$('detail').textContent=`Library Mall · approximately ${r.meters} m. Seeded accessibility-first route; follow local signs and conditions.`;$('next').textContent='Enter building';$('next').disabled=false;}
function stage(){ $('campusJourney').hidden=!outdoorStage;$('scene').hidden=outdoorStage;$('floorSelect').hidden=outdoorStage;document.querySelector('.map-legend').hidden=outdoorStage;if(outdoorStage)showOutdoor();else{if(!viewer)viewer=new BuildingViewer($('scene'),()=>{},()=>{});viewer.setMode('pov');renderCue();requestAnimationFrame(()=>viewer.resize());$('next').textContent='Next step';}}
const floorName=f=>floors.find(x=>x.id===f)?.name||`Floor ${f}`;
const options=(el,items,value)=>{el.replaceChildren(...items.map(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=x.name;return o;}));if(items.some(x=>String(x.id)===String(value)))el.value=value;};
function destinations(){return [...catalog.filter(c=>c.routable),...amenities.filter(c=>c.routable)];}
function populate(id,f,preferred){let list=(id==='source'?catalog.filter(c=>c.routable):destinations()).filter(c=>c.floor===Number(f));if(id==='destination'&&$('destinationType').value!=='rooms')list=list.filter(c=>c.kind===$('destinationType').value);else if(id==='destination')list=list.filter(c=>!c.kind);options($(id),list,preferred);}
function stopSpeech(){if(window.GoGoNative)window.GoGoNative.stopSpeech();else window.speechSynthesis?.cancel();}
function speak(){if(!$('voice').checked||$('profile').value==='deaf'||!path.length)return;const c=cueFor(path,index,$('profile').value);if(window.GoGoNative)window.GoGoNative.speak(c.text);else if(window.speechSynthesis){stopSpeech();speechSynthesis.speak(new SpeechSynthesisUtterance(c.text));}}
function showHome(){screen='home';stopSpeech();$('planner').hidden=false;$('journey').hidden=true;document.body.classList.remove('navigation');window.scrollTo(0,0);}
window.GoGoBack=()=>{if(screen==='journey'){showHome();return true;}return false;};
$('back').onclick=()=>{if(!window.GoGoBack()&&window.GoGoNative)window.GoGoNative.closeApp();};
function plan(){stopSpeech();index=0;path=$('destinationType').value==='emergency'?[]:planRoute($('journeyType').value==='outdoor'?'entrance':$('source').value,amenities.find(a=>a.id===$('destination').value)?.routeId||$('destination').value,$('profile').value,'normal',{avoidStairs:$('stepfree').checked,mode:'comfort'}).path;const d=destinations().find(c=>c.id===$('destination').value);$('destinationDetails').textContent=d?.detail||'';const emergency=$('destinationType').value==='emergency';$('emergencyInfo').hidden=!emergency;$('start').hidden=emergency;$('start').disabled=!path.length;$('formStatus').textContent=emergency?'':path.length?'':$('destinationType').value==='bathroom'?'No bathroom location is mapped on this floor. Choose another floor.':'Choose a mapped destination and a compatible starting place.';}
function changeBuilding(){path=[];index=0;selectBuilding($('buildingChoice').value);refreshAmenities();viewer?.loadBuilding();for(const id of ['sourceFloor','destFloor','floorSelect'])options($(id),floors.map(f=>({id:f.id,name:f.name})));const d=catalog.find(c=>c.id===(model()?.defaultRoom||'space-2-Library')&&c.routable)||catalog.find(c=>c.routable);$('sourceFloor').value=nodes.entrance.floor;$('destFloor').value=d.floor;$('destinationType').value='rooms';$('destinationField').hidden=false;populate('source',nodes.entrance.floor,'entrance');populate('destination',d.floor,d.id);$('accessibilityScore').textContent=accessibility(activeId).score;$('emergencyText').textContent=activeId==='morgridge'?'In the Library/Commons, posted exits lead to two nearby stairwells: one in front of the information desk and one beside it under the green Exit sign. If you cannot use stairs, follow the building’s emergency procedures and use the emergency phone by the elevators for assistance. Do not use elevators during a fire.':'Follow posted EXIT signs and the building’s evacuation instructions. Emergency exit locations are not verified in these supplied plans. Do not use elevators during a fire.';plan();}
function renderCue(){const n=nodes[path[index]],c=cueFor(path,index,$('profile').value);$('cueMeta').textContent=`${floorName(n.floor)} · ${index+1} / ${path.length}`;$('instruction').textContent=c.text;const amenity=amenities.find(a=>a.id===$('destination').value);$('detail').textContent=amenity ? amenity.detail : c.detail||'';if(amenity&&index===path.length-1)$('instruction').textContent='Reached the mapped approach · '+amenity.name;$('next').disabled=index===path.length-1;viewer.setPosition(n.p);viewer.setRoute(path);if(path[index+1])viewer.setHeading(n.p,nodes[path[index+1]].p);$('floorSelect').value=n.floor;}
$('start').onclick=()=>{plan();if(!path.length)return;screen='journey';$('planner').hidden=true;$('journey').hidden=false;document.body.classList.add('navigation');outdoorStage=$('journeyType').value==='outdoor';stage();window.scrollTo(0,0);if(!outdoorStage)speak();};
$('floorSelect').onchange=()=>{viewer.view=$('floorSelect').value;viewer.follow=false;viewer.pan=[0,0];viewer.zoom=1;};
$('next').onclick=()=>{if(outdoorStage){outdoorStage=false;stage();speak();return;}if(index+1<path.length){index++;renderCue();speak();}};
$('repeat').onclick=()=>{if(!outdoorStage)speak();};
$('journeyType').onchange=()=>{$('indoorSource').hidden=$('journeyType').value==='outdoor';plan();};
$('buildingChoice').onchange=changeBuilding;
$('sourceFloor').onchange=()=>{populate('source',$('sourceFloor').value,'e'+$('sourceFloor').value);plan();};
$('destFloor').onchange=()=>{populate('destination',$('destFloor').value);plan();};
$('destinationType').onchange=()=>{const emergency=$('destinationType').value==='emergency';$('destinationField').hidden=emergency;const kind=$('destinationType').value;if(['bathroom','exit'].includes(kind)&&!amenities.some(a=>a.kind===kind&&a.floor===Number($('destFloor').value))){const first=amenities.find(a=>a.kind===kind);if(first)$('destFloor').value=first.floor;}populate('destination',$('destFloor').value);plan();};
for(const id of ['source','destination','stepfree'])$(id).onchange=plan;
$('profile').onchange=()=>{$('stepfree').checked=['wheelchair','blind','mobility'].includes($('profile').value);$('voice').checked=$('profile').value!=='deaf';try{localStorage.setItem('gogo-profile',$('profile').value);}catch{}plan();};
$('voice').onchange=()=>{if(!$('voice').checked)stopSpeech();};
options($('buildingChoice'),places.map(p=>({id:p.id,name:p.name})), 'morgridge');
try{const saved=localStorage.getItem('gogo-profile');if([...$('profile').options].some(o=>o.value===saved))$('profile').value=saved;}catch{}
changeBuilding();$('profile').onchange();showHome();
let last=0;function frame(t){if(screen==='journey'&&!outdoorStage)viewer?.tick(Math.min(.1,(t-last)/1000||0));last=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSpeech();});

// Voice assistant: local navigation commands stay deterministic; Ollama only interprets
// open-ended requests against the currently loaded building catalog.
let assistantRequest=0,pendingRequest='',missingRequest=null,pendingQuestion=null,voiceActive=false;
const DEFAULT_PHONE_OLLAMA_URL='http://192.168.1.110:11434',BROWSER_OLLAMA_URL='http://127.0.0.1:11434',OLLAMA_MODEL='llama3.2:3b';
const BrowserSpeech=window.SpeechRecognition||window.webkitSpeechRecognition;
let browserRecognizer=null,browserSpeechToken=0,browserWakeEnabled=true;
const clean=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function openAssistant(){
 voiceActive=true;$('voiceFab').classList.add('active');$('voiceFab').setAttribute('aria-label','Stop voice assistant');
}
function stopVoiceSession(){if(window.GoGoNative?.stopVoice)window.GoGoNative.stopVoice();else{browserWakeEnabled=false;++browserSpeechToken;if(browserRecognizer)try{browserRecognizer.abort();}catch{}browserRecognizer=null;window.speechSynthesis?.cancel();}}
function dismissVoiceVisual(){voiceActive=false;$('voiceFab').classList.remove('active','listening');$('voiceFab').setAttribute('aria-label','Talk to GoGo');}
function closeAssistant(){pendingQuestion=null;stopVoiceSession();dismissVoiceVisual();}
function setAssistantStatus(text,listening=false){$('assistantStatus').textContent=text;$('voiceFab').classList.toggle('listening',listening);}
function assistantSpeak(text){if($('profile').value==='deaf')return;if(window.GoGoNative)window.GoGoNative.speak(String(text));else if(window.speechSynthesis){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(String(text)));}}
function assistantReply(text){setAssistantStatus(text||'Ready');assistantSpeak(text);}
function configuredOllamaUrl(){try{return localStorage.getItem('gogo-ollama-url')||(window.GoGoNative?DEFAULT_PHONE_OLLAMA_URL:BROWSER_OLLAMA_URL);}catch{return window.GoGoNative?DEFAULT_PHONE_OLLAMA_URL:BROWSER_OLLAMA_URL;}}
function promptAndListen(text,field,data={}){pendingQuestion={field,data};openAssistant();setAssistantStatus('Waiting for your answer',true);if(window.GoGoNative?.promptAndListen){window.GoGoNative.promptAndListen(text);return;}if(window.speechSynthesis){const utterance=new SpeechSynthesisUtterance(text);utterance.onend=()=>startBrowserSpeech(false);speechSynthesis.cancel();speechSynthesis.speak(utterance);}else startBrowserSpeech(false);}
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
 const current=path.length?cueFor(path,index,$('profile').value):null;
 return {currentLocation:{building:place?.name||activeId,floor:floorName(Number($('sourceFloor').value)),place:$('source').selectedOptions[0]?.textContent||''},selectedDestination:{floor:floorName(Number($('destFloor').value)),place:$('destination').selectedOptions[0]?.textContent||''},accessPreference:$('profile').selectedOptions[0]?.textContent,navigationActive:screen==='journey',currentCue:current?.text||'',floors:floors.map(f=>({id:f.id,name:f.name})),destinations:destinations().map(d=>({name:d.name,floor:d.floor,kind:d.kind||'room'})),rules:['Use currentLocation fields when present instead of asking for them again.','Only mapped destinations may be used for navigation.','Infer a mapped room floor from the catalog.','Ask one short question when the requested destination is missing or ambiguous.']};
}
function chooseDestination(d){
 $('destFloor').value=d.floor;$('destinationType').value=d.kind&&['bathroom','exit'].includes(d.kind)?d.kind:'rooms';$('destinationField').hidden=false;populate('destination',d.floor,d.id);$('destination').value=d.id;plan();
 if(!path.length){showMissing(`A compatible route to ${d.name} is not mapped for the current starting point and access preference.`);return false;}
 $('start').click();dismissVoiceVisual();return true;
}
function findDestination(query){
 const q=clean(query),number=(q.match(/\b\d{3,5}[a-z]?\b/)||[])[0],list=destinations();
 let matches=list.filter(d=>number&&clean(d.name).includes(number));
 if(!matches.length)matches=list.filter(d=>{const n=clean(d.name);return n.length>3&&(q.includes(n)||n.includes(q.replace(/^(take me to|go to|navigate to|find) /,'')));});
 if(!matches.length&&/bathroom|restroom/.test(q)){const requested=floorFromSpeech(q),floor=requested||Number($('sourceFloor').value);matches=list.filter(d=>d.kind==='bathroom'&&(!requested||d.floor===requested)).sort((a,b)=>(a.floor===floor?-1:0)-(b.floor===floor?-1:0));}
 return matches[0]||null;
}
function floorFromSpeech(q){const digit=(q.match(/\b(?:floor )?(\d{1,2})\b/)||[])[1];if(digit)return Number(digit);const words={basement:0,ground:1,first:1,one:1,second:2,two:2,third:3,three:3,fourth:4,four:4,fifth:5,five:5,sixth:6,six:6,seventh:7,seven:7};return Object.entries(words).find(([word])=>new RegExp(`\\b${word}\\b`).test(q))?.[1]||0;}
function answerPendingQuestion(raw){
 const pending=pendingQuestion;if(!pending)return false;pendingQuestion=null;const q=clean(raw);
 if(pending.field==='destinationFloor'){
  const floor=floorFromSpeech(q);const matches=destinations().filter(d=>d.kind===pending.data.kind&&d.floor===floor);
  if(matches.length){chooseDestination(matches[0]);return true;}
  promptAndListen(`I do not have that destination on ${floor?floorName(floor):'that floor'}. Which floor do you need?`,'destinationFloor',pending.data);return true;
 }
 if(pending.field==='destination'){
  const destination=findDestination(q);if(destination){chooseDestination(destination);return true;}
  promptAndListen('I could not match that to a mapped place. What room or destination do you need?','destination');return true;
 }
 return false;
}
function runLocalCommand(raw){
 const q=clean(raw.replace(/hey\s+go\s*go/ig,''));
 if(!q)return {handled:true,text:'How can I help?'};
 if(/\b(next|continue|next step)\b/.test(q)&&screen==='journey'){if(outdoorStage){outdoorStage=false;stage();}else if(index+1<path.length){index++;renderCue();}dismissVoiceVisual();return {handled:true,text:$('instruction').textContent||'You are at the end of the route.'};}
 if(/\b(repeat|say that again|current direction)\b/.test(q)&&screen==='journey'){dismissVoiceVisual();return {handled:true,text:$('instruction').textContent};}
 if(/where am i|current location|starting point/.test(q)){const source=$('source').selectedOptions[0]?.textContent||'the selected starting point';return {handled:true,text:`Your selected location is ${source} in ${places.find(p=>p.id===activeId)?.name}.`};}
 if(/what('| i)?s next|next direction/.test(q)&&path.length)return {handled:true,text:cueFor(path,index,$('profile').value).text};
 const profiles=[['blind',/blind|low vision/],['wheelchair',/wheelchair/],['deaf',/deaf|hard of hearing/],['mobility',/limited mobility|walker|cane/],['walking',/no preference|walking/]];
 const profile=profiles.find(([,re])=>re.test(q));if(profile){$('profile').value=profile[0];$('profile').onchange();return {handled:true,text:`Access preference set to ${$('profile').selectedOptions[0].textContent}.`};}
 const building=places.find(p=>q.includes(clean(p.name)));if(building&&building.id!==activeId){$('buildingChoice').value=building.id;changeBuilding();promptAndListen(`${building.name} is selected. Which room or destination do you need?`,'destination');return {handled:true,text:''};}
 if(/bathroom|restroom/.test(q)&&!floorFromSpeech(q)){const bathroomFloors=[...new Set(destinations().filter(d=>d.kind==='bathroom').map(d=>d.floor))];if(bathroomFloors.length>1){promptAndListen('Which floor do you need the bathroom on?','destinationFloor',{kind:'bathroom'});return {handled:true,text:''};}}
 const destination=findDestination(q);if(destination){chooseDestination(destination);return {handled:true,text:''};}
 if(/\b(go|navigate|take me|directions|route)\b/.test(q)){promptAndListen('What room or destination do you need?','destination');return {handled:true,text:''};}
 return {handled:false};
}
function showMissing(text){missingRequest={query:pendingRequest||'Unknown request',detail:text,building:places.find(p=>p.id===activeId)?.name||activeId,createdAt:new Date().toISOString()};const saved=savedMissing();saved.push(missingRequest);try{localStorage.setItem('gogo-missing-data',JSON.stringify(saved.slice(-100)));}catch{}setAssistantStatus(text||'More map data is needed');}
function savedMissing(){try{return JSON.parse(localStorage.getItem('gogo-missing-data')||'[]');}catch{return [];}}
function askOllama(query){
 pendingRequest=query;setAssistantStatus('Thinking…');const id='voice-'+(++assistantRequest);
 const context=mappedContext();
 const server=configuredOllamaUrl();if(window.GoGoNative?.askOllama){window.GoGoNative.askOllama(id,server,OLLAMA_MODEL,query,JSON.stringify(context));return;}
 const system=`You are GoGo, a concise voice-only indoor accessibility navigation agent. Use only the supplied building context. Never invent a room, floor, elevator, obstacle, or route. Use currentLocation when its fields are present. Infer a mapped room's floor from the destination catalog. If the destination or another required fact is missing or ambiguous, ask exactly one short question. Reply with JSON only using: {"speech":"short spoken response","action":"none|next|repeat|navigate|ask","destination":"exact mapped name or empty","question":"one short follow-up question or empty","missingData":"specific absent map detail or empty"}. Building context: ${JSON.stringify(context)}`;
 fetch(server+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:OLLAMA_MODEL,stream:false,format:'json',messages:[{role:'system',content:system},{role:'user',content:query}]})}).then(async response=>{if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();}).then(result=>window.GoGoAssistantReply(id,result.message?.content||'','')).catch(()=>window.GoGoAssistantReply(id,'','Start Ollama and check the server URL in Settings.'));
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
window.GoGoWakeDetected=()=>{openAssistant();setAssistantStatus('Listening…',true);};
$('voiceFab').onclick=()=>{if(voiceActive){closeAssistant();return;}openAssistant();if(window.GoGoNative?.startVoice)window.GoGoNative.startVoice();else{browserWakeEnabled=true;startBrowserSpeech(false);}};
$('settingsButton').onclick=()=>{$('ollamaServer').value=configuredOllamaUrl();$('settingsPanel').hidden=false;$('settingsBackdrop').hidden=false;};
function closeSettings(){$('settingsPanel').hidden=true;$('settingsBackdrop').hidden=true;}
$('settingsClose').onclick=closeSettings;$('settingsBackdrop').onclick=closeSettings;
$('settingsSave').onclick=()=>{const value=$('ollamaServer').value.trim().replace(/\/$/,'');if(!/^https?:\/\//i.test(value))return;$('ollamaServer').value=value;try{localStorage.setItem('gogo-ollama-url',value);}catch{}closeSettings();};
setTimeout(()=>{if(window.GoGoNative?.setWakeWord)window.GoGoNative.setWakeWord(true);else startBrowserSpeech(true);},500);
