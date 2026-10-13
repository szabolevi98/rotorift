import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {DRONE_SURFACES,configureDronePolymer} from '../shared/visual/drone-rendering.js';

// Geometry-only execution of the actual showroom factories. Printing the pack
// label needs a canvas, but is irrelevant to the physical cable clearance.
const context=vm.createContext({THREE,DRONE_SURFACES,configureDronePolymer,
 document:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})}});
for(const name of ['whoop65.js','whoop75.js'])vm.runInContext(await readFile(new URL('../showcase/'+name,import.meta.url),'utf8'),context);
for(const size of [65,75])test(`${size} whoop: all motor leads connect underneath the PCB and clear the moulded frame`,()=>{
 const model=vm.runInContext(`createRift${size}()`,context),root=model.root;root.scale.setScalar(1);root.updateMatrixWorld(true);
 const frame=root.children.find(o=>/^\d+_01_/.test(o.name)),board=root.children.find(o=>/AIO/.test(o.name)),wires=board.children.filter(o=>o.name==='Motor_phase_wire'),pads=board.children.filter(o=>o.name==='Motor_phase_pad');
 assert.equal(wires.length,12);assert.equal(pads.length,12);
 const ray=new THREE.Raycaster();
 for(const wire of wires){
  const points=wire.geometry.parameters.path.getPoints(120),radius=wire.geometry.parameters.radius;
  assert.ok(points[0].y+radius<10.2,'wire must attach to the bottom, not pass through the PCB');
  assert.ok(pads.some(p=>Math.hypot(p.position.x-points[0].x,p.position.z-points[0].z)<.01),'wire must meet a real solder pad');
  // Sample the centre and six sides of the cable, not just its centre line.
  for(const offset of [[0,0,0],[radius,0,0],[-radius,0,0],[0,radius,0],[0,-radius,0],[0,0,radius],[0,0,-radius]])for(let i=1;i<points.length;i++){
   const start=points[i-1].clone().add(new THREE.Vector3(...offset)),end=points[i].clone().add(new THREE.Vector3(...offset)),direction=end.clone().sub(start);
   ray.set(start,direction.clone().normalize());ray.far=direction.length();
   const hit=ray.intersectObjects(frame.children,true)[0];
   assert.ok(!hit,`motor lead intersects ${hit?.object.name} at ${start.toArray().map(v=>v.toFixed(2)).join(', ')}`);
  }
 }
});
test('Rift 75: the inset lens remains unobstructed and the surrounding camera case is covered',()=>{
 const model=vm.runInContext('createRift75()',context),root=model.root;root.scale.setScalar(1);root.updateMatrixWorld(true);
 const camera=root.getObjectByName('Micro_FPV_camera'),canopy=root.getObjectByName('75_05_Micro_camera_canopy'),ray=new THREE.Raycaster();
 const direction=new THREE.Vector3(0,0,1).transformDirection(camera.matrixWorld);
 const from=(x,y)=>{ray.set(new THREE.Vector3(x,y,-30).applyMatrix4(camera.matrixWorld),direction);ray.far=40;return ray.intersectObjects(canopy.children,true)[0];};
 assert.equal(from(0,0)?.object.name,'FPV_multicoated_lens','the optical axis must see the glass, not white plastic');
 for(const x of [-4.8,4.8])for(const y of [-2.5,2.5])assert.equal(from(x,y)?.object.name,'Integrated_tapered_camera_nose','the black square camera case must sit inside the shell');
});
test('Rift 75: the rear-facing antenna passes through its shell opening without clipping',()=>{
 const model=vm.runInContext('createRift75()',context);model.root.scale.setScalar(1);model.root.updateMatrixWorld(true);
 const white=[];model.root.getObjectByName('75_05_Micro_camera_canopy').traverse(o=>{if(o.isMesh&&o.material===model.materials.canopy)white.push(o);});
 const axis=new THREE.Vector3(0,1,3).normalize(),side=new THREE.Vector3(0,3,-1).normalize(),ray=new THREE.Raycaster();ray.far=21;
 for(const offset of [new THREE.Vector3(),new THREE.Vector3(1.3,0,0),new THREE.Vector3(-1.3,0,0),side.clone().multiplyScalar(1.3),side.clone().multiplyScalar(-1.3)]){
  ray.set(new THREE.Vector3(0,16,9).add(offset),axis);const hit=ray.intersectObjects(white,false)[0];assert.ok(!hit,`antenna intersects ${hit?.object.name}`);
 }
});
