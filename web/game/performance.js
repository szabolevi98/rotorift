// Developer-only benchmark. No saved input settings, multiplayer or game state.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { buildEnvironment } from './environment.js';
import { ParkShadows } from './park-shadows.js';
import { configureDroneRenderer } from '../../shared/visual/drone-rendering.js';
import { createMapAtmosphere } from "./map-atmosphere.js";
import { loadPrebakedCollisions } from "./prebaked-collisions.js";
import { DronePhysics } from "../../shared/physics/drone.js";
import { hoverThrottle } from "../../shared/physics/propulsion.js";
const report=document.querySelector('#report'), results=[];
const params=new URLSearchParams(location.search), variant=params.get('variant')??'current', original=params.has('original');
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#scene'),antialias:true,logarithmicDepthBuffer:variant!=='depth'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,Math.round(innerHeight*.7),false);
configureDroneRenderer(THREE,renderer);
const gl=renderer.getContext(), gpuExtension=gl.getExtension('WEBGL_debug_renderer_info');
const gpu=gpuExtension?gl.getParameter(gpuExtension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
const physicsMode=params.get('physics')??'none';
function output(status){report.textContent=JSON.stringify({variant,physicsMode,originalShadowUpdates:original,gpu,size:[renderer.domElement.width,renderer.domElement.height],status,results},null,2);}
await RAPIER.init();const {maps,drones}=await(await fetch('/api/catalog')).json();
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
try {
for(const id of params.has('map')?[params.get('map')]:['betonudvar','liget','jatszoter','skyline']) {
 const map=maps.find(m=>m.id===id),world=new RAPIER.World({x:0,y:-9.81,z:0}),scene=new THREE.Scene();
 const atmosphere=createMapAtmosphere(renderer,scene,map.kind);
 const bakedCollisions=physicsMode==='prepared'?await loadPrebakedCollisions(RAPIER,world,map):null;
 if(physicsMode==='prepared'&&!bakedCollisions)throw Error('Prepared collisions failed to load');
 const environment=buildEnvironment(scene,world,RAPIER,map,{bakedCollisions});environment.highlight(0,false);
 const drone=physicsMode==='none'?null:new DronePhysics(RAPIER,world,drones.find(d=>d.id===(params.get('drone')??'rift-x5')),map.spawn,{updateSceneQueries:false});
 const input=drone?{roll:0,pitch:0,yaw:0,throttle:hoverThrottle(drone.config)}:null;
 const camera=new THREE.PerspectiveCamera(100,innerWidth/(innerHeight*.7),.012,12000);
 const shadows=variant==='none'?null:new ParkShadows(scene,camera,atmosphere.profile);
 if(original&&shadows)for(const light of shadows.csm.lights)light.shadow.autoUpdate=true;
 if(!shadows){const sun=new THREE.DirectionalLight(atmosphere.profile.sunColor,atmosphere.profile.sunIntensity);sun.position.set(-35,75,25);scene.add(sun);}
 const poses=id==='skyline'?[
  ['avenue',[60,2,250],[60,4,0]],['podium',[0,5,-120],[0,5,-155]],
  ['skywalk',[0,49.8,0],[0,49.8,15]],['garage',[-144,2.6,145],[-144,2.6,100]],
  ['facade-close',[6.4,25,0],[6.4,25,-15]]
 ]:id==='liget'?[
  ['outside',[0,2,60],[0,3,0]],['passage',[0,2,0],[0,2,-25]],['glass-room',[12,6,0],[12,6,-15]]
 ]:id==='jatszoter'?[
  ['outside',[0,3,25],[0,2,-3]],['under-fort',[0,.7,-3],[3.4,1,-3]],
  ['tower-post',[-3.4,.7,-3],[-3.4,1,0]],['near-ground',[0,.15,-3],[3.4,.4,-3]],
  ['cube-climber',[14,.7,-7],[14,1,-12]]
 ]:[['entry',[0,2,255],[0,4,-35]],['bay',[-68,2,-30],[-68,2,-60]],['upper-bay',[-60,24,-30],[-60,24,-60]]];
 for(const [name,position,target]of poses){
  if(map.kind==='construction') {
   const base=environment.heightAt(position[0],position[2]);position[1]+=base;target[1]+=base;
  }
  camera.position.set(...position);camera.lookAt(...target);environment.update(position);
  if(drone){drone.reset(position);drone.armed=true;for(let i=0;i<120;i++)drone.step(input);}
  const costs=[],calls=[],triangles=[],physicsCosts=[],collisionCosts=[];
  output(`${id}/${name} warming up`);
  await frame();
  for(let i=0;i<30;i++){
   if(variant==='moving') {
    camera.position.set(position[0],position[1],position[2]+i*.25);
    camera.lookAt(target[0],target[1],target[2]+i*.25);
   }
   if(drone&&params.has('hold')){
    drone.body.setTranslation({x:position[0],y:position[1],z:position[2]},true);
    drone.body.setLinvel({x:0,y:0,z:7},true);
   }
   let start=performance.now();environment.update(drone?drone.pose.p:position,drone?.pose.v);const collisionCost=performance.now()-start;
   start=performance.now();if(drone)for(let step=0;step<4;step++)drone.step(input);const physicsCost=performance.now()-start;
   start=performance.now();shadows?.update();renderer.render(scene,camera);gl.finish();
   if(i>=6){costs.push(performance.now()-start);calls.push(renderer.info.render.calls);triangles.push(renderer.info.render.triangles);physicsCosts.push(physicsCost);collisionCosts.push(collisionCost);}
  }
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  let activeColliders=0;world.colliders.forEach(collider=>{if(collider.isEnabled())activeColliders++;});
  results.push({map:id,pose:name,renderAndGpuMs:+mean(costs).toFixed(2),physics4StepsMs:+mean(physicsCosts).toFixed(3),collisionUpdateMs:+mean(collisionCosts).toFixed(3),activeColliders,calls:Math.round(mean(calls)),triangles:Math.round(mean(triangles))});output(`${id}/${name} complete`);
 }
 shadows?.dispose();drone?.dispose();environment.dispose();world.free();atmosphere.dispose();
}
output('complete');
}catch(error){output('error: '+error.message);console.error(error);}
