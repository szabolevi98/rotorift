import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { loadCatalog } from "../server/catalog.js";
import { AirplaneSlipstream } from "../shared/physics/airplane-slipstream.js";
import { FixedWingPhysics } from "../shared/physics/fixed-wing.js";
import { aircraftSimulation } from "../shared/aircraft/capabilities.js";
import { advanceFixedSteps } from "../shared/physics/fixed-step.js";
await RAPIER.init();
const { airplanes, drones } = await loadCatalog();
const idle = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
const loads = () => ({ force: [0, 0, 0], torque: [0, 0, 0] });
function wash(
  c,
  surfaces = idle,
  velocity = [0, 0, 0],
  thrust = c.motor.maxThrustN,
  rates = [0, 0, 0],
) {
  return new AirplaneSlipstream(c).addLoads(
    loads(),
    velocity,
    rates,
    surfaces,
    thrust,
  );
}
function rig(c, options = {}) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const p = new FixedWingPhysics(RAPIER, world, c, [0, 300, 0], {
    simulation: options,
    updateSceneQueries: false,
  });
  return { world, p };
}
for (const c of airplanes) {
  test(
    c.id + ": only downstream surfaces in the wake gain control authority",
    () => {
      assert.equal(aircraftSimulation(c, { propwash: true }).propwash, true);
      assert.deepEqual(wash(c, idle, [0, 0, 0], 0), loads());
      const zero = wash(c),
        pitch = wash(c, { ...idle, pitch: 0.4 }),
        yaw = wash(c, { ...idle, yaw: 0.4 });
      assert.ok(
        yaw.torque[1] < zero.torque[1],
        "rudder wash reinforces right input",
      );
      if (c.id === "rift-s75")
        assert.deepEqual(
          pitch,
          zero,
          "raised pusher misses the lower horizontal tail",
        );
      else {
        assert.ok(
          pitch.torque[0] < zero.torque[0],
          "elevator wash reinforces nose-down input",
        );
        const lower = wash(
          c,
          { ...idle, pitch: 0.4 },
          [0, 0, 0],
          c.motor.maxThrustN * 0.25,
        );
        assert.ok(Math.abs(lower.torque[0]) < Math.abs(pitch.torque[0]));
        const damping = wash(
          c,
          idle,
          [0, 0, 0],
          c.motor.maxThrustN,
          [0.1, 0, 0],
        );
        assert.ok(
          damping.torque[0] < zero.torque[0],
          "local tail airflow damps pitch rotation",
        );
      }
      const upstream = structuredClone(c);
      upstream.motors[0].positionM[2] = 2;
      assert.deepEqual(wash(upstream, { pitch: 1, yaw: 1 }), loads());
      assert.deepEqual(
        wash(c, { pitch: 1, yaw: 1 }, [50, 0, 0]),
        loads(),
        "strong crossflow carries wake away from tail",
      );
      const reversed = structuredClone(c);
      reversed.motors[0].direction *= -1;
      assert.ok(
        zero.torque[1] * wash(reversed).torque[1] < 0,
        "swirl follows prop rotation",
      );
      assert.deepEqual(
        wash(c, { ...idle, roll: 1 }),
        zero,
        "outboard ailerons gain no fake authority",
      );
    },
  );
  test(
    c.id +
      ": real motor spool and blade loss drive the optional wash; reset/disable preserve baseline",
    () => {
      const on = rig(c, { propwash: true, propDamage: true }),
        off = rig(c, { propwash: false, propDamage: true });
      try {
        for (const { p } of [on, off]) {
          p.armed = true;
          p.step({ ...idle, pitch: 0.3, yaw: 0.2, throttle: 0.6 });
        }
        assert.notDeepEqual(on.p.loads.torque, off.p.loads.torque);
        // Identical broken motors: no thrust means no wash even at full command.
        for (const { p } of [on, off]) {
          p.reset([0, 300, 0]);
          p.effects.propeller.blades = [3, 3];
          p.armed = true;
        }
        for (let i = 0; i < 120; i++)
          for (const { p } of [on, off])
            p.step({ ...idle, pitch: 0.3, yaw: 0.2, throttle: 1 });
        assert.deepEqual(on.p.pose, off.p.pose);
        on.p.effects.setOptions({ propwash: false, propDamage: true });
        for (const { p } of [on, off]) {
          p.reset([0, 300, 0]);
          p.armed = true;
        }
        for (let i = 0; i < 120; i++)
          for (const { p } of [on, off])
            p.step({ ...idle, pitch: 0.3, yaw: 0.2, throttle: 0.6 });
        assert.deepEqual(
          on.p.pose,
          off.p.pose,
          "disabled option restores exact original solver",
        );
        on.p.effects.setOptions({ propwash: true, propDamage: true });
        on.p.reset([0, 300, 0]);
        assert.equal(on.p.motorThrust[0], 0);
        assert.deepEqual(on.p.effects.propeller.blades, [0, 0]);
        on.p.step(idle);
        off.p.reset([0, 300, 0]);
        off.p.step(idle);
        assert.deepEqual(
          on.p.pose,
          off.p.pose,
          "unpowered reset has no residual wake",
        );
      } finally {
        on.world.free();
        off.world.free();
      }
    },
  );
  test(
    c.id +
      ": enabled wash is deterministic across frame cadences and stabilized servos remain bounded",
    () => {
      const paths = [];
      for (const hz of [30, 60, 120, 144]) {
        const { world, p } = rig(c, { propwash: true }),
          clock = { accumulator: 0 };
        p.mode = "stabilized";
        p.armed = true;
        try {
          for (let i = 0; i < hz * 4; i++)
            advanceFixedSteps(clock, 1 / hz, () =>
              p.step({ ...idle, throttle: 0.6 }),
            );
          paths.push(p.pose.p);
          const pitch = Math.asin(
            Math.max(
              -1,
              Math.min(
                1,
                2 * (p.pose.q.w * p.pose.q.x - p.pose.q.y * p.pose.q.z),
              ),
            ),
          );
          assert.ok(
            Math.abs(pitch) < 0.04,
            "stabilized remains near level with wash",
          );
          for (let i = 0; i < 240 * 4; i++)
            p.step({
              pitch: Math.sin(i / 60),
              roll: Math.cos(i / 90),
              yaw: 0.4,
              throttle: 0.7,
            });
          assert.ok(
            [...p.pose.p, ...p.pose.v, ...p.pose.w].every(Number.isFinite),
          );
          assert.equal(p.crashed, false);
          assert.ok(
            Object.values(p.surfaces).every(
              (v) => Math.abs(v) <= c.controls.travel,
            ),
          );
        } finally {
          world.free();
        }
      }
      for (const path of paths)
        assert.ok(Math.hypot(...path.map((v, i) => v - paths[0][i])) < 0.03);
    },
  );
}
test("quad propwash capability and simulation categories remain available", () => {
  for (const c of drones)
    assert.equal(aircraftSimulation(c, { propwash: true }).propwash, true);
});
