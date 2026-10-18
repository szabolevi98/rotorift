import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createTrainerModel,
  animateTrainer,
} from "../shared/visual/fixed-wing-model.js";

function dispose(root) {
  const materials = new Set();
  root.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) materials.add(o.material);
  });
  for (const m of materials) m.dispose();
}
function vertices(object) {
  const p = object.geometry.attributes.position;
  return Array.from({ length: p.count }, (_, i) =>
    new THREE.Vector3()
      .fromBufferAttribute(p, i)
      .applyMatrix4(object.matrixWorld),
  );
}
function distanceToMesh(point, object) {
  const geometry = object.geometry,
    p = geometry.attributes.position,
    index = geometry.index;
  let nearest = Infinity;
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const points = [0, 1, 2].map((j) =>
      new THREE.Vector3()
        .fromBufferAttribute(p, index ? index.getX(i + j) : i + j)
        .applyMatrix4(object.matrixWorld),
    );
    const candidate = new THREE.Triangle(...points).closestPointToPoint(
      point,
      new THREE.Vector3(),
    );
    nearest = Math.min(nearest, candidate.distanceTo(point));
  }
  return nearest;
}

test("all windshield and side-window interiors remain visible outside both original and batched cabin shells", () => {
  const raw = createTrainerModel({ batchStatic: false }),
    batched = createTrainerModel();
  try {
    const windows = raw.children.filter((o) =>
      [
        "T15_windscreen",
        "T15_front_side_window",
        "T15_rear_side_window",
      ].includes(o.name),
    );
    assert.ok(windows.length >= 8);
    for (const window of windows) {
      const g = window.geometry,
        index = g.index,
        p = g.attributes.position;
      for (let i = 0; i < index.count; i += 3) {
        const center = new THREE.Vector3();
        for (let j = 0; j < 3; j++)
          center.add(
            new THREE.Vector3()
              .fromBufferAttribute(p, index.getX(i + j))
              .applyMatrix4(window.matrixWorld),
          );
        center.multiplyScalar(1 / 3);
        const outward =
          window.name === "T15_windscreen"
            ? new THREE.Vector3(0, 1, -1).normalize()
            : new THREE.Vector3(Math.sign(center.x), 0, 0);
        const ray = new THREE.Raycaster(
          center.clone().addScaledVector(outward, 0.12),
          outward.clone().negate(),
          0,
          0.15,
        );
        for (const model of [raw, batched]) {
          const first = ray.intersectObject(model, true)[0];
          assert.equal(
            first?.object.material.color.getHexString(),
            "365b70",
            window.name + " is hidden by " + first?.object.name,
          );
        }
      }
    }
  } finally {
    dispose(raw);
    dispose(batched);
  }
});

test("cowl/body meet at one shared seam and control-surface leading edges stay attached throughout travel", () => {
  const model = createTrainerModel({ batchStatic: false });
  try {
    const cowl = new THREE.Box3().setFromObject(
        model.getObjectByName("T15_moulded_cowl"),
      ),
      body = new THREE.Box3().setFromObject(
        model.getObjectByName("T15_fuselage"),
      );
    assert.ok(
      Math.abs(cowl.max.z - body.min.z) < 1e-6,
      "white hull must not extend inside the colored cowl",
    );
    for (const value of [-1, 0, 1]) {
      animateTrainer(model, { pitch: value, roll: value, yaw: value }, 0);
      model.updateMatrixWorld(true);
      for (const [surface, fixed] of [
        ["aileron", "T15_airfoil_wing"],
        ["elevator", "T15_stabilizer"],
        ["rudder", "T15_swept_fin"],
      ]) {
        const hinges = [];
        model.traverse((o) => {
          if (o.userData.surface === surface) hinges.push(o);
        });
        for (const hinge of hinges)
          for (const part of hinge.children) {
            const local = part.geometry.attributes.position;
            for (let i = 0; i < local.count; i++) {
              if (Math.abs(local.getZ(i)) > 1e-8) continue;
              const p = new THREE.Vector3()
                .fromBufferAttribute(local, i)
                .applyMatrix4(part.matrixWorld);
              assert.ok(
                distanceToMesh(p, model.getObjectByName(fixed)) < 0.004,
                surface + " has a detached leading edge",
              );
            }
          }
      }
      model.traverse((o) => {
        if (o.isMesh)
          assert.ok(
            vertices(o).every((v) => v.toArray().every(Number.isFinite)),
          );
      });
    }
  } finally {
    dispose(model);
  }
});
