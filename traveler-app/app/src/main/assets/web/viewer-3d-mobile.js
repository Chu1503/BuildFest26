import * as THREE from './vendor/three.module.js';
import {BuildingViewer} from './viewer.js';
import {floors,floorById,world,nodes} from './active-building.js';

// Android-only extensions of the shared 3D viewer (viewer.js stays identical to the website's):
// - frames Morgridge's traced floors the same way as the imported buildings,
// - shows the route on the stacked "All floors" overview.
const UP=new THREE.Vector3(0,1,0);

export class MobileBuildingViewer extends BuildingViewer{
 constructor(el,onMove,onElevator){
  super(el,onMove,onElevator);
  this.showAll=false;this.frames=new WeakMap();
  const render=this.renderer.render.bind(this.renderer);
  this.renderer.render=(scene,camera)=>{this.beforeRender();render(scene,camera);};
 }
 get allView(){return this.mode==='overview'&&this.view==='all';}
 allZoom(){const base=floors.length>=6?.75:.82;return Math.min(1.8,base*(this.camera.aspect<1?1.2:1));}
 setShowAll(all){if(this.showAll===all)return;this.showAll=all;this.zoom=all?this.allZoom():1;}
 floorOffset(id){if(!this.allView)return 0;const gap=floors.length>1?Math.max(4,28/(floors.length-1)):0;return Math.max(0,floors.findIndex(f=>f.id===id))*gap;}
 loadBuilding(){super.loadBuilding();this.zoom=this.showAll?this.allZoom():1;this.routeAll=undefined;}

 // Route segments keep their endpoints so they can be lifted onto the stacked floors.
 setRoute(path){
  this.path=path;this.routeFloors=new Set(path.map(k=>nodes[k].floor));if(!path.length)this.routeFloors=new Set([this.floor]);
  for(const m of [...this.routeGroup.children]){this.routeGroup.remove(m);m.geometry.dispose();m.material.dispose();}
  const geometry=new THREE.CylinderGeometry(.085,.085,1,9),material=new THREE.MeshBasicMaterial({color:'#f4c542',depthTest:false});
  path.slice(1).forEach((id,i)=>{const m=new THREE.Mesh(geometry,material);m.userData={floors:[nodes[path[i]].floor,nodes[id].floor],a:path[i],b:id};m.renderOrder=8;this.routeGroup.add(m);});
  this.placeRoute();this.buildGuide(path);this.updateVisibility();this.applyTheme();
 }
 placeRoute(){
  const all=this.allView,width=all?3:1;
  for(const m of this.routeGroup.children){
   const na=nodes[m.userData.a],nb=nodes[m.userData.b];if(!na||!nb){m.visible=false;continue;}
   const a=new THREE.Vector3(...na.p),b=new THREE.Vector3(...nb.p);a.y+=.22+this.floorOffset(na.floor);b.y+=.22+this.floorOffset(nb.floor);
   const length=a.distanceTo(b);m.position.copy(a).add(b).multiplyScalar(.5);
   if(length>1e-4)m.quaternion.setFromUnitVectors(UP,b.clone().sub(a).normalize());
   m.scale.set(width,Math.max(length,1e-4),width);
  }
 }
 updateVisibility(){
  super.updateVisibility();
  if(!this.routeGroup)return;
  const all=this.allView;if(this.routeAll!==all){this.routeAll=all;this.placeRoute();}
  if(all){this.routeGroup.visible=true;for(const m of this.routeGroup.children)m.visible=true;}
 }

 // Morgridge floors are hand-traced polygons; frame each one around its own outline.
 frameFor(f){
  if(this.frames.has(f))return this.frames.get(f);
  const points=f.outline.map(p=>world(f.id,p)),xs=points.map(p=>p[0]),zs=points.map(p=>p[2]);
  const frame={center:[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...zs)+Math.max(...zs))/2],span:Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs))};
  this.frames.set(f,frame);return frame;
 }
 beforeRender(){
  // Stacked floors sit further from the camera; push the fog back so they stay readable.
  if(this.scene.fog&&this.allView){this.scene.fog.near=160;this.scene.fog.far=420;}
  if(this.allView){this.avatar.position.y=this.pos.y+this.floorOffset(this.floor);return;}
  if(this.mode!=='overview')return;
  const f=floorById[Number(this.view)]||floorById[this.floor];if(!f||f.source||!f.outline)return;
  const {center,span}=this.frameFor(f),y=(f.id-1)*4.5,fov=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2)),d=span*.5/Math.min(fov,fov*this.camera.aspect);
  this.camera.position.set(center[0]+Math.sin(this.angle)*d*this.zoom,y+d*.72*this.zoom,center[1]+Math.cos(this.angle)*d*.7*this.zoom);
  this.camera.lookAt(center[0],y,center[1]);
 }
}
