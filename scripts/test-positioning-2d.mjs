import assert from 'node:assert/strict';
import {filterPosition,smoothHeading,freshFix,relativePosition} from '../building-demo/positioning.js';
import {selectBuilding,floors,nodes} from '../building-demo/active-building.js';
for(const building of ['morgridge','library','chazen','union','discovery']){selectBuilding(building);for(const f of floors){const p=nodes['e'+f.id].p,anchor={p,floor:f.id,latitude:43,longitude:-89};const next=relativePosition(anchor,{latitude:43.000001,longitude:-89},0);assert.equal(next[1],(f.id-1)*4.5);assert.equal(Math.round(next[1]/4.5)+1,f.id);const filtered=filterPosition({p,time:1000},next,2000);assert(filtered);assert.equal(filtered.p[1],p[1]);}}
assert.equal(filterPosition({p:[0,9,0],time:1000},[30,9,0],2000),null);
assert.equal(filterPosition({p:[0,9,0],time:1000},[0,0,0],2000),null);
assert.deepEqual(filterPosition({p:[0,9,0],time:1000},[.1,9,.1],2000).p,[0,9,0]);
const smoothed=filterPosition({p:[0,9,0],time:1000},[2,9,0],2000);assert(smoothed.p[0]>0&&smoothed.p[0]<2);
assert(Math.abs(smoothHeading(Math.PI-.01,-Math.PI+.01)-(Math.PI-.01))<.02);
assert(!freshFix({latitude:43,longitude:-89,accuracy:2,receivedAt:1000,ageMs:9000,mock:false},2500));
console.log('22 floors retain anchored elevation; jump rejection, jitter smoothing, heading wrap and combined fix age pass.');
