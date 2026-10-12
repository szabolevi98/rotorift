import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { configureDroneRenderer, addDroneReflections } from "/shared/visual/drone-rendering.js";
import { radioInput } from "./controller.js";
import { radioGuideTarget, radioStickPositions } from "./radio-guide-state.js";

export class RadioGuide {
  constructor(root, translate) {
    this.root = root;
    this.t = translate;
    this.canvas = root.querySelector("canvas");
    this.caption = root.querySelector("[data-radio-instruction]");
    this.timer = root.querySelector("[data-radio-timer]");
    this.liveLabel = root.querySelector("[data-radio-live]");
    this.buttons = [...root.querySelectorAll("[data-radio-guide-axis]")];
    this.setAxis("centres");
    for (const button of this.buttons) button.onclick = () => this.setAxis(button.dataset.radioGuideAxis);
    window.addEventListener("languagechange", () => {
      this.labelKey = null;
      if (this.controller) this.render(this.controller, performance.now());
    });
  }
  setAxis(axis) {
    this.axis = axis;
    this.started = performance.now();
    this.labelKey = null;
  }
  build() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    configureDroneRenderer(THREE, this.renderer);
    this.renderer.shadowMap.enabled = false;
    this.scene = new THREE.Scene();
    this.reflections = addDroneReflections(THREE, this.renderer, this.scene);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 20);
    this.camera.position.set(0.4, 0.9, 4.7);
    this.camera.lookAt(0, 0.12, 0);
    this.scene.add(new THREE.HemisphereLight(0xe0ecff, 0x36322e, 2.2));
    const key = new THREE.DirectionalLight(0xffeedf, 3.5); key.position.set(-3, 4, 5); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x82cdd9, 2); rim.position.set(3, 1, -2); this.scene.add(rim);
    const plastic = new THREE.MeshStandardMaterial({ color: 0x282d34, roughness: 0.6, metalness: 0.15 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x10151b, roughness: 0.84 });
    const silver = new THREE.MeshStandardMaterial({ color: 0x9da5b2, roughness: 0.3, metalness: 0.8 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xff6648, emissive: 0xff6648, emissiveIntensity: 0.25, roughness: 0.45 });
    const cyan = new THREE.MeshBasicMaterial({ color: 0x73d9d0, toneMapped: false, depthTest: false, depthWrite: false });
    const radio = new THREE.Group(); this.scene.add(radio); radio.rotation.x = -0.08;
    const mesh = (geometry, material, x, y, z, parent = radio) => {
      const item = new THREE.Mesh(geometry, material); item.position.set(x, y, z); parent.add(item); return item;
    };
    const box = (w, h, d, material, x, y, z, radius = 0.06) => mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material, x, y, z);
    const cylinder = (radius, height, material, x, y, z, parent = radio) => {
      const item = mesh(new THREE.CylinderGeometry(radius, radius, height, 24), material, x, y, z, parent);
      item.rotation.x = Math.PI / 2; return item;
    };
    const shell = new THREE.Shape();
    shell.moveTo(-0.9, -0.98); shell.quadraticCurveTo(-1.12, -1.12, -1.29, -0.6);
    shell.lineTo(-1.32, 0.56); shell.quadraticCurveTo(-1.3, 0.88, -1.04, 0.88);
    shell.lineTo(1.04, 0.88); shell.quadraticCurveTo(1.3, 0.88, 1.32, 0.56);
    shell.lineTo(1.29, -0.6); shell.quadraticCurveTo(1.12, -1.12, 0.9, -0.98);
    shell.quadraticCurveTo(0.5, -0.72, 0, -0.74); shell.quadraticCurveTo(-0.5, -0.72, -0.9, -0.98);
    mesh(new THREE.ExtrudeGeometry(shell, { depth: 0.42, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.055, bevelThickness: 0.055, curveSegments: 12 }), plastic, 0, 0, -0.23);
    for (const side of [-1, 1]) {
      box(0.34, 0.75, 0.07, grip, side * 1.08, -0.49, 0.235, 0.04);
      for (let i = 0; i < 5; i++) box(0.23, 0.018, 0.025, plastic, side * 1.08, -0.27 - i * 0.085, 0.28, 0.008);
      const toggle = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.23, 10), silver, side * 1.02, 0.99, 0);
      toggle.rotation.z = side * 0.16;
      box(0.14, 0.05, 0.14, grip, side * 1.02, 0.88, 0);
      for (const y of [0.73, -0.75]) cylinder(0.035, 0.018, silver, side * 1.18, y, 0.26);
    }
    const antenna = mesh(new THREE.CylinderGeometry(0.065, 0.085, 0.48, 16), grip, 0, 1.06, -0.12);
    antenna.rotation.z = -0.12;
    cylinder(0.07, 0.028, orange, 0, 0.58, 0.29);
    box(0.72, 0.42, 0.065, grip, 0, -0.44, 0.27, 0.035);
    const display = document.createElement("canvas"); display.width = 256; display.height = 128;
    const ctx = display.getContext("2d"); ctx.fillStyle = "#152b30"; ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = "#b7e8df"; ctx.font = "bold 26px Arial"; ctx.textAlign = "center"; ctx.fillText("ROTORIFT", 128, 49);
    ctx.font = "20px Arial"; ctx.fillText("MODE 2", 128, 83);
    const screen = new THREE.CanvasTexture(display); screen.colorSpace = THREE.SRGBColorSpace;
    mesh(new THREE.PlaneGeometry(0.62, 0.31), new THREE.MeshBasicMaterial({ map: screen }), 0, -0.44, 0.309);
    this.sticks = []; this.rings = []; this.markers = []; this.arrows = [];
    for (const x of [-0.72, 0.72]) {
      cylinder(0.405, 0.08, grip, x, 0.22, 0.28);
      cylinder(0.35, 0.015, plastic, x, 0.22, 0.33);
      const ring = mesh(new THREE.TorusGeometry(0.39, 0.027, 8, 40), silver.clone(), x, 0.22, 0.35); this.rings.push(ring);
      const pivot = new THREE.Group(); pivot.position.set(x, 0.22, 0.36); radio.add(pivot);
      cylinder(0.045, 0.36, silver, 0, 0, 0.17, pivot);
      cylinder(0.095, 0.08, orange, 0, 0, 0.39, pivot);
      cylinder(0.067, 0.02, grip, 0, 0, 0.436, pivot);
      mesh(new THREE.SphereGeometry(0.065, 12, 8), silver, 0, 0, 0, pivot);
      this.sticks.push(pivot);
      const marker = mesh(new THREE.TorusGeometry(0.06, 0.015, 8, 20), cyan, x, 0.22, 0.365); marker.renderOrder = 5; this.markers.push(marker);
      const arrows = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const direction = new THREE.Vector3(dx, dy, 0);
        const arrow = new THREE.ArrowHelper(direction, new THREE.Vector3(x + dx * 0.45, 0.22 + dy * 0.45, 0.37), 0.18, 0xff6648, 0.09, 0.08);
        radio.add(arrow); arrows.push(arrow);
      }
      this.arrows.push(arrows);
    }
    this.scene.updateMatrixWorld(true);
  }
  render(controller, now) {
    this.controller = controller;
    if (!this.root.offsetParent) return;
    const guide = radioGuideTarget(this.axis, now - this.started, controller.range, now);
    const connected = !!controller.pad;
    const labelKey = [document.documentElement.lang, guide.mode, guide.seconds, connected, controller.pad?.id, controller.raw.length].join("|");
    if (labelKey !== this.labelKey) {
      this.labelKey = labelKey;
      this.root.dataset.connected = String(connected);
      this.caption.textContent = this.t("radioGuide." + guide.mode, { pitch: this.t("axis.pitch"), roll: this.t("axis.roll") });
      this.timer.textContent = guide.seconds === null ? "" : guide.seconds + " s";
      this.liveLabel.textContent = this.t(connected ? "radioGuide.live" : "radioGuide.noRadio");
      this.canvas.setAttribute("aria-label", this.t("radioGuide.aria"));
      for (const button of this.buttons) {
        button.disabled = !!controller.range;
        button.setAttribute("aria-pressed", String(button.dataset.radioGuideAxis === guide.mode));
      }
      for (const row of document.querySelectorAll("[data-radio-axis-row]"))
        row.classList.toggle("guide-active", guide.mode === "range" || row.dataset.radioAxisRow === guide.mode);
    }
    const { clientWidth: width, clientHeight: height } = this.canvas;
    if (!width || !height) return; // Hidden mobile model does not allocate a GPU context.
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.bottom < 0 || bounds.top > innerHeight) return;
    if (this.visualFailed) return;
    if (!this.renderer) {
      try { this.build(); }
      catch {
        this.visualFailed = true;
        this.renderer?.dispose();
        this.root.querySelector(".radio-guide-visual").classList.add("hidden");
        return; // Calibration remains usable if WebGL is unavailable.
      }
    }
    if (this.width !== width || this.height !== height) {
      this.width = width; this.height = height;
      this.renderer.setSize(width, height, false); this.camera.aspect = width / height;
      this.camera.fov = this.camera.aspect < 1.2 ? 43 : 35;
      this.camera.updateProjectionMatrix();
    }
    const desired = radioStickPositions(guide.pose);
    const actual = radioStickPositions(radioInput(controller.raw, controller.profile));
    const leftActive = ["centres", "range", "throttle", "yaw"].includes(guide.mode);
    const rightActive = ["centres", "range", "pitch", "roll"].includes(guide.mode);
    for (let i = 0; i < 2; i++) {
      this.sticks[i].rotation.set(-desired[i][1] * 0.6, desired[i][0] * 0.6, 0);
      this.rings[i].material.color.setHex((i ? rightActive : leftActive) ? 0xff6648 : 0x9da5b2);
      this.markers[i].visible = connected;
      this.markers[i].position.x = (i ? 0.72 : -0.72) + actual[i][0] * 0.28;
      this.markers[i].position.y = 0.22 + actual[i][1] * 0.28;
      this.arrows[i].forEach((arrow, direction) => {
        const horizontal = direction < 2;
        arrow.visible = guide.mode === "range" || (i ? (horizontal ? guide.mode === "roll" : guide.mode === "pitch") : (horizontal ? guide.mode === "yaw" : guide.mode === "throttle"));
      });
    }
    this.renderer.render(this.scene, this.camera);
  }
}
