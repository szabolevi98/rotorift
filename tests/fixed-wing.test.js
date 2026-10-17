import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {loadCatalog} from '../server/catalog.js';
import {validateAirplane} from '../shared/physics/config.js';
import {aerodynamicLoads} from '../shared/physics/aerodynamics.js';
import {createAircraftPhysics,aircraftCapabilities} from '../shared/physics/aircraft.js';
import {createTrainerModel,animateTrainer} from '../shared/visual/fixed-wing-model.js';
import {advanceFixedSteps} from '../shared/physics/fixed-step.js';
await RAPIER.init();
const {airplanes}=await loadCatalog(),config=airplanes[0];
const controls={pitch:0,roll:0,yaw:0,throttle:0};
function flight(){const world=new RAPIER.World({x:0,y:-9.81,z:0});return {world,physics:createAircraftPhysics(RAPIER,world,config,[0,100,0],{updateSceneQueries:false})};}
test('trainer configuration, capabilities and geometry are independent of the five quadcopters',()=>{
  assert.equal(config.wingspanM,1.5);assert.equal(config.motors.length,1);assert.equal(aircraftCapabilities(config).racing,false);
  assert.throws(()=>validateAirplane({...config,aero:{...config.aero,areaM2:-1}}));
  const model=createTrainerModel();let props=0,surfaces=0,triangles=0;
  model.traverse(o=>{if(o.userData.propeller)props++;if(o.userData.surface)surfaces++;if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  assert.equal(props,1);assert.equal(surfaces,4);assert.ok(triangles<10000);
  animateTrainer(model,{pitch:.5,roll:.5,yaw:.5},1);assert.equal(model.getObjectByName('T15_propeller').rotation.z,1);
});
test('airflow generates lift and drag, controls lose authority at rest, and signs match Mode 2',()=>{
  const zero=aerodynamicLoads(config,[0,0,0],[0,0,0],{pitch:1,roll:1,yaw:1});assert.ok(zero.force.every(v=>v===0));assert.ok(zero.torque.every(v=>v===0));
  const level=aerodynamicLoads(config,[0,0,-15],[0,0,0],controls);assert.ok(level.force[1]>0&&level.force[2]>0);
  const turn=aerodynamicLoads(config,[0,0,-15],[0,0,0],{pitch:1,roll:1,yaw:1});assert.ok(turn.torque.every(v=>v<0));
  const stalled=aerodynamicLoads(config,[0,-10,-8],[0,0,0],controls);assert.equal(stalled.stall,1);assert.ok(stalled.force.every(Number.isFinite));
  for(const v of [[0,0,15],[0,15,0],[15,0,0],[0,-15,0]])assert.ok(aerodynamicLoads(config,v,[3,-3,3],controls).force.every(Number.isFinite));
});
test('unpowered trainer glides and loses mechanical energy instead of hovering',()=>{
  const {world,physics:p}=flight();const energy=()=>.5*config.massKg*Math.hypot(...p.pose.v)**2+config.massKg*9.81*p.pose.p[1],initial=energy();
  for(let i=0;i<2400;i++)p.step(controls);
  assert.ok(p.pose.p[1]<99&&p.pose.p[1]>50);assert.ok(p.pose.p[2]<-70);assert.ok(energy()<initial);assert.equal(p.motorThrust[0],0);world.free();
});
test('powered flight, extreme stalls, reset and 30/60/120/144 Hz display cadences stay finite and deterministic',()=>{
  const paths=[];
  for(const hz of [30,60,120,144]){const {world,physics:p}=flight(),clock={accumulator:0};p.armed=true;
    for(let i=0;i<hz*4;i++)advanceFixedSteps(clock,1/hz,()=>p.step({...controls,throttle:.45}));
    paths.push(p.pose.p);world.free();}
  for(const path of paths)assert.ok(Math.hypot(...path.map((v,i)=>v-paths[0][i]))<.03);
  const {world,physics:p}=flight();p.armed=true;
  for(let i=0;i<240*20;i++)p.step({pitch:Math.sin(i/240),roll:1,yaw:-1,throttle:1});
  assert.ok([...p.pose.p,...p.pose.v,...Object.values(p.pose.q)].every(Number.isFinite));
  p.reset([0,65,0]);assert.equal(p.armed,false);assert.deepEqual(p.pose.v,[0,0,-15]);world.free();
});
test('wing tips collide, while single-motor battery and disabled quad-only effects follow capabilities',()=>{
  const {world,physics:p}=flight();world.createCollider(RAPIER.ColliderDesc.cuboid(.08,1,.1).setTranslation(.67,100,-1));p.armed=true;p.effects.setOptions({battery:true,propwash:true,propDamage:true});
  assert.equal(p.effects.options.propwash,false);assert.equal(p.effects.options.propDamage,false);
  for(let i=0;i<120;i++)p.step({...controls,throttle:.6});
  assert.ok(Math.abs(p.pose.v[0])>.01||p.crashed||Math.abs(p.pose.w[1])>.05,'wing collision affects the airframe');
  assert.ok(p.effects.usedMah>0);assert.ok(p.effects.telemetry.voltage>0);world.free();
});
