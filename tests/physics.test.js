import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { loadCatalog } from "../server/catalog.js";
import { DronePhysics, PHYSICS_DT } from "../shared/physics/drone.js";
await RAPIER.init();
const { drones } = await loadCatalog();
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
function fixture(config) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  return { world, drone: new DronePhysics(RAPIER, world, config, [0, 10, 0]) };
}
for (const config of drones) {
  test(config.id + ": gravity, hover balance and motor response", () => {
    const { world, drone } = fixture(config);
    try {
      for (let i = 0; i < 120; i++) drone.step(neutral);
      assert.ok(drone.pose.p[1] < 9);
      drone.reset([0, 10, 0]);
      drone.armed = true;
      const input = {
        ...neutral,
        throttle: Math.sqrt(
          (config.massKg * 9.81) / (4 * config.motor.maxThrustN),
        ),
      };
      drone.step(input);
      assert.ok(
        drone.motorThrust.every((n) => n > 0 && n < config.motor.maxThrustN),
      );
      for (let i = 0; i < 480; i++) drone.step(input);
      assert.ok(drone.pose.p[1] > 9 && drone.pose.p[1] < 10.1);
      assert.ok(
        Math.hypot(drone.pose.q.x, drone.pose.q.y, drone.pose.q.z) < 0.002,
        "neutral motors must balance the configured centre of mass",
      );
      assert.ok(
        Math.abs(
          drone.motorThrust.reduce((a, b) => a + b, 0) - config.massKg * 9.81,
        ) < 0.001,
      );
    } finally {
      world.free();
    }
  });
  for (const mode of ["acro", "angle", "horizon"])
    test(config.id + ": " + mode + " pitch and roll behaviour", () => {
      for (const axis of ["x", "z"]) {
        const { world, drone } = fixture(config);
        try {
          drone.mode = mode;
          drone.armed = true;
          const q = { x: 0, y: 0, z: 0, w: Math.cos(0.15) };
          q[axis] = Math.sin(0.15);
          drone.body.setRotation(q, true);
          const input = {
            ...neutral,
            throttle: Math.sqrt(
              (config.massKg * 9.81) / (4 * config.motor.maxThrustN),
            ),
          };
          for (let i = 0; i < 480; i++) drone.step(input);
          if (mode === "acro")
            assert.ok(
              Math.abs(drone.pose.q[axis]) > 0.14,
              "Acro must retain its attitude",
            );
          else
            assert.ok(
              Math.abs(drone.pose.q[axis]) < 0.015,
              mode + " must restore level on both axes",
            );
        } finally {
          world.free();
        }
      }
    });
  test(config.id + ": ground collision and disarmed reset", () => {
    const { world, drone } = fixture(config);
    try {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0),
      );
      for (let i = 0; i < 960; i++) drone.step(neutral);
      assert.ok(drone.pose.p[1] >= 0 && drone.pose.p[1] < 0.1);
      assert.ok(Math.hypot(...drone.pose.v) < 0.05);
      drone.armed = true;
      drone.step({ ...neutral, throttle: 1 });
      drone.reset([1, 2, 3]);
      assert.equal(drone.armed, false);
      assert.deepEqual(drone.motorThrust, [0, 0, 0, 0]);
      assert.deepEqual(drone.pose.p, [1, 2, 3]);
      assert.equal(Math.hypot(...drone.pose.v), 0);
    } finally {
      world.free();
    }
  });
}
test("the three configurations give different thrust-to-mass response", () => {
  const speeds = {};
  for (const c of drones) {
    const { world, drone } = fixture(c);
    try {
      drone.armed = true;
      for (let i = 0; i < 240; i++) drone.step({ ...neutral, throttle: 1 });
      speeds[c.id] = drone.pose.v[1];
      assert.ok(
        Math.hypot(drone.pose.q.x, drone.pose.q.y, drone.pose.q.z) < 0.002,
        "motor saturation must not tilt a neutral drone",
      );
    } finally {
      world.free();
    }
  }
  assert.ok(speeds["rift-x5"] > speeds["rift-c3"]);
  assert.ok(Math.abs(speeds["rift-c3"] - speeds["rift-65"]) > 0.1);
});
test("integration is stable at 120 Hz and 240 Hz", () => {
  const c = drones.find((d) => d.id === "rift-x5"),
    positions = [];
  for (const dt of [PHYSICS_DT, 1 / 120]) {
    const { world, drone } = fixture(c);
    try {
      drone.armed = true;
      for (let s = 0; s < 1 - dt / 2; s += dt)
        drone.step({ ...neutral, throttle: 0.5, roll: 0.12 }, dt);
      positions.push(drone.pose.p);
    } finally {
      world.free();
    }
  }
  assert.ok(
    Math.hypot(...positions[0].map((v, i) => v - positions[1][i])) < 0.25,
  );
});
