import assert from 'node:assert/strict';
import {planRoute,nodes,catalog,cueFor} from '../building-demo/routing.js';
import {freshFix,relativePosition,floorSuggestion} from '../building-demo/positioning.js';
let count=0;for(const end of catalog)for(const profile of ['wheelchair','blind','deaf','mobility','walking'])for(const incident of ['normal','a','all']){let r=planRoute('entrance',end.id,profile,incident);count++;if(!end.routable)assert.equal(r.path.length,0);else if(incident==='all'&&!['walking','deaf'].includes(profile)&&end.floor!==1)assert.equal(r.path.length,0);else assert.ok(r.path.length,end.id);if(!['walking','deaf'].includes(profile))assert.ok(!r.path.some(k=>/^s\d$/.test(k)||k==='steps'));}
for(const start of catalog.filter(c=>c.routable)){assert.ok(planRoute(start.id,'entrance','wheelchair','normal').path.length);}
let sample={latitude:43,longitude:-89,accuracy:2,receivedAt:10000,ageMs:1000,mock:false};assert.ok(freshFix(sample,10001));for(const change of [{accuracy:20},{accuracy:0},{ageMs:12000},{mock:true},{receivedAt:-10000}])assert.equal(freshFix({...sample,...change},10001),false);
assert.deepEqual(relativePosition({...sample,p:[0,0,0]},sample,0),[0,0,0]);assert.equal(floorSuggestion(4.5,2),3);assert.equal(floorSuggestion(.3,2),null);
let p=planRoute('entrance','space-2-Library','wheelchair','normal').path;for(let i=0;i<p.length;i++)assert.ok(!/approximate|simulated|wave-to-open/i.test(cueFor(p,i,'wheelchair').text));
console.log(`${count} route cases, ${catalog.filter(c=>c.routable).length} reverse sources, sensor freshness and cue checks passed.`);
