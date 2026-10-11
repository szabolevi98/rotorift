import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { DroneCameraRig } from "../web/game/camera-rig.js";

function closeVector(actual, expected) {
  assert.ok(actual.distanceTo(expected) < 1e-9, `${actual.toArray()} != ${expected.toArray()}`);
}

async function setup(id) {
  const config = JSON.parse(await readFile(new URL(`../data/drones/${id}.json`, import.meta.url)));
  const model = new THREE.Mesh(new THREE.BoxGeometry(
    config.motorDiagonalM * 1.5, config.motorDiagonalM * 0.6, config.motorDiagonalM * 1.5,
  ));
  const camera = new THREE.PerspectiveCamera(100, 16 / 9, 0.012, 350);
  const rig = new DroneCameraRig(camera);
  rig.configure(config, model);
  return { camera, rig, config };
}

for (const id of ["rift-65", "rift-c3", "rift-x5"]) {
  test(`${id}: chase framing stays centered and readable at any flight attitude`, async () => {
    const { camera, rig } = await setup(id);
    rig.setView(true);
    const position = new THREE.Vector3(3, 12, -8);
    for (const euler of [
      [0, 0, 0], [Math.PI / 2, 0, 0], [-Math.PI / 2, 0.8, 0],
      [0, Math.PI, 0], [0, 0, Math.PI], [0.4, 1.2, -0.7],
    ]) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...euler));
      rig.update(position, q);
      camera.updateMatrixWorld(true);
      const center = rig.modelCenter.clone().applyQuaternion(q).add(position);
      closeVector(center.clone().project(camera).setZ(0), new THREE.Vector3());
      // A 1.5-diagonal wide prop envelope should occupy a useful portion of
      // the viewport, even for the tinywhoop, with no clipping of its sides.
      const left = center.clone().add(new THREE.Vector3(-rig.config.motorDiagonalM * 0.75, 0, 0).applyQuaternion(q)).project(camera);
      const right = center.clone().add(new THREE.Vector3(rig.config.motorDiagonalM * 0.75, 0, 0).applyQuaternion(q)).project(camera);
      const screenFraction = (right.x - left.x) / 2;
      assert.ok(screenFraction > 0.25 && screenFraction < 0.6, screenFraction);
      assert.ok(left.z > -1 && left.z < 1);
      assert.ok(camera.quaternion.toArray().every(Number.isFinite));
    }
  });
}

test("fast translation and teleport never change the drone's relative camera pose", async () => {
  const { camera, rig } = await setup("rift-x5");
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.8, -0.2));
  rig.setView(true);
  rig.update(new THREE.Vector3(), q);
  const offset = camera.position.clone();
  const rotation = camera.quaternion.clone();
  for (const position of [new THREE.Vector3(0.5, 0, -1), new THREE.Vector3(100, 25, -250), new THREE.Vector3(0, 0.15, 32)]) {
    rig.update(position, q);
    closeVector(camera.position.clone().sub(position), offset);
    assert.ok(camera.quaternion.angleTo(rotation) < 1e-7);
  }
});

test("view switching applies immediately and restores independent FPV settings", async () => {
  const { camera, rig, config } = await setup("rift-65");
  rig.update(new THREE.Vector3(1, 2, 3), new THREE.Quaternion());
  rig.setSettings(35, 115);
  const fpvPosition = camera.position.clone();
  const fpvRotation = camera.quaternion.clone();
  rig.setView(true);
  assert.equal(camera.fov, 60);
  assert.ok(camera.position.distanceTo(fpvPosition) > config.motorDiagonalM);
  rig.setSettings(35, 115);
  assert.equal(camera.fov, 60);
  rig.setView(false);
  assert.equal(camera.fov, 115);
  closeVector(camera.position, fpvPosition);
  assert.ok(camera.quaternion.angleTo(fpvRotation) < 1e-7);
});
