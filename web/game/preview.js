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
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7b856e, 2.3));
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.position.set(0.3, 0.6, 0.15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -0.4;
    sun.shadow.camera.right = 0.4;
    sun.shadow.camera.top = 0.4;
    sun.shadow.camera.bottom = -0.4;
    sun.shadow.camera.near = 0.01;
    sun.shadow.camera.far = 2;
    sun.shadow.bias = -0.0001;
    this.scene.add(sun);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 3),
      new THREE.ShadowMaterial({ opacity: 0.13 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.version = 0;
    this.color = "coral";
  }
  async select(config) {
    const version = ++this.version,
      model = await loadModel(config, { isolateMaterials: true });
    if (version !== this.version) { disposeModelMaterials(model); return; }
    if (this.model) { this.scene.remove(this.model); disposeModelMaterials(this.model); }
    this.model = model;
    applyDroneColor(model, this.color);
    this.scene.add(model);
    const size = new THREE.Box3().setFromObject(model),
      center = size.getCenter(new THREE.Vector3()),
      extent = size.getSize(new THREE.Vector3()).length();
    this.controls.target.set(center.x, center.y, center.z);
    this.camera.position
      .copy(center)
      .add(new THREE.Vector3(extent * 0.75, extent * 0.58, extent * 0.85));
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
      this.camera.updateProjectionMatrix();
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
