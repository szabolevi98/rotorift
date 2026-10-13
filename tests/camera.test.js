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

for (const id of ["rift-65", "rift-75", "rift-c3", "rift-x5"]) {
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

test("chase camera tilt follows settings while preserving centered framing and follow distance",async()=>{
  const {camera,rig}=await setup("rift-x5");rig.setView("chase");
  const position=new THREE.Vector3(2,4,-8),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.4,.6,-.3));
  rig.update(position,q);rig.setSettings(0,100);
  const offset=camera.position.clone().sub(rig.modelCenter.clone().applyQuaternion(q).add(position)),rotation=camera.quaternion.clone();
  rig.setSettings(45,100);
  const center=rig.modelCenter.clone().applyQuaternion(q).add(position);
  assert.ok(Math.abs(camera.position.distanceTo(center)-offset.length())<1e-9);
  assert.ok(Math.abs(camera.quaternion.angleTo(rotation)-Math.PI/4)<1e-7,"tilt is applied to the chase mount, not ignored");
  camera.updateMatrixWorld(true);closeVector(center.project(camera).setZ(0),new THREE.Vector3());
  rig.configure(rig.config,new THREE.Group(),()=>0);rig.update(new THREE.Vector3(0,.08,0),new THREE.Quaternion());rig.setSettings(60,100);
  assert.ok(camera.position.y>=.04,"a tilted chase camera cannot sink through the ground");
});

test("both FPV views share the optical mount; visible drone mode keeps nearby frame parts within the near plane",async()=>{
  const {camera,rig,config}=await setup("rift-75"),model=new THREE.Group();
  model.userData.fpvCameraOffset=[0,.024,-.018];rig.configure(config,model);
  const position=new THREE.Vector3(2,3,4);rig.update(position,new THREE.Quaternion());
  rig.setView("fpv-clean");const clean=camera.position.clone(),rotation=camera.quaternion.clone();
  closeVector(clean,position.clone().add(new THREE.Vector3(...model.userData.fpvCameraOffset)).add(new THREE.Vector3(...config.visualOffsetM)));
  rig.setView("fpv");assert.equal(rig.chase,false);assert.equal(camera.near,.001);
  closeVector(camera.position,clean);assert.ok(camera.quaternion.angleTo(rotation)<1e-7);
  rig.setView("chase");assert.equal(rig.chase,true);assert.equal(camera.near,.012);
});
