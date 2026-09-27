import fs from 'node:fs';
import {floors,nodes,edges,destinations,world} from '../building-demo/building.js';
const inside=(p,poly)=>{let b=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){let a=poly[i],c=poly[j];if((a[1]>p[1])!==(c[1]>p[1])&&p[0]<(c[0]-a[0])*(p[1]-a[1])/(c[1]-a[1])+a[0])b=!b;}return b;};
const catalog=[{id:'unverified-2580',name:'2580',floor:2,type:'unverified',routable:false},{id:'unverified-2610',name:'2610',floor:2,type:'unverified',routable:false},{id:'unverified-B2537',name:'B2537 · Lactation',floor:0,type:'unverified',routable:false}];const graph=JSON.parse(JSON.stringify({nodes,edges}));
for(const f of floors){
 const free=p=>inside(p,f.outline)&&!f.holes.some(h=>inside(p,h))&&!f.rooms.some(r=>inside(p,r.poly));
 const minX=Math.min(...f.outline.map(p=>p[0]))-8,minY=Math.min(...f.outline.map(p=>p[1]))-8,maxX=Math.max(...f.outline.map(p=>p[0])),maxY=Math.max(...f.outline.map(p=>p[1]));
 const unit=7,w=Math.ceil((maxX-minX)/unit)+2,h=Math.ceil((maxY-minY)/unit)+2,points=new Array(w*h),valid=new Uint8Array(w*h),prev=new Int32Array(w*h).fill(-1);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let k=y*w+x;points[k]=[minX+x*unit,minY+y*unit];valid[k]=free(points[k])?1:0;}
 const near=p=>{let best=-1,dist=Infinity;for(let k=0;k<points.length;k++)if(valid[k]){let d=Math.hypot(p[0]-points[k][0],p[1]-points[k][1]);if(d<dist){dist=d;best=k;}}return best;};
 const start=near(nodes['e'+f.id].pixel),q=[start];prev[start]=start;
 for(let i=0;i<q.length;i++){let k=q[i],x=k%w,y=Math.floor(k/w);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){let nx=x+dx,ny=y+dy,n=ny*w+nx;if(nx<0||nx>=w||ny<0||ny>=h||!valid[n]||prev[n]!==-1)continue;prev[n]=k;q.push(n);}}
 const clear=(a,b)=>{let len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let t=0;t<=len;t+=2)if(!free(a.map((v,i)=>v+(b[i]-v)*t/(len||1))))return false;return free(b);};
 for(const r of f.rooms.filter(r=>r.type!=='service')){
  const id='space-'+f.id+'-'+r.id.replace(/[^a-z0-9]/gi,'-');let best=-1,dist=Infinity;
  for(let k=0;k<points.length;k++)if(prev[k]!==-1){let p=points[k],d=Math.min(...r.poly.map((a,i)=>{let b=r.poly[(i+1)%r.poly.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);}));if(d<dist){dist=d;best=k;}}
  let available=best>=0&&dist<30;catalog.push({id,name:r.id,floor:f.id,type:r.type,routable:available});if(!available)continue;
  let raw=[best];while(raw.at(-1)!==start)raw.push(prev[raw.at(-1)]);raw.reverse();let path=[nodes['e'+f.id].pixel,...raw.map(k=>points[k])];let smooth=[path[0]];
  for(let i=0;i<path.length-1;){let j=path.length-1;while(j>i+1&&!clear(path[i],path[j]))j--;smooth.push(path[j]);i=j;}
  let last='e'+f.id;for(let i=1;i<smooth.length;i++){let key=i===smooth.length-1?id:id+'-via-'+i;graph.nodes[key]={p:world(f.id,smooth[i]),pixel:smooth[i],floor:f.id,name:i===smooth.length-1?r.id:'Corridor'};graph.edges.push({a:last,b:key,type:'corridor',d:Math.hypot(...graph.nodes[last].p.map((v,j)=>v-graph.nodes[key].p[j]))});last=key;}
 }
}
for(const id of ['entrance','university',...floors.map(f=>'e'+f.id)])catalog.push({id,name:nodes[id].name,floor:nodes[id].floor,type:'landmark',routable:true});
fs.writeFileSync(new URL('../building-demo/catalog-data.js',import.meta.url),'export const catalog='+JSON.stringify(catalog)+';\nexport const additions='+JSON.stringify(graph)+';\n');
console.log(catalog.length,'places;',catalog.filter(r=>r.routable).length,'routable;',Object.keys(graph.nodes).length,'nodes');
