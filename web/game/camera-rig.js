import * as THREE from "three";
export const CAMERA_VIEWS = ["chase", "fpv", "fpv-clean"];

export class DroneCameraRig {
  constructor(camera) {
    this.camera = camera;
    this.chase = false;
    this.view = "fpv-clean";
    this.angle = 20;
    this.fpvFov = 100;
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.modelCenter = new THREE.Vector3();
    this.chaseOffset = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.tilt = new THREE.Quaternion();
    this.fpvOffset = new THREE.Vector3();
  }

  configure(config, model, heightAt = null) {
    this.config = config;
    this.heightAt = heightAt;
    this.fpvOffset.set(...config.cameraOffsetM);
    if (model.userData.fpvCameraOffset)
      this.fpvOffset.set(...model.userData.fpvCameraOffset).add(new THREE.Vector3(...config.visualOffsetM));
    model.updateMatrixWorld(true);
    new THREE.Box3().setFromObject(model).getCenter(this.modelCenter);
    this.modelCenter.add(new THREE.Vector3(...config.visualOffsetM));
    const size=config.wingspanM??config.motorDiagonalM;
    this.chaseOffset
      .set(0, size * 0.85, size * 2.6)
      .add(this.modelCenter);
  }

  setView(view) {
    this.view = typeof view === "boolean" ? (view ? "chase" : "fpv-clean") : view;
    this.chase = this.view === "chase";
    this.apply();
  }

  setSettings(angle, fov) {
    this.angle = angle;
    this.fpvFov = fov;
    this.apply();
  }

  update(position, quaternion) {
    this.position.copy(position);
    this.quaternion.copy(quaternion);
    this.apply();
  }

  apply() {
    const fov = this.chase ? 60 : this.fpvFov;
    const near = this.view === "fpv" ? 0.001 : 0.012;
    if (this.camera.fov !== fov || this.camera.near !== near) {
      this.camera.fov = fov;
      this.camera.near = near;
      this.camera.updateProjectionMatrix();
    }
    if (!this.config) return;
    this.tilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.angle * Math.PI / 180);

    if (this.chase) {
      // Attach the whole rig to the interpolated drone pose. Smoothing its
      // world position separately lets a fast drone fly away from the camera.
      this.camera.position
        .copy(this.chaseOffset)
        .sub(this.modelCenter)
        .applyQuaternion(this.tilt)
        .add(this.modelCenter)
        .applyQuaternion(this.quaternion)
        .add(this.position);
      if (this.heightAt)
        this.camera.position.y = Math.max(this.camera.position.y, this.heightAt(this.camera.position.x, this.camera.position.z) + .04);
      this.target
        .copy(this.modelCenter)
        .applyQuaternion(this.quaternion)
        .add(this.position);
      this.camera.up.set(0, 1, 0).applyQuaternion(this.quaternion);
      this.camera.lookAt(this.target);
    } else {
      this.offset
        .copy(this.fpvOffset)
        .applyQuaternion(this.quaternion);
      this.camera.position.copy(this.position).add(this.offset);
      this.camera.up.set(0, 1, 0);
      this.camera.quaternion
        .copy(this.quaternion)
        .multiply(this.tilt);
    }
  }
}
