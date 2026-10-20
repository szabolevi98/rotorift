import { PilotPositionPicker } from "../web/game/pilot-position.js";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { loadCatalog } from "../server/catalog.js";
import {
  CIRCUIT_LENGTH,
  CIRCUIT_LAP_SECONDS,
  CIRCUIT_SAMPLES,
  circuitCarState,
  circuitPoint,
  circuitSurfaceHeight,
} from "../shared/world/circuit-layout.js";
import {CIRCUIT_LAUNCH, CIRCUIT_PIT_LINE} from "../shared/world/circuit-pits.js";
import { TrafficClock } from "../shared/world/traffic-clock.js";
import { CircuitTraffic } from "../web/game/circuit-traffic.js";
import { buildCircuit } from "../web/game/circuit.js";
import { buildEnvironment } from "../web/game/environment.js";
import { DronePhysics } from "../shared/physics/drone.js";
import { PHYSICS_DT } from "../shared/physics/time-step.js";
await RAPIER.init();
const { maps, drones, airplanes } = await loadCatalog(),
  map = maps.find((m) => m.id === "apex");

test("Apex is a full-sized fifth map with drone and airplane circuits and a clear launch apron", () => {
  assert.equal(map.kind, "circuit");
  assert.equal(map.size, 800);
  assert.deepEqual(map.baseSpawn ?? map.spawn, CIRCUIT_LAUNCH);
  for(const route of map.routes.filter(r=>r.aircraftKinds.includes("quadrotor"))) {
    assert.deepEqual(route.spawn,CIRCUIT_LAUNCH,"racing also launches outside the live car lanes");
    assert.ok(Math.min(...CIRCUIT_SAMPLES.map(p=>Math.hypot(p.x-route.spawn[0],p.z-route.spawn[2])))>35);
  }
  assert.equal(map.routes.length, 4);
  assert.equal(
    map.routes.filter((r) => r.aircraftKinds.includes("fixedWing")).length,
    2,
  );
  assert.ok(CIRCUIT_LENGTH > 2100 && CIRCUIT_LENGTH < 2600);
  assert.ok(CIRCUIT_LAP_SECONDS > 65 && CIRCUIT_LAP_SECONDS < 140);
  assert.ok(CIRCUIT_SAMPLES.every(s => Math.abs(s.curvature) * 16 < 1), "inner guardrails must not fold at tight corners");
  assert.equal(circuitSurfaceHeight(-175, 200), 0);
  assert.equal(circuitSurfaceHeight(65, 217), 20.3);
  assert.ok(
    CIRCUIT_SAMPLES.every((s) => Object.values(s).every(Number.isFinite)),
  );
  assert.ok(
    CIRCUIT_SAMPLES.some((s) => s.speed < 18) &&
      CIRCUIT_SAMPLES.some((s) => s.speed > 30),
  );
});

test("traffic is a pure absolute-time function, continuous across lap seams, and stays on the track", () => {
  for (const seed of [0, 123456789, 4294967295])
    for (let i = 0; i < 8; i++) {
      const a = circuitCarState(12345.678, i, seed);
      assert.deepEqual(a, circuitCarState(12345.678, i, seed));
      for (let time = 0; time < 160; time += 0.5) {
        const a = circuitCarState(time, i, seed),
          b = circuitCarState(time + 0.001, i, seed);
        assert.ok(
          Math.hypot(b.x - a.x, b.z - a.z) < 0.06,
          "continuous car movement and lap seam",
        );
        assert.ok(Object.values(a).every(Number.isFinite));
        const center = circuitPoint(a.distance);
        assert.ok(Math.hypot(a.x - center.x, a.z - center.z) < 4.51);
        assert.ok(Math.abs(a.x) < 400 && Math.abs(a.z) < 400);
      }
    }
  // Drivers in each lane have the same pace and a preserved headway.
  for (let time = 0; time < 200; time += 0.25)
    for (let i = 0; i < 4; i++) {
      const a = circuitCarState(time, i),
        b = circuitCarState(time, i + 4);
      assert.ok(
        Math.hypot(a.x - b.x, a.z - b.z) > 8,
        "no overtaking through a car in the same lane",
      );
    }
});

