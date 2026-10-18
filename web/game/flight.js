import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PHYSICS_DT } from "/shared/physics/time-step.js";
import {createAircraftPhysics} from '/shared/physics/aircraft.js';
import {aircraftLaunch} from '/shared/aircraft/launch.js';
import {createAircraftVisual} from './aircraft-visual.js';
import { buildEnvironment } from "./environment.js";
import { loadModel, disposeModelMaterials } from "./models.js";
import { applyDroneColor, normalizeDroneColor } from "../../shared/visual/drone-colors.js";
import { DroneTrail } from "./drone-trail.js";
import { DroneCameraRig, CAMERA_VIEWS } from "./camera-rig.js";
import { MapBoundary } from "/shared/world/boundary.js";
import { PARK_VIEW_DISTANCE } from "./park-terrain.js";
import { ParkShadows } from "./park-shadows.js";
import { configureDroneRenderer } from "/shared/visual/drone-rendering.js";
import { createMapAtmosphere } from "./map-atmosphere.js";
import { CONSTRUCTION_VIEW_DISTANCE } from "./construction.js";
import { RemoteCollisions } from "./remote-collisions.js";
import { normalizeSimulation } from "../../shared/simulation/options.js";
import { loadPrebakedCollisions } from "./prebaked-collisions.js";
import { PLAYGROUND_VIEW_DISTANCE } from "./playground.js";
import { advanceFixedSteps } from '../../shared/physics/fixed-step.js';
import { LapGhostPilot } from './lap-ghost.js';
import { AnalogVideo } from './analog-video.js';
import { prepareFlightViews } from './prepare-views.js';
import { DroneSound } from './drone-sound.js';
export class Flight {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    configureDroneRenderer(THREE, this.renderer);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc9dedc);
    this.scene.fog = new THREE.Fog(0xc9dedc, 60, 190);
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
    this.view = "fpv-clean";
    this.remotes = new Map();
    this.sound = null;
    this.remoteVersion = 0;
  }
  async init() {
    await RAPIER.init();
  }
  async load(map, config, rates, mode, color = this.color ?? "coral", simulation, onProgress, {launchMethod="air"} = {}) {
    this.mute();
    const version = this.loadVersion = (this.loadVersion ?? 0) + 1;
    this.active = false;
    this.preparingViews = false;
    this.analogPrepared = false;
    this.parkShadows?.dispose();
    this.ghostVersion=(this.ghostVersion??0)+1;
    this.lapGhost?.dispose();this.lapGhost=null;
    this.parkShadows = null;
    this.environment?.dispose();
    this.environment = null;
    this.atmosphere?.dispose();
    this.atmosphere = null;
    this.remoteCollisions?.dispose();
    this.remoteCollisions = null;
    this.physics = null;
    this.world?.free();
    this.removeModel(this.visual);
    this.visual = null;
    for (const o of this.remotes.values()) { this.removeModel(o.model); o.trail.dispose(); }
    this.remotes.clear();
    this.remoteVersion++;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const loadWorld = this.world;
    const bakedCollisions = await loadPrebakedCollisions(RAPIER, loadWorld, map, () => version===this.loadVersion, onProgress);
    if(version!==this.loadVersion){bakedCollisions?.dispose();return false;}
    this.environment = buildEnvironment(this.scene, this.world, RAPIER, map, { bakedCollisions });
    this.environment.highlight(0, false);
    this.config = config;
    this.sound?.configure(config);
    this.map = map;
    this.boundary = new MapBoundary(map);
    this.camera.far = map.kind === "playground" ? PLAYGROUND_VIEW_DISTANCE : map.kind === "park" ? PARK_VIEW_DISTANCE : CONSTRUCTION_VIEW_DISTANCE;
    this.camera.updateProjectionMatrix();
    this.atmosphere = createMapAtmosphere(this.renderer, this.scene, map.kind);
    this.sun.visible = false;
    this.launchPose=aircraftLaunch(config,map,{method:launchMethod});
    this.launchPosition=this.launchPose.p;
    this.physics = createAircraftPhysics(RAPIER, this.world, config, this.launchPosition, { updateSceneQueries: false, simulation, launchPose:this.launchPose });
    this.remoteCollisions = new RemoteCollisions(RAPIER, this.world, config);
    this.remotePlayers = [];
    this.physics.rates = rates;
    this.physics.mode = mode;
    const visual = await loadModel(config, { isolateMaterials: true, onProgress });
    if (version !== this.loadVersion) { this.removeModel(visual); return false; }
    this.visual = visual;
    this.aircraftVisual = createAircraftVisual(visual,config);
    this.aircraftVisual.bindPhysics(this.physics);
    this.setColor(color);
    this.cameraRig.configure(config, this.visual, (x,z)=>this.environment.heightAt(x,z));
    this.scene.add(this.visual);
    this.accumulator = 0;
    this.previous = this.physics.pose;
    this.current = this.physics.pose;
    this.place(this.current, 1);
    this.parkShadows = new ParkShadows(this.scene, this.camera, this.atmosphere.profile);
    this.active = true;
    return true;
  }
  setColor(value) { this.color = normalizeDroneColor(value); applyDroneColor(this.visual, this.color); }
  async setLapGhost(value){
    const version=this.ghostVersion=(this.ghostVersion??0)+1;
    this.lapGhost?.dispose();this.lapGhost=null;
    if(!value)return;
    // Use cached original geometry, never temporary damaged blades/FPV discs.
    const source=await loadModel(this.config);
    try {
      if(version!==this.ghostVersion)return;
      this.lapGhost=new LapGhostPilot(this.scene,source,this.config,value.replay,value.label);
    } finally {
      if(source.userData.proceduralAircraft)disposeModelMaterials(source);
    }
  }
  setSimulation(options) {
    this.physics?.effects.setOptions(normalizeSimulation(options));
    this.remoteCollisions?.update(this.remotePlayers ?? [], this.ownId, this.physics.effects.options.ghost);
  }
  reset(position = this.launchPosition ?? this.map.spawn, pose = this.launchPose) {
    if (!this.physics || !this.environment) return;
    this.physics.reset(position,pose);
    this.lapGhost?.update(null);
    this.aircraftVisual.reset(this.physics);
    this.boundary.reset();
    this.environment.update(position);
    this.accumulator = 0;
    this.previous = this.current = this.physics.pose;
    this.place(this.current, 1);
  }
  setView(view) {
    this.cameraRig.setView(view);
    this.view = this.cameraRig.view;
    this.chase = this.cameraRig.chase;
    if (this.visual) this.visual.visible = this.view !== "fpv-clean";
  }
  cycleView() { this.setView(CAMERA_VIEWS[(CAMERA_VIEWS.indexOf(this.view) + 1) % CAMERA_VIEWS.length]); }
  getAnalogVideo() { return this.analogVideo ??= new AnalogVideo(this.renderer); }
  async prepareViews(options = {}) {
    const version = this.loadVersion;
    this.preparingViews = true;
    try {
      const ready = await prepareFlightViews(this, {...options, current: () => version === this.loadVersion});
      if (version !== this.loadVersion) return false;
      if (ready && options.analog) this.analogPrepared = true;
      return ready;
    } finally {
      if (version === this.loadVersion) this.preparingViews = false;
    }
  }
  setCameraSettings(angle, fov) {
    this.cameraRig.setSettings(angle, fov);
  }
  step(dt, input, update, metrics = null) {
    if (!this.active) return;
    const worldStart = metrics ? performance.now() : 0;
    this.environment.update(this.physics.pose.p, this.physics.pose.v);
    const physicsStart = metrics ? performance.now() : 0;
    if(metrics)metrics.maxPhysicsStepMs=0;
    const steps = advanceFixedSteps(this, dt, () => {
      const stepStart=metrics?performance.now():0;
      this.previous = this.physics.pose;
      this.remoteCollisions.step(PHYSICS_DT);
      this.physics.step(input);
      this.current = this.physics.pose;
      update(this.previous, this.current, PHYSICS_DT);
      if(metrics)metrics.maxPhysicsStepMs=Math.max(metrics.maxPhysicsStepMs,performance.now()-stepStart);
    });
    if (metrics) {
      metrics.worldMs = physicsStart - worldStart;
      metrics.physicsMs = performance.now() - physicsStart;
      metrics.steps = steps;
      metrics.droppedMs = Math.max(0, dt - .1) * 1000;
    }
    this.place(this.current, this.accumulator / PHYSICS_DT);
    this.aircraftVisual.update(dt,this.physics,input);
    this.sound?.update(this.aircraftVisual.motorSpeeds, {
      enabled: this.soundEnabled, volume: this.soundVolume, armed: this.physics.armed, chase: this.chase,
      speed: Math.hypot(...this.current.v), vertical: this.current.v[1],
      propwash: this.physics.effects.options.propwash, blades: this.physics.effects.propellers?.blades,
    });
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
    this.visual.visible = this.view !== "fpv-clean";
    this.cameraRig.update(pos, q);
  }
  async remote(player) {
    let remote = this.remotes.get(player.id);
    if (!remote) {
      const version = this.remoteVersion;
      remote = { model: null, target: player, trail: new DroneTrail(this.scene, player.color, this.config.maxSpeedMps), initialized: false };
      this.remotes.set(player.id, remote);
      const model = await loadModel(this.config, { isolateMaterials: true });
      if (version !== this.remoteVersion || this.remotes.get(player.id) !== remote) {
        this.removeModel(model);
        return;
      }
      remote.model = model;
      remote.animation = createAircraftVisual(model,this.config,{remote:true});
      applyDroneColor(model, remote.target.color);
      this.scene.add(model);
    } else {
      remote.target = player;
      applyDroneColor(remote.model, player.color);
      remote.trail.setColor(player.color);
    }
  }
  updateRemotes(players, ownId) {
    this.remotePlayers = players; this.ownId = ownId;
    this.remoteCollisions?.update(players, ownId, this.physics.effects.options.ghost);
    const ids = new Set(players.filter((p) => p.id !== ownId).map((p) => p.id));
    for (const [id, r] of this.remotes)
      if (!ids.has(id)) {
        this.removeModel(r.model);
        r.trail.dispose();
        this.remotes.delete(id);
      }
    for (const p of players)
      if (p.id !== ownId && p.p && p.q) this.remote(p).catch(() => {});
  }
  removeModel(model) {
    if (!model) return;
    if(model===this.visual){this.aircraftVisual?.dispose();this.aircraftVisual=null;}
    for(const remote of this.remotes.values())if(remote.model===model)remote.animation?.dispose();
    this.scene.remove(model);
    this.parkShadows?.releaseModel(model);
    const materials = new Set();
    const geometries = new Set();
    model.traverse((object) => {
      if(model.userData.proceduralAircraft&&object.geometry)geometries.add(object.geometry);
      if (object.isMesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    // These are instance-owned materials; the cached geometries stay reusable.
    for (const material of materials) material.dispose();
    for(const geometry of geometries)geometry.dispose();
  }
  render(dt, analog = false) {
    this.aircraftVisual?.prepareView(this.view,this.physics);
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
      r.animation.updateRemote(dt,r.target);
      const q = new THREE.Quaternion(
          r.target.q.x,
          r.target.q.y,
          r.target.q.z,
          r.target.q.w,
        ),
        p = new THREE.Vector3(...r.target.p).add(
          new THREE.Vector3(...this.config.visualOffsetM).applyQuaternion(q),
        );
      if (!r.initialized || r.resetId !== r.target.resetId) {
        r.model.position.copy(p); r.model.quaternion.copy(q); r.trail.clear();
        r.resetId = r.target.resetId; r.initialized = true;
      } else {
        r.model.position.lerp(p, 1 - Math.exp(-dt * 18));
        r.model.quaternion.slerp(q, 1 - Math.exp(-dt * 18));
      }
      const tail = new THREE.Vector3(0, 0.015, (this.config.lengthM??this.config.motorDiagonalM) * 0.3).applyQuaternion(r.model.quaternion).add(r.model.position);
      r.trail.update(tail.toArray(), performance.now() / 1000, r.target.resetId, w, h);
    }
    this.parkShadows?.update({ dynamic: this.view !== "fpv-clean" || this.remotes.size > 0 });
    if (analog) {
      this.getAnalogVideo().render(this.scene, this.camera, dt);
    } else {
      this.analogVideo?.reset();
      this.renderer.render(this.scene, this.camera);
    }
  }
  startSound() {
    if (!this.soundEnabled) return;
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextClass) return;
    this.sound ??= new DroneSound(new AudioContextClass(), this.config);
    this.sound.resume();
  }
  mute() {
    this.sound?.mute();
  }
}
