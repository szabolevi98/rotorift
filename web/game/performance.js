// Developer-only benchmark. No saved input settings, multiplayer or game state.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { buildEnvironment } from './environment.js';
import { ParkShadows } from './park-shadows.js';
import { configureDroneRenderer, addDroneReflections } from '../../shared/visual/drone-rendering.js';
const report=document.querySelector('#report'), results=[];
const params=new URLSearchParams(location.search), variant=params.get('variant')??'current', original=params.has('original');
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#scene'),antialias:true,logarithmicDepthBuffer:variant!=='depth'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,Math.round(innerHeight*.7),false);
configureDroneRenderer(THREE,renderer);
const gl=renderer.getContext(), gpuExtension=gl.getExtension('WEBGL_debug_renderer_info');
const gpu=gpuExtension?gl.getParameter(gpuExtension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
function output(status){report.textContent=JSON.stringify({variant,originalShadowUpdates:original,gpu,size:[renderer.domElement.width,renderer.domElement.height],status,results},null,2);}
await RAPIER.init();const {maps}=await(await fetch('/api/catalog')).json();
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
try {
for(const id of ['betonudvar','liget']) {
 const map=maps.find(m=>m.id===id),world=new RAPIER.World({x:0,y:-9.81,z:0}),scene=new THREE.Scene();
 scene.background=new THREE.Color(0xbcd4df);scene.fog=new THREE.FogExp2(0xbcd4df,.00085);
 scene.add(new THREE.HemisphereLight(0xfaf8e5,0x768367,2.4));const reflection=addDroneReflections(THREE,renderer,scene);
 const environment=buildEnvironment(scene,world,RAPIER,map);environment.highlight(0,false);
 const camera=new THREE.PerspectiveCamera(100,innerWidth/(innerHeight*.7),.012,12000);
 const shadows=variant==='none'?null:new ParkShadows(scene,camera);
 if(original&&shadows)for(const light of shadows.csm.lights)light.shadow.autoUpdate=true;
 if(!shadows){const sun=new THREE.DirectionalLight(0xfff0d5,3);sun.position.set(-35,75,25);scene.add(sun);}
 const poses=id==='liget'?[
  ['outside',[0,2,60],[0,3,0]],['passage',[0,2,0],[0,2,-25]],['glass-room',[12,6,0],[12,6,-15]]
 ]:[['entry',[0,2,255],[0,4,-35]],['bay',[-68,2,-30],[-68,2,-60]],['upper-bay',[-60,24,-30],[-60,24,-60]]];
 for(const [name,position,target]of poses){
  camera.position.set(...position);camera.lookAt(...target);environment.update(position);
  const costs=[],calls=[],triangles=[];
  output(`${id}/${name} warming up`);
  await frame();
  for(let i=0;i<30;i++){
   if(variant==='moving') {
    camera.position.set(position[0],position[1],position[2]+i*.25);
    camera.lookAt(target[0],target[1],target[2]+i*.25);
   }
   const start=performance.now();environment.update(position);shadows?.update();renderer.render(scene,camera);gl.finish();
   if(i>=6){costs.push(performance.now()-start);calls.push(renderer.info.render.calls);triangles.push(renderer.info.render.triangles);}
  }
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  results.push({map:id,pose:name,renderAndGpuMs:+mean(costs).toFixed(2),calls:Math.round(mean(calls)),triangles:Math.round(mean(triangles))});output(`${id}/${name} complete`);
 }
 shadows?.dispose();environment.dispose();world.free();reflection.dispose();
}
output('complete');
}catch(error){output('error: '+error.message);console.error(error);}
