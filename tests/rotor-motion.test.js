import test from 'node:test';
import assert from 'node:assert/strict';
import {RotorMotion} from '../shared/visual/rotor-motion.js';
import {throttleToThrust,motorThrustLimit} from '../shared/physics/propulsion.js';
import {loadCatalog} from '../server/catalog.js';
const {drones}=await loadCatalog();
for(const config of drones)test(`${config.id}: visible rotor speed rises at 25/50/75/100%, stops at zero, and keeps counter-rotation`,()=>{
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
