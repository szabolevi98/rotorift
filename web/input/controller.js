import { read, write } from "../storage.js";
import { clamp } from "../../shared/physics/math.js";
export const DEFAULT_KEYS = {
  throttleUp: "KeyW",
  throttleDown: "KeyS",
  pitchForward: "ArrowUp",
  pitchBack: "ArrowDown",
  rollLeft: "ArrowLeft",
  rollRight: "ArrowRight",
  yawLeft: "KeyA",
  yawRight: "KeyD",
  arm: "Space",
  reset: "KeyR",
  menu: "Escape",
  view: "KeyV",
  mode: "KeyM",
  hover: "KeyH",
};
// Digital keys emulate gradual stick travel. The radio keeps its calibrated
// analogue input. Yaw is gentler on keys; drone rate profiles remain unchanged.
export const KEYBOARD_RESPONSE = {
  roll: { limit: 1, riseSeconds: 0.22 },
  pitch: { limit: 1, riseSeconds: 0.22 },
  yaw: { limit: 0.75, riseSeconds: 0.30 },
  returnSeconds: 0.08,
};
export const defaultProfile = () => ({
  deadzone: 0.015,
  axes: {
    roll: { index: 0, invert: false, center: 0, min: -1, max: 1 },
    pitch: { index: 1, invert: true, center: 0, min: -1, max: 1 },
    yaw: { index: 3, invert: false, center: 0, min: -1, max: 1 },
    throttle: { index: 2, invert: false, center: 0, min: -1, max: 1 },
  },
});
const defaults = defaultProfile;
export function radioInput(raw, profile) {
  const out = {};
  for (const [axis, a] of Object.entries(profile.axes)) {
    const value =
      raw[a.index] ??
      (axis === "throttle" ? (a.invert ? a.max : a.min) : a.center);
    let v;
    if (axis === "throttle") {
      v = clamp((value - a.min) / Math.max(0.1, a.max - a.min), 0, 1);
      if (a.invert) v = 1 - v;
    } else {
      v = clamp(
        (value - a.center) /
          Math.max(
            0.1,
            value >= a.center ? a.max - a.center : a.center - a.min,
          ),
        -1,
        1,
      );
      if (a.invert) v = -v;
      const dead = clamp(profile.deadzone, 0, 0.2);
      v =
        Math.abs(v) <= dead
          ? 0
          : (Math.sign(v) * (Math.abs(v) - dead)) / (1 - dead);
    }
    out[axis] = v;
  }
  return out;
}
export class Controller {
  constructor(action) {
    this.action = action;
    this.keys = { ...DEFAULT_KEYS, ...read("keys", {}) };
    this.source = read("input-source", "auto");
    this.pressed = new Set();
    this.keyboard = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
    this.raw = [];
    this.pad = null;
    this.lastId = null;
    this.profile = defaults();
    this.range = null;
    window.addEventListener("keydown", (e) => {
      if (e.target.closest("input,select,textarea,button")) return;
      if (Object.values(this.keys).includes(e.code) || ["ShiftLeft", "ShiftRight"].includes(e.code)) {
        e.preventDefault();
        this.pressed.add(e.code);
        if (!e.repeat) {
          const a = Object.keys(this.keys).find((k) => this.keys[k] === e.code);
          if (["arm", "reset", "menu", "view", "mode", "hover"].includes(a))
            this.action(a);
        }
      }
    });
    window.addEventListener("keyup", (e) => this.pressed.delete(e.code));
    window.addEventListener("blur", () => {
      this.clear();
      this.action("lostFocus");
    });
  }
  clear() {
    this.pressed.clear();
    this.keyboard = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
  }
  save() {
    if (this.pad) write("radio." + this.pad.id, this.profile);
    write("keys", this.keys);
    write("input-source", this.source);
  }
  poll(dt) {
    const pads = Array.from(navigator.getGamepads?.() ?? []).filter(Boolean);
    this.pad = pads.find((p) => p.id === this.lastId) ?? pads[0] ?? null;
    if ((this.pad?.id ?? null) !== this.lastId) {
      this.lastId = this.pad?.id ?? null;
      this.profile = this.pad
        ? read("radio." + this.pad.id, defaults())
        : defaults();
      if (this.source !== "keyboard") this.action("radioChanged");
    }
    this.raw = this.pad ? Array.from(this.pad.axes) : [];
    if (this.range) {
      for (let i = 0; i < this.raw.length; i++) {
        this.range.min[i] = Math.min(this.range.min[i] ?? 1, this.raw[i]);
        this.range.max[i] = Math.max(this.range.max[i] ?? -1, this.raw[i]);
      }
      if (performance.now() >= this.range.end) {
        for (const a of Object.values(this.profile.axes)) {
          if (
            (this.range.max[a.index] ?? 0) - (this.range.min[a.index] ?? 0) >
            0.2
          ) {
            a.min = this.range.min[a.index];
            a.max = this.range.max[a.index];
          }
        }
        this.range = null;
        this.save();
        window.dispatchEvent(new Event("calibrationdone"));
      }
    }
    const k = this.keyboard,
      p = this.pressed,
      has = (a) => p.has(this.keys[a]);
    k.throttle = clamp(
      k.throttle +
        (Number(has("throttleUp")) - Number(has("throttleDown"))) * dt * 0.4,
      0,
      1,
    );
    for (const [axis, positive, negative] of [
      ["roll", "rollRight", "rollLeft"],
      ["pitch", "pitchForward", "pitchBack"],
      ["yaw", "yawRight", "yawLeft"],
    ]) {
      const response = KEYBOARD_RESPONSE[axis];
      const target =
        (Number(has(positive)) - Number(has(negative))) *
        (p.has("ShiftLeft") || p.has("ShiftRight") ? 0.35 : 1) * response.limit;
      const returning = target === 0 || (Math.sign(target) === Math.sign(k[axis]) && Math.abs(target) < Math.abs(k[axis]));
      const travel = dt * response.limit / (returning ? KEYBOARD_RESPONSE.returnSeconds : response.riseSeconds);
      k[axis] += clamp(target - k[axis], -travel, travel);
    }
    if (this.source === "keyboard" || !this.pad) return { ...k };
    return radioInput(this.raw, this.profile);
  }
  get usingRadio() {
    return this.source !== "keyboard" && !!this.pad;
  }
  calibrateCenter() {
    if (!this.pad) return false;
    for (const [axis, a] of Object.entries(this.profile.axes))
      if (axis !== "throttle") a.center = this.raw[a.index] ?? 0;
    this.save();
    return true;
  }
  calibrateRange() {
    if (!this.pad) return false;
    this.range = { end: performance.now() + 6000, min: [], max: [] };
    return true;
  }
}
