import * as THREE from "three";
export const CAMERA_VIEWS = ["chase", "fpv", "fpv-clean"];
const AIRPLANE_VIEWS = [...CAMERA_VIEWS, 'pilot'];

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
    this.pilotPosition = null;
    this.pilotFov = 35;
    this.pilotYaw = this.pilotPitch = 0;
    this.pilotReady = false;
    this.pilotEuler = new THREE.Euler(0,0,0,'YXZ');
  }

  get views() { return this.config?.kind === 'fixedWing' ? AIRPLANE_VIEWS : CAMERA_VIEWS; }
  get fpv() { return this.view === 'fpv' || this.view === 'fpv-clean'; }

  configure(config, model, heightAt = null, pickPilotPosition = null) {
    this.config = config;
    this.heightAt = heightAt;
    this.pickPilotPosition = pickPilotPosition;
    this.pilotPosition = null;
    this.pilotReady = false;
    if (!this.views.includes(this.view)) this.view = 'chase';
    this.chase = this.view === 'chase';
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

  setView(view, { pilotPosition } = {}) {
    const next = typeof view === "boolean" ? (view ? "chase" : "fpv-clean") : view;
    if (!this.views.includes(next)) return false;
    if (next === 'pilot') {
      const point = pilotPosition ?? this.pickPilotPosition?.(this.position);
      if (!point) return false;
      this.pilotPosition = point.clone();
      this.pilotReady = false;
    }
    this.view = next;
    this.chase = this.view === "chase";
    this.apply();
    return true;
  }

  zoomPilot(delta) {
    if (this.view !== 'pilot') return;
    this.pilotFov = THREE.MathUtils.clamp(this.pilotFov * Math.exp(THREE.MathUtils.clamp(delta,-240,240)*.002),10,65);
    this.apply();
  }

  setSettings(angle, fov) {
    this.angle = angle;
    this.fpvFov = fov;
    this.apply();
  }

  update(position, quaternion, dt = 0) {
    this.position.copy(position);
    this.quaternion.copy(quaternion);
    this.apply(dt);
  }

  apply(dt = null) {
    const fov = this.view === 'pilot' ? this.pilotFov : this.chase ? 60 : this.fpvFov;
    const near = this.view === "fpv" ? 0.001 : 0.012;
    if (this.camera.fov !== fov || this.camera.near !== near) {
      this.camera.fov = fov;
      this.camera.near = near;
      this.camera.updateProjectionMatrix();
    }
    if (!this.config) return;
    if (this.view === 'pilot') {
      this.pilotPosition ??= this.pickPilotPosition?.(this.position);
      if (!this.pilotPosition) return;
      this.camera.position.copy(this.pilotPosition);
      this.target.copy(this.modelCenter).applyQuaternion(this.quaternion).add(this.position).sub(this.pilotPosition);
      const horizontal = Math.hypot(this.target.x,this.target.z);
      const yaw = horizontal > .1 ? Math.atan2(-this.target.x,-this.target.z) : this.pilotYaw;
      const pitch = Math.atan2(this.target.y,Math.max(.001,horizontal));
      const blend = !this.pilotReady ? 1 : dt === null ? 0 : dt > 0 ? 1-Math.exp(-dt*14) : 1;
      this.pilotYaw += Math.atan2(Math.sin(yaw-this.pilotYaw),Math.cos(yaw-this.pilotYaw))*blend;
      this.pilotPitch += (pitch-this.pilotPitch)*blend;
      this.pilotEuler.set(THREE.MathUtils.clamp(this.pilotPitch,-Math.PI*.499,Math.PI*.499),this.pilotYaw,0);
      this.camera.up.set(0,1,0);
      this.camera.quaternion.setFromEuler(this.pilotEuler);
      this.pilotReady = true;
      return;
    }
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
