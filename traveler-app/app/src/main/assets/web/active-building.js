import * as original from './building.js';
import {additions,catalog as originalCatalog} from './catalog-data.js';
import {data} from './waypoint-data.js';
export const nodes={},edges=[],catalog=[],floors=[],floorById={};
export const colors=original.colors;
export let activeId='morgridge',obstacle=null;
export const model=()=>data.models[activeId];
export function world(id,p){const f=floorById[id];return f.source?[(p[0]-f.source.width/2)*f.source.scale,(id-1)*4.5,(p[1]-f.source.height/2)*f.source.scale]:original.world(id,p);}
export function selectBuilding(id){
 activeId=id;obstacle=null;for(const key of Object.keys(nodes))delete nodes[key];for(const key of Object.keys(floorById))delete floorById[key];edges.length=0;catalog.length=0;floors.length=0;
 if(id==='morgridge'){Object.assign(nodes,original.nodes,additions.nodes);edges.push(...additions.edges);catalog.push(...originalCatalog);floors.push(...original.floors);}
 else {const b=data.models[id];if(!b)throw Error('Unknown building');
 for(const n of b.graph.nodes)nodes[n.id]={name:n.label,floor:n.floor+1,p:[n.x,n.floor*4.5,n.z]};
 edges.push(...b.graph.edges.map(e=>({a:e.a,b:e.b,d:e.meters,type:e.kind==='elevator'?(e.id.startsWith('liftB')?'elevatorB':'elevatorA'):e.kind||'walk',id:e.id,slope:e.slope,width:e.width,tactile:e.tactile})));
 b.plan.floors.forEach((source,i)=>{const id=i+1;floors.push({id,name:source.label,source,mesh:b.floorMeshes[i],anchor:source.lift||source.spawn,scale:source.scale,rooms:[],holes:[],stairs:[]});const lifts=source.lifts||[source.lift||source.spawn];nodes['e'+id]={name:'Elevator lobby · '+source.label,floor:id,p:worldPoint(source,lifts[0],i)};const closest=Object.entries(nodes).filter(([key,n])=>n.floor===id&&key!=='e'+id).sort((a,b)=>dist(a[1].p,nodes['e'+id].p)-dist(b[1].p,nodes['e'+id].p))[0];if(closest)edges.push({a:'e'+id,b:closest[0],d:.01,type:'walk'});});
 if(id==='discovery')for(const f of floors){const n=nodes['b'+(f.id-1)];nodes['e'+f.id+'-1']={...n,name:'East elevator lobby · '+f.name};edges.push({a:'e'+f.id+'-1',b:'b'+(f.id-1),d:.01,type:'walk'});}
 for(const [id,n] of Object.entries(nodes))if(id==='entrance'||id.startsWith('room')||/^e\d+(?:-1)?$/.test(id))catalog.push({id,name:n.name,floor:n.floor,routable:true});
 }
 for(const f of floors)floorById[f.id]=f;
}
const worldPoint=(f,p,i)=>[(p[0]-f.width/2)*f.scale,i*4.5,(p[1]-f.height/2)*f.scale];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
export function segmentDistance(p,a,b){const dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-t*dx,p[2]-a[2]-t*dz);}
export function setObstacle(path,fraction=.6){obstacle=null;if(!path)return;const pairs=path.slice(1).map((id,i)=>[nodes[path[i]],nodes[id]]).filter(([a,b])=>a.floor===b.floor&&dist(a.p,b.p)>.1);const pair=pairs[Math.min(pairs.length-1,Math.floor(pairs.length*fraction))];if(pair)obstacle={floor:pair[0].floor,p:pair[0].p.map((v,i)=>(v+pair[1].p[i])/2),radius:.7};}
export function edgeBlocked(e){return obstacle&&nodes[e.a].floor===obstacle.floor&&nodes[e.b].floor===obstacle.floor&&segmentDistance(obstacle.p,nodes[e.a].p,nodes[e.b].p)<obstacle.radius+.2;}
export function sourceAllowed(f,x,z){const s=f.source,p=[x/s.scale+s.width/2,z/s.scale+s.height/2],r=.2/s.scale;for(const [dx,dy] of [[0,0],[r,0],[-r,0],[0,r],[0,-r]])if(!s.zones.some(poly=>inside([p[0]+dx,p[1]+dy],poly))||s.exclusions.some(poly=>inside([p[0]+dx,p[1]+dy],poly)))return false;return !s.walls.some(line=>line.slice(1).some((b,i)=>segmentDistance([p[0],0,p[1]],[...line[i].slice(0,1),0,line[i][1]],[b[0],0,b[1]])<r));}
function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
selectBuilding('morgridge');
