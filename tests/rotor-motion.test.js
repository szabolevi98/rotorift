import test from 'node:test';
import assert from 'node:assert/strict';
import {RotorMotion,RemoteRotorMotion,validRotorSpeeds} from '../shared/visual/rotor-motion.js';
import * as THREE from 'three';
import {throttleToThrust,motorThrustLimit} from '../shared/physics/propulsion.js';
import {loadCatalog} from '../server/catalog.js';
const {drones}=await loadCatalog();
test('turtle rotors reverse their normal directions, with only the powered pair moving locally and remotely',()=>{
  const config=drones.at(-1),motion=new RemoteRotorMotion(new THREE.Group(),config);
  motion.update(1/60,[-.25,0,-1,0],1,config.motors,true,true);
  assert.deepEqual(motion.fraction,[.5,0,1,0]);
  for(const i of [0,2])assert.equal(Math.sign(motion.speed[i]),-config.motors[i].direction);
  const remote=new RemoteRotorMotion(new THREE.Group(),config);
  remote.updatePlayer(1/60,{connected:true,resetId:1,turtleMode:true,rotorSpeeds:[.5,0,1,0]});
  assert.deepEqual(remote.speed,motion.speed);
});
for(const config of drones)test(`${config.id}: visible rotor speed rises at 25/50/75/100%, stops when disabled, and keeps counter-rotation`,()=>{
  const motion=new RotorMotion(),speeds=[];
  for(const throttle of [.25,.5,.75,1]) {
    motion.update(1/60,Array(4).fill(throttleToThrust(throttle,config)),motorThrustLimit(config),config.motors,true);
    speeds.push(Math.abs(motion.speed[0]));
    assert.ok(motion.speed.every((v,i)=>Math.sign(v)===config.motors[i].direction));
  }
  assert.ok(speeds.every((v,i)=>i===0||v>speeds[i-1]));
  assert.ok(speeds.at(-1)/60<Math.PI/3,'three-blade motion must remain readable at 60 Hz');
  const stopped=[...motion.phase];
  motion.update(1/60,Array(4).fill(1),motorThrustLimit(config),config.motors,false);
  assert.deepEqual(motion.phase,stopped);assert.deepEqual(motion.fraction,[0,0,0,0]);
});

test('remote model animates four motor pivots independently and stops/resets without restoring broken blade meshes',()=>{
  const config=drones.find(c=>c.id==='rift-x5'),model=new THREE.Group(),props=[];
  for(let i=0;i<4;i++) {
    const prop=new THREE.Group();prop.userData={propeller:true,motorIndex:i};model.add(prop);props.push(prop);
    const broken=new THREE.Mesh();broken.visible=false;prop.add(broken);
  }
  const motion=new RemoteRotorMotion(model,config),player={resetId:1,connected:true,finished:false,rotorSpeeds:[0,.25,.5,1]};
  motion.updatePlayer(1/60,player);
  assert.equal(props[0].rotation.y,0);
  assert.ok(Math.abs(props[1].rotation.y)<Math.abs(props[2].rotation.y));
  assert.ok(Math.abs(props[2].rotation.y)<Math.abs(props[3].rotation.y));
  assert.ok(props.every(p=>p.children[0].visible===false),'animation must preserve blade damage');
  for(const stop of [{rotorSpeeds:[0,0,0,0]},{connected:false},{finished:true},{rotorSpeeds:undefined}]) {
    const before=props.map(p=>p.rotation.y);
    motion.updatePlayer(1/60,{...player,...stop});assert.deepEqual(props.map(p=>p.rotation.y),before);
  }
  motion.updatePlayer(1/60,{...player,resetId:2,rotorSpeeds:[0,0,0,0]});
  assert.ok(props.every(p=>p.rotation.y===0));
});

test('wire motor speeds must contain exactly four finite normalized numbers',()=>{
  assert.equal(validRotorSpeeds([0,.25,.75,1]),true);
  for(const value of [null,[],[0,0,0],[0,0,0,0,0],[0,-1,0,0],[0,2,0,0],[0,NaN,0,0],[0,Infinity,0,0],[0,'1',0,0]])assert.equal(validRotorSpeeds(value),false);
});
