// Turn-by-turn presentation shared by the website and the Android app:
// maneuver icons, distances, time estimates and the searchable place list.
import {nodes,catalog,cueFor} from './routing.js';
import {floors} from './active-building.js';
import {amenities} from './amenities.js';
import {placeLabel,placeKind} from './place-search.js';

export const floorLabel=id=>floors.find(f=>f.id===Number(id))?.name||`Floor ${id}`;
const horizontal=(a,b)=>Math.hypot(b.p[0]-a.p[0],b.p[2]-a.p[2]);

// Searchable rooms, restrooms, exits and elevator lobbies for the active building.
function toItems(list){
 return list.map(item=>{
  const floor=floorLabel(item.floor),title=placeLabel(item,floor);
  const kindWord={bathroom:'Restroom',exit:'Exit',elevator:'Elevator',entrance:'Entrance'}[item.kind];
  return {id:item.id,floor:item.floor,kind:item.kind,title,subtitle:kindWord?`${kindWord} · ${floor}`:floor,badge:shortFloor(floor,item.floor),keywords:[item.name,item.id,kindWord,item.kind==='bathroom'?'toilet wc washroom':'' ].join(' '),detail:item.detail||''};
 });
}
// Exits duplicate their entrance nodes, so destinations list the exit version only.
export function destinationItems(){
 const extra=amenities.filter(a=>a.routable).map(a=>({...a,kind:placeKind(a)})),exits=new Set(extra.filter(a=>a.kind==='exit').map(a=>a.routeId));
 const rooms=catalog.filter(c=>c.routable&&!exits.has(c.id)).map(c=>({...c,kind:placeKind(c)}));
 return toItems([...rooms,...extra]);
}
export const sourceItems=()=>toItems(catalog.filter(c=>c.routable).map(c=>({...c,kind:placeKind(c)})));
function shortFloor(name,id){const m=/^(?:floor|level)\s+(\w+)/i.exec(name)||/^(\w+)\s+·/.exec(name);if(m)return /^\d/.test(m[1])?'L'+m[1]:m[1];if(/^lower/i.test(name))return 'LL';if(/^ground/i.test(name))return 'G';return 'L'+id;}

