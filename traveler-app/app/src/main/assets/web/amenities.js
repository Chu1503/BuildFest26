import {nodes,catalog,floors,world,activeId} from './active-building.js';
import {places} from './campus.js';
// Amenity routes end at existing graph approaches. No new unverified walkway is added.
export const amenities=[];
export function refreshAmenities(){
 amenities.length=0;
 const add=(kind,name,floor,p,detail)=>{const candidates=catalog.filter(c=>c.routable&&c.floor===floor&&nodes[c.id]);candidates.sort((a,b)=>Math.hypot(nodes[a.id].p[0]-p[0],nodes[a.id].p[2]-p[2])-Math.hypot(nodes[b.id].p[0]-p[0],nodes[b.id].p[2]-p[2]));if(!candidates.length)return;amenities.push({id:'amenity-'+amenities.length,routeId:candidates[0].id,kind,name,floor,p,routable:true,detail});};
 if(activeId==='morgridge')for(const f of floors)for(const r of f.rooms.filter(r=>/restroom/i.test(r.id))){const center=r.poly.reduce((a,p)=>[a[0]+p[0]/r.poly.length,a[1]+p[1]/r.poly.length],[0,0]);add('bathroom','Bathrooms · mapped approach',f.id,world(f.id,center),'Restrooms marked in the supplied first-floor plan. Route ends at the nearest mapped approach, not the bathroom door. UW documents a single-stall accessible restroom on most floors; upper-floor exact positions are not yet traced.');}
 if(activeId==='library')for(const f of floors)for(const [label,p] of [['West',[303,180]],['East',[577,180]]])add('bathroom',`${label} center bathrooms · approach`,f.id,world(f.id,p),'Bathroom symbol from the supplied College Library floor plan. Route ends at a nearby mapped approach; follow signs for the door. Floor 1 also marks gender-inclusive restrooms.');
 // Imported plans carry their own restroom symbols and extra entrances (plan.floors[i].restrooms / .exits).
 if(activeId!=='morgridge'&&activeId!=='library')for(const f of floors)for(const [i,p] of (f.source?.restrooms||[]).entries())add('bathroom',`${f.name} restrooms${f.source.restrooms.length>1?' '+(i+1):''} · approach`,f.id,world(f.id,p),'Restroom symbol from the supplied floor plan. Route ends at the nearest mapped place; follow signs to the restroom door. Accessible-stall details are not confirmed.');
 const extraExits=floors.flatMap(f=>(f.source?.exits||[]).map(x=>x.id));
 for(const id of ['entrance',...(activeId==='morgridge'?['university']:[]),...extraExits])if(nodes[id])amenities.push({id:'amenity-'+amenities.length,routeId:id,kind:'exit',name:nodes[id].name+' · exit',floor:nodes[id].floor,p:nodes[id].p,routable:true,detail:'Mapped building entrance/exit. Not a verified emergency evacuation route.'});
}
export function accessibility(id){if(id==='morgridge')return {score:'95 / 100'};const place=places.find(item=>item.id===id);return {score:`${place?.score ?? '—'} / 100`};}
