import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadModel, disposeModelMaterials } from "./models.js";
import { applyDroneColor, normalizeDroneColor } from "../../shared/visual/drone-colors.js";
import { configureDroneRenderer, addDroneReflections } from "/shared/visual/drone-rendering.js";
export class Preview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    configureDroneRenderer(THREE, this.renderer);
    this.scene = new THREE.Scene();
    this.reflections = addDroneReflections(THREE, this.renderer, this.scene);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.002, 10);
    this.camera.position.set(0.38, 0.3, 0.42);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 0.045;
    this.controls.maxDistance = 1;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.7;
    this.scene.add(new THREE.HemisphereLight(0xdce9ff, 0x45443b, 2.1));
    const sun = new THREE.DirectionalLight(0xfff1e1, 3.2);
    sun.position.set(-0.4, 0.7, -0.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -0.4;
    sun.shadow.camera.right = 0.4;
    sun.shadow.camera.top = 0.4;
    sun.shadow.camera.bottom = -0.4;
    sun.shadow.camera.near = 0.01;
    sun.shadow.camera.far = 2;
    sun.shadow.bias = -0.0001;
    sun.shadow.normalBias = 0.0002;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xa7dcff, 1.6);
    rim.position.set(0.5, 0.1, 0.4);
    this.scene.add(rim);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 3),
      new THREE.ShadowMaterial({ opacity: 0.13, depthWrite: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.floor = floor;
    this.version = 0;
    this.color = "coral";
  }
  async select(config, onProgress) {
    const version = ++this.version,
      model = await loadModel(config, { isolateMaterials: true, onProgress });
    if (version !== this.version) { disposeModelMaterials(model); return; }
    if (this.model) { this.scene.remove(this.model); disposeModelMaterials(this.model); }
    this.model = model;
    applyDroneColor(model, this.color);
    this.scene.add(model);
    const size = new THREE.Box3().setFromObject(model),
      center = size.getCenter(new THREE.Vector3()),
      extent = size.getSize(new THREE.Vector3()).length();
    // Model roots sit at frame level, not at their landing feet. A floor at
    // Y=0 intersects the arms and produces competing depth values as we orbit.
    this.floor.position.y = size.min.y - 0.0005;
    this.controls.target.set(center.x, center.y, center.z);
    this.camera.position
      .copy(center)
      .add(new THREE.Vector3(extent * 0.53, extent * 0.36, -extent * 0.60));
    this.controls.minDistance = extent * 0.5;
    this.controls.maxDistance = extent * 2.5;
    this.controls.update();
  }
  setColor(value) { this.color = normalizeDroneColor(value); applyDroneColor(this.model, this.color); }
  render() {
    if (!this.canvas.offsetParent) return;
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    if (
      this.renderer.domElement.width !==
        Math.round(w * this.renderer.getPixelRatio()) ||
      this.renderer.domElement.height !==
        Math.round(h * this.renderer.getPixelRatio())
    ) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      // Keep the whole drone visible when the desktop stage adapts to screen height.
      const baseFov = w >= 700 ? 48 : 36;
      this.camera.fov = Math.min(75, baseFov * Math.max(1, 1.7 / this.camera.aspect));
      this.camera.updateProjectionMatrix();
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
