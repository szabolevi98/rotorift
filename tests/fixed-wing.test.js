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
const {airplanes}=await loadCatalog(),config=airplanes.find(c=>c.id==='rift-t15');
const controls={pitch:0,roll:0,yaw:0,throttle:0};
function flight(){const world=new RAPIER.World({x:0,y:-9.81,z:0});return {world,physics:createAircraftPhysics(RAPIER,world,config,[0,100,0],{updateSceneQueries:false})};}
test('trainer configuration, capabilities and geometry are independent of the five quadcopters',()=>{
  assert.equal(config.wingspanM,1.5);assert.equal(config.motors.length,1);assert.equal(aircraftCapabilities(config).racing,true);
  assert.throws(()=>validateAirplane({...config,aero:{...config.aero,areaM2:-1}}));
  const model=createTrainerModel();let props=0,surfaces=0,triangles=0,draws=0;
  model.traverse(o=>{if(o.userData.propeller)props++;if(o.userData.surface)surfaces++;if(o.isMesh){draws++;assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));}if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  assert.equal(props,1);assert.equal(surfaces,4);assert.ok(triangles<10000);assert.ok(draws<=20,"detailed static parts remain batched");
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
  assert.equal(p.effects.options.propwash,true);assert.equal(p.effects.options.propDamage,true);
  for(let i=0;i<120;i++)p.step({...controls,throttle:.6});
  assert.ok(Math.abs(p.pose.v[0])>.01||p.crashed||Math.abs(p.pose.w[1])>.05,'wing collision affects the airframe');
  assert.ok(p.effects.usedMah>0);assert.ok(p.effects.telemetry.voltage>0);world.free();
});

import {createAircraftVisual} from '../web/game/aircraft-visual.js';
import {RemoteCollisions} from '../web/game/remote-collisions.js';
import {aircraftRoutes,routeSupportsAircraft} from '../shared/aircraft/capabilities.js';
import {selectAircraftRoute,routePreferenceKey} from '../web/aircraft-menu.js';
import {RouteDraft} from '../shared/race/editor.js';

test('local and remote trainer visuals animate one axial rotor and independent hinged surfaces',()=>{
  const model=createTrainerModel(),visual=createAircraftVisual(model,config);
  const physics={armed:true,motorThrust:[7],surfaces:{pitch:-.2,roll:.3,yaw:.1}};
  visual.bindPhysics(physics);visual.update(.1,physics,{throttle:.5});
  const prop=model.getObjectByName('T15_propeller');assert.notEqual(prop.rotation.z,0);assert.equal(prop.rotation.y,0);
  const payload=visual.networkState(physics,false);assert.deepEqual(Object.keys(payload),['animation']);assert.equal(payload.animation.engine,Math.SQRT1_2);
  const remoteModel=createTrainerModel(),remote=createAircraftVisual(remoteModel,config,{remote:true});remote.updateRemote(.1,{...payload,resetId:1});
  assert.notEqual(remoteModel.getObjectByName('T15_propeller').rotation.z,0);
  const elevator=[];remoteModel.traverse(o=>{if(o.userData.surface==='elevator')elevator.push(o)});assert.ok(Math.abs(elevator[0].rotation.x+.08)<1e-12);
  remote.updateRemote(.1,{...payload,resetId:1,connected:false});assert.equal(remote.motorSpeeds[0],0);assert.equal(elevator[0].rotation.x,0);
  visual.reset();assert.equal(visual.motorSpeeds[0],0);visual.dispose();remote.dispose();
});

test('trainer wing collision proxies block contact and ghost mode removes all remote geometry',()=>{
  const results=[];
  for(const ghost of [true,false]){
    const world=new RAPIER.World({x:0,y:0,z:0}),p=createAircraftPhysics(RAPIER,world,config,[-1.8,30,0],{updateSceneQueries:false}),remote=new RemoteCollisions(RAPIER,world,config);
    remote.update([{id:'peer',p:[0,30,0],q:{x:0,y:0,z:0,w:1},resetId:1}],'self',ghost);
    p.body.setLinvel({x:4,y:0,z:0},true);
    for(let i=0;i<120;i++){remote.step(1/240);p.step(controls);}
    results.push(p.pose.p[0]);remote.update([],'self',false);assert.equal(remote.bodies.size,0);assert.equal(world.bodies.len(),1);remote.dispose();world.free();
  }
  assert.ok(results[0]>-.3,JSON.stringify(results));assert.ok(results[1]<-1,JSON.stringify(results));
});

