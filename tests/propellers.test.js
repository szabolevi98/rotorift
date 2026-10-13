import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import {loadCatalog} from "../server/catalog.js";
import {DronePhysics,PHYSICS_DT} from "../shared/physics/drone.js";
import {PropellerDamage,freshPropellers,validPropellers,propellerState} from "../shared/physics/propellers.js";
import {FlightEffects} from "../shared/physics/flight-effects.js";
import {hoverThrottle} from "../shared/physics/propulsion.js";
await RAPIER.init();
const {drones}=await loadCatalog(),x5=drones.find(c=>c.id==='rift-x5');
const neutral={roll:0,pitch:0,yaw:0,throttle:0};
test('four independent rotors have discrete blade states, irreversible strikes and complete failure',()=>{
 const p=new PropellerDamage(x5);
 for(let i=0;i<4;i++){
  p.impact(i,4,i,0,true);assert.equal(propellerState(p.blades[i]),'bent');
  assert.ok(p.blades.slice(i+1).every(blades=>blades.every(v=>v===0)));
 }
 p.impact(0,8,5,0,true);assert.equal(propellerState(p.blades[0]),'chipped');
 p.impact(0,13,6,0,true);assert.equal(propellerState(p.blades[0]),'broken');
 assert.ok(p.efficiency(0,6)<p.efficiency(1,6));
 p.impact(0,30,7,0,true);assert.equal(propellerState(p.blades[0]),'destroyed');assert.equal(p.efficiency(0,8),0);
 const broken=[...p.blades[0]];p.impact(0,4,8);assert.deepEqual(p.blades[0],broken);
 p.reset();assert.deepEqual(p.blades,freshPropellers());
 assert.ok(validPropellers(p.blades));for(const value of [null,[0,0,0,0],[[4,0,0],[0,0,0],[0,0,0],[0,0,0]]])assert.equal(validPropellers(value),false);
});
test('weak contact does not damage props; disabling and reset replace all blades',()=>{
 const fx=new FlightEffects(x5,{propDamage:true});fx.impact(0,1,0,true);assert.deepEqual(fx.propellers.blades,freshPropellers());
 fx.impact(2,30,0,true);assert.equal(fx.motorEfficiency(2),0);
 fx.setOptions({propDamage:false});assert.deepEqual(fx.propellers.blades,freshPropellers());assert.equal(fx.motorEfficiency(2),1);
});
test('an actual local obstacle strikes only the front left X5 rotor',()=>{
 const world=new RAPIER.World({x:0,y:0,z:0});
 try{
  const drone=new DronePhysics(RAPIER,world,x5,[0,1,0],{updateSceneQueries:false,simulation:{propDamage:true}});
  world.createCollider(RAPIER.ColliderDesc.cuboid(.008,.03,.010).setTranslation(-.19,.98,-.076));
  drone.armed=true;drone.body.setLinvel({x:-8,y:0,z:0},true);
  for(let i=0;i<24;i++)drone.step(neutral);
  assert.ok(drone.effects.propellers.blades[0].some(v=>v>0));
  assert.deepEqual(drone.effects.propellers.blades.slice(1),[[0,0,0],[0,0,0],[0,0,0]]);
 }finally{world.free();}
});
for(const config of drones.filter(c=>c.category!=='freestyle'))test(`${config.id}: ring protects a side hit, but a narrow obstacle inside the ring hits a blade`,()=>{
 function scenario(inside){
  const world=new RAPIER.World({x:0,y:0,z:0});
  try{
   const motor=config.motors[0].positionM,rad=config.propDiameterM/2;
   const drone=new DronePhysics(RAPIER,world,config,[0,1,0],{updateSceneQueries:false,simulation:{propDamage:true}});
   drone.armed=true;
   // Let the motor reach armed idle before striking the obstacle; a freshly
   // armed, almost stationary blade has a different fracture threshold.
   for(let i=0;i<24;i++)drone.step(neutral);
   drone.body.setTranslation({x:0,y:1,z:0},true);
   if(inside){
    world.createCollider(RAPIER.ColliderDesc.cuboid(rad*.07,.008,rad*.07).setTranslation(motor[0]-rad*.55,1+motor[1]-.013,motor[2]));
    drone.body.setLinvel({x:0,y:-5,z:0},true);
   }else{
    world.createCollider(RAPIER.ColliderDesc.cuboid(.005,.15,rad*.3).setTranslation(motor[0]-rad*1.8,1+motor[1],motor[2]));
    drone.body.setLinvel({x:-3,y:0,z:0},true);
   }
   for(let i=0;i<24;i++)drone.step(neutral);
   return drone.effects.propellers.blades;
  }finally{world.free();}
 }
 assert.deepEqual(scenario(false),freshPropellers(),'side bump should hit the protective ring first');
 assert.ok(scenario(true)[0].some(v=>v>0),'a pole through the open ring must reach the rotor');
});
test('destroying one rotor produces actual loss of control and a hub-only collider',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0});
 try{
  const drone=new DronePhysics(RAPIER,world,x5,[0,10,0],{simulation:{propDamage:true}});drone.armed=true;
  for(let i=0;i<60;i++)drone.step({...neutral,throttle:hoverThrottle(x5)});
  assert.ok(Math.hypot(drone.pose.w[0],drone.pose.w[2])<.01);
  drone.effects.propellers.blades[0]=[3,3,3];
  for(let i=0;i<120;i++)drone.step({...neutral,throttle:hoverThrottle(x5)});
  assert.equal(drone.effects.motorEfficiency(0),0);
  assert.ok(Math.hypot(drone.pose.w[0],drone.pose.w[2])>1,'three surviving rotors cannot sustain neutral hover');
  assert.ok(drone.propColliders[0].shape.radius<x5.propDiameterM*.1);
  drone.reset([0,10,0]);drone.step(neutral);assert.deepEqual(drone.effects.propellers.blades,freshPropellers());
  assert.equal(drone.propColliders[0].shape.radius,x5.propDiameterM*.48);
 }finally{world.free();}
});
