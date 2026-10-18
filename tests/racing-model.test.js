import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { loadCatalog } from "../server/catalog.js";
import { validateDrone } from "../shared/physics/config.js";
import {
  createRacingModel,
  R5_MOTOR_POSITIONS,
} from "../shared/visual/racing-model.js";
import { loadModel, disposeModelMaterials } from "../web/game/models.js";
import { createAircraftVisual } from "../web/game/aircraft-visual.js";
import { addAircraftColliders } from "../shared/physics/aircraft-colliders.js";
import { applyDroneColor } from "../shared/visual/drone-colors.js";
import { measureCruise, measureRotation } from "../scripts/measure-flight.mjs";
await RAPIER.init();
const catalog = await loadCatalog(),
  config = catalog.drones.find((c) => c.id === "rift-r5"),
  x5 = catalog.drones.find((c) => c.id === "rift-x5");

test("R5 keeps a short racing body, a top fin and bottom-mounted 6S pack in the shared flight/showcase mesh", async () => {
  const raw = createRacingModel({ batchStatic: false }),
    batched = await loadModel(config);
  assert.equal(config.category, "racing");
  assert.equal(config.battery.cells, 6);
  assert.ok(config.massKg < x5.massKg);
  const battery = new THREE.Box3().setFromObject(
      raw.getObjectByName("R5_underslung_battery"),
    ),
    fin = new THREE.Box3().setFromObject(raw.getObjectByName("R5_shark_fin")),
    chassis = new THREE.Box3().setFromObject(
      raw.getObjectByName("R5_lower_chassis"),
    );
  // The power leads reach up to the connector, but the actual pack stays below.
  const pack = new THREE.Box3().setFromObject(
    raw.getObjectByName("R5_6S_1050mAh_pack"),
  );
  assert.ok(pack.max.y < chassis.min.y);
  assert.ok(fin.min.y > 0.018 && fin.max.y > 0.065);
  assert.ok(chassis.max.z - chassis.min.z < 0.1);
  assert.ok(battery.min.y < -0.05);
  assert.equal(
    raw.children.filter((o) => o.name === "R5_motor_solder").length,
    12,
  );
  let triangles = 0,
    draws = 0;
  batched.traverse((o) => {
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
  assert.ok(draws < 50, draws + " draws");
  assert.ok(triangles < 45000, triangles + " triangles");
  const textured = [];
  batched.traverse((o) => {
    if (o.material?.map) textured.push(o);
  });
  assert.ok(textured.length >= 2);
  for (const mesh of textured)
    assert.equal(
      mesh.geometry.attributes.uv.count,
      mesh.geometry.attributes.position.count,
    );
  const rotor = [];
  batched.traverse((o) => {
    if (o.userData.propeller) rotor.push(o);
  });
  assert.deepEqual(
    rotor.map((o) => o.position.toArray()),
    R5_MOTOR_POSITIONS,
  );
  assert.deepEqual(
    R5_MOTOR_POSITIONS,
    config.motors.map((m) => m.positionM),
  );
  assert.equal(rotor.length, 4);
  assert.ok(
    rotor.every(
      (o) =>
        o.children.filter((c) => c.userData.bladeIndex !== undefined).length ===
        3,
    ),
  );
  disposeModelMaterials(raw);
  disposeModelMaterials(batched);
});

test("R5 propeller swept volumes clear the frame/camera/fin/wiring, and its lens looks out of the housing", () => {
  const model = createRacingModel({ batchStatic: false }),
    parts = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (p.userData.propeller) return;
    parts.push(o);
  });
  const ray = new THREE.Raycaster();
  for (const [x, y, z] of R5_MOTOR_POSITIONS)
    for (const r of [0.015, 0.03, 0.045, 0.062])
      for (let i = 0; i < 32; i++) {
        ray.set(
          new THREE.Vector3(
            x + Math.cos((i * Math.PI) / 16) * r,
            y + 0.005,
            z + Math.sin((i * Math.PI) / 16) * r,
          ),
          new THREE.Vector3(0, -1, 0),
        );
        ray.near = 0;
        ray.far = 0.01;
        const hit = ray.intersectObjects(parts, false)[0];
        assert.equal(hit, undefined, hit?.object.name + " enters a rotor");
      }
  ray.set(
    new THREE.Vector3(...model.userData.fpvCameraOffset),
    new THREE.Vector3(0, 0, -1),
  );
  ray.far = 0.1;
  assert.equal(ray.intersectObjects(parts, false).length, 0);
  disposeModelMaterials(model);
});

