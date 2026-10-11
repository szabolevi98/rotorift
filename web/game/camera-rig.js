import * as THREE from "three";

export class DroneCameraRig {
  constructor(camera) {
    this.camera = camera;
    this.chase = false;
    this.angle = 20;
    this.fpvFov = 100;
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.modelCenter = new THREE.Vector3();
    this.chaseOffset = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this.target = new THREE.Vector3();
  }

  configure(config, model) {
    this.config = config;
    model.updateMatrixWorld(true);
    new THREE.Box3().setFromObject(model).getCenter(this.modelCenter);
    this.modelCenter.add(new THREE.Vector3(...config.visualOffsetM));
    this.chaseOffset
      .set(0, config.motorDiagonalM * 0.85, config.motorDiagonalM * 2.6)
      .add(this.modelCenter);
  }

  setView(chase) {
    this.chase = chase;
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
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    if (!this.config) return;

    if (this.chase) {
      // Attach the whole rig to the interpolated drone pose. Smoothing its
      // world position separately lets a fast drone fly away from the camera.
      this.camera.position
        .copy(this.chaseOffset)
        .applyQuaternion(this.quaternion)
        .add(this.position);
      this.target
        .copy(this.modelCenter)
        .applyQuaternion(this.quaternion)
        .add(this.position);
      this.camera.up.set(0, 1, 0).applyQuaternion(this.quaternion);
      this.camera.lookAt(this.target);
    } else {
      this.offset
        .set(...this.config.cameraOffsetM)
        .applyQuaternion(this.quaternion);
      this.camera.position.copy(this.position).add(this.offset);
      this.camera.up.set(0, 1, 0);
      this.camera.quaternion
        .copy(this.quaternion)
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            (this.angle * Math.PI) / 180,
          ),
        );
    }
  }
}
