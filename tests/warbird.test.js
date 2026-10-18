import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { loadCatalog } from "../server/catalog.js";
import { createAirplaneModel } from "../shared/visual/airplane-models.js";
import { createWarbirdModel } from "../shared/visual/warbird-model.js";
import { animateFixedWingModel } from "../shared/visual/airplane-model-utils.js";
import { createAircraftVisual } from "../web/game/aircraft-visual.js";
import { FixedWingPhysics } from "../shared/physics/fixed-wing.js";
import { advanceFixedSteps } from "../shared/physics/fixed-step.js";
import { disposeModelMaterials } from "../web/game/models.js";
await RAPIER.init();
const catalog = await loadCatalog(),
  config = catalog.airplanes.find((c) => c.id === "rift-a40");

test("Aero 40 is the first airplane, a distinct 400 mm / 1S warbird with finite compact geometry", () => {
  assert.deepEqual(
    catalog.airplanes.map((c) => c.id),
    ["rift-a40", "rift-s75", "rift-t15"],
  );
  assert.equal(config.battery.cells, 1);
  assert.equal(config.wingspanM, 0.4);
  const model = createAirplaneModel(config),
    size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - 0.4) < 0.001);
  assert.ok(Math.abs(size.z - config.lengthM) < 0.005);
  let draws = 0,
    triangles = 0,
    surfaces = 0;
  model.traverse((o) => {
    if (o.userData.surface) surfaces++;
    if (o.isMesh) {
      draws++;
      triangles +=
        (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      assert.ok(
        [
          ...o.geometry.attributes.position.array,
          ...o.geometry.attributes.normal.array,
        ].every(Number.isFinite),
      );
    }
  });
  assert.equal(surfaces, 4);
  assert.ok(draws <= 26, draws + " draws");
  assert.ok(triangles < 28000, triangles + " triangles");
  disposeModelMaterials(model);
});

test("curved canopy replaces the fuselage skin and stays visible from both sides after batching", () => {
  const raw = createWarbirdModel({ batchStatic: false }),
    batched = createWarbirdModel();
  const pane = raw.getObjectByName("A40_flush_bubble_canopy"),
    p = pane.geometry.attributes.position,
    n = pane.geometry.attributes.normal;
  for (const row of [8, 16, 24])
    for (const column of [4, 12]) {
      const ids = [
        row * 17 + column,
        row * 17 + column + 1,
        (row + 1) * 17 + column + 1,
      ];
      const point = ids
        .reduce(
          (v, i) => v.add(new THREE.Vector3().fromBufferAttribute(p, i)),
          new THREE.Vector3(),
        )
        .divideScalar(3);
      const normal = ids
        .reduce(
          (v, i) => v.add(new THREE.Vector3().fromBufferAttribute(n, i)),
          new THREE.Vector3(),
        )
        .normalize();
      const ray = new THREE.Raycaster(
        point.clone().addScaledVector(normal, 0.06),
        normal.negate(),
        0,
        0.065,
      );
      for (const model of [raw, batched])
        assert.equal(
          ray
            .intersectObject(model, true)[0]
            ?.object.material.color.getHexString(),
          "244a5b",
        );
    }
  const prop = raw.getObjectByName("A40_tractor_propeller");
  assert.deepEqual(prop.position.toArray(), config.motors[0].positionM);
  assert.ok(prop.position.z < -0.145);
  assert.equal(raw.userData.fpvCameraOffset[2], config.cameraOffsetM[2]);
  disposeModelMaterials(raw);
  disposeModelMaterials(batched);
});

