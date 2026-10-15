import { RADIO_ACTIONS } from "./action-bindings.js";

export const RADIO_PRESETS = ["auto", "edgetx-classic", "edgetx-android", "edgetx-mobile-model", "mode2-gamepad", "custom"];
export const isEdgeTXRadio = (pad) => /radiomaster|edge.?tx|open.?tx|taranis|frsky.*joystick|(?:pocket|tx15|tx16s|boxer|zorro).*joystick/i.test(pad?.id ?? "");
export function inputLayout(userAgent = globalThis.navigator?.userAgent ?? "") {
  return /Android/i.test(userAgent) && /Chrome|Chromium|EdgA|SamsungBrowser/i.test(userAgent) ? "android-chromium" : "hid";
}
export const defaultProfile = () => ({
  deadzone: 0.015,
  actions: Object.fromEntries(RADIO_ACTIONS.map((action) => [action, null])),
  axes: {
    roll: { index: 0, invert: false, center: 0, min: -1, max: 1 },
    pitch: { index: 1, invert: false, center: 0, min: -1, max: 1 },
    yaw: { index: 3, invert: false, center: 0, min: -1, max: 1 },
    throttle: { index: 2, invert: false, center: 0, min: -1, max: 1 },
  },
});
// EdgeTX Classic exposes X/Y/Z/Rx/Ry/Rz. Chromium on Android aliases these
// in older releases; newer releases preserve Z as extra axis 4. Sources:
// https://github.com/EdgeTX/edgetx/blob/main/radio/src/usb_joystick.cpp
// https://github.com/chromium/chromium/blob/main/device/gamepad/android/java/src/org/chromium/device/gamepad/GamepadMappings.java
export function radioPreset(pad, preset = "auto", layout = inputLayout()) {
  const profile = defaultProfile();
  const selected = preset === "auto"
    ? isEdgeTXRadio(pad) ? layout === "android-chromium" ? "edgetx-android" : "edgetx-classic"
      : pad?.mapping === "standard" ? "mode2-gamepad" : "custom"
    : preset;
  if (selected === "edgetx-android") {
    profile.axes.yaw.index = 2;
    profile.axes.throttle.index = 4;
    profile.supported = (pad?.axes?.length ?? 0) >= 6;
  } else if (selected === "edgetx-mobile-model") {
    // Dedicated SIM model: CH1 Ail, CH2 Ele, CH3/4 Thr, CH5/6 Rud.
    // Duplicating Thr/Rud keeps all four controls after Android's HID aliases.
    profile.axes.throttle.index = 2;
    profile.axes.yaw.index = layout === "android-chromium" ? 3 : 5;
  } else if (selected === "mode2-gamepad") {
    profile.axes.roll.index = 2;
    profile.axes.pitch.index = 3;
    // Standard gamepads report right-stick forward as negative Y. Raw FPV
    // radios use the radio default instead of inheriting this convention.
    profile.axes.pitch.invert = true;
    profile.axes.yaw.index = 0;
    profile.axes.throttle.index = 1;
    profile.axes.throttle.invert = true;
  }
  return { ...profile, schema: 2, preset, detectedPreset: selected, layout };
}
export const profileStorageKey = (pad, layout = inputLayout()) =>
  `radio.v2.${layout}.${pad.mapping || "raw"}.${pad.axes.length}.${pad.id}`;

export function restoreRadioProfile(pad, saved, legacy, layout = inputLayout()) {
  const base = radioPreset(pad, "auto", layout);
  const valid = (profile) => profile && Object.keys(base.axes).every((name) => {
    const axis = profile.axes?.[name];
    return axis && Number.isInteger(axis.index) && axis.index >= 0 &&
      [axis.center, axis.min, axis.max].every(Number.isFinite) && axis.max > axis.min;
  });
  if (valid(saved)) {
    // Manual inversion/calibration marks the profile custom. Update only an
    // untouched named preset from the old pitch-inverted default, preserving
    // action bindings, deadzone and every deliberately customized mapping.
    if (RADIO_PRESETS.includes(saved.preset) && saved.preset !== "custom") {
      const recommended = radioPreset(pad, saved.preset, layout);
      const previousAxes = structuredClone(recommended.axes); previousAxes.pitch.invert = true;
      if (JSON.stringify(saved.axes) === JSON.stringify(previousAxes)) return { ...base, ...saved, axes: recommended.axes };
    }
    return { ...base, ...saved };
  }
  // Old profiles assumed browser indices equal radio channels. On Android,
  // discard that unversioned assumption while retaining action assignments.
  if (valid(legacy) && (!legacy.layout || legacy.layout === layout) &&
      !(layout === "android-chromium" && isEdgeTXRadio(pad) && !legacy.schema)) {
    const previousAxes = defaultProfile().axes; previousAxes.pitch.invert = true;
    const unchanged = JSON.stringify(legacy.axes) === JSON.stringify(previousAxes);
    if (!unchanged || legacy.preset === "custom") return { ...base, ...legacy, schema: 2, preset: "custom", layout };
  }
  if (legacy) {
    base.actions = { ...base.actions, ...legacy.actions };
    if (Number.isFinite(legacy.deadzone)) base.deadzone = Math.max(0, Math.min(0.2, legacy.deadzone));
  }
  return base;
}
