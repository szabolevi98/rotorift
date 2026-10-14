import { read, write } from "../storage.js";
import { clamp } from "../../shared/physics/math.js";
import { ActionBindings, RADIO_ACTIONS, availableBindings, bindingKey } from "./action-bindings.js";
import { defaultProfile, radioPreset, profileStorageKey, restoreRadioProfile, isEdgeTXRadio } from "./radio-profiles.js";
import { StickSetup } from "./stick-setup.js";
export { defaultProfile } from "./radio-profiles.js";
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
  turtle: "KeyT",
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
    this.pads = [];
    this.deviceId = read("radio-device", "auto");
    this.lastId = null;
    this.lastIndex = null;
    this.profile = defaults();
    this.range = null;
    this.bindings = new ActionBindings();
    this.setup = null;
    window.addEventListener("keydown", (e) => {
      if (e.target.closest("input,select,textarea,button")) return;
      if (Object.values(this.keys).includes(e.code) || ["ShiftLeft", "ShiftRight"].includes(e.code)) {
        e.preventDefault();
        this.pressed.add(e.code);
        if (!e.repeat) {
          const a = Object.keys(this.keys).find((k) => this.keys[k] === e.code);
          if (["arm", "reset", "menu", "view", "mode", "turtle", "hover"].includes(a))
            this.action(a);
        }
      }
    });
    window.addEventListener("keyup", (e) => this.pressed.delete(e.code));
    window.addEventListener("blur", () => {
      this.clear();
      this.action("lostFocus");
    });
    window.document?.addEventListener("visibilitychange", () => {
      if (window.document.hidden) { this.clear(); this.action("lostFocus"); }
    });
  }
  clear() {
    this.pressed.clear();
    this.keyboard = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
    this.bindings.reset();
    this.setup = null;
  }
  applyPreset(preset) {
    if (!this.pad) return;
    if (preset === "custom") { this.markCustom(); this.save(); return; }
    this.profile = { ...radioPreset(this.pad, preset), actions: this.profile.actions, deadzone: this.profile.deadzone };
    this.clear(); this.range = null; this.save();
  }
  markCustom() { this.profile.preset = "custom"; this.profile.supported = true; }
  startStickSetup() {
    if (!this.pad) return false;
    this.clear(); this.range = null;
    this.setup = new StickSetup(this.raw);
    return true;
  }
  advanceStickSetup() {
    if (!this.setup?.advance(this.raw)) return false;
    if (!this.setup.axis) {
      this.profile.axes = this.setup.axes;
      this.markCustom(); this.setup = null; this.bindings.reset(); this.save();
    }
    return true;
  }
  bindAction(action, binding) {
    if (!this.pad || !RADIO_ACTIONS.includes(action)) return false;
    if (binding && !availableBindings(this.pad, this.profile).some((b) => bindingKey(b) === bindingKey(binding))) return false;
    this.profile.actions ??= {};
    // A control belongs to one action; do not accidentally arm and reset together.
    if (binding) for (const name of RADIO_ACTIONS) {
      const other = this.profile.actions[name];
      if (other?.type === binding.type && other.index === binding.index)
        this.profile.actions[name] = null;
    }
    this.profile.actions[action] = binding;
    this.bindings.reset();
    this.save();
    return true;
  }
  save() {
    if (this.pad) {
      write(profileStorageKey(this.pad), this.profile);
      write("radio." + this.pad.id, this.profile);
    }
    write("keys", this.keys);
    write("input-source", this.source);
    write("radio-device", this.deviceId);
  }
  poll(dt) {
    const pads = Array.from(navigator.getGamepads?.() ?? []).filter(Boolean);
    this.pads = pads;
    this.pad = this.deviceId !== "auto" ? pads.find((p) => p.id === this.deviceId) ?? null
      : pads.find(isEdgeTXRadio) ?? pads.find((p) => p.id === this.lastId) ?? pads[0] ?? null;
    if ((this.pad?.id ?? null) !== this.lastId || (this.pad?.index ?? null) !== this.lastIndex) {
      this.lastId = this.pad?.id ?? null;
      this.lastIndex = this.pad?.index ?? null;
      this.profile = this.pad
        ? restoreRadioProfile(this.pad, read(profileStorageKey(this.pad), null), read("radio." + this.pad.id, null))
        : defaults();
      this.bindings.reset();
      this.bindings.result = null;
      this.range = null;
      this.setup = null;
      if (this.source !== "keyboard") this.action("radioChanged");
    }
    this.raw = this.pad ? Array.from(this.pad.axes) : [];
    this.setup?.sample(this.raw);
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
    const out = this.usingRadio ? this.radioReady ? radioInput(this.raw, this.profile) : { roll: 0, pitch: 0, yaw: 0, throttle: 0 } : { ...k };
    const { events, assignment } = this.bindings.sample(this.pad, this.profile, this.usingRadio && !this.range && !this.setup);
    if (assignment) this.bindAction(assignment.action, assignment.binding);
    for (const event of events) {
      // Supply this frame's throttle, so arming never uses a stale low value.
      this.action(event, out);
      if (event === "menu" || event === "reset") break;
    }
    return out;
  }
  get usingRadio() {
    return this.source !== "keyboard" && !!this.pad;
  }
  get radioReady() {
    const axes = Object.values(this.profile.axes);
    return !this.setup && this.profile.supported !== false && new Set(axes.map((axis) => axis.index)).size === 4 && axes.every((axis) => Number.isFinite(this.raw[axis.index]));
  }
  calibrateCenter() {
    if (!this.pad) return false;
    if (this.setup) return false;
    for (const [axis, a] of Object.entries(this.profile.axes))
      if (axis !== "throttle") a.center = this.raw[a.index] ?? 0;
    this.save();
    return true;
  }
  calibrateRange() {
    if (!this.pad) return false;
    this.setup = null;
    this.bindings.reset();
    const start = performance.now();
    this.range = { start, end: start + 6000, min: [], max: [] };
    return true;
  }
}
