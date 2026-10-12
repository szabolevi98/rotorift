import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildConstruction, CONSTRUCTION_VIEW_DISTANCE } from "../web/game/construction.js";
import { CONSTRUCTION_BUILDINGS, CONSTRUCTION_CRANES, CONSTRUCTION_PIT, CONSTRUCTION_VEHICLES, CONSTRUCTION_EARTHWORKS, CONSTRUCTION_HANGAR, CONSTRUCTION_ROAD_HEIGHT, constructionHeight, constructionSurfaceHeight, floorOpening } from "../shared/world/construction-layout.js";
import { DronePhysics } from "../shared/physics/drone.js";
import { CONSTRUCTION_LANDSCAPE_RINGS } from "../web/game/construction-landscape.js";
const map = JSON.parse(await readFile(new URL("../data/maps/betonudvar.json", import.meta.url)));
await RAPIER.init();

test("construction site has open bays/shafts, a clear main road, a real excavation and hollow pipes", () => {
  const scene = new THREE.Scene(), world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const site = buildConstruction(scene, world, RAPIER, map); world.step();
  try {
    assert.equal(map.size, 600); assert.equal(map.boundary.returnAfterSeconds, 600);
    assert.equal(map.racingEnabled, false); assert.deepEqual(map.gates, []);
    assert.ok(Math.max(...CONSTRUCTION_CRANES.map(c => c.height)) >= 75);
    assert.equal(CONSTRUCTION_VEHICLES.length, 8);
    const ray = (p, direction, distance) => world.castRay(new RAPIER.Ray({ x: p[0], y: p[1], z: p[2] }, { x: direction[0], y: direction[1], z: direction[2] }), distance, true);
    assert.equal(ray([0, 1.8, 255], [0, 0, -1], 535), null, "central working road must stay open");
    for (const b of CONSTRUCTION_BUILDINGS) {
      const [x, z] = floorOpening(b), base = constructionHeight(b.x, b.z), height = b.levels * b.storey + base;
      const shaft = ray([x, height + 4, z], [0, -1, 0], height + 8);
      assert.ok(shaft && Math.abs(shaft.timeOfImpact - (height + 4 - base - 0.24)) < 0.05, b.id + ": shaft must reach the foundation");
      assert.equal(ray([x, base + 2.2, b.z - b.depth / 2 - 1], [0, 0, 1], b.depth + 2), null, b.id + ": first level must be flyable");
      const column = ray([b.x - b.width / 2 - 3, base + 2, b.z - b.depth / 2], [1, 0, 0], 4);
      assert.ok(column, b.id + ": concrete columns must collide");
    }
    const p = CONSTRUCTION_PIT;
    for (const [x, z] of [[p.x + 5, p.z], [p.x + p.width / 2 - 2, p.z], [p.x + p.width / 2 + 2, p.z]]) {
      const hit = ray([x, 8, z], [0, -1, 0], 20);
      assert.ok(hit && Math.abs((8 - hit.timeOfImpact) - constructionHeight(x, z)) < 0.03, "pit ground and slopes must match their collision surface");
    }
    const pipeBase = constructionHeight(164, 193);
    assert.equal(ray([157, pipeBase + 1.55, 187], [0, 0, 1], 12), null, "precast pipe opening must have no invisible box");
    assert.ok(ray([158.5, pipeBase + 1.55, 187], [0, 0, 1], 12), "pipe wall must collide");
    assert.ok(ray([800, 10, 800], [0, -1, 0], 12), "ground continues outside the fence");
    assert.ok(CONSTRUCTION_VIEW_DISTANCE >= 10000);
    assert.ok(site.root.userData.instances > 4000);
    assert.ok(site.root.userData.batches < 340, "repeated details including new work yards must remain instanced");
    console.log("construction geometry:", site.root.userData.instances, "parts in", site.root.userData.batches, "batches;", site.root.userData.colliders, "colliders");
  } finally {
    site.dispose(); assert.equal(scene.children.length, 0); assert.equal(world.colliders.len(), 0); world.free();
  }
});

