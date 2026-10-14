import * as THREE from "three";
import { createRadioModel } from "./radio-model.js";
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
    this.camera.position.set(0.24, 0.70, 5.5);
    this.camera.lookAt(0, 0.18, 0);
    this.scene.add(new THREE.HemisphereLight(0xe0ecff, 0x36322e, 2.2));
    const key = new THREE.DirectionalLight(0xffeedf, 3.5); key.position.set(-3, 4, 5); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x82cdd9, 2); rim.position.set(3, 1, -2); this.scene.add(rim);
    const model = createRadioModel();
    this.scene.add(model.root);
    this.sticks = model.sticks;
    this.rings = model.rings;
    this.arrows = model.arrows;
    this.scene.updateMatrixWorld(true);
  }
  render(controller, now) {
    this.controller = controller;
    if (!this.root.offsetParent) return;
    const guide = radioGuideTarget(controller.setup?.axis ?? this.axis, now - this.started, controller.range, now, !!controller.setup);
    const connected = !!controller.pad;
    const labelKey = [document.documentElement.lang, guide.mode, guide.seconds, connected, !!controller.setup, controller.pad?.id, controller.raw.length].join("|");
    if (labelKey !== this.labelKey) {
      this.labelKey = labelKey;
      this.root.dataset.connected = String(connected);
      this.caption.textContent = this.t((controller.setup ? "stickSetup." : "radioGuide.") + guide.mode, { pitch: this.t("axis.pitch"), roll: this.t("axis.roll") });
      this.timer.textContent = guide.seconds === null ? "" : guide.seconds + " s";
      this.liveLabel.textContent = this.t(connected ? "radioGuide.live" : "radioGuide.noRadio");
      this.canvas.setAttribute("aria-label", this.t("radioGuide.aria"));
      for (const button of this.buttons) {
        button.disabled = !!controller.range || !!controller.setup;
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
    const actualPose = controller.setup
      ? { throttle: 0, yaw: 0, pitch: 0, roll: 0, ...radioInput(controller.raw, { ...controller.profile, axes: controller.setup.feedbackAxes }) }
      : radioInput(controller.raw, controller.profile);
    const actual = radioStickPositions(actualPose);
    // A connected radio drives the mechanical gimbals themselves. The arrows
    // remain the instruction; without a radio the sticks demonstrate it.
    const displayed = connected ? actual : desired;
    const leftActive = ["centres", "range", "throttle", "yaw"].includes(guide.mode);
    const rightActive = ["centres", "range", "pitch", "roll"].includes(guide.mode);
    for (let i = 0; i < 2; i++) {
      this.sticks[i].rotation.set(-displayed[i][1] * 0.6, displayed[i][0] * 0.6, 0);
      this.rings[i].material.color.setHex((i ? rightActive : leftActive) ? 0xff6648 : 0x9da5b2);
      this.arrows[i].forEach((arrow, direction) => {
        const horizontal = direction < 2;
        arrow.visible = guide.mode === "range" || (i ? (horizontal ? guide.mode === "roll" : guide.mode === "pitch") : (horizontal ? guide.mode === "yaw" : guide.mode === "throttle"));
        if (controller.setup && direction % 2 === 1) arrow.visible = false;
      });
    }
    this.renderer.render(this.scene, this.camera);
  }
}
