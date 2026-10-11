import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { parkHeight, parkSurfaceHeight, parkClearance, pathClearance, PARK_BENCHES, PARK_GARDEN, PARK_SPORT, PARK_CHUNK_SIZE, PARK_GRID_STEPS, PARK_PATHS, PARK_LAKES, PARK_BUILDINGS } from "../shared/world/park-layout.js";
import { MapBoundary } from "../shared/world/boundary.js";
import { makeParkTerrain, buildPark, ribbon } from "../web/game/park.js";
import { makeParkDistantTerrain, PARK_VIEW_DISTANCE, PARK_TERRAIN_RINGS } from "../web/game/park-terrain.js";
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

test("distant terrain is stitched, covers high-altitude views and has bounded geometry", () => {
  const geometry = makeParkDistantTerrain(0, 0), p = geometry.attributes.position;
  assert.ok(geometry.index.count / 3 < 45000, "distant ground must remain cheaper than detailed terrain");
  const inner = 448, center = 64, edges = new Map();
  const vertexKey = (i) => `${p.getX(i)},${p.getZ(i)}`;
  for (let i = 0; i < geometry.index.count; i += 3) for (let j = 0; j < 3; j++) {
    const a = vertexKey(geometry.index.getX(i + j)), b = vertexKey(geometry.index.getX(i + (j + 1) % 3));
    const key = [a, b].sort().join("|"); edges.set(key, (edges.get(key) ?? 0) + 1);
  }
  for (const [key, count] of edges) {
    if (count === 2) continue;
    const [a, b] = key.split("|").map((s) => s.split(",").map(Number));
    const outer = PARK_TERRAIN_RINGS.at(-1).outer;
    const boundary = [inner, outer].some((radius) => [0, 1].some((axis) =>
      a[axis] === b[axis] && Math.abs(a[axis] - center) === radius));
    assert.ok(count === 1 && boundary, "LOD rings must have no cracks or unmatched internal edges");
  }
  for (const axis of [0, 1]) for (const side of [-1, 1]) {
    const points = new Set();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), values = [x, z];
      if (values[axis] === center + side * inner && Math.abs(values[1 - axis] - center) <= inner) {
        points.add(values[1 - axis]);
        assert.equal(p.getY(i), Math.fround(parkHeight(x, z)), "inner seam matches detailed terrain heights");
      }
    }
    assert.equal(points.size, inner * 2 / (PARK_CHUNK_SIZE / PARK_GRID_STEPS) + 1);
  }
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()); mesh.updateMatrixWorld(true);
  for (const altitude of [100, 500, 2000]) for (const [x, z] of [[520, 20], [900, 300], [-1700, 230], [5000, -2400], [10000, 2000]]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, altitude, z), new THREE.Vector3(0, -1, 0));
    assert.ok(ray.intersectObject(mesh).length, `ground must exist beyond streamed chunks at ${altitude} m altitude`);
  }
  assert.ok(PARK_TERRAIN_RINGS.at(-1).outer > PARK_VIEW_DISTANCE);
  geometry.dispose(); mesh.material.dispose();
});

test("path interiors follow terrain triangles without sinking into hills", () => {
  for (const path of PARK_PATHS) {
    const mesh = ribbon(path.points, path.width), p = mesh.attributes.position;
    for (let i = 0; i < mesh.index.count; i += 3) {
      for (const weights of [[1 / 3, 1 / 3, 1 / 3], [0.1, 0.7, 0.2]]) {
        const sample = new THREE.Vector3();
        for (let j = 0; j < 3; j++) {
          const index = mesh.index.getX(i + j);
          sample.addScaledVector(new THREE.Vector3(p.getX(index), p.getY(index), p.getZ(index)), weights[j]);
        }
        assert.ok(Math.abs(sample.y - parkSurfaceHeight(sample.x, sample.z) - 0.065) < 0.0001,
          "the full triangle must have the same clearance as its vertices");
      }
    }
    mesh.dispose();
  }
});

test("benches and building terraces leave the actual curved promenades clear", () => {
  assert.ok(PARK_BENCHES.length >= 10, "retain seating along the promenades");
  for (const seat of PARK_BENCHES) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), seat.angle);
    for (const x of [-1.1, 0, 1.1]) for (const z of [-0.4, 0.4]) {
      const p = new THREE.Vector3(x, 0, z).applyQuaternion(q);
      assert.ok(pathClearance(seat.x + p.x, seat.z + p.z) > 0.5,
        "the whole seat, not only its center, must be outside every path");
    }
  }
  for (const path of PARK_PATHS) {
    const mesh = ribbon(path.points, path.width), p = mesh.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      for (const b of PARK_BUILDINGS) {
        const halfWidth = b.id === "boathouse" ? 10.5 : b.id === "cafe" ? 15 : b.width / 2;
        const halfDepth = b.id === "boathouse" ? 9 : b.id === "cafe" ? 12.5 : b.depth / 2;
        assert.ok(Math.abs(x - b.x) >= halfWidth - 0.001 || Math.abs(z - b.z) >= halfDepth - 0.001,
          `${b.id}: the walkway must skirt the building and meet its terrace at the edge`);
      }
      for (const side of [-1, 1]) for (const row of [-8, 0, 8])
        assert.ok(Math.hypot(x - (PARK_GARDEN.x + side * 4), z - (PARK_GARDEN.z + row)) > 0.3,
          "the garden path must not run through pergola columns");
    }
    mesh.dispose();
  }
});