test("room traffic clocks agree after late join and resume, slew small corrections and catch up suspension", () => {
  const meta = { version: 2, epoch: 100000, seed: 42 },
    a = new TrafficClock(),
    b = new TrafficClock();
  assert.equal(a.sample(meta, 105000, 0), 5);
  for (let i = 1; i <= 600; i++)
    a.sample(meta, 105000 + (i * 1000) / 60, 1 / 60);
  const late = b.sample(meta, 115000, 0);
  assert.ok(Math.abs(a.time - late) < 1e-8);
  assert.deepEqual(
    circuitCarState(a.time, 3, meta.seed),
    circuitCarState(b.time, 3, meta.seed),
  );
  const before = a.time;
  a.sample(meta, 114990, 1 / 60);
  assert.ok(a.time >= before, "clock correction never drives cars backwards");
  assert.equal(
    a.sample(meta, 180000, 1 / 60),
    80,
    "background suspension catches up",
  );
  assert.equal(
    a.sample({ ...meta, seed: 7 }, 180000, 0),
    80,
    "new room seed starts from its shared phase",
  );
  assert.equal(a.sample({ version: 99, epoch: 0, seed: 0 }, 180000, 0), null);
});

test("batched cars render eight liveries with a bounded mesh budget and kinematic bodies that cannot be pushed", () => {
  const scene = new THREE.Scene(),
    world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    traffic = new CircuitTraffic(scene, world, RAPIER);
  try {
    assert.equal(traffic.bodies.length, 8);
    assert.ok(traffic.root.children.length <= 10);
    const paint = traffic.batches.find((m) => m.instanceColor);
    assert.equal(paint.count, 8);
    for (const mesh of traffic.root.children)
      assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));
    traffic.step(10, 8);
    world.step();
    traffic.render(10, 8);
    for (const [i, b] of traffic.bodies.entries()) {
      const state = circuitCarState(10, i, 8);
      assert.ok(
        Math.hypot(b.translation().x - state.x, b.translation().z - state.z) <
          0.001,
      );
      assert.equal(b.isKinematic(), true);
      assert.equal(b.numColliders(), 2);
    }
    traffic.step(500, 8);
    world.step();
    assert.ok(
      traffic.bodies.every(
        (b) => Math.hypot(...Object.values(b.linvel())) < 0.01,
      ),
      "teleport after sleep has no enormous sweep velocity",
    );
  } finally {
    traffic.dispose();
    assert.equal(world.bodies.len(), 0);
    assert.equal(world.colliders.len(), 0);
    assert.equal(scene.children.length, 0);
    world.free();
  }
});

test("cars really collide with a drone while their own scheduled trajectory remains unchanged", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    scene = new THREE.Scene(),
    traffic = new CircuitTraffic(scene, world, RAPIER);
  const start = circuitCarState(0.45, 0),
    p = new DronePhysics(
      RAPIER,
      world,
      drones.find((d) => d.id === "rift-x5"),
      [start.x, 0.8, start.z],
      { updateSceneQueries: false, simulation: { propDamage: true } },
    );
  let touched = false;
  try {
    for (let i = 0; i < 240; i++) {
      traffic.step(i * PHYSICS_DT);
      p.step({ throttle: 0, pitch: 0, roll: 0, yaw: 0 });
      for (const body of traffic.bodies)
        for (let j = 0; j < body.numColliders(); j++)
          world.contactPair(body.collider(j), p.bodyCollider, (m) => {
            if (m.numContacts()) touched = true;
          });
    }
    assert.ok(
      touched ||
        Math.hypot(...p.pose.v) > 1 ||
        p.effects.propellers.blades.flat().some((v) => v > 0),
      "moving car contacts the drone",
    );
    const expected = circuitCarState(239 * PHYSICS_DT, 0);
    assert.ok(
      Math.hypot(
        traffic.bodies[0].translation().x - expected.x,
        traffic.bodies[0].translation().z - expected.z,
      ) < 0.001,
    );
  } finally {
    traffic.dispose();
    p.dispose();
    world.free();
  }
});