test("earthwork terrain, ramps and level building pads agree with the visible collision surface", () => {
  const scene = new THREE.Scene(), world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const site = buildConstruction(scene, world, RAPIER, map);
  try {
    const terrain = site.root.children.filter(o => o.name.startsWith("earthworks-"));
    assert.equal(terrain.length, 36);
    const groundHit = (x,z) => {
      site.update([x, constructionHeight(x,z)+2, z]);world.step();
      return world.castRay(new RAPIER.Ray({x,y:40,z},{x:0,y:-1,z:0}),70,true,undefined,undefined,
        collider => collider.shape.type === RAPIER.ShapeType.TriMesh);
    };
    let min = Infinity, max = -Infinity;
    for (let x = -275; x <= 275; x += 25) for (let z = -275; z <= 275; z += 25) {
      const y = constructionHeight(x,z);min=Math.min(min,y);max=Math.max(max,y);
    }
    assert.ok(max-min > 14,"the site has substantial relief rather than a flat base with decoration");
    for (const [x,z] of [[273.3,54.7],[58.8,-223.1],[-214.7,59.1],[-180.2,-204.3],[247.1,-221.7],[237.4,-193.1],[60.7,48.3]]) {
      const hit = groundHit(x,z);
      assert.ok(hit && Math.abs(40-hit.timeOfImpact-constructionHeight(x,z))<0.015,"rendered triangles, height helper and collision agree between grid vertices");
    }
    for (const p of CONSTRUCTION_EARTHWORKS.filter(p=>p.ramp)) {
      const south = constructionHeight(p.x,p.z+p.depth/2-2);
      const mid = constructionHeight(p.x,p.z+p.depth*0.3);
      const floor = constructionHeight(p.x,p.z-10);
      assert.ok(south>mid && mid>floor,"haul ramp descends continuously into "+p.id);
      const base=constructionHeight(p.x,p.z-4), spacing=p.id==="east-basement"?16:12;
      for(const x of [-spacing,0,spacing])for(const z of [-8,8])
        assert.ok(Math.abs(constructionHeight(p.x+x,p.z-4+z)-base)<0.01,"ramp ends before foundation pads; footings must rest on the floor");
    }
    for (const b of [...CONSTRUCTION_BUILDINGS,CONSTRUCTION_HANGAR]) {
      const h=constructionHeight(b.x,b.z);
      for(const sx of [-1,1])for(const sz of [-1,1])
        assert.ok(Math.abs(constructionHeight(b.x+sx*b.width/2,b.z+sz*b.depth/2)-h)<0.01,b.id+" has a level foundation pad");
    }
    for (const z of [-300,-100,0,100,300]) {
      assert.equal(constructionHeight(300,z),0);assert.ok(Number.isFinite(constructionHeight(800,z)));
    }
    site.update(map.spawn);
    assert.ok(site.root.userData.activeColliders<350,"terrain collision is also local; added relief must not activate the whole map");
  } finally {site.dispose();world.free();}
});

test("all three aircraft settle above the visible spawn road and can lift off after reset", async () => {
  const scene=new THREE.Scene(),world=new RAPIER.World({x:0,y:-9.81,z:0}),site=buildConstruction(scene,world,RAPIER,map);
  try {
    site.update(map.spawn);world.step();
    const floor=site.heightAt(map.spawn[0],map.spawn[2]);
    assert.equal(floor,CONSTRUCTION_ROAD_HEIGHT);
    const hit=world.castRay(new RAPIER.Ray({x:map.spawn[0],y:1,z:map.spawn[2]},{x:0,y:-1,z:0}),2,true);
    assert.ok(hit&&Math.abs(1-hit.timeOfImpact-floor)<0.002,"the visible road has its own collision surface");
    for(const id of ["rift-65","rift-c3","rift-x5"]) {
      const config=JSON.parse(await readFile(new URL(`../data/drones/${id}.json`,import.meta.url)));
      const drone=new DronePhysics(RAPIER,world,config,map.spawn,{updateSceneQueries:false});
      const input={roll:0,pitch:0,yaw:0,throttle:0};
      for(let attempt=0;attempt<2;attempt++) {
        if(attempt)drone.reset(map.spawn);
        for(let i=0;i<480;i++)drone.step(input);
        assert.ok(drone.pose.p[1]-config.bodyHalfExtentsM[1]>floor-0.007,id+" must not sink through the road");
        assert.ok(drone.pose.p[1]+config.cameraOffsetM[1]>floor+0.01,id+" FPV camera stays above the surface");
      }
      const resting=drone.pose.p[1];drone.armed=true;
      for(let i=0;i<240;i++)drone.step({...input,throttle:0.4});
      assert.ok(drone.pose.p[1]>resting+0.2,id+" lifts off from the corrected surface");
      world.removeRigidBody(drone.body);
    }
  } finally {site.dispose();world.free();}
});

