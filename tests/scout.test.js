import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { loadCatalog } from "../server/catalog.js";
import { createScoutModel } from "../shared/visual/scout-model.js";
import { createAirplaneModel } from "../shared/visual/airplane-models.js";
import { createAircraftVisual } from "../web/game/aircraft-visual.js";
import { FixedWingPhysics } from "../shared/physics/fixed-wing.js";
import { aircraftLaunch } from "../shared/aircraft/launch.js";
import { advanceFixedSteps } from "../shared/physics/fixed-step.js";
import { COLLISION_ASSETS } from "../shared/world/collision-assets.js";
import { decodeCollisionData } from "../shared/world/collision-data.js";
import { PrebakedCollisions } from "../web/game/prebaked-collisions.js";
import { parkSurfaceHeight } from "../shared/world/park-layout.js";
import { RemoteCollisions } from "../web/game/remote-collisions.js";
await RAPIER.init();
const catalog = await loadCatalog(),
  config = catalog.airplanes.find((c) => c.id === "rift-s75");
const idle = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
function flight() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  return {
    world,
    p: new FixedWingPhysics(RAPIER, world, config, [0, 100, 0], {
      updateSceneQueries: false,
    }),
  };
}

test("S75 is a distinct 750 mm / 2S pusher, with lightweight finite geometry and working control hinges", () => {
  assert.equal(config.wingspanM, 0.75);
  assert.equal(config.battery.cells, 2);
  assert.notEqual(config.configHash, catalog.airplanes[0].configHash);
  const model = createAirplaneModel(config),
    box = new THREE.Box3().setFromObject(model, true),
    size = box.getSize(new THREE.Vector3());
  assert.equal(model.name, "Rift_S75");
  assert.ok(Math.abs(size.x - 0.75) < 0.001);
  assert.ok(Math.abs(size.z - 0.55) < 0.01);
  let tris = 0,
    draws = 0,
    surfaces = 0;
  model.traverse((o) => {
    if (o.userData.surface) surfaces++;
    if (o.isMesh) {
      draws++;
      tris +=
        (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      assert.ok(
        [...o.geometry.attributes.position.array].every(Number.isFinite),
      );
    }
  });
  assert.equal(surfaces, 4);
  assert.ok(tris < 11000);
  assert.ok(draws <= 18);
  const prop = model.getObjectByName("S75_pusher_propeller");
  assert.deepEqual(prop.position.toArray(), config.motors[0].positionM);
  const visual = createAircraftVisual(model, config),
    physics = {
      armed: true,
      motorThrust: [config.motor.maxThrustN * 0.5],
      surfaces: { pitch: 0.5, roll: 0.3, yaw: -0.2 },
    };
  visual.update(0.1, physics, { throttle: 0.5 });
  assert.ok(prop.rotation.z < 0);
  assert.equal(model.getObjectByName("S75_elevator").rotation.x, 0.2);
  assert.ok(model.getObjectByName("S75_aileron_1").rotation.x < 0);
  visual.dispose();
});

test("full pusher sweep clears wing, pod, tail and motor pod; FPV lens looks out of the nose", () => {
  const model = createScoutModel({ batchStatic: false }),
    prop = model.getObjectByName("S75_pusher_propeller");
  for (const name of [
    "S75_main_wing",
    "S75_wing_root",
    "S75_rounded_foam_pod",
    "S75_tapered_tail_boom",
    "S75_motor_pylon",
    "S75_streamlined_motor_nacelle",
    "S75_horizontal_stabilizer",
    "S75_rounded_vertical_fin",
  ]) {
    const boxes = [];
    model.traverse((o) => {
      if (o.name === name) boxes.push(new THREE.Box3().setFromObject(o));
    });
    assert.ok(boxes.length);
    // An AABB around the tall pod overestimates its pointed aft end. Cast through
    // the actual swept disc instead of mistaking that empty volume for contact.
    const parts = [];
    model.traverse((o) => {
      if (o.name === name) parts.push(o);
    });
    for (let a = 0; a < 24; a++)
      for (const r of [0.015, 0.035, 0.05, 0.0635]) {
        const ray = new THREE.Raycaster(
          new THREE.Vector3(
            Math.cos((a * Math.PI) / 12) * r,
            0.125 + Math.sin((a * Math.PI) / 12) * r,
            0.137,
          ),
          new THREE.Vector3(0, 0, 1),
          0,
          0.01,
        );
        assert.equal(
          ray.intersectObjects(parts, true).length,
          0,
          name + " blocks the propeller",
        );
      }
  }
  const lens = model.getObjectByName("S75_FPV_lens");
  assert.ok(config.cameraOffsetM[2] < lens.position.z);
  const ray = new THREE.Raycaster(
    new THREE.Vector3(...config.cameraOffsetM),
    new THREE.Vector3(0, 0, -1),
    0,
    1,
  );
  assert.equal(ray.intersectObject(model, true).length, 0);
  assert.equal(prop.children.filter((c) => c.isMesh).length, 2);
});

test("S75 glides without power, has a gentle cruise and stable higher-throttle climb", () => {
  for (const throttle of [0, 0.4, 0.7]) {
    const { world, p } = flight();
    p.armed = true;
    const energy = () =>
        config.massKg *
        (9.81 * p.pose.p[1] + 0.5 * Math.hypot(...p.pose.v) ** 2),
      initial = energy();
    try {
      for (let i = 0; i < 240 * 15; i++) p.step({ ...idle, throttle });
      assert.ok(p.pose.p[2] < -100);
      assert.ok(p.airspeed > 7 && p.airspeed < 15);
      if (!throttle) {
        assert.ok(p.pose.p[1] < 90 && p.pose.p[1] > 60);
        assert.ok(energy() < initial);
      }
      if (throttle === 0.4) assert.ok(Math.abs(p.pose.p[1] - 100) < 5);
      if (throttle === 0.7) assert.ok(p.pose.p[1] > 115 && p.pose.p[1] < 150);
    } finally {
      world.free();
    }
  }
});

test("S75 physics cadence is independent of monitor refresh, full-stick stalls stay finite and reset stops its motor", () => {
  const paths = [];
  for (const hz of [30, 60, 120, 144]) {
    const { world, p } = flight(),
      clock = { accumulator: 0 };
    p.armed = true;
    for (let i = 0; i < hz * 5; i++)
      advanceFixedSteps(clock, 1 / hz, () =>
        p.step({ ...idle, throttle: 0.4 }),
      );
    paths.push(p.pose.p);
    world.free();
  }
  for (const path of paths)
    assert.ok(Math.hypot(...path.map((v, i) => v - paths[0][i])) < 0.03);
  const { world, p } = flight();
  p.armed = true;
  p.effects.setOptions({ battery: true, wind: "calm" });
  try {
    for (let i = 0; i < 240 * 20; i++)
      p.step({ pitch: Math.sin(i / 180), roll: 1, yaw: -1, throttle: 1 });
    assert.ok(
      [...p.pose.p, ...p.pose.v, ...Object.values(p.pose.q)].every(
        Number.isFinite,
      ),
    );
    assert.ok(p.effects.usedMah > 0);
    p.reset([0, 40, 0]);
    assert.equal(p.armed, false);
    assert.equal(p.motorThrust[0], 0);
    assert.deepEqual(p.pose.v, [0, 0, -9]);
  } finally {
    world.free();
  }
});

test("small-plane ground launch parks and takes off from the real Grove surface", async () => {
  const map = { ...catalog.maps.find((m) => m.id === "liget"), gates: [] };
  const raw = gunzipSync(
    await readFile(
      new URL("../web" + COLLISION_ASSETS.liget.url, import.meta.url),
    ),
  );
  const records = decodeCollisionData(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    "liget",
  );
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
    baked = new PrebakedCollisions(RAPIER, world, map, records),
    launch = aircraftLaunch(config, map, { method: "ground" });
  const p = new FixedWingPhysics(RAPIER, world, config, launch.p, {
    launchPose: launch,
    updateSceneQueries: false,
  });
  try {
    for (let i = 0; i < 480; i++) {
      baked.update(p.pose.p, p.pose.v);
      p.step(idle);
    }
    assert.ok(p.grounded);
    assert.ok(p.pose.q.w > 0.99);
    assert.ok(Math.hypot(...p.pose.v) < 0.1);
    p.armed = true;
    let lifted = false;
    for (let i = 0; i < 240 * 15; i++) {
      const pos = p.pose.p,
        agl = pos[1] - parkSurfaceHeight(pos[0], pos[2]);
      baked.update(pos, p.pose.v);
      p.step({
        ...idle,
        pitch: p.airspeed > 6 && agl < 2 ? -0.25 : 0,
        throttle: 0.8,
      });
      if (agl > 4) {
        lifted = true;
        break;
      }
    }
    assert.ok(lifted, JSON.stringify(p.pose));
    assert.equal(p.crashed, false);
  } finally {
    baked.dispose();
    world.free();
  }
});

test("mixed remote S75 and T15 use different collision dimensions and matching pusher animation", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    configs = new Map(catalog.airplanes.map((c) => [c.id, c]));
  const remote = new RemoteCollisions(RAPIER, world, config, (p) =>
    configs.get(p.droneId),
  );
  try {
    const players = catalog.airplanes.map((c, i) => ({
      id: c.id,
      droneId: c.id,
      p: [i * 5, 30, 0],
      q: { x: 0, y: 0, z: 0, w: 1 },
      resetId: 1,
    }));
    remote.update(players, "self", false);
    assert.equal(remote.bodies.size, 2);
    const local = createAircraftVisual(createScoutModel(), config),
      other = createAircraftVisual(createScoutModel(), config);
    const physics = {
      armed: true,
      motorThrust: [1],
      surfaces: { pitch: 0.3, roll: -0.2, yaw: 0.1 },
    };
    local.update(0.1, physics, { throttle: 0.7 });
    other.updateRemote(0.1, {
      ...local.networkState(physics, false),
      resetId: 1,
    });
    assert.equal(other.motion.phase[0], local.motion.phase[0]);
    assert.ok(other.motion.phase[0] < 0);
    local.dispose();
    other.dispose();
    world.updateSceneQueries();
    // At 0.6 m from its centre a T15 wing is present, an S75 wing is not.
    for (const [i, c] of catalog.airplanes.entries()) {
      const hit = world.castRay(
        new RAPIER.Ray(
          { x: i * 5 + 0.6, y: 31, z: -0.03 },
          { x: 0, y: -1, z: 0 },
        ),
        2,
        true,
      );
      assert.equal(Boolean(hit), c.id === "rift-t15");
    }
  } finally {
    remote.dispose();
    world.free();
  }
});
