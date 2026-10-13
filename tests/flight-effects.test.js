import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { loadCatalog } from "../server/catalog.js";
import { FlightEffects } from "../shared/physics/flight-effects.js";
import { DronePhysics, PHYSICS_DT } from "../shared/physics/drone.js";
import { motorThrustLimit, hoverThrottle } from "../shared/physics/propulsion.js";
import { DEFAULT_SIMULATION, normalizeSimulation, validSimulation, simulationKey } from "../shared/simulation/options.js";
import { RemoteCollisions } from "../web/game/remote-collisions.js";
await RAPIER.init();
const { drones } = await loadCatalog(), config = drones.find(d => d.id === "rift-x5");
const q = {x:0,y:0,z:0,w:1}, neutral = {roll:0,pitch:0,yaw:0,throttle:0};

test("simulation options reject malformed room rules and have distinct record categories", () => {
  assert.equal(simulationKey(), "00010");
  assert.deepEqual(normalizeSimulation(null), DEFAULT_SIMULATION);
  for (const value of [null, [], {battery:1}, {wind:"storm"}, {cheat:true}]) assert.equal(validSimulation(value), false);
  const keys = new Set();
  for (let flags = 0; flags < 16; flags++) for (const wind of ["calm","light","medium","strong"])
    keys.add(simulationKey({battery:!!(flags&1),propDamage:!!(flags&2),propwash:!!(flags&4),ghost:!!(flags&8),wind}));
  assert.equal(keys.size, 64);
});

for (const c of drones) test(`${c.id}: load drains the configured battery, warnings latch and reset restores it`, () => {
  const effects = new FlightEffects(c, {battery:true}), thrust = Array(4).fill(motorThrustLimit(c));
  effects.update(60, false, thrust, [0,0,0], q);
  assert.equal(effects.usedMah, 0, "disarmed battery does not drain");
  let low = false, critical = false;
  for (let i = 0; i < 1000; i++) {
    effects.update(0.25, true, thrust, [0,0,0], q);
    low ||= effects.batteryState === "low";
    if (effects.batteryState === "critical") { critical = true; assert.ok(effects.throttleLimit < 0.6); }
    if (effects.charge === 0) break;
  }
  assert.ok(low && critical);
  assert.equal(effects.charge, 0);
  assert.equal(effects.usedMah, c.battery.capacityMah);
  effects.update(5, false, [0,0,0,0], [0,0,0], q);
  assert.equal(effects.batteryState, "critical", "landing warning cannot disappear when voltage rebounds");
  assert.equal(effects.throttleLimit, 0, "an exhausted pack cannot keep producing thrust");
  assert.equal(effects.powerFactor, 0);
  effects.reset();
  assert.equal(effects.charge, 1); assert.equal(effects.throttleLimit, 1); assert.equal(effects.batteryState,"normal");
  const disabled = new FlightEffects(c);
  disabled.update(1000, true, thrust, [0,-10,0], q);
  assert.equal(disabled.powerFactor, 1); assert.equal(disabled.charge,1); assert.equal(disabled.motorEfficiency(0),1);
});

test("propwash is tied to powered descent through the wake and disappears with horizontal escape", () => {
  const effects = new FlightEffects(config, {propwash:true});
  for(let i=0;i<120;i++)effects.update(PHYSICS_DT,true,[1,1,1,1],[0,-7,0],q);
  assert.ok(effects.wash > 0.9); assert.ok(effects.motorEfficiency(0) < 0.95);
  for(let i=0;i<240;i++)effects.update(PHYSICS_DT,true,[1,1,1,1],[20,-7,0],q);
  assert.ok(effects.wash < 0.01);
  effects.setOptions({propwash:false}); assert.equal(effects.motorEfficiency(0),1);
});

test("calm has no disturbance; increasing wind produces increasing actual drift", () => {
  const positions = [];
  for(const wind of ["calm","light","medium","strong"]){
    const world=new RAPIER.World({x:0,y:-9.81,z:0});
    try {
      const drone=new DronePhysics(RAPIER,world,config,[0,10,0],{simulation:{wind}});drone.armed=true;
      for(let i=0;i<480;i++)drone.step({...neutral,throttle:hoverThrottle(config)});
      positions.push(drone.pose.p[0]);
    } finally {world.free();}
  }
  assert.ok(Math.abs(positions[0])<0.001);
  for(let i=1;i<positions.length;i++)assert.ok(positions[i]>positions[i-1]+0.02,JSON.stringify(positions));
});

test("real propeller contact damages thrust while safe resting and reset do not", () => {
  const world=new RAPIER.World({x:0,y:0,z:0});
  try {
    const drone=new DronePhysics(RAPIER,world,config,[0,1,0],{updateSceneQueries:false,simulation:{propDamage:true}});
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.03,1,1).setTranslation(0.25,1,0));
    drone.armed=true;drone.body.setLinvel({x:10,y:0,z:0},true);
    for(let i=0;i<48;i++)drone.step(neutral);
    assert.ok(Math.max(...drone.effects.damage)>0,"wall impact must damage a rotating propeller");
    const index=drone.effects.damage.indexOf(Math.max(...drone.effects.damage));
    assert.ok(drone.effects.motorEfficiency(index)<1);
    drone.reset([0,1,0]);assert.deepEqual(drone.effects.damage,[0,0,0,0]);
    drone.armed=true;for(let i=0;i<48;i++)drone.step(neutral);
    assert.deepEqual(drone.effects.damage,[0,0,0,0]);
  } finally {world.free();}
});

test("critical battery limits physical thrust rather than only the HUD percentage", () => {
  const world=new RAPIER.World({x:0,y:0,z:0});
  try {
    const drone=new DronePhysics(RAPIER,world,config,[0,10,0],{simulation:{battery:true}});
    drone.effects.usedMah=config.battery.capacityMah*0.98;drone.armed=true;
    for(let i=0;i<120;i++)drone.step({...neutral,throttle:1});
    assert.equal(drone.effects.batteryState,"critical");
    assert.ok(drone.motorThrust.reduce((a,b)=>a+b,0)<motorThrustLimit(config)*1.5);
    assert.ok(drone.effects.throttleLimit<0.5);
  } finally {world.free();}
});

test("ghost mode removes actual remote colliders, solid drones collide, and leave/reset release proxies", () => {
  const positions=[];
  for(const ghost of [true,false]){
    const world=new RAPIER.World({x:0,y:0,z:0});
    try {
      const drone=new DronePhysics(RAPIER,world,config,[-0.6,2,0],{updateSceneQueries:false});
      const remote=new RemoteCollisions(RAPIER,world,config);
      remote.update([{id:"peer",p:[0,2,0],q,resetId:1}],"self",ghost);
      assert.equal(remote.bodies.size,ghost?0:1);
      drone.body.setLinvel({x:4,y:0,z:0},true);
      for(let i=0;i<120;i++){remote.step(PHYSICS_DT);drone.step(neutral);}
      positions.push(drone.pose.p[0]);
      remote.update([{id:"peer",p:[5,2,0],q,resetId:2}],"self",false);
      assert.equal(remote.bodies.get("peer").translation().x,5,"reset snaps without a sweeping collider");
      remote.update([],"self",false);assert.equal(remote.bodies.size,0);
      remote.dispose();assert.equal(world.bodies.len(),1);
    } finally {world.free();}
  }
  assert.ok(positions[0]>0.8,`ghost passed: ${positions[0]}`);
  assert.ok(positions[1]<0,`solid collided: ${positions[1]}`);
});
