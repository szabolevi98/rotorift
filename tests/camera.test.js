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

async function airplaneSetup() {
  const config=JSON.parse(await readFile(new URL('../data/airplanes/rift-t15.json',import.meta.url)));
  const model=new THREE.Mesh(new THREE.BoxGeometry(1.5,.3,1));
  const camera=new THREE.PerspectiveCamera(),rig=new DroneCameraRig(camera),picks=[];
  rig.configure(config,model,()=>0,position=>{picks.push(position.clone());return new THREE.Vector3(position.x,1.7,position.z);});
  rig.update(new THREE.Vector3(4,40,8),new THREE.Quaternion());
  return {camera,rig,picks};
}

test('ground pilot stays fixed, tracks the airplane without rolling, and relocates only on re-entry',async()=>{
  const {camera,rig,picks}=await airplaneSetup();
  assert.equal(rig.setView('pilot'),true);const anchor=camera.position.clone();
  assert.equal(picks.length,1);assert.equal(rig.fpv,false);
  for(const position of [new THREE.Vector3(30,12,-50),new THREE.Vector3(4,150,8),new THREE.Vector3(-200,9,100)]){
    for(let i=0;i<120;i++)rig.update(position,new THREE.Quaternion().setFromEuler(new THREE.Euler(.6,1.5,-1)),1/60);
    closeVector(camera.position,anchor);
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).dot(position.clone().sub(anchor).normalize())>.999);
    const attitude=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');
    assert.ok(Math.abs(attitude.z)<1e-9,'airplane bank must not roll the pilot camera');
    assert.ok(camera.quaternion.toArray().every(Number.isFinite));
  }
  assert.equal(picks.length,1);
  rig.setView('chase');rig.setView('pilot');
  assert.equal(picks.length,2);closeVector(camera.position,new THREE.Vector3(-200,1.7,100));
});

test('pilot tracking cadence and independent zoom do not alter FPV settings or drone camera cycles',async()=>{
  const rotations=[];
  for(const hz of [30,60,144]){
    const {camera,rig}=await airplaneSetup();rig.setSettings(28,112);rig.setView('pilot');
    for(let i=0;i<hz;i++)rig.update(new THREE.Vector3(50,30,-90),new THREE.Quaternion(),1/hz);
    rotations.push(camera.quaternion.clone());
    rig.zoomPilot(-10000);assert.ok(camera.fov<35);
    for(let i=0;i<50;i++)rig.zoomPilot(-240);assert.equal(camera.fov,10);
    for(let i=0;i<50;i++)rig.zoomPilot(240);assert.equal(camera.fov,65);
    rig.setView('fpv-clean');assert.equal(camera.fov,112);assert.equal(rig.angle,28);
  }
  assert.ok(rotations.every(q=>q.angleTo(rotations[0])<1e-7));
  const {rig}=await setup('rift-65');assert.equal(rig.views.includes('pilot'),false);
  assert.equal(rig.setView('pilot'),false);assert.equal(rig.view,'fpv-clean');
});

test('failed pilot placement keeps the previous camera, and loading a drone exits pilot view',async()=>{
  const {camera,rig}=await airplaneSetup();rig.pickPilotPosition=()=>null;
  const before=camera.position.clone();assert.equal(rig.setView('pilot'),false);closeVector(camera.position,before);
  rig.pickPilotPosition=()=>new THREE.Vector3(0,1.7,0);rig.setView('pilot');
  const drone=(await setup('rift-65')).config;rig.configure(drone,new THREE.Group());rig.update(new THREE.Vector3(0,3,0),new THREE.Quaternion());
  assert.equal(rig.view,'chase');assert.equal(rig.pilotPosition,null);
});
