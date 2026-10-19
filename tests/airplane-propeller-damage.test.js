import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { loadCatalog } from "../server/catalog.js";
import { createAircraftPhysics } from "../shared/physics/aircraft.js";
import { AirplanePropellerDamage } from "../shared/physics/airplane-propeller.js";
import {
  airplaneAnimation,
  validAirplaneAnimation,
} from "../shared/aircraft/animation.js";
import { createAircraftVisual } from "../web/game/aircraft-visual.js";
import { createTrainerModel } from "../shared/visual/fixed-wing-model.js";
import { createScoutModel } from "../shared/visual/scout-model.js";
import { createWarbirdModel } from "../shared/visual/warbird-model.js";
import { RemoteCollisions } from "../web/game/remote-collisions.js";
await RAPIER.init();
const { airplanes } = await loadCatalog(),
  neutral = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
const factories = {
  "rift-a40": createWarbirdModel,
  "rift-s75": createScoutModel,
  "rift-t15": createTrainerModel,
};
const state = (propeller, engine = 0) => ({
  kind: "fixedWing",
  engine,
  surfaces: { pitch: 0, roll: 0, yaw: 0 },
  propeller,
});
function disposeModel(model) {
  const materials = new Set();
  model.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) materials.add(o.material);
  });
  for (const m of materials) m.dispose();
}

for (const config of airplanes) {
  test(
    config.id +
      " actual prop-edge contact damages only when enabled; reset and disabling repair it",
    () => {
      for (const enabled of [false, true]) {
        const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
          p = createAircraftPhysics(RAPIER, world, config, [0, 100, 0], {
            simulation: { propDamage: enabled },
            updateSceneQueries: false,
            launchPose: { q: { x: 0, y: 0, z: 0, w: 1 }, v: [0, 0, -5] },
          });
        try {
          const m = config.motors[0].positionM,
            r = config.propDiameterM / 2;
          world.createCollider(
            RAPIER.ColliderDesc.cuboid(0.008, 0.008, 0.01).setTranslation(
              m[0],
              100 + m[1] + r * 0.8,
              m[2] - 0.05,
            ),
          );
          p.armed = true;
          for (let i = 0; i < 50; i++) p.step({ ...neutral, throttle: 0.5 });
          assert.equal(
            p.effects.propeller.blades.some((v) => v > 0),
            enabled,
          );
          assert.equal(p.propellerContact.collider.isEnabled(), enabled);
          assert.equal(
            p.crashed,
            false,
            "minor prop contact is independent of severe airframe crash",
          );
          p.effects.propeller.blades = [3, 3];
          p.propellerContact.prepare();
          assert.ok(p.propellerContact.collider.shape.radius < r * 0.2);
          p.reset([0, 100, 0]);
          assert.deepEqual(p.effects.telemetry.propeller, [0, 0]);
          assert.ok(p.propellerContact.collider.shape.radius > r * 0.9);
          p.effects.propeller.blades = [2, 3];
          p.effects.setOptions({ propDamage: false });
          p.propellerContact.prepare();
          assert.deepEqual(p.effects.propeller.blades, [0, 0]);
          assert.equal(p.propellerContact.collider.isEnabled(), false);
        } finally {
          world.free();
        }
      }
    },
  );
  test(
    config.id +
      " lost prop removes motor thrust while aerodynamic glide and reset still work",
    () => {
      const runs = [];
      for (const broken of [false, true]) {
        const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
          p = createAircraftPhysics(RAPIER, world, config, [0, 100, 0], {
            simulation: { propDamage: true },
            updateSceneQueries: false,
          });
        try {
          if (broken) p.effects.propeller.blades = [3, 3];
          p.armed = true;
          for (let i = 0; i < 120; i++) p.step({ ...neutral, throttle: 0.8 });
          assert.ok(
            [...p.pose.p, ...p.pose.v, ...p.pose.w].every(Number.isFinite),
          );
          assert.ok(
            p.pose.p[2] < -1,
            "continues flying/gliding with missing prop",
          );
          assert.equal(p.crashed, false);
          runs.push(p.loads.force[2]);
        } finally {
          world.free();
        }
      }
      assert.ok(runs[0] < runs[1], "healthy prop adds forward force");
    },
  );
  test(
    config.id +
      " each visible blade deforms independently, survives exposure/remote stop and repairs on reset",
    () => {
      const model = factories[config.id](),
        remoteModel = factories[config.id]();
      const visual = createAircraftVisual(model, config),
        remote = createAircraftVisual(remoteModel, config);
      const physics = {
        armed: true,
        motorThrust: [config.motor.maxThrustN],
        surfaces: { pitch: 0, roll: 0, yaw: 0 },
        effects: {
          options: { propDamage: true },
          propeller: { blades: [2, 3] },
        },
      };
      try {
        assert.equal(visual.damage.blades.length, 2);
        visual.update(1 / 60, physics, { throttle: 1 });
        const payload = visual.networkState(physics, false);
        assert.deepEqual(payload.animation.propeller, [2, 3]);
        physics.effects.propeller.blades[0] = 1;
        assert.deepEqual(
          payload.animation.propeller,
          [2, 3],
          "network payload owns state copy",
        );
        remote.updateRemote(1 / 60, {
          ...payload,
          resetId: 1,
          connected: false,
        });
        const chipped = remote.damage.blades.find(
            (e) => e.blade.userData.bladeIndex === 0,
          ),
          missing = remote.damage.blades.find(
            (e) => e.blade.userData.bladeIndex === 1,
          );
        assert.notEqual(chipped.blade.geometry, chipped.original);
        assert.equal(missing.blade.visible, false);
        assert.equal(remote.exposure.discs[0].visible, false);
        remote.updateRemote(1 / 60, {
          animation: state([3, 3], 1),
          resetId: 1,
        });
        assert.equal(remote.exposure.discs[0].visible, false);
        remote.reset();
        for (const e of remote.damage.blades) {
          assert.equal(e.blade.geometry, e.original);
          assert.equal(e.blade.visible, true);
        }
        physics.effects.options.propDamage = false;
        assert.equal(
          visual.networkState(physics, false).animation.propeller,
          undefined,
        );
      } finally {
        visual.dispose();
        remote.dispose();
        disposeModel(model);
        disposeModel(remoteModel);
      }
    },
  );
}

