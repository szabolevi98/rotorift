import test from "node:test";
import assert from "node:assert/strict";
import { createTrainerModel } from "../shared/visual/fixed-wing-model.js";
import { createAircraftVisual } from "../web/game/aircraft-visual.js";
import { loadCatalog } from "../server/catalog.js";
const { airplanes } = await loadCatalog(),
  config = airplanes[0];

test("airplane prop motion and exposure rise progressively, stop at zero and match remotely", () => {
  const model = createTrainerModel(),
    remoteModel = createTrainerModel();
  const visual = createAircraftVisual(model, config),
    remote = createAircraftVisual(remoteModel, config, { remote: true });
  const physics = {
      armed: true,
      motorThrust: [0],
      surfaces: { pitch: 0, roll: 0, yaw: 0 },
    },
    speeds = [],
    opacity = [];
  try {
    for (const throttle of [0.25, 0.5, 0.75, 1]) {
      physics.motorThrust[0] =
        config.motor.maxThrustN * throttle ** config.motor.thrustExponent;
      visual.update(1 / 60, physics, { throttle });
      const payload = visual.networkState(physics, false);
      remote.updateRemote(1 / 60, { ...payload, resetId: 1 });
      speeds.push(visual.motion.speed[0]);
      opacity.push(visual.exposure.discs[0].material.opacity);
      assert.ok(
        Math.abs(remote.motion.phase[0] - visual.motion.phase[0]) < 1e-10,
      );
      assert.equal(remote.exposure.discs[0].material.opacity, opacity.at(-1));
    }
    for (const values of [speeds, opacity])
      assert.ok(values.every((v, i) => !i || v > values[i - 1]));
    assert.ok(
      speeds.at(-1) > 22 * 3,
      "large prop has faster visible motion than the old quad shutter rate",
    );
    assert.equal(
      visual.exposure.blades[0].blade.visible,
      false,
      "fast blades become a swept exposure",
    );
    const phase = visual.motion.phase[0];
    visual.update(1 / 60, physics, { throttle: 0 });
    assert.equal(visual.motion.phase[0], phase);
    assert.equal(visual.exposure.discs[0].visible, false);
    for (const { blade, original } of visual.exposure.blades) {
      assert.equal(blade.visible, true);
      assert.equal(blade.material.opacity, original.opacity);
      assert.equal(blade.material.depthWrite, original.depthWrite);
    }
    remote.updateRemote(1 / 60, { resetId: 1, connected: false });
    assert.equal(remote.exposure.discs[0].visible, false);
    visual.reset();
    assert.equal(visual.motion.phase[0], 0);
  } finally {
    visual.dispose();
    remote.dispose();
    for (const root of [model, remoteModel]) {
      const materials = new Set();
      root.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) materials.add(o.material);
      });
      for (const m of materials) m.dispose();
    }
  }
});

test("airplane visual phase is independent of 30/60/120/144 Hz frame cadence", () => {
  const phases = [];
  for (const hz of [30, 60, 120, 144]) {
    const model = createTrainerModel(),
      visual = createAircraftVisual(model, config);
    const physics = {
      armed: true,
      motorThrust: [config.motor.maxThrustN * 0.25],
      surfaces: { pitch: 0, roll: 0, yaw: 0 },
    };
    for (let i = 0; i < hz; i++)
      visual.update(1 / hz, physics, { throttle: 0.5 });
    phases.push(visual.motion.phase[0]);
    visual.dispose();
    const materials = new Set();
    model.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) materials.add(o.material);
    });
    for (const m of materials) m.dispose();
  }
  for (const phase of phases) assert.ok(Math.abs(phase - phases[0]) < 1e-10);
});