test("R5 motor solder joints touch ESC pads and connected camera conductors end in their FC solder", () => {
  const model = createRacingModel({ batchStatic: false }),
    esc = new THREE.Box3().setFromObject(
      model.getObjectByName("R5_four_in_one_ESC"),
    ),
    board = new THREE.Box3().setFromObject(
      model.getObjectByName("R5_flight_controller"),
    );
  for (const object of model.children.filter((o) =>
    o.name.startsWith("R5_motor_wire_"),
  )) {
    const end = object.geometry.parameters.path.getPoint(1);
    assert.ok(end.y >= esc.max.y - 0.001 && end.y <= esc.max.y + 0.0015);
    assert.ok(Math.abs(end.x) <= esc.max.x && Math.abs(end.z) <= esc.max.z);
  }
  for (const object of model.children.filter(
    (o) => o.name === "R5_camera_harness",
  )) {
    const end = object.geometry.parameters.path.getPoint(1);
    assert.ok(board.clone().expandByScalar(0.001).containsPoint(end));
  }
  disposeModelMaterials(model);
});

test("R5 supports individual blade damage, FPV exposure, remote motor fractions, color changes and texture disposal", () => {
  const model = createRacingModel(),
    remoteModel = createRacingModel(),
    visual = createAircraftVisual(model, config),
    remote = createAircraftVisual(remoteModel, config, { remote: true });
  const blades = Array.from({ length: 4 }, () => [0, 0, 0]);
  blades[0][1] = 3;
  const physics = {
    armed: true,
    motorThrust: [13.8, 7, 4, 2],
    effects: { propellers: { blades } },
    turtleMode: false,
  };
  visual.bindPhysics({ effects: { propellers: { phase: [0, 0, 0, 0] } } });
  visual.update(0.1, physics, { throttle: 1 });
  visual.prepareView("fpv", physics);
  assert.equal(
    visual.damage.entries.filter((e) => e.motor === 0 && e.blade === 1)[0].mesh
      .visible,
    false,
  );
  assert.ok(visual.exposure.rotors[0].disc.visible);
  remote.updateRemote(0.1, {
    ...visual.networkState(physics, false),
    resetId: 1,
  });
  assert.deepEqual(remote.motion.fraction, visual.motion.fraction);
  applyDroneColor(model, "blue");
  const accents = [];
  model.traverse((o) => {
    if (o.material?.userData.droneColorRole === "base")
      accents.push(o.material.color.getHexString());
  });
  assert.ok(accents.length && accents.every((c) => c === "3986ff"));
  visual.dispose();
  remote.dispose();
  const textures = new Set();
  model.traverse((o) => {
    if (o.material?.map) textures.add(o.material.map);
  });
  let disposed = 0;
  for (const t of textures) t.addEventListener("dispose", () => disposed++);
  disposeModelMaterials(model);
  disposeModelMaterials(remoteModel);
  assert.equal(disposed, textures.size);
});

test("R5 extra frame colliders cover battery and fin in both local and remote construction without mass inflation", () => {
  assert.throws(() =>
    validateDrone({
      ...config,
      frameParts: [{ halfExtentsM: [-1, 1, 1], positionM: [0, 0, 0] }],
    }),
  );
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setAdditionalMass(config.massKg),
    );
  const { frameColliders } = addAircraftColliders(RAPIER, world, body, config);
  assert.equal(frameColliders.length, 2);
  world.step();
  assert.ok(Math.abs(body.mass() - config.massKg) < 1e-6);
  world.updateSceneQueries();
  for (const [x, y, z] of [
    [0, -0.04, 0],
    [0, 0.057, -0.02],
  ])
    assert.ok(
      world.castRay(
        new RAPIER.Ray({ x: x + 0.03, y, z }, { x: -1, y: 0, z: 0 }),
        0.06,
        true,
      ),
    );
  world.free();
});

test("R5 accelerates and cruises faster than X5 while preserving controllable, damped stick response", () => {
  const racer = measureCruise(config),
    freestyle = measureCruise(x5);
  assert.ok(
    racer.horizontalKmh > freestyle.horizontalKmh * 1.07 &&
      racer.horizontalKmh < freestyle.horizontalKmh * 1.2,
  );
  assert.ok(racer.to100S < freestyle.to100S);
  for (const axis of ["roll", "pitch", "yaw"]) {
    const result = measureRotation(config, axis);
    assert.ok(result.response90S < 0.15);
    assert.ok(result.brakeS < 0.22);
    assert.ok(result.residualDegS < 1);
  }
});
