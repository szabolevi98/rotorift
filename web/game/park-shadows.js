import * as THREE from "three";
import { CSM } from "three/addons/csm/CSM.js";

export const PARK_SHADOW_DISTANCE = 1600;
const SPLITS = [60, 200, 600, PARK_SHADOW_DISTANCE];

// Separate near/far maps retain ground-level detail without losing the park
// shadows when the camera climbs. CSM snaps each map to texels as it follows.
export class ParkShadows {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.projection = new THREE.Matrix4();
    this.materialHooks = new Map();
    this.csm = new CSM({
      camera, parent: scene, cascades: SPLITS.length,
      maxFar: PARK_SHADOW_DISTANCE, mode: "custom", shadowMapSize: 2048,
      shadowBias: -0.00002, lightDirection: new THREE.Vector3(35, -75, -25).normalize(),
      lightIntensity: 3, lightNear: 0.5, lightFar: 5000, lightMargin: 200,
      customSplitsCallback: (_count, _near, _far, target) => {
        // Scale the intervals together if another view uses a shorter far plane.
        for (const distance of SPLITS) target.push(distance / PARK_SHADOW_DISTANCE);
      },
    });
    this.csm.fade = true;
    this.csm.updateFrustums();
    this.updateDepthBounds();
    this.csm.lights.forEach((light, i) => {
      light.color.setHex(0xfff0d5);
      light.shadow.normalBias = [0.015, 0.04, 0.1, 0.2][i];
    });
    this.projection.copy(camera.projectionMatrix);
    this.update();
  }

  update() {
    // New streamed chunks and online drones can introduce materials later.
    this.scene.traverse((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!(material.isMeshStandardMaterial || material.isMeshPhongMaterial || material.isMeshLambertMaterial)) continue;
        if (this.csm.shaders.has(material)) continue;
        const hook = material.onBeforeCompile;
        this.materialHooks.set(material, hook);
        this.csm.setupMaterial(material);
        const compileCSM = material.onBeforeCompile;
        material.onBeforeCompile = function (shader, renderer) {
          hook.call(this, shader, renderer);
          compileCSM.call(this, shader, renderer);
        };
        material.needsUpdate = true;
      }
    });
    if (!this.projection.equals(this.camera.projectionMatrix)) {
      this.csm.updateFrustums();
      this.updateDepthBounds();
      this.projection.copy(this.camera.projectionMatrix);
    }
    this.camera.updateMatrixWorld();
    this.csm.update();
  }

  updateDepthBounds() {
    // The sphere diameter bounds the light-space depth at any camera angle,
    // including wide FPV FOVs. Keep the near map's depth precision independent
    // of the much larger far cascade and of the drone's altitude.
    for (const light of this.csm.lights) {
      const camera = light.shadow.camera;
      camera.far = camera.right - camera.left + 2 * this.csm.lightMargin;
      light.shadow.bias = -0.003 / camera.far;
      camera.updateProjectionMatrix();
    }
  }

  releaseModel(root) {
    root.traverse((object) => {
      if (!object.isMesh) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!this.materialHooks.has(material)) continue;
        material.onBeforeCompile = this.materialHooks.get(material);
        delete material.defines.USE_CSM;
        delete material.defines.CSM_CASCADES;
        delete material.defines.CSM_FADE;
        this.materialHooks.delete(material);
        this.csm.shaders.delete(material);
        material.needsUpdate = true;
      }
    });
  }

  dispose() {
    for (const light of this.csm.lights) light.shadow.dispose();
    this.csm.remove();
    this.csm.dispose();
    for (const [material, hook] of this.materialHooks) material.onBeforeCompile = hook;
    this.materialHooks.clear();
  }
}