export const MANEUVER_ICONS={
 straight:'<path d="M12 20V5m0 0-5.5 5.5M12 5l5.5 5.5"/>',
 left:'<path d="M17 20v-7.5A3.5 3.5 0 0 0 13.5 9H5m0 0 4.5-4.5M5 9l4.5 4.5"/>',
 right:'<path d="M7 20v-7.5A3.5 3.5 0 0 1 10.5 9H19m0 0-4.5-4.5M19 9l-4.5 4.5"/>',
 uturn:'<path d="M8 20V9.5a4 4 0 0 1 8 0V14m0 0-3.5-3.5M16 14l3.5-3.5"/>',
 elevator:'<path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 7 3-3 3 3m-6 4 3 3 3-3"/>',
 stairs:'<path d="M4 20h4.5v-4.5H13V11h4.5V6.5H21"/>',
 ramp:'<path d="M3 19h18L3 10v9Zm4-7.5L19 6"/>',
 bearleft:'<path d="M14 20v-6.5L7 6.5m0 0v5m0-5h5"/>',
 bearright:'<path d="M10 20v-6.5l7-7m0 0v5m0-5h-5"/>',
 arrive:'<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/>'
};
export const maneuverSvg=kind=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${MANEUVER_ICONS[kind]||MANEUVER_ICONS.straight}</svg>`;
export function maneuverKind(text){
 if(/^arrived/i.test(text))return 'arrive';
 if(/elevator/i.test(text))return 'elevator';
 if(/stairs/i.test(text))return 'stairs';
 if(/ramp/i.test(text))return 'ramp';
 if(/turn around/i.test(text))return 'uturn';
 if(/bear left/i.test(text))return 'bearleft';
 if(/bear right/i.test(text))return 'bearright';
 if(/left/i.test(text))return 'left';
 if(/right/i.test(text))return 'right';
 return 'straight';
}
export const formatDistance=m=>m<1?'Now':m<20?`${Math.round(m)} m`:`${Math.round(m/5)*5} m`;

// The routing graph is dense (points can be under a metre apart), so turn-by-turn steps are
// rebuilt here: straight stretches merge into one step and only real turns (judged over a few
// metres either side), floor changes and arrival become steps. Routing itself is unchanged.
const TURN=.6,WINDOW=2.2;
function turnAngle(pts,i){
 const back=(()=>{let d=0;for(let j=i-1;j>=0;j--){if(pts[j].floor!==pts[i].floor)return pts[j+1];d+=horizontal(pts[j],pts[j+1]);if(d>=WINDOW)return pts[j];}return pts[0];})();
 const ahead=(()=>{let d=0;for(let j=i+1;j<pts.length;j++){if(pts[j].floor!==pts[i].floor)return pts[j-1];d+=horizontal(pts[j-1],pts[j]);if(d>=WINDOW)return pts[j];}return pts.at(-1);})();
 const ax=pts[i].p[0]-back.p[0],az=pts[i].p[2]-back.p[2],bx=ahead.p[0]-pts[i].p[0],bz=ahead.p[2]-pts[i].p[2];
 if(Math.hypot(ax,az)<.3||Math.hypot(bx,bz)<.3)return 0;
 return Math.atan2(ax*bz-az*bx,ax*bx+az*bz);
}
const turnText=a=>Math.abs(a)>2.6?'Turn around':a>0?(a<1?'Bear right':'Turn right'):(a>-1?'Bear left':'Turn left');
export function routeSteps(path,profile){
 const pts=path.map(id=>nodes[id]),last=path.length-1;if(last<1)return [{i:0,text:'You are here',kind:'arrive'}];
 const first=cueFor(path,0,profile).text.replace(/\.$/,'');
 const steps=[{i:0,text:/^continue straight$/i.test(first)?'Head straight ahead':first}];
 const candidates=[];
 for(let i=1;i<last;i++){
  if(pts[i].floor!==pts[i+1].floor){
   let j=i;while(j+1<last&&pts[j+1].floor!==pts[j+2]?.floor&&pts[j+2])j++;
   const how=/stairs/i.test(cueFor(path,i,profile).text)?'stairs':'elevator',to=pts[j+1].floor;
   flush();steps.push({i,text:`Take the ${how} to ${floorLabel(to)}`,kind:how});
   if(j+1<last)steps.push({i:j+1,text:`Leave the ${how} on ${floorLabel(to)}`,kind:'straight'});
   i=j+1;continue;
  }
  const a=turnAngle(pts,i);if(Math.abs(a)>TURN)candidates.push({i,a});
 }
 flush();
 steps.push({i:last,text:'Arrive',kind:'arrive'});
 // Keep steps ordered and drop a turn that sits right on top of another step.
 steps.sort((x,y)=>x.i-y.i);
 const isTurn=s=>/^(left|right|bearleft|bearright|uturn)$/.test(s.kind);
 const out=[];
 for(const s of steps.filter((s,k)=>k===0||s.i!==steps[k-1].i)){
  const prev=out.at(-1);
  // A turn right after leaving the elevator reads better as one instruction.
  if(prev&&isTurn(s)&&distanceAlong(pts,prev.i,s.i)<1.6&&/^Leave the/.test(prev.text)){prev.text+=` and ${s.text[0].toLowerCase()+s.text.slice(1)}`;prev.kind=s.kind;continue;}
  // A turn just before the elevator or the destination is noise from the graph.
  if(prev&&isTurn(prev)&&!isTurn(s)&&distanceAlong(pts,prev.i,s.i)<1.6&&out.length>1)out.pop();
  out.push({...s});
 }
 return out;
 function flush(){
  // Cluster nearby candidates and keep the sharpest turn of each cluster.
  let group=[];const out=()=>{if(!group.length)return;const best=group.reduce((m,c)=>Math.abs(c.a)>Math.abs(m.a)?c:m);steps.push({i:best.i,text:turnText(best.a),kind:maneuverKind(turnText(best.a))});group=[];};
  for(const c of candidates){const prev=group.at(-1);if(prev&&distanceAlong(pts,prev.i,c.i)>WINDOW*1.2)out();group.push(c);}
  out();candidates.length=0;
 }
}
function distanceAlong(pts,a,b){let d=0;for(let i=a;i<b;i++)if(pts[i].floor===pts[i+1].floor)d+=horizontal(pts[i],pts[i+1]);return d;}

// Everything the navigation banner and trip summary need for step k.
export function stepGuide(path,steps,k,profile,destinationName=''){
 const pts=path.map(id=>nodes[id]),step=steps[k],after=steps[k+1],arrived=!after;
 const text=arrived?(destinationName?`Arrived at ${destinationName}`:'You have arrived'):step.text;
 const leg=after?distanceAlong(pts,step.i,after.i):0;
 let meters=0,floorChanges=0;
 for(let i=step.i;i<pts.length-1;i++){if(pts[i].floor===pts[i+1].floor)meters+=horizontal(pts[i],pts[i+1]);else floorChanges++;}
 const speed=profile==='wheelchair'?.9:profile==='blind'?.8:1.1,seconds=meters/speed+floorChanges*35;
 const next=!after?'':after.kind==='arrive'?(destinationName?`Arrive at ${destinationName}`:'Arrive'):after.text;
 return {text,kind:arrived?'arrive':step.kind||maneuverKind(text),arrived,leg,meters,seconds,minutes:Math.max(1,Math.round(seconds/60)),floor:pts[step.i].floor,floorName:floorLabel(pts[step.i].floor),next,progress:steps.length>1?k/(steps.length-1):1,total:distanceAlong(pts,0,pts.length-1),detail:cueFor(path,step.i,profile).detail};
}
// Direction to face at node i: toward a point a few metres further along the route,
// so tiny zig-zags in the graph do not swing the camera.
export function headingAhead(path,i,distance=3){
 const a=nodes[path[i]];if(!a)return null;let d=0,b=null;
 for(let j=i+1;j<path.length;j++){const n=nodes[path[j]];if(n.floor!==a.floor)break;d+=horizontal(nodes[path[j-1]],n);b=n;if(d>=distance)break;}
 if(!b||Math.hypot(b.p[0]-a.p[0],b.p[2]-a.p[2])<.05)return null;
 return Math.atan2(-(b.p[0]-a.p[0]),-(b.p[2]-a.p[2]));
}
export function arrivalTime(seconds){const t=new Date(Date.now()+seconds*1000);return t.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});}
