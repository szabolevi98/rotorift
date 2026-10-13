import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { loadCatalog } from "../server/catalog.js";
import { DronePhysics, PHYSICS_DT } from "../shared/physics/drone.js";
import { hoverThrottle, throttleToThrust, motorThrustLimit } from "../shared/physics/propulsion.js";
import { rotate, inverse } from "../shared/physics/math.js";
import { actualRate } from "../shared/physics/rates.js";
await RAPIER.init();
const { drones } = await loadCatalog();
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
function fixture(config) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  return { world, drone: new DronePhysics(RAPIER, world, config, [0, 10, 0]) };
}
for (const config of drones) {
  test(config.id + ": 27–30% hover curve preserves full motor power and 30% lifts from the ground", () => {
    const hover = hoverThrottle(config);
    assert.ok(hover >= 0.27 && hover <= 0.30, `${config.id}: ${hover}`);
    assert.equal(throttleToThrust(0, config), 0);
    assert.equal(throttleToThrust(1, config), motorThrustLimit(config));
    const lowerVoltage = structuredClone(config);
    lowerVoltage.battery.nominalVoltage *= 0.9;
    assert.ok(hoverThrottle(lowerVoltage) > hover);
    for (const throttle of [0.26, 0.30]) {
      const { world, drone } = fixture(config);
      try {
        world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0));
        drone.reset([0, 0.04, 0]);
        for (let i = 0; i < 120; i++) drone.step(neutral);
        drone.armed = true;
        for (let i = 0; i < 480; i++) drone.step({ ...neutral, throttle });
        if (throttle === 0.26) assert.ok(drone.pose.p[1] < 0.1, "below hover stays grounded");
        else assert.ok(drone.pose.p[1] > 0.8, "30% must take off");
      } finally { world.free(); }
    }
  });
  test(config.id + ": full Acro roll and pitch follow configured rates, flip in under 0.7 s and brake on release", () => {
    for (const [axis, index] of [["roll", 2], ["pitch", 0]]) {
      const { world, drone } = fixture(config);
      try {
        drone.armed = true;
        const input = { ...neutral, throttle: hoverThrottle(config) };
        for (let i = 0; i < 120; i++) drone.step(input);
        const target = actualRate(1, drone.rates[axis]);
        let angle = 0, flipAt = null, peak = 0, rate;
        const bodyRate = () => -rotate(drone.pose.w, inverse(drone.pose.q))[index] * 180 / Math.PI;
        for (let i = 0; i < 240; i++) {
          drone.step({ ...input, [axis]: 1 });
          rate = bodyRate(); angle += rate * PHYSICS_DT; peak = Math.max(peak, rate);
          if (angle >= 360 && flipAt === null) flipAt = (i + 1) * PHYSICS_DT;
          if (i === 35) assert.ok(rate >= target * 0.9, `${axis}: slow response ${rate}`);
        }
        assert.ok(flipAt !== null && flipAt < 0.7, `${axis}: flip ${flipAt}`);
        assert.ok(rate > target * 0.98 && rate <= target * 1.02, `${axis}: rate ${rate}`);
        assert.ok(peak < target * 1.12, `${axis}: overshoot ${peak}`);
        let rebound = 0;
        for (let i = 0; i < 60; i++) {
          drone.step(input); rate = bodyRate();
          rebound += Math.max(0, -rate) * PHYSICS_DT;
        }
        assert.ok(Math.abs(rate) < 10, `${axis}: still spinning after release ${rate}`);
        assert.ok(rebound < 5, `${axis}: reverse bounce ${rebound}`);
      } finally { world.free(); }
    }
  });
  test(config.id + ": gravity, hover balance and motor response", () => {
    const { world, drone } = fixture(config);
    try {
      for (let i = 0; i < 120; i++) drone.step(neutral);
      assert.ok(drone.pose.p[1] < 9);
      drone.reset([0, 10, 0]);
      drone.armed = true;
      const input = {
        ...neutral,
        throttle: hoverThrottle(config),
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
            throttle: hoverThrottle(config),
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

test("full-power cruise converges to category speeds through drag, without a velocity clamp", () => {
  const bands = { "rift-65": [70, 85], "rift-75": [85, 100], "rift-c3": [110, 130], "rift-x5": [190, 205] };
  for (const config of drones) {
    const { world, drone } = fixture(config);
    try {
      drone.reset([0, 1000, 0]); drone.armed = true;
      const pitch = 80 * Math.PI / 180;
      drone.body.setRotation({ x: Math.sin(pitch / 2), y: 0, z: 0, w: Math.cos(pitch / 2) }, true);
      let speedAt15;
      for (let i = 0; i < 240 * 30; i++) {
        drone.step({ ...neutral, throttle: 1 });
        if (i === 240 * 15 - 1) speedAt15 = Math.hypot(...drone.pose.v) * 3.6;
      }
      const speed = Math.hypot(...drone.pose.v) * 3.6, [min, max] = bands[config.id];
      assert.ok(speed >= min && speed <= max, `${config.id}: ${speed} km/h`);
      assert.ok(Math.abs(speed - speedAt15) < 1, "speed must settle rather than grow indefinitely");
      // Excess speed must dissipate progressively, preserving crash impulses.
      drone.body.setLinvel({ x: config.maxSpeedMps * 1.5, y: 0, z: 0 }, true);
      drone.armed = false; drone.step(neutral);
      assert.ok(drone.pose.v[0] > config.maxSpeedMps, "must not snap velocity to a hard limit");
      for (let i = 0; i < 240; i++) drone.step(neutral);
      assert.ok(drone.pose.v[0] < config.maxSpeedMps);
    } finally { world.free(); }
  }
});
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