test("hangar doors and roof openings are flyable; the outer landscape stays visible and physical", () => {
  const scene=new THREE.Scene(),world=new RAPIER.World({x:0,y:-9.81,z:0}),site=buildConstruction(scene,world,RAPIER,map);
  try {
    const h=CONSTRUCTION_HANGAR,base=constructionHeight(h.x,h.z);
    site.update([h.x,base+3,h.z]);world.step();
    const ray=(p,d,t)=>world.castRay(new RAPIER.Ray({x:p[0],y:p[1],z:p[2]},{x:d[0],y:d[1],z:d[2]}),t,true);
    assert.equal(ray([h.x,base+3,h.z+26],[0,0,-1],52),null,"both hangar doors connect an unobstructed interior line");
    const roofOpening=ray([h.x-8,base+22,h.z-10],[0,-1,0],25);
    assert.ok(roofOpening&&Math.abs(roofOpening.timeOfImpact-(22-0.25))<0.03,"unfinished roof panel exposes the floor below");
    assert.ok(ray([h.x+8,base+22,h.z],[0,-1,0],15),"installed roof panels remain solid");
    const meshes=site.root.children.filter(o=>o.name.startsWith("bare-landscape-"));
    assert.equal(meshes.length,CONSTRUCTION_LANDSCAPE_RINGS.length);
    assert.ok(meshes.reduce((sum,o)=>sum+o.geometry.attributes.position.count,0)<100000,"distant terrain uses bounded detail");
    const terrain=new THREE.Raycaster();terrain.ray.direction.set(0,-1,0);
    for(const [x,z] of [[310,20],[1000,-700],[21000,19000],[40000,30000]]) {
      site.update([x,10,z]);world.step();scene.updateMatrixWorld(true);
      terrain.ray.origin.set(x,30,z);
      const visible=terrain.intersectObjects(site.root.children,false).find(hit=>hit.object.name.startsWith("bare-"));
      const physical=ray([x,30,z],[0,-1,0],40);
      assert.ok(visible&&physical&&Math.abs(visible.distance-physical.timeOfImpact)<0.02,"bare ground continues with matching collision outside the fence");
    }
    assert.ok(site.root.userData.landmarks.some(p=>p.name==="concrete-batching-plant"));
    assert.ok(site.root.userData.landmarks.some(p=>p.name==="precast-assembly-court"));
  } finally {site.dispose();world.free();}
});

test("construction keeps visuals intact while collision work follows the aircraft", () => {
  const scene = new THREE.Scene(), world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const site = buildConstruction(scene, world, RAPIER, map);
  const meshes = [...site.root.children];
  site.update(map.spawn); world.step();
  assert.ok(site.root.userData.activeColliders < 350);
  const corner = CONSTRUCTION_BUILDINGS[0];
  const cast = () => world.castRay(new RAPIER.Ray({x:corner.x-corner.width/2-3,y:2,z:corner.z-corner.depth/2},{x:1,y:0,z:0}),4,true);
  assert.equal(cast(),null,"a distant building need not participate in physics");
  site.update([corner.x,2,corner.z]);world.step();assert.ok(cast(),"nearby columns reactivate before entry");
  assert.deepEqual(site.root.children,meshes,"collision activation must never hide or rebuild the visible map");
  site.dispose();world.free();
});
