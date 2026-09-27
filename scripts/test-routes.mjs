import assert from 'node:assert/strict';
import {planRoute,nodes,catalog,cueFor} from '../building-demo/routing.js';
import {floors,selectBuilding} from '../building-demo/active-building.js';
import {freshFix,relativePosition,floorSuggestion} from '../building-demo/positioning.js';

const buildings=['morgridge','union','library','discovery','chazen'];
let count=0,reverse=0;
for(const building of buildings){
 selectBuilding(building);
 assert.ok(floors.length>1,`${building} must expose every floor`);
 for(const floor of floors)assert.ok(catalog.some(place=>place.floor===floor.id),`${building} ${floor.name} needs a selectable place`);
 for(const end of catalog)for(const profile of ['wheelchair','blind','deaf','mobility','walking'])for(const incident of ['normal','a','all']){
  const route=planRoute('entrance',end.id,profile,incident,{avoidStairs:!['walking','deaf'].includes(profile)});count++;
  if(!end.routable)assert.equal(route.path.length,0);
  else if(incident==='normal')assert.ok(route.path.length,`${building}: ${end.id}`);
  if(!['walking','deaf'].includes(profile))assert.ok(!route.path.some(id=>nodes[id]?.name?.toLowerCase().includes('stairs')));
 }
 for(const start of catalog.filter(place=>place.routable)){assert.ok(planRoute(start.id,'entrance','wheelchair','normal',{avoidStairs:true}).path.length,`${building}: ${start.id} reverse route`);reverse++;}
}

selectBuilding('morgridge');
const sample={latitude:43,longitude:-89,accuracy:2,receivedAt:10000,ageMs:1000,mock:false};
assert.ok(freshFix(sample,10001));
for(const change of [{accuracy:20},{accuracy:0},{ageMs:12000},{mock:true},{receivedAt:-10000}])assert.equal(freshFix({...sample,...change},10001),false);
assert.deepEqual(relativePosition({...sample,p:[0,0,0]},sample,0),[0,0,0]);
assert.equal(floorSuggestion(4.5,2),3);
assert.equal(floorSuggestion(.3,2),null);
const samplePath=planRoute('entrance','space-2-Library','wheelchair','normal').path;
for(let i=0;i<samplePath.length;i++)assert.ok(!/approximate|simulated|wave-to-open/i.test(cueFor(samplePath,i,'wheelchair').text));
console.log(`${count} route cases across ${buildings.length} buildings, ${reverse} reverse sources, floor coverage, sensor freshness and cue checks passed.`);
