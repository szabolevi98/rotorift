import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { parkHeight, parkSurfaceHeight, PARK_CHUNK_SIZE, PARK_GRID_STEPS } from "../shared/world/park-layout.js";
import { MapBoundary } from "../shared/world/boundary.js";
import { makeParkTerrain, buildPark } from "../web/game/park.js";
import { DronePhysics } from "../shared/physics/drone.js";
const map = JSON.parse(await readFile(new URL("../data/maps/liget.json", import.meta.url)));
await RAPIER.init();

test("Liget is 700 m across, its start is level, and hills have usable variation", () => {
  assert.equal(map.size, 700);
  assert.equal(map.boundary.returnAfterSeconds, 600);
  assert.equal(parkHeight(map.spawn[0], map.spawn[2]), 0);
  const heights = [];
  for (let x = -300; x <= 300; x += 30) for (let z = -300; z <= 300; z += 30)
    heights.push(parkHeight(x, z));
  assert.ok(Math.max(...heights) - Math.min(...heights) > 12);
});

test("terrain seams match exactly and physical ground follows the visible triangles", () => {
  const a = makeParkTerrain(0, 0), b = makeParkTerrain(1, 0);
  const count = PARK_GRID_STEPS + 1;
  for (let row = 0; row < count; row++) {
    assert.equal(a.attributes.position.getY(row * count + count - 1), b.attributes.position.getY(row * count));
    assert.equal(a.attributes.normal.getX(row * count + count - 1), b.attributes.normal.getX(row * count));
  }
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.trimesh(a.attributes.position.array, new Uint32Array(a.index.array)));
  world.step();
  for (const [x, z] of [[23.2, 61.7], [89.1, 23.3], [124, 112], [2.3, 5.8]]) {
    const hit = world.castRay(new RAPIER.Ray({ x, y: 40, z }, { x: 0, y: -1, z: 0 }), 50, true);
    assert.ok(hit);
    assert.ok(Math.abs(40 - hit.timeOfImpact - parkSurfaceHeight(x, z)) < 0.0001);
  }
  a.dispose(); b.dispose(); world.free();
});

test("the pavilion passage is flyable and the streamed landscape has no fence wall or leaking chunks", async () => {
  const scene = new THREE.Scene(), world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const park = buildPark(scene, world, RAPIER, map);
  world.step();
  const passage = world.castRay(new RAPIER.Ray({ x: 0, y: 2, z: 22 }, { x: 0, y: 0, z: -1 }), 44, true);
  assert.equal(passage, null);
  const roof = world.castRay(new RAPIER.Ray({ x: 0, y: 2, z: 0 }, { x: 0, y: 1, z: 0 }), 7, true);
  assert.ok(roof && roof.timeOfImpact > 2);
  const start = world.castRay(new RAPIER.Ray({ x: 0, y: 1, z: 60 }, { x: 0, y: -1, z: 0 }), 2, true);
  assert.ok(start && Math.abs(1 - start.timeOfImpact - 0.065) < 0.001);
  // The fence is visual geometry only; it must never stop a low crossing.
  const fence = world.castRay(new RAPIER.Ray({ x: 0, y: parkSurfaceHeight(0, 350) + 1.2, z: 348 },
    { x: 0, y: 0, z: 1 }), 4, true);
  assert.equal(fence, null);
  for (const id of ["rift-65", "rift-c3", "rift-x5"]) {
    const config = JSON.parse(await readFile(new URL(`../data/drones/${id}.json`, import.meta.url)));
    const drone = new DronePhysics(RAPIER, world, config, map.spawn);
    for (let frame = 0; frame < 120; frame++) drone.step({ throttle: 0, pitch: 0, roll: 0, yaw: 0 });
    const pose = drone.pose, q = new THREE.Quaternion(pose.q.x, pose.q.y, pose.q.z, pose.q.w);
    const camera = new THREE.Vector3(...config.cameraOffsetM).applyQuaternion(q).add(new THREE.Vector3(...pose.p));
    assert.ok(camera.y > 0.0678 + 0.012, `${id}: the FPV camera must be above paving and the launch mat`);
    drone.dispose();
  }
  assert.equal(park.chunkCount, 49);
  assert.equal(park.physicsChunkCount, 9);
  const initialColliders = world.colliders.len();
  const originalObjects = [...park.root.children];
  park.update([-0.001, 1, 60]); park.update([0.001, 1, 60]);
  assert.ok(park.root.children.every((o, i) => o === originalObjects[i]), "small movement at a grid edge must not rebuild the landscape");
  assert.equal(world.colliders.len(), initialColliders);
  for (const p of [[700, 40, 700], [3500, 40, -6000], [0, 1, 60]]) {
    park.update(p); world.step();
    assert.equal(park.chunkCount, 49);
    assert.equal(park.physicsChunkCount, 9);
    const hit = world.castRay(new RAPIER.Ray({ x: p[0], y: 60, z: p[2] }, { x: 0, y: -1, z: 0 }), 70, true);
    assert.ok(hit, "terrain collision must continue outside the park");
  }
  assert.equal(world.colliders.len(), initialColliders);
  park.dispose(); assert.equal(scene.children.length, 0); world.free();
});

test("boundary gives ten full minutes, clears on reentry, and pauses when no time advances", () => {
  const boundary = new MapBoundary(map);
  assert.equal(boundary.update([350, 15, 350], 60), false);
  assert.equal(boundary.outside, false);
  assert.equal(boundary.update([350.1, 15, 0], 0), false);
  assert.equal(boundary.remainingSeconds, 600);
  assert.equal(boundary.update([351, 15, 0], 599.9), false);
  assert.equal(boundary.update([351, 15, 0], 0), false);
  assert.equal(boundary.update([351, 15, 0], 0.1), true);
  boundary.reset();
  boundary.update([-351, 1, 0], 400);
  boundary.update([349, 1, 0], 1);
  assert.equal(boundary.outside, false);
  boundary.update([0, 1, -351], 1);
  assert.equal(boundary.remainingSeconds, 599);
  const unlimited = new MapBoundary({ size: 120 });
  assert.equal(unlimited.update([1e6, 10, -1e6], 700), false);
});