test("static circuit and traffic resources are separate, the bridge/garages are flyable and dispose cleanly", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    scene = new THREE.Scene(),
    site = buildCircuit(scene, world, RAPIER, map);
  try {
    assert.ok(site.root.userData.batches < 40);
    const groundBatches = site.root.children.filter(mesh=>mesh.userData.groundSurface);
    assert.equal(groundBatches.length, 1);
    assert.ok(groundBatches.every(mesh=>!mesh.castShadow && mesh.receiveShadow));
    assert.ok(site.root.children.some(mesh=>mesh.name.startsWith('box:white:') && mesh.castShadow), 'real walls still cast shadows');
    assert.equal(groundBatches[0].name,'Apex_disjoint_ground','all terrain, paving and paint share disjoint geometry');
    assert.ok(site.root.userData.instances < 6000);
    assert.equal(
      world.bodies.len(),
      0,
      "moving bodies must never enter baked scenery",
    );
    world.colliders.forEach((c) => c.setEnabled(true));
    world.step();
    const ray = (p, d, n) =>
      world.castRay(
        new RAPIER.Ray(
          { x: p[0], y: p[1], z: p[2] },
          { x: d[0], y: d[1], z: d[2] },
        ),
        n,
        true,
      );
    assert.equal(
      ray([100, 4, 150], [1, 0, 0], 30),
      null,
      "fly below pedestrian bridge",
    );
    assert.ok(ray([115, 4, 150], [0, 1, 0], 10), "bridge deck is solid");
    assert.equal(
      ray([-100, 3, 190], [0, 0, 1], 25),
      null,
      "pit garage has an open front",
    );
    assert.ok(ray([-100, 3, 210], [0, 0, 1], 20), "garage rear wall is solid");
    assert.ok(!site.root.userData.landmarks.some(p=>p.name==="Paddock_transporters"));
    for(const [i,[x,z]] of CIRCUIT_PIT_LINE.entries()) {
      const hit=world.intersectionWithShape({x,y:1.3,z},{x:0,y:0,z:0,w:1},new RAPIER.Ball(1));
      assert.equal(hit,null,`pit lane entry/exit has no barrier or garage obstruction at sample ${i}`);
    }
    for(const x of [-100,-80,0,100]) {
      assert.equal(ray([x,3,194],[0,0,1],23),null,"each garage has a clear interior approach");
    }
    assert.ok(ray([-175, 2, 200], [0, -1, 0], 3), "spawn sits on solid ground");
    assert.equal(ray([20, 2.7, 43], [0, 0, 1], 53), null, "clubhouse has a full-width flight passage");
    assert.equal(ray([-40, 2.7, 32], [-1, 0, 0], 50), null, "media tower can be flown through below its deck");
    for (let d = 0; d < CIRCUIT_LENGTH; d += 5) for (const lane of [-4.5, -1.5, 1.5, 4.5]) {
      const s = circuitPoint(d, lane);
      const hit = world.intersectionWithShape(
        {x:s.x, y:.728, z:s.z},
        {x:0,y:Math.sin(s.yaw/2),z:0,w:Math.cos(s.yaw/2)},
        new RAPIER.Cuboid(.97,.58,2.18),
      );
      assert.equal(hit, null, `car body clears all scenery at ${d} m, lane ${lane}`);
    }
    const surface = site.root.getObjectByName("Apex_disjoint_ground");
    assert.ok(
      surface.geometry.attributes.normal.getY(0) > 0.9,
      "road faces upward",
    );
    const groundRay = new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,2);
    site.root.updateMatrixWorld(true);
    const asphaltColors=[0x353b40,0x343b40].map(hex=>new THREE.Color(hex));
    for(const [x,z] of CIRCUIT_PIT_LINE) {
      groundRay.ray.origin.set(x,1,z);
      const [hit]=groundRay.intersectObject(surface,false);
      assert.ok(hit,"the complete pit lane has a paved surface");
      const color=new THREE.Color().fromBufferAttribute(surface.geometry.attributes.color,hit.face.a);
      assert.ok(asphaltColors.some(c=>Math.abs(c.r-color.r)+Math.abs(c.g-color.g)+Math.abs(c.b-color.b)<.001),
        `pit merge must replace kerbs/runoff with asphalt at ${x},${z}`);
    }
    for(let x=-337.173;x<350;x+=53.125)for(let z=-338.397;z<350;z+=61.875) {
      groundRay.ray.origin.set(x,1,z);
      assert.equal(groundRay.intersectObject(surface,false).length,1,`one ground surface at ${x},${z}; no stacked depth layers`);
    }
  } finally {
    site.dispose();
    assert.equal(world.colliders.len(), 0);
    assert.equal(scene.children.length, 0);
    world.free();
  }
  const scene2 = new THREE.Scene(),
    w2 = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    environment = buildEnvironment(scene2, w2, RAPIER, { ...map, gates: [] });
  assert.equal(environment.traffic.bodies.length, 8);
  const picker = new PilotPositionPicker(RAPIER, w2, map, environment.heightAt);
  assert.ok(picker.entries.every((e) => !e.collider.parent()?.isKinematic()));
  environment.dispose();
  assert.equal(w2.colliders.len(), 0);
  w2.free();
});
