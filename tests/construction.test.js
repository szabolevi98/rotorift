import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildConstruction, CONSTRUCTION_VIEW_DISTANCE } from "../web/game/construction.js";
import { CONSTRUCTION_BUILDINGS, CONSTRUCTION_CRANES, CONSTRUCTION_PIT, CONSTRUCTION_VEHICLES, constructionHeight, floorOpening } from "../shared/world/construction-layout.js";
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
      const [x, z] = floorOpening(b), height = b.levels * b.storey;
      const shaft = ray([x, height + 4, z], [0, -1, 0], height + 8);
      assert.ok(shaft && Math.abs(shaft.timeOfImpact - (height + 4 - 0.24)) < 0.05, b.id + ": shaft must reach the foundation");
      assert.equal(ray([x, 2.2, b.z - b.depth / 2 - 1], [0, 0, 1], b.depth + 2), null, b.id + ": first level must be flyable");
      const column = ray([b.x - b.width / 2 - 3, 2, b.z - b.depth / 2], [1, 0, 0], 4);
      assert.ok(column, b.id + ": concrete columns must collide");
    }
    const p = CONSTRUCTION_PIT;
    for (const [x, z] of [[p.x + 5, p.z], [p.x + p.width / 2 - 2, p.z], [p.x + p.width / 2 + 2, p.z]]) {
      const hit = ray([x, 8, z], [0, -1, 0], 20);
      assert.ok(hit && Math.abs((8 - hit.timeOfImpact) - constructionHeight(x, z)) < 0.03, "pit ground and slopes must match their collision surface");
    }
    assert.equal(ray([157, 1.55, 187], [0, 0, 1], 12), null, "precast pipe opening must have no invisible box");
    assert.ok(ray([158.5, 1.55, 187], [0, 0, 1], 12), "pipe wall must collide");
    assert.ok(ray([800, 10, 800], [0, -1, 0], 12), "ground continues outside the fence");
    assert.ok(CONSTRUCTION_VIEW_DISTANCE >= 10000);
    assert.ok(site.root.userData.instances > 4000);
    assert.ok(site.root.userData.batches < 300, "repeated details must be instanced, not thousands of draw calls");
    console.log("construction geometry:", site.root.userData.instances, "parts in", site.root.userData.batches, "batches;", site.root.userData.colliders, "colliders");
  } finally {
    site.dispose(); assert.equal(scene.children.length, 0); assert.equal(world.colliders.len(), 0); world.free();
  }
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
