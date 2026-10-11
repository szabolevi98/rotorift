import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { DronePhysics, PHYSICS_DT } from "/shared/physics/drone.js";
import { buildEnvironment } from "./environment.js";
import { loadModel } from "./models.js";
import { DroneCameraRig } from "./camera-rig.js";
import { MapBoundary } from "/shared/world/boundary.js";
import { PARK_VIEW_DISTANCE, PARK_FOG_DENSITY } from "./park-terrain.js";
export class Flight {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc9dedc);
    this.scene.fog = new THREE.Fog(0xc9dedc, 60, 190);
    this.scene.add(new THREE.HemisphereLight(0xfaf8e5, 0x768367, 2.4));
    const sun = new THREE.DirectionalLight(0xfff0d5, 3);
    sun.position.set(-35, 60, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -75,
      right: 75,
      top: 75,
      bottom: -75,
      near: 0.5,
      far: 150,
    });
    sun.shadow.bias = -0.0003;
    this.scene.add(sun);
    this.sun = sun;
    this.camera = new THREE.PerspectiveCamera(100, 1, 0.012, 350);
    this.camera.position.set(0, 10, 30);
    this.camera.lookAt(0, 0, 0);
    this.cameraRig = new DroneCameraRig(this.camera);
    this.accumulator = 0;
    this.active = false;
    this.chase = false;
    this.remotes = new Map();
    this.sound = null;
    this.remoteVersion = 0;
  }
  async init() {
    await RAPIER.init();
  }
  async load(map, config, rates, mode) {
    this.active = false;
    this.environment?.dispose();
    this.world?.free();
    if (this.visual) this.scene.remove(this.visual);
    for (const o of this.remotes.values()) this.scene.remove(o.model);
    this.remotes.clear();
    this.remoteVersion++;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.environment = buildEnvironment(this.scene, this.world, RAPIER, map);
    this.config = config;
    this.map = map;
    this.boundary = new MapBoundary(map);
    this.camera.far = map.kind === "park" ? PARK_VIEW_DISTANCE : 350;
    this.camera.updateProjectionMatrix();
    this.scene.background.setHex(map.kind === "park" ? 0xbcd4df : 0xc9dedc);
    this.scene.fog = map.kind === "park"
      ? new THREE.FogExp2(0xbcd4df, PARK_FOG_DENSITY)
      : new THREE.Fog(0xc9dedc, 60, 190);
    if (map.kind !== "park") {
      this.sun.position.set(-35, 60, 25);
      this.sun.target.position.set(0, 0, 0);
      this.sun.target.updateMatrixWorld();
      Object.assign(this.sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, far: 150 });
      this.sun.shadow.camera.updateProjectionMatrix();
    }
    this.physics = new DronePhysics(RAPIER, this.world, config, map.spawn);
    this.physics.rates = rates;
    this.physics.mode = mode;
    this.visual = await loadModel(config);
    this.cameraRig.configure(config, this.visual);
    this.scene.add(this.visual);
    this.props = [];
    this.visual.traverse((o) => {
      if (o.userData.propeller) this.props.push(o);
    });
    this.accumulator = 0;
    this.previous = this.physics.pose;
    this.current = this.physics.pose;
    this.place(this.current, 1);
    this.active = true;
  }
  reset(position = this.map.spawn) {
    this.physics.reset(position);
    this.boundary.reset();
    this.environment.update(position);
    this.accumulator = 0;
    this.previous = this.current = this.physics.pose;
    this.place(this.current, 1);
  }
  setView(chase) {
    this.chase = chase;
    if (this.visual) this.visual.visible = chase;
    this.cameraRig.setView(chase);
  }
  setCameraSettings(angle, fov) {
    this.cameraRig.setSettings(angle, fov);
  }
  step(dt, input, update) {
    if (!this.active) return;
    this.environment.update(this.physics.pose.p);
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator >= PHYSICS_DT) {
      this.previous = this.physics.pose;
      this.physics.step(input);
      this.current = this.physics.pose;
      this.accumulator -= PHYSICS_DT;
      update(this.previous, this.current, PHYSICS_DT);
    }
    this.place(this.current, this.accumulator / PHYSICS_DT);
    for (const p of this.props)
      p.rotation.y +=
        dt *
        (this.physics.armed ? 180 + input.throttle * 750 : 0) *
        p.userData.direction;
    if (this.sound) {
      const total = this.physics.motorThrust.reduce((a, b) => a + b, 0),
        fraction = total / (4 * this.config.motor.maxThrustN);
      this.sound.osc.frequency.setTargetAtTime(
        100 + fraction * 700,
        this.sound.ctx.currentTime,
        0.025,
      );
      this.sound.gain.gain.setTargetAtTime(
        this.physics.armed && this.soundEnabled
          ? 0.014 * Math.sqrt(fraction)
          : 0,
        this.sound.ctx.currentTime,
        0.03,
      );
    }
  }
  place(pose, alpha) {
    if (!this.visual) return;
    const a = this.previous ?? pose,
      pos = new THREE.Vector3(...a.p).lerp(new THREE.Vector3(...pose.p), alpha),
      q = new THREE.Quaternion(a.q.x, a.q.y, a.q.z, a.q.w).slerp(
        new THREE.Quaternion(pose.q.x, pose.q.y, pose.q.z, pose.q.w),
        alpha,
      );
    this.visual.position
      .copy(pos)
      .add(new THREE.Vector3(...this.config.visualOffsetM).applyQuaternion(q));
    this.visual.quaternion.copy(q);
    this.visual.visible = this.chase;
    this.cameraRig.update(pos, q);
  }
  async remote(player) {
    let remote = this.remotes.get(player.id);
    if (!remote) {
      const version = this.remoteVersion;
      remote = { model: null, target: player };
      this.remotes.set(player.id, remote);
      const model = await loadModel(this.config);
      if (version !== this.remoteVersion || !this.remotes.has(player.id))
        return;
      remote.model = model;
      this.scene.add(model);
    }
    remote.target = player;
  }
  updateRemotes(players, ownId) {
    const ids = new Set(players.filter((p) => p.id !== ownId).map((p) => p.id));
    for (const [id, r] of this.remotes)
      if (!ids.has(id)) {
        if (r.model) this.scene.remove(r.model);
        this.remotes.delete(id);
      }
    for (const p of players)
      if (p.id !== ownId && p.p && p.q) this.remote(p).catch(() => {});
  }
  render(dt) {
    if (this.current && this.map.kind === "park") {
      const p = this.current.p;
      this.sun.position.set(p[0] - 35, p[1] + 75, p[2] + 25);
      this.sun.target.position.set(...p);
      this.sun.target.updateMatrixWorld();
      Object.assign(this.sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, far: 180 });
      this.sun.shadow.camera.updateProjectionMatrix();
    }
    const w = innerWidth,
      h = innerHeight;
    if (
      this.renderer.domElement.width !==
        Math.round(w * this.renderer.getPixelRatio()) ||
      this.renderer.domElement.height !==
        Math.round(h * this.renderer.getPixelRatio())
    ) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    for (const r of this.remotes.values()) {
      if (!r.model) continue;
      const q = new THREE.Quaternion(
          r.target.q.x,
          r.target.q.y,
          r.target.q.z,
          r.target.q.w,
        ),
        p = new THREE.Vector3(...r.target.p).add(
          new THREE.Vector3(...this.config.visualOffsetM).applyQuaternion(q),
        );
      r.model.position.lerp(p, 1 - Math.exp(-dt * 18));
      r.model.quaternion.slerp(q, 1 - Math.exp(-dt * 18));
    }
    this.renderer.render(this.scene, this.camera);
  }
  startSound() {
    if (this.sound) {
      this.sound.ctx.resume();
      return;
    }
    const ctx = new AudioContext(),
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = "sawtooth";
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    this.sound = { ctx, osc, gain };
  }
  mute() {
    this.sound?.gain.gain.setTargetAtTime(0, this.sound.ctx.currentTime, 0.01);
  }
}
