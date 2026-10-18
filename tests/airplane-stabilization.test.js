import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { loadCatalog } from "../server/catalog.js";
import { FixedWingPhysics } from "../shared/physics/fixed-wing.js";
import {
  airplaneSurfaceTargets,
  AIRPLANE_ANGLE_LIMITS,
} from "../shared/physics/airplane-stabilization.js";
import { aircraftModes } from "../shared/aircraft/capabilities.js";
import { advanceFixedSteps } from "../shared/physics/fixed-step.js";
await RAPIER.init();
const { airplanes, drones } = await loadCatalog();
const idle = { pitch: 0, roll: 0, yaw: 0, throttle: 0.5 };
function attitude(q) {
  return {
    pitch: Math.asin(Math.max(-1, Math.min(1, 2 * (q.w * q.x - q.y * q.z)))),
    roll: Math.atan2(
      2 * (q.x * q.y + q.w * q.z),
      1 - 2 * (q.x * q.x + q.z * q.z),
    ),
  };
}
function flight(config, mode, pitch = 0, roll = 0) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
    p = new FixedWingPhysics(RAPIER, world, config, [0, 300, 0], {
      updateSceneQueries: false,
    });
  const q = {
    x: Math.sin(pitch / 2) * Math.cos(roll / 2),
    y: -Math.sin(pitch / 2) * Math.sin(roll / 2),
    z: Math.cos(pitch / 2) * Math.sin(roll / 2),
    w: Math.cos(pitch / 2) * Math.cos(roll / 2),
  };
  p.body.setRotation(q, true);
  p.mode = mode;
  p.armed = true;
  return { world, p };
}

test("only airplanes offer self-level stabilization, while Manual keeps direct surface demands", () => {
  for (const config of airplanes) {
    assert.deepEqual(aircraftModes(config), ["manual", "stabilized"]);
    const profile = config.controls,
      input = { pitch: 0.6, roll: -0.3, yaw: 0.4 },
      targets = {};
    const result = airplaneSurfaceTargets(
      config,
      "manual",
      input,
      { x: 0, y: 0, z: 1, w: 0 },
      [5, 6, 7],
      [0, -9, -4],
      profile,
      targets,
    );
    for (const axis of ["pitch", "roll", "yaw"])
      assert.equal(
        result[axis],
        (input[axis] * (1 - profile.expo) + input[axis] ** 3 * profile.expo) *
          profile.travel,
      );
  }
  for (const config of drones)
    assert.deepEqual(aircraftModes(config), ["acro", "angle", "horizon"]);
});

