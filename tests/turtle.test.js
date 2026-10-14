import test from 'node:test';import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';import {loadCatalog} from '../server/catalog.js';
import {DronePhysics} from '../shared/physics/drone.js';import {rotate} from '../shared/physics/math.js';import {turtleThrust} from '../shared/physics/turtle.js';
await RAPIER.init();const {drones}=await loadCatalog(),zero={roll:0,pitch:0,yaw:0,throttle:0},inverted={x:0,y:0,z:1,w:0};
for(const c of drones)for(const stick of [{roll:.65},{pitch:.65},{roll:1},{pitch:1},{roll:-1},{pitch:-1}])test(c.id+': turtle recovers and settles with '+JSON.stringify(stick),()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.createCollider(RAPIER.ColliderDesc.cuboid(20,.1,20).setTranslation(0,-.1,0).setFriction(.8));
 const drone=new DronePhysics(RAPIER,world,c,[0,.2,0],{simulation:{battery:true}});drone.body.setRotation(inverted,true);
 try{
  for(let i=0;i<120;i++)drone.step(zero);
  assert.ok(drone.setTurtleMode(true));drone.armed=true;assert.equal(drone.setTurtleMode(false),false);
  for(let i=0;i<60;i++)drone.step({...zero,throttle:1,yaw:1});assert.ok(drone.motorThrust.every(v=>v===0),'throttle and yaw do not drive turtle motors');
  let recovered=false;
  for(let i=0;i<960;i++){
   drone.step({...zero,...stick});
   if(rotate([0,1,0],drone.body.rotation())[1]>.8){recovered=true;break;}
  }
  assert.ok(recovered,'reverse thrust must physically turn the aircraft back over');
  assert.ok(drone.effects.usedMah>0,'battery current counts reverse-running motors');
  drone.armed=false;assert.ok(drone.setTurtleMode(false));assert.ok(drone.motorThrust.every(v=>v===0));
  for(let i=0;i<240;i++)drone.step(zero);
  assert.ok(rotate([0,1,0],drone.body.rotation())[1]>.8,'recovered aircraft must settle upright after disarming');
  drone.reset([0,.2,0]);assert.equal(drone.turtleMode,false);assert.equal(drone.armed,false);
 }finally{world.free();}
});
test('turtle motor demand is finite, ignores throttle/yaw, stops upright, and selects opposing pairs',()=>{
 const c=drones.at(-1),right=turtleThrust(c,{...zero,roll:1},inverted,10),left=turtleThrust(c,{...zero,roll:-1},inverted,10);
 assert.equal(right.filter(v=>v<0).length,2);assert.ok(right.every((v,i)=>v===0?left[i]<0:left[i]===0));
 assert.deepEqual(turtleThrust(c,{...zero,roll:1},{x:0,y:0,z:0,w:1},10),[0,0,0,0]);
});

test('turtle selection preserves crash damage and battery consumption rather than resetting the aircraft',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0}),drone=new DronePhysics(RAPIER,world,drones.at(-1),[0,1,0],{simulation:{battery:true,propDamage:true}});
 try{
  drone.effects.propellers.blades[0]=[3,3,3];drone.effects.usedMah=120;const pose=drone.pose;
  assert.ok(drone.setTurtleMode(true));assert.ok(drone.setTurtleMode(false));
  assert.deepEqual(drone.effects.propellers.blades[0],[3,3,3]);assert.equal(drone.effects.usedMah,120);assert.deepEqual(drone.pose,pose);
 }finally{world.free();}
});
