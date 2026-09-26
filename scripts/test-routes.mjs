import assert from 'node:assert/strict';
import {planRoute} from '../building-demo/routing.js';
import {nodes,destinations,floors} from '../building-demo/building.js';
let count=0;
for(const target of destinations)for(const profile of ['wheelchair','blind','walking'])for(const scenario of ['normal','a','all','lost']){
 const r=planRoute('entrance',target,profile,scenario);count++;
 if(scenario==='lost')assert.equal(r.path.length,0);
 else if(profile!=='walking'&&scenario==='all'&&nodes[target].floor!==1)assert.equal(r.path.length,0);
 else assert.ok(r.path.length>0,`${target} ${profile} ${scenario}`);
 if(profile!=='walking')assert.ok(!r.path.some(k=>/^s\d$/.test(k)||k==='steps'));
}
assert.equal(floors.length,8);assert.equal(floors.reduce((sum,f)=>sum+f.rooms.length,0),115);
console.log(`${count} routing scenarios passed; 8 floors, 115 labeled spaces.`);