for (const config of airplanes) {
  test(
    config.id +
      ": releasing the sticks recovers a bank, pitch disturbance and inverted flight via real servos",
    () => {
      for (const [pitch, roll] of [
        [0.3, 0.8],
        [-0.3, -1.1],
        [0, Math.PI],
      ]) {
        const { world, p } = flight(config, "stabilized", pitch, roll);
        try {
          for (let i = 0; i < 240 * 8; i++) p.step(idle);
          const angles = attitude(p.pose.q);
          assert.ok(Math.abs(angles.pitch) < 0.035, JSON.stringify(angles));
          assert.ok(Math.abs(angles.roll) < 0.035, JSON.stringify(angles));
          assert.ok(p.pose.p[1] > 260);
          assert.ok(p.airspeed > 5);
          for (const value of Object.values(p.surfaces))
            assert.ok(Math.abs(value) <= p.controlProfile.travel);
        } finally {
          world.free();
        }
      }
      const { world, p } = flight(config, "manual", 0.3, 0.8);
      try {
        for (let i = 0; i < 240 * 8; i++) p.step(idle);
        assert.ok(Math.abs(attitude(p.pose.q).roll) > 0.5);
      } finally {
        world.free();
      }
    },
  );

  test(
    config.id +
      ": held sticks demand bounded bank/pitch, return to level and preserve yaw/throttle authority",
    () => {
      for (const sign of [-1, 1]) {
        const { world, p } = flight(config, "stabilized");
        try {
          let maxPitch = 0,
            maxRoll = 0;
          for (let i = 0; i < 240 * 6; i++) {
            p.step({ ...idle, pitch: sign, roll: sign });
            const angles = attitude(p.pose.q);
            maxPitch = Math.max(maxPitch, Math.abs(angles.pitch));
            maxRoll = Math.max(maxRoll, Math.abs(angles.roll));
          }
          assert.ok(maxPitch < AIRPLANE_ANGLE_LIMITS.pitch + 0.1);
          assert.ok(maxRoll < AIRPLANE_ANGLE_LIMITS.roll + 0.1);
          const commanded = attitude(p.pose.q);
          assert.ok(commanded.pitch * sign < -0.15);
          assert.ok(commanded.roll * sign < -0.4);
          for (let i = 0; i < 240 * 8; i++) p.step(idle);
          const recovered = attitude(p.pose.q);
          assert.ok(
            Math.abs(recovered.pitch) < 0.04 && Math.abs(recovered.roll) < 0.04,
          );
          p.step({ ...idle, yaw: 0.8 });
          assert.ok(p.surfaces.yaw > 0);
          p.armed = false;
          for (let i = 0; i < 360; i++) p.step({ ...idle, throttle: 1 });
          assert.ok(p.motorThrust[0] < 0.001);
        } finally {
          world.free();
        }
      }
    },
  );

  test(
    config.id +
      ": no artificial recovery or hover at rest, no height hold, and mode changes leave pose continuous",
    () => {
      const { world, p } = flight(config, "stabilized", 0.3, 0.8);
      try {
        p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        p.armed = false;
        const prior = p.pose.q;
        p.step({ ...idle, throttle: 0 });
        const after = p.pose.q;
        assert.ok(
          Math.hypot(...["x", "y", "z", "w"].map((k) => after[k] - prior[k])) <
            1e-5,
        );
        assert.ok(p.pose.v[1] < 0);
        assert.equal(p.motorThrust[0], 0);
        const before = p.pose;
        p.mode = "manual";
        assert.deepEqual(p.pose, before);
        p.mode = "stabilized";
        assert.deepEqual(p.pose, before);
        p.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        p.body.setLinvel({ x: 0, y: 0, z: -config.launch.speedMps }, true);
        for (let i = 0; i < 240 * 12; i++) p.step({ ...idle, throttle: 0 });
        assert.ok(
          p.pose.p[1] < 295,
          "stabilization does not secretly add thrust/lift or hold altitude",
        );
        assert.ok(
          [...p.pose.p, ...p.pose.v, ...Object.values(p.pose.q)].every(
            Number.isFinite,
          ),
        );
      } finally {
        world.free();
      }
    },
  );

  test(
    config.id +
      ": self-level feedback is independent of 30/60/120/144 Hz display cadence",
    () => {
      const paths = [];
      for (const hz of [30, 60, 120, 144]) {
        const { world, p } = flight(config, "stabilized", 0.2, 0.7),
          clock = { accumulator: 0 };
        try {
          for (let i = 0; i < hz * 4; i++)
            advanceFixedSteps(clock, 1 / hz, () => p.step(idle));
          paths.push(p.pose.p);
        } finally {
          world.free();
        }
      }
      for (const path of paths)
        assert.ok(Math.hypot(...path.map((v, i) => v - paths[0][i])) < 0.03);
    },
  );
}

test("stabilization stays finite near vertical, inverted, reversed and stalled attitudes", () => {
  for (const c of airplanes)
    for (const pitch of [-Math.PI / 2, Math.PI / 2]) {
      const { world, p } = flight(c, "stabilized", pitch, Math.PI);
      try {
        p.body.setLinvel({ x: 0, y: 0, z: 4 }, true);
        for (let i = 0; i < 240 * 5; i++)
          p.step({ ...idle, pitch: 0.3, roll: -0.2, yaw: 0.1, throttle: 0 });
        assert.ok(
          [
            ...p.pose.p,
            ...p.pose.v,
            ...Object.values(p.pose.q),
            ...Object.values(p.surfaces),
          ].every(Number.isFinite),
        );
      } finally {
        world.free();
      }
    }
});