test("two lakes, open flight space and grounded small buildings have a deliberate layout", () => {
  assert.equal(PARK_LAKES.length, 2);
  assert.ok(PARK_LAKES[0].rx * PARK_LAKES[0].rz > PARK_LAKES[1].rx * PARK_LAKES[1].rz * 3);
  for (const lake of PARK_LAKES) {
    assert.ok(parkSurfaceHeight(lake.x, lake.z) < lake.waterY - 1);
    assert.equal(parkClearance(lake.x, lake.z, map, 8), false);
  }
  assert.equal(parkClearance(0, 220, map, 8), false, "keep the southern meadow open for freestyle");
  for (const b of PARK_BUILDINGS) for (const x of [-b.width / 2, b.width / 2])
    for (const z of [-b.depth / 2, b.depth / 2])
      assert.ok(Math.abs(parkSurfaceHeight(b.x + x, b.z + z) - b.baseY) < 0.00001,
        "building foundations must touch a flat piece of terrain");
});

test("the pavilion passage is flyable and the streamed landscape has no fence wall or leaking chunks", async () => {
  const scene = new THREE.Scene(), world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const park = buildPark(scene, world, RAPIER, map);
  assert.ok(park.treeCount >= 280 && park.treeCount < 450, `tree count ${park.treeCount}: fill the park while preserving open flight space`);
  const assertObjectsInsideFence = () => {
    const half = map.size / 2, matrix = new THREE.Matrix4();
    for (const group of park.root.children.filter((o) => o.isGroup)) {
      for (const mesh of group.children.filter((o) => o.isInstancedMesh)) {
        mesh.geometry.computeBoundingBox();
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, matrix);
          const box = mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
          assert.ok(box.min.x >= -half && box.max.x <= half && box.min.z >= -half && box.max.z <= half,
            "vegetation must stay completely inside the fence");
        }
      }
    }
  };
  assertObjectsInsideFence();
  park.root.updateMatrixWorld(true);
  for (const x of [-25, 25]) for (const z of [-25, 25]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x + 1.5, 2, z + 3), new THREE.Vector3(0, -1, 0));
    const hits = ray.intersectObjects(park.root.children, true);
    assert.ok(Math.abs(hits[0].point.y - 0.5) < 0.00001,
      "planter soil must be exposed below the concrete rim, without an overlapping concrete top");
  }
  for (const mesh of park.root.children.filter((o) => ["park-path", "park-curb"].includes(o.name))) {
    const p = mesh.geometry.attributes.position;
    for (let i = 0; i < p.count; i++)
      assert.ok(Math.abs(p.getX(i)) <= map.size / 2 && Math.abs(p.getZ(i)) <= map.size / 2,
        "paths and curbs must stop at the fence");
  }
  world.step();
  const club = PARK_SPORT.clubhouse;
  const clubhousePassage = world.castRay(new RAPIER.Ray({ x: club.x, y: club.baseY + 2, z: club.z + 16 },
    { x: 0, y: 0, z: -1 }), 32, true);
  assert.equal(clubhousePassage, null, "the new clubhouse has an open central flight passage");
  const clubRoof = world.castRay(new RAPIER.Ray({ x: club.x, y: club.baseY + 2, z: club.z },
    { x: 0, y: 1, z: 0 }), 5, true);
  assert.ok(clubRoof && clubRoof.timeOfImpact > 2);
  const carpark = PARK_SPORT.parking;
  const driveway = world.castRay(new RAPIER.Ray({ x: 4, y: carpark.baseY + 1, z: carpark.z },
    { x: 1, y: 0, z: 0 }), 78, true);
  assert.equal(driveway, null, "driveway and parking aisle remain clear of cars and carport posts");
  const carportRun = world.castRay(new RAPIER.Ray({ x: carpark.x - 26, y: carpark.baseY + 2.1, z: carpark.z - 16 },
    { x: 1, y: 0, z: 0 }), 52, true);
  assert.equal(carportRun, null, "the space above parked cars and below the canopy is flyable");
  const court = PARK_SPORT.court;
  const courtFloor = world.castRay(new RAPIER.Ray({ x: court.x + 4, y: court.baseY + 2, z: court.z },
    { x: 0, y: -1, z: 0 }), 4, true);
  assert.ok(courtFloor && Math.abs(courtFloor.timeOfImpact - 1.863) < 0.001, "court surface has matching collision");
  const bridgeGap = world.castRay(new RAPIER.Ray({ x: 203, y: 1.5, z: 160 }, { x: 0, y: 0, z: 1 }), 30, true);
  assert.equal(bridgeGap, null, "the bridge must have a flyable passage below its deck");
  const bridgeDeck = world.castRay(new RAPIER.Ray({ x: 203, y: 1.5, z: 175 }, { x: 0, y: 1, z: 0 }), 3, true);
  assert.ok(bridgeDeck && Math.abs(bridgeDeck.timeOfImpact - 1.08) < 0.001);
  const cafeBay = world.castRay(new RAPIER.Ray({ x: 116, y: 4, z: -139 }, { x: 0, y: 0, z: -1 }), 20, true);
  assert.equal(cafeBay, null, "the cafe terrace and side bay must be open");
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
    assertObjectsInsideFence();
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
