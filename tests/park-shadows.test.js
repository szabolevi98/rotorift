import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ParkShadows, PARK_SHADOW_DISTANCE } from "../web/game/park-shadows.js";

function setup(fov = 100, aspect = 16 / 9) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.012, 12000);
  const shadows = new ParkShadows(scene, camera);
  return { scene, camera, shadows };
}

function updateLights(scene, shadows) {
  scene.updateMatrixWorld(true);
  for (const light of shadows.csm.lights) light.shadow.updateMatrices(light);
}

test("static shadow maps are reused; movement, projection, geometry and dynamic drones invalidate them", () => {
  const {scene,camera,shadows}=setup();
  for(const light of shadows.csm.lights)light.shadow.map={dispose(){}};
  const consume=()=>{for(const light of shadows.csm.lights)light.shadow.needsUpdate=false;};
  shadows.update(); consume(); shadows.update();
  assert.ok(shadows.csm.lights.every(light=>light.shadow.autoUpdate===false&&!light.shadow.needsUpdate));
  camera.position.set(120,60,30);camera.lookAt(0,0,0);shadows.update();
  assert.ok(shadows.csm.lights.some(light=>light.shadow.needsUpdate)); consume();
  camera.fov=120;camera.updateProjectionMatrix();shadows.update();
  assert.ok(shadows.csm.lights.every(light=>light.shadow.needsUpdate)); consume();
  const caster=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());caster.castShadow=true;scene.add(caster);shadows.update();
  assert.ok(shadows.csm.lights.every(light=>light.shadow.needsUpdate)); consume();
  shadows.update({dynamic:true});assert.ok(shadows.csm.lights.every(light=>light.shadow.needsUpdate));consume();
  scene.remove(caster);shadows.update();assert.ok(shadows.csm.lights.every(light=>light.shadow.needsUpdate));
  shadows.dispose();caster.geometry.dispose();caster.material.dispose();
});

test("park ground and tree crowns remain in the correct shadow cascade from 100–1000 m", () => {
  const { scene, camera, shadows } = setup();
  for (const altitude of [100, 500, 1000]) {
    camera.position.set(0, altitude, 125);
    camera.lookAt(0, 0, 0);
    shadows.update(); updateLights(scene, shadows);
    const visible = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    let checked = 0;
    for (const x of [-325, -150, 0, 150, 325]) for (const z of [-325, -150, 0, 150, 325]) {
      const ground = new THREE.Vector3(x, 0, z);
      if (!visible.containsPoint(ground)) continue;
      const depth = -ground.clone().applyMatrix4(camera.matrixWorldInverse).z;
      assert.ok(depth < PARK_SHADOW_DISTANCE);
      const index = shadows.csm.breaks.findIndex((end) => depth < end * PARK_SHADOW_DISTANCE);
      const frustum = shadows.csm.lights[index].shadow.getFrustum();
      assert.ok(frustum.containsPoint(ground), `missing ground shadow at ${x},${z} from ${altitude} m`);
      assert.ok(frustum.containsPoint(ground.clone().setY(18)), "tree caster clipped above the ground");
      checked++;
    }
    assert.ok(checked >= (altitude === 100 ? 4 : 25));
  }
  shadows.dispose();
});

test("wide FPV, chase and portrait projections retain all shadow-frustum corners", () => {
  const { scene, camera, shadows } = setup();
  for (const [fov, aspect] of [[52, 16 / 9], [60, 16 / 9], [100, 16 / 9], [140, 16 / 9], [100, 9 / 16]]) {
    camera.fov = fov; camera.aspect = aspect; camera.updateProjectionMatrix();
    camera.position.set(110, 400, -90);
    camera.lookAt(0, 60, 0);
    shadows.update(); updateLights(scene, shadows);
    for (let i = 0; i < shadows.csm.frustums.length; i++) {
      const source = shadows.csm.frustums[i];
      const lightFrustum = shadows.csm.lights[i].shadow.getFrustum();
      for (const vertex of [...source.vertices.near, ...source.vertices.far]) {
        const world = vertex.clone().applyMatrix4(camera.matrixWorld);
        assert.ok(lightFrustum.containsPoint(world), `cascade ${i} clipped at FOV ${fov}, aspect ${aspect}`);
      }
    }
    assert.ok(shadows.projection.equals(camera.projectionMatrix));
  }
  shadows.dispose();
});

test("streamed and online materials get shadows; release and map changes free their hooks and shadow maps", () => {
  const { scene, shadows } = setup();
  const material = new THREE.MeshStandardMaterial();
  let hookCalled = false;
  const hook = () => { hookCalled = true; };
  material.onBeforeCompile = hook;
  const basic = new THREE.MeshBasicMaterial();
  const model = new THREE.Mesh(new THREE.BoxGeometry(), [material, basic]);
  scene.add(model); shadows.update();
  assert.equal(material.defines.CSM_CASCADES, 4);
  assert.equal(basic.defines?.USE_CSM, undefined);
  const shader = { uniforms: {} };
  material.onBeforeCompile(shader);
  assert.ok(hookCalled);
  assert.equal(shader.uniforms.shadowFar.value, PARK_SHADOW_DISTANCE);
  shadows.releaseModel(model);
  scene.remove(model);
  assert.equal(material.onBeforeCompile, hook);
  assert.equal(material.defines.USE_CSM, undefined);
  assert.ok(!shadows.csm.shaders.has(material));
  const streamed = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  scene.add(streamed); shadows.update();
  assert.equal(streamed.material.defines.USE_CSM, 1);
  let disposed = 0;
  for (const light of shadows.csm.lights) light.shadow.map = { dispose() { disposed++; } };
  shadows.dispose();
  assert.equal(disposed, 4);
  assert.equal(scene.children.filter((child) => child.isDirectionalLight).length, 0);
  assert.equal(streamed.material.defines.USE_CSM, undefined);
  assert.equal(shadows.csm.shaders.size, 0);
  assert.equal(shadows.materialHooks.size, 0);
});
