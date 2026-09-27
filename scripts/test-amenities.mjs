import assert from 'node:assert/strict';
import {selectBuilding,nodes,edges,floors} from '../building-demo/active-building.js';
import {amenities,refreshAmenities} from '../building-demo/amenities.js';
import {planRoute} from '../building-demo/routing.js';
let checked=0;
for(const building of ['morgridge','union','library','chazen','discovery']){
 selectBuilding(building);refreshAmenities();
 assert(amenities.some(a=>a.kind==='exit'));
 if(building==='discovery')assert(!amenities.some(a=>a.kind==='bathroom'),'Do not invent bathrooms for the conceptual model');
 for(const a of amenities){
  assert(nodes[a.routeId]);assert.equal(nodes[a.routeId].floor,a.floor);
  assert(floors.some(f=>f.id===a.floor));assert(a.p.every(Number.isFinite));
  const {path}=planRoute('entrance',a.routeId,'wheelchair','normal',{avoidStairs:true,mode:'comfort'});
  assert(path.length,`${building}: ${a.name} must have a mapped approach`);
  for(let i=1;i<path.length;i++)assert(!edges.filter(e=>(e.a===path[i-1]&&e.b===path[i])||(e.b===path[i-1]&&e.a===path[i])).every(e=>e.type==='stairs'));
  checked++;
 }
}
console.log(`${checked} bathroom/exit approaches reachable with a step-free profile across five buildings.`);
