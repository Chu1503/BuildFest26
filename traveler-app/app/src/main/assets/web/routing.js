import {nodes,edges} from './building.js';
import {additions,catalog} from './catalog-data.js';
Object.assign(nodes,additions.nodes);edges.splice(0,edges.length,...additions.edges);
export {nodes,edges,catalog};
export function planRoute(start,end,profile='wheelchair',incident='normal'){
 if(!nodes[start]||!nodes[end])return {path:[],reason:'unmapped'};
 if(incident==='lost')return {path:[],reason:'location'};
 const d={[start]:0},prev={},done=new Set(),queue=[[0,start]],adj={};
 for(const e of edges){if(e.type==='stairs'&&!['walking','deaf'].includes(profile))continue;if(e.type==='elevatorA'&&['a','all'].includes(incident))continue;if(e.type==='elevatorB'&&incident==='all')continue;for(const [a,b]of [[e.a,e.b],[e.b,e.a]])(adj[a]??=[]).push([b,e.d+(e.type.startsWith('elevator')?5:0)]);}
 while(queue.length){queue.sort((a,b)=>b[0]-a[0]);let [cost,u]=queue.pop();if(done.has(u))continue;done.add(u);if(u===end)break;for(const [v,w]of adj[u]||[])if(cost+w<(d[v]??Infinity)){d[v]=cost+w;prev[v]=u;queue.push([d[v],v]);}}
 if(d[end]===undefined)return {path:[],reason:'blocked'};let path=[end];while(path[0]!==start)path.unshift(prev[path[0]]);return {path,distance:d[end]};
}
export function cueFor(path,index,profile){let id=path[index],to=path[index+1];if(!id)return {text:'No route available.',detail:''};if(!to)return {text:`Arrived at ${nodes[id].name}.`,detail:''};if(nodes[id].floor!==nodes[to].floor)return {text:`Take the ${id.startsWith('s')?'stairs':'elevator'} to ${nodes[to].floor===0?'the garden level':'Floor '+nodes[to].floor}.`,detail:profile==='blind'?'The elevator area has textured grey walls.':''};if(id==='entrance'&&to==='ramp')return {text:'Take the ramp on your left.',detail:profile==='blind'?'Door sensor on your right.':''};let turn='Continue straight';if(index>0){let a=nodes[path[index-1]].p,b=nodes[id].p,c=nodes[to].p,ax=b[0]-a[0],az=b[2]-a[2],bx=c[0]-b[0],bz=c[2]-b[2],angle=Math.atan2(ax*bz-az*bx,ax*bx+az*bz);if(Math.abs(angle)>2.7)turn='Turn around';else if(angle>.35)turn='Turn right';else if(angle<-.35)turn='Turn left';}return {text:turn+'.',detail:profile==='blind'&&index===path.length-2?'Destination: '+nodes[to].name+'.':''};}
