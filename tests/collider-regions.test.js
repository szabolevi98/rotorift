import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { readFile } from "node:fs/promises";
import { ColliderRegions } from "../shared/world/collider-regions.js";
import { DronePhysics } from "../shared/physics/drone.js";
import { hoverThrottle } from "../shared/physics/propulsion.js";
await RAPIER.init();
const config = JSON.parse(await readFile(new URL("../data/drones/rift-x5.json", import.meta.url)));

test("local collision regions retain long shapes, re-enable on teleport, and do not churn on small movement", () => {
  const world = new RAPIER.World({x:0,y:-9.81,z:0}), regions = new ColliderRegions();
  const near = world.createCollider(RAPIER.ColliderDesc.cuboid(1,1,1));
  const far = world.createCollider(RAPIER.ColliderDesc.cuboid(1,1,1).setTranslation(150,0,0));
  const beam = world.createCollider(RAPIER.ColliderDesc.cuboid(200,0.1,0.1).setTranslation(210,10,0));
  regions.add(near,[-1,-1,-1],[1,1,1]); regions.add(far,[149,-1,-1],[151,1,1]);
  regions.add(beam,[10,9.9,-0.1],[410,10.1,0.1]);
  assert.ok(regions.update([0,0,0])); assert.ok(near.isEnabled()); assert.ok(!far.isEnabled()); assert.ok(beam.isEnabled());
  assert.equal(regions.update([0.001,0,0]), false);
  assert.ok(regions.update([150,0,0])); assert.ok(far.isEnabled()); assert.ok(!near.isEnabled());
  regions.remove(far); regions.clear(); assert.equal(regions.activeCount,0); world.free();
});

test("60 m/s aircraft reactivates a distant wall well before CCD contact", () => {
  const world = new RAPIER.World({x:0,y:-9.81,z:0}), regions = new ColliderRegions();
  const wall = world.createCollider(RAPIER.ColliderDesc.cuboid(0.1,20,20).setTranslation(150,15,0));
  regions.add(wall,[149.9,-5,-20],[150.1,35,20]); regions.update([0,15,0]); assert.equal(wall.isEnabled(),false);
  const drone = new DronePhysics(RAPIER,world,config,[0,15,0],{updateSceneQueries:false}); drone.armed=true;
  const input = {throttle:hoverThrottle(config),roll:0,pitch:0,yaw:0};
  let maxX=0, activeBeforeContact=false;
  for(let frame=0;frame<200;frame++) {
    const p=drone.pose.p; regions.update(p,drone.pose.v);
    if(p[0]<120 && wall.isEnabled())activeBeforeContact=true;
    if(p[0]<149)drone.body.setLinvel({x:60,y:0,z:0},true);
    for(let step=0;step<4;step++){drone.step(input); maxX=Math.max(maxX,drone.pose.p[0]);}
  }
  assert.ok(activeBeforeContact); assert.ok(maxX>148 && maxX<150,"the aircraft must reach, but not pass through, the wall");
  world.free();
});
test("velocity changes preload the new direction even before the aircraft moves",()=>{
  const world=new RAPIER.World({x:0,y:0,z:0}),regions=new ColliderRegions();
  const ahead=world.createCollider(RAPIER.ColliderDesc.cuboid(1,1,1).setTranslation(45,0,0));
  const behind=world.createCollider(RAPIER.ColliderDesc.cuboid(1,1,1).setTranslation(-45,0,0));
  regions.add(ahead,[44,-1,-1],[46,1,1]);regions.add(behind,[-46,-1,-1],[-44,1,1]);
  regions.update([0,0,0],[100,0,0]);assert.ok(ahead.isEnabled());assert.ok(!behind.isEnabled());
  assert.ok(regions.update([0,0,0],[-100,0,0]));assert.ok(behind.isEnabled());assert.ok(!ahead.isEnabled());
  regions.clear();world.free();
});

test("skipping unused scene queries preserves the full physics/contact/CCD trajectory", () => {
  const simulate = (updateSceneQueries) => {
    const world = new RAPIER.World({x:0,y:-9.81,z:0});
    world.createCollider(RAPIER.ColliderDesc.cuboid(20,0.5,20).setTranslation(0,-0.5,0));
    const drone = new DronePhysics(RAPIER,world,config,[0,0.15,0],{updateSceneQueries}); drone.armed=true;
    const poses=[];
    for(let i=0;i<600;i++) {
      drone.step({throttle:i<120?0.3:0.26,roll:i>120&&i<240?0.5:0,pitch:0,yaw:0});
      if(i%60===0)poses.push(drone.pose);
    }
    world.free(); return poses;
  };
  assert.deepEqual(simulate(false),simulate(true));
});