test("propeller, hinged paint and all four control surfaces animate in local and remote models", () => {
  const model = createWarbirdModel(),
    visual = createAircraftVisual(model, config),
    remoteModel = createWarbirdModel(),
    remote = createAircraftVisual(remoteModel, config);
  const physics = {
    armed: true,
    motorThrust: [config.motor.maxThrustN * 0.5],
    surfaces: { pitch: 0.3, roll: 0.4, yaw: -0.2 },
  };
  visual.update(0.1, physics, { throttle: 0.5 });
  remote.updateRemote(0.1, {
    ...visual.networkState(physics, false),
    resetId: 1,
  });
  assert.ok(model.getObjectByName("A40_tractor_propeller").rotation.z > 0);
  assert.equal(
    remoteModel.getObjectByName("A40_tractor_propeller").rotation.z,
    model.getObjectByName("A40_tractor_propeller").rotation.z,
  );
  assert.equal(model.getObjectByName("A40_elevator").rotation.x, 0.12);
  for (const value of [-1, 0, 1]) {
    animateFixedWingModel(model, { pitch: value, roll: value, yaw: value }, 0);
    model.updateMatrixWorld(true);
    for (const side of [-1, 1]) {
      const pivot = model.getObjectByName("A40_aileron_" + side);
      assert.ok(
        pivot.children.some((o) => o.name.startsWith("A40_aileron_paint")),
      );
      // The hinge pivot is a physical wing point, not an offset rotating flap.
      assert.equal(pivot.position.z, -0.008);
      assert.ok(Math.abs(pivot.position.x) < 0.18);
    }
  }
  visual.dispose();
  remote.dispose();
  disposeModelMaterials(model);
  disposeModelMaterials(remoteModel);
});

test("micro warbird glides, responds to all axes, and has consistent powered flight at different display cadences", () => {
  const idle = { pitch: 0, roll: 0, yaw: 0, throttle: 0 },
    paths = [];
  const flight = () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    return {
      world,
      p: new FixedWingPhysics(RAPIER, world, config, [0, 100, 0], {
        updateSceneQueries: false,
      }),
    };
  };
  for (const hz of [30, 60, 144]) {
    const { world, p } = flight(),
      clock = { accumulator: 0 };
    p.armed = true;
    for (let i = 0; i < hz * 5; i++)
      advanceFixedSteps(clock, 1 / hz, () =>
        p.step({ ...idle, throttle: 0.65 }),
      );
    assert.ok(p.pose.p[2] < -30);
    assert.ok(
      [...p.pose.p, ...p.pose.v, ...Object.values(p.pose.q)].every(
        Number.isFinite,
      ),
    );
    paths.push(p.pose.p);
    world.free();
  }
  for (const path of paths)
    assert.ok(Math.hypot(...path.map((v, i) => v - paths[0][i])) < 0.03);
  const { world, p } = flight();
  for (let i = 0; i < 240 * 10; i++) p.step(idle);
  assert.ok(p.pose.p[1] < 99 && p.pose.p[1] > 60);
  assert.equal(p.motorThrust[0], 0);
  world.free();
  for (const axis of ["pitch", "roll", "yaw"])
    for (const sign of [-1, 1]) {
      const { world, p } = flight();
      for (let i = 0; i < 48; i++) p.step({ ...idle, [axis]: sign });
      const k = { pitch: 0, yaw: 1, roll: 2 }[axis];
      assert.ok(p.pose.w[k] * sign < 0, axis + " control sign");
      world.free();
    }
});

test("taildragger rests on its main wheels and small tail wheel, then performs a real ground takeoff", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(100, 0.1, 100).setTranslation(0, -0.1, 0),
  );
  const plane = new FixedWingPhysics(RAPIER, world, config, [0, 0.074, 0], {
    launchPose: { q: { x: 0, y: 0, z: 0, w: 1 }, v: [0, 0, 0] },
  });
  try {
    for (let i = 0; i < 480; i++) plane.step({ throttle: 0 });
    assert.ok(plane.grounded);
    assert.ok(plane.pose.q.w > 0.98);
    assert.equal(plane.gearColliders[2].shape.radius, 0.005);
    plane.armed = true;
    for (let i = 0; i < 240 * 10; i++)
      plane.step({ throttle: 0.9, pitch: plane.airspeed > 5 ? -0.2 : 0 });
    assert.ok(plane.pose.p[1] > 5);
    assert.ok(plane.pose.p[2] < -30);
    assert.equal(plane.crashed, false);
  } finally {
    world.free();
  }
});