test('route selection preserves old drone preferences and isolates airplane courses through editor round trips',async()=>{
  const catalog=await loadCatalog(),park=catalog.maps[0],quad=catalog.drones[0];
  assert.equal(aircraftRoutes(park,quad).length,3);assert.equal(aircraftRoutes(park,config).length,2);
  assert.equal(selectAircraftRoute(park,quad,'wing_1').routeId,'race_1');assert.equal(selectAircraftRoute(park,config,'race_1').routeId,'wing_1');
  assert.equal(routePreferenceKey(park,quad),'selected-race-liget');assert.equal(routePreferenceKey(park,config),'selected-race-liget-fixedWing');
  assert.equal(selectAircraftRoute(catalog.maps.find(m=>m.id==='jatszoter'),config).gates.length,0);
  for(const map of catalog.maps.filter(m=>m.kind!=='playground')){
    assert.equal(aircraftRoutes(map,config).length,2);
    assert.equal(aircraftRoutes(map,quad).length,3);
    assert.equal(selectAircraftRoute(map,config,'race_1').routeId,'wing_1');
  }
  for(const route of catalog.maps.flatMap(map=>aircraftRoutes(map,config))){
    const draft=new RouteDraft(park,route);draft.setGate(1,{width:20});assert.deepEqual(draft.export().aircraftKinds,['fixedWing']);
    assert.ok(route.gates.every(g=>g.width>=18&&g.height>=14));assert.equal(routeSupportsAircraft(route,quad),false);
  }
});


test('mixed remote collision proxies use each aircraft dimensions and rebuild after a model change',async()=>{
  const {drones,airplanes}=await loadCatalog(),catalog=new Map([...drones,...airplanes].map(c=>[c.id,c]));
  const quad=drones.find(c=>c.id==='rift-x5'),tiny=drones.find(c=>c.id==='rift-65');
  const world=new RAPIER.World({x:0,y:0,z:0}),remote=new RemoteCollisions(RAPIER,world,quad,p=>catalog.get(p.droneId));
  const player=(id,c,x)=>({id,droneId:c.id,p:[x,30,0],q:{x:0,y:0,z:0,w:1},resetId:1});
  try{
    const players=[player('plane',config,0),player('tiny',tiny,4),player('quad',quad,8)];
    remote.update(players,'self',false);
    assert.equal(remote.bodies.size,3);
    for(const p of players)assert.equal(remote.bodies.get(p.id).userData.config.id,p.droneId);
    assert.equal(remote.bodies.get('plane').userData.propColliders.length,0);
    const tinyBody=remote.bodies.get('tiny'),quadBody=remote.bodies.get('quad');
    assert.ok(tinyBody.userData.propColliders[0].shape.radius<quadBody.userData.propColliders[0].shape.radius);
    // A ray through the wingtip hits an aircraft much wider than our own quad.
    world.updateSceneQueries();
    const hit=world.castRay(new RAPIER.Ray({x:.6,y:31,z:0},{x:0,y:-1,z:0}),2,true);
    assert.equal(hit?.collider.parent().handle,remote.bodies.get('plane').handle);
    remote.update([player('tiny',config,4)],'self',false);
    assert.notEqual(remote.bodies.get('tiny'),tinyBody);
    assert.equal(remote.bodies.get('tiny').userData.config.kind,'fixedWing');
    assert.equal(world.bodies.len(),1);
    remote.update([{...player('tiny',config,4),droneId:'unknown'}],'self',false);assert.equal(world.bodies.len(),0);
    remote.update(players,'self',true);assert.equal(remote.bodies.size,0);assert.equal(world.bodies.len(),0);
  }finally{remote.dispose();world.free();}
});
