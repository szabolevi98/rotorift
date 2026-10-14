import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {loadCatalog} from '../server/catalog.js';
import {DronePhysics} from '../shared/physics/drone.js';
import {advanceFixedSteps} from '../shared/physics/fixed-step.js';
import {hoverThrottle} from '../shared/physics/propulsion.js';
await RAPIER.init();
const {drones}=await loadCatalog();
function fly(config, intervals) {
  const world=new RAPIER.World({x:0,y:-9.81,z:0});
  const drone=new DronePhysics(RAPIER,world,config,[0,30,0],{simulation:{battery:true}});
  drone.armed=true;
  const clock={accumulator:0};let ticks=0;
  try {
    for(const dt of intervals)advanceFixedSteps(clock,dt,()=>{
      const pitch=ticks>=240&&ticks<480?.1:0,roll=ticks>=360&&ticks<420?.15:0;
      drone.step({roll,pitch,yaw:.04,throttle:hoverThrottle(config)});ticks++;
    });
    return {ticks,pose:drone.pose,motors:[...drone.motorThrust],usedMah:drone.effects.usedMah};
  }finally{world.free();}
}
for(const config of drones)test(config.id+': identical flight, rotation and battery at 30/35/60/75/120/144/240 Hz and mixed frame drops',()=>{
  const reference=fly(config,Array(180).fill(1/60));
  assert.equal(reference.ticks,720);
  for(const hz of [30,35,75,120,144,240])assert.deepEqual(fly(config,Array(3*hz).fill(1/hz)),reference,`${hz} Hz must not change simulation speed`);
  const frames=[];let time=0,i=0;
  while(time<3-1e-12){const dt=Math.min([1/60,1/35,1/120][i++%3],3-time);frames.push(dt);time+=dt;}
  assert.deepEqual(fly(config,frames),reference,'intermittent 60 → 35 FPS must retain the same flight');
});
test('long stalls are capped to 24 ticks rather than an unlimited catch-up loop',()=>{
  const clock={accumulator:0};let ticks=0;
  assert.equal(advanceFixedSteps(clock,.5,()=>ticks++),24);assert.equal(ticks,24);
  assert.equal(advanceFixedSteps(clock,-1,()=>ticks++),0);
});
