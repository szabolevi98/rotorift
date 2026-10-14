import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';import * as THREE from 'three';
import {DRONE_SURFACES,configureDronePolymer} from '../shared/visual/drone-rendering.js';
const config=JSON.parse(await readFile(new URL('../data/drones/rift-x35.json',import.meta.url),'utf8'));
const context=vm.createContext({THREE,DRONE_SURFACES,configureDronePolymer,document:{createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})}});
vm.runInContext(await readFile(new URL('../showcase/freestyle35.js',import.meta.url),'utf8'),context);
function model(){const m=vm.runInContext('createRiftX35()',context);m.root.scale.setScalar(1);m.root.updateMatrixWorld(true);return m;}
test('X35 is a compact 4S aircraft with no action camera, flat arms and independently exportable tri-blade rotors',()=>{
  const m=model();assert.equal(m.actionParts.length,0);assert.equal(m.propellers.length,4);assert.equal(m.batteryParts.length,1);
  assert.ok(m.triangles<40000,'the new compact aircraft must stay lightweight');
  for(let i=0;i<4;i++){
    const prop=m.propellers[i].group,expected=config.motors[i].positionM;
    assert.ok(Math.abs(prop.position.x/1000-expected[0])<1e-8);assert.ok(Math.abs(prop.position.z/1000-expected[2])<1e-8);
    assert.ok(Math.abs(prop.position.y/1000+config.visualOffsetM[1]-expected[1])<1e-8);
    const blades=[];prop.traverse(o=>{if(/^Twisted_.*blade/.test(o.name))blades.push(o);});assert.equal(blades.length,3);
    const positions=blades[0].geometry.attributes.position;let radius=0;
    for(let n=0;n<positions.count;n++)radius=Math.max(radius,Math.hypot(positions.getX(n),positions.getZ(n)));
    assert.ok(Math.abs(radius-config.propDiameterM*500)<.1);
  }
  const arms=m.root.getObjectByName('X35_01_Carbon_frame').children.filter(o=>o.name==='X35_conventional_carbon_arm');assert.equal(arms.length,4);
  for(const arm of arms)assert.ok(Math.abs(new THREE.Box3().setFromObject(arm).getSize(new THREE.Vector3()).y-4)<1e-6);
});
test('X35 motor leads clear the carbon and PCB, while the rear ELRS dipole stays below all propellers',()=>{
  const m=model(),frame=m.root.getObjectByName('X35_01_Carbon_frame'),pcb=m.root.getObjectByName('X35_35A_AIO_PCB'),ray=new THREE.Raycaster(),wires=[];
  m.root.traverse(o=>{if(o.name==='Motor_phase_wire')wires.push(o);});assert.equal(wires.length,12);
  for(const wire of wires){const points=wire.geometry.parameters.path.getPoints(120),r=wire.geometry.parameters.radius;
    for(const offset of [[0,0,0],[r,0,0],[-r,0,0],[0,r,0],[0,-r,0],[0,0,r],[0,0,-r]])for(let i=1;i<points.length;i++){
      const a=points[i-1].clone().add(new THREE.Vector3(...offset)),b=points[i].clone().add(new THREE.Vector3(...offset)),d=b.sub(a);ray.set(a,d.clone().normalize());ray.far=d.length();
      assert.equal(ray.intersectObjects([...frame.children,pcb],true).length,0,'phase wire must not cross carbon or PCB');
    }
  }
  const dipole=new THREE.Box3().setFromObject(m.root.getObjectByName('ELRS_T_dipole'));
  assert.ok(dipole.max.y<12,'the receiver antenna must clear the swept rotor surfaces');
});
test('X35 lens surround and camera mount leave the forward optical axis clear',()=>{
  const m=model(),lens=m.root.getObjectByName('FPV_coated_lens');
  const direction=new THREE.Vector3(0,-1,0).applyQuaternion(lens.getWorldQuaternion(new THREE.Quaternion()));
  const start=lens.getWorldPosition(new THREE.Vector3()).addScaledVector(direction,.4);
  const ray=new THREE.Raycaster(start,direction,0,100);
  assert.equal(ray.intersectObject(m.root,true).length,0,'the mount cannot obstruct the FPV camera');
});
test('X35 arm and motor seat expose only one carbon surface at the former flickering overlap',()=>{
  const m=model(),carbon=m.root.getObjectByName('X35_01_Carbon_frame').children.filter(o=>o.material===m.materials.carbon),ray=new THREE.Raycaster();
  for(const prop of m.propellers){
    const x=prop.group.position.x,z=prop.group.position.z;
    ray.set(new THREE.Vector3(x-Math.sign(x)*4,1,z-Math.sign(z)*5),new THREE.Vector3(0,-1,0));ray.far=1.01;
    assert.equal(new Set(ray.intersectObjects(carbon).map(hit=>hit.object)).size,1,'motor seat and arm cannot have competing top faces');
  }
});
