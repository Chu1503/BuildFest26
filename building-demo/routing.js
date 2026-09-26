import {nodes,edges} from './building.js';
export {nodes,edges};
export function planRoute(start,destination,profile,incident){
 if(incident==='lost')return {path:[],reason:'location'};
 const dist=Object.fromEntries(Object.keys(nodes).map(k=>[k,Infinity])),prev={},q=new Set(Object.keys(nodes));dist[start]=0;
 while(q.size){let u=[...q].reduce((a,b)=>dist[a]<dist[b]?a:b);q.delete(u);if(!Number.isFinite(dist[u]))break;if(u===destination)break;
 for(const e of edges){if(e.a!==u&&e.b!==u)continue;if(e.type==='stairs'&&profile!=='walking')continue;if(e.type==='elevatorA'&&['a','all'].includes(incident))continue;if(e.type==='elevatorB'&&incident==='all')continue;let v=e.a===u?e.b:e.a;if(!q.has(v))continue;const cost=e.d+(e.type.startsWith('elevator')?5:0)+(e.type==='stairs'?1:0);if(dist[u]+cost<dist[v]){dist[v]=dist[u]+cost;prev[v]=u;}}
 }
 if(!Number.isFinite(dist[destination]))return {path:[],reason:'blocked'};const path=[destination];while(path[0]!==start)path.unshift(prev[path[0]]);return {path,reason:null,distance:path.slice(1).reduce((sum,n,i)=>sum+edges.find(e=>(e.a===n&&e.b===path[i])||(e.b===n&&e.a===path[i])).d,0)};
}
export function cueFor(path,index,profile){
 let id=path[index],next=path[index+1];if(!id)return {text:'No available route.',detail:'Ask building staff for assistance.',icon:'!'};
 if(!next)return {text:`You have arrived at ${nodes[id].name}.`,detail:'Demo destination reached. Confirm signs and current access with staff.',icon:'✓'};
 if(nodes[id].floor!==nodes[next].floor)return {text:`Take ${id.startsWith('s')?'the stairs':'the elevator'} to ${nodes[next].floor===0?'the garden level':'Floor '+nodes[next].floor}.`,detail:id.startsWith('s')?'Walking scenario. Confirm the stair landing.':'Press E near the elevator lobby in keyboard mode. Textured grey walls identify the elevator area.',icon:'↕'};
 if(id==='entrance'&&next==='ramp')return {text:'Use the ramp to the left of the three steps.',detail:'Orchard Street entrance. Wave-to-open sensor is on the right side of the doors.',icon:'↰'};
 if(id==='university')return {text:'Continue into the central hall.',detail:'From University Avenue, the elevators are toward the left near the center of the building.',icon:'↑'};
 if(next==='library')return {text:'The Commons & Library is to your left.',detail:'The information desk can help with heavy doors and room access.',icon:'↰'};
 let turn='Continue straight';if(index>0){let before=nodes[path[index-1]].p,here=nodes[id].p,after=nodes[next].p,dx=here[0]-before[0],dz=here[2]-before[2],nx=after[0]-here[0],nz=after[2]-here[2],cross=dx*nz-dz*nx;if(Math.abs(cross)>.1)turn=cross>0?'Turn right':'Turn left';else if(dx*nx+dz*nz<0)turn='Turn around';}
 return {text:`${turn} toward ${nodes[next].name}.`,detail:'Route geometry is approximate. The moving position is simulated.',icon:turn.includes('right')?'↱':turn.includes('left')?'↰':'↑'};
}