test("two-blade severity, cooldown, imbalance and stopped thresholds remain distinct", () => {
  const p = new AirplanePropellerDamage(airplanes[0]);
  p.impact(1, 0);
  assert.deepEqual(p.blades, [0, 0]);
  p.impact(4, 1);
  assert.deepEqual(p.blades, [1, 0]);
  assert.ok(p.imbalance > 0 && p.efficiency(1) < 1);
  p.impact(20, 1.01);
  assert.deepEqual(p.blades, [1, 0], "cooldown");
  p.impact(8, 2);
  assert.deepEqual(p.blades, [2, 0]);
  p.impact(13, 3);
  assert.deepEqual(p.blades, [3, 0]);
  p.impact(25, 4);
  assert.deepEqual(p.blades, [3, 3]);
  assert.equal(p.efficiency(4), 0);
  p.reset();
  p.impact(4, 5, 0, false);
  assert.deepEqual(p.blades, [0, 0]);
  p.impact(25, 6, 0, false);
  assert.ok(p.blades.includes(3));
});

test("typed plane damage validates two bounded integers, keeps stopped damage, and strips disabled damage", () => {
  const config = airplanes[0],
    value = state([1, 3], 0.7);
  assert.equal(validAirplaneAnimation(value), true);
  for (const invalid of [[0], [[0, 0, 0]], [0, 4], [0.1, 0], [NaN, 0], null])
    assert.equal(
      validAirplaneAnimation({ ...value, propeller: invalid }),
      false,
    );
  assert.deepEqual(airplaneAnimation(config, value, false).propeller, [1, 3]);
  assert.equal(airplaneAnimation(config, value, false).engine, 0);
  assert.equal(
    airplaneAnimation(config, value, true, false).propeller,
    undefined,
  );
});

test("remote plane damage adds, shrinks and removes the optional prop collision proxy", () => {
  const config = airplanes[0],
    world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    remote = new RemoteCollisions(RAPIER, world, config);
  const p = {
    id: "peer",
    p: [0, 30, 0],
    q: { x: 0, y: 0, z: 0, w: 1 },
    resetId: 1,
  };
  try {
    remote.update([p], "self", false);
    const body = remote.bodies.get("peer");
    assert.equal(body.userData.propColliders.length, 0);
    remote.update([{ ...p, animation: state([0, 0]) }], "self", false);
    assert.equal(body.userData.propColliders.length, 1);
    const full = body.userData.propColliders[0].shape.radius;
    remote.update([{ ...p, animation: state([3, 3]) }], "self", false);
    assert.ok(body.userData.propColliders[0].shape.radius < full * 0.2);
    remote.update([p], "self", false);
    assert.equal(body.userData.propColliders.length, 0);
    remote.update([{ ...p, animation: state([0, 0]) }], "self", true);
    assert.equal(remote.bodies.size, 0);
  } finally {
    remote.dispose();
    world.free();
  }
});
