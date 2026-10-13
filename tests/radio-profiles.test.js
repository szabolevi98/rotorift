import test from "node:test";
import assert from "node:assert/strict";
import { defaultProfile, inputLayout, isEdgeTXRadio, radioPreset, restoreRadioProfile, profileStorageKey } from "../web/input/radio-profiles.js";
import { radioInput, Controller } from "../web/input/controller.js";
import { StickSetup } from "../web/input/stick-setup.js";

const android = "Mozilla/5.0 (Linux; Android 15) Chrome/140.0.0.0";
const pocket = (axes = [0, 0, -1, 0, -1, -1, 0, 0]) => ({ id: "RadioMaster Pocket Joystick", axes, buttons: [] });
test("RadioMaster and EdgeTX names are detected without treating every gamepad as a radio", () => {
  for (const id of ["RadioMaster Pocket", "RadioMaster TX15", "RadioMaster TX16S Joystick", "EdgeTX Joystick", "OpenTX Joystick", "FrSky Taranis Joystick"])
    assert.equal(isEdgeTXRadio({ id }), true, id);
  for (const id of ["Xbox 360 Controller", "DualSense", "Joystick (Vendor: 0483 Product: 5710)"])
    assert.equal(isEdgeTXRadio({ id }), false, id);
  assert.equal(inputLayout(android), "android-chromium");
  assert.equal(inputLayout("Windows Chrome/140"), "hid");
  assert.equal(inputLayout("Android Firefox/140"), "hid");
});

test("EdgeTX AETR desktop default keeps switch channels out of the four flight sticks", () => {
  const profile = radioPreset(pocket(), "auto", "hid");
  assert.equal(profile.detectedPreset, "edgetx-classic");
  assert.deepEqual(radioInput([0, 0, -1, 0, -1, 1, 0, 0], profile), { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
  assert.equal(radioInput([0, 0, 1, 0, -1, -1, 0, 0], profile).throttle, 1);
});

test("new Android EdgeTX ordering uses Rx as yaw and preserved Z as throttle", () => {
  // Chromium exposes X,Y,Rx,Ry,Z,Rz, then remaining extra axes.
  const profile = radioPreset(pocket(), "auto", "android-chromium");
  assert.equal(profile.supported, true);
  assert.equal(profile.axes.yaw.index, 2);
  assert.equal(profile.axes.throttle.index, 4);
  assert.deepEqual(radioInput([0, 0, 0, 1, -1, -1, 0, 0], profile), { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
  assert.deepEqual(radioInput([1, -1, 1, -1, 1, 1, 0, 0], profile), { roll: 1, pitch: 1, yaw: 1, throttle: 1 });
});

test("legacy Android's missing Z is flagged instead of inventing an analogue throttle", () => {
  const profile = radioPreset(pocket([0, 0, 0, -1]), "auto", "android-chromium");
  assert.equal(profile.supported, false);
  assert.equal(profile.axes.throttle.index, 4);
});

test("Android-compatible SIM model keeps all controls through old and new aliasing", () => {
  const mobile = radioPreset(pocket(), "edgetx-mobile-model", "android-chromium");
  const desktop = radioPreset(pocket(), "edgetx-mobile-model", "hid");
  assert.deepEqual(radioInput([0.4, -0.6, 0.2, 0.7], mobile), radioInput([0.4, -0.6, 0.2, 0.2, 0.7, 0.7, 0, 0], desktop));
});

test("standard gamepad starts in Mode 2 rather than an RC channel order", () => {
  const profile = radioPreset({ id: "Xbox", mapping: "standard", axes: [0, 1, 0, 0] }, "auto", "hid");
  assert.deepEqual(radioInput([0, 1, 0, 0], profile), { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
  assert.deepEqual(radioInput([1, -1, 1, -1], profile), { roll: 1, pitch: 1, yaw: 1, throttle: 1 });
});

test("profiles are scoped by platform/layout, and a saved custom calibration wins", () => {
  const pad = pocket(), saved = radioPreset(pad, "custom", "hid");
  saved.axes.pitch.invert = false;
  saved.axes.pitch.center = 0.05;
  assert.notEqual(profileStorageKey(pad, "hid"), profileStorageKey(pad, "android-chromium"));
  assert.notEqual(profileStorageKey(pad, "hid"), profileStorageKey(pocket([0, 0, 0, 0]), "hid"));
  assert.deepEqual(restoreRadioProfile(pad, saved, null, "hid"), saved);
  assert.equal(restoreRadioProfile(pad, null, { ...saved, layout: "android-chromium" }, "hid").preset, "auto");
});

test("old Android index assumption is replaced while button assignments survive", () => {
  const old = defaultProfile();
  old.actions.arm = { type: "button", index: 0 };
  const profile = restoreRadioProfile(pocket(), null, old, "android-chromium");
  assert.equal(profile.axes.yaw.index, 2);
  assert.equal(profile.axes.throttle.index, 4);
  assert.deepEqual(profile.actions.arm, old.actions.arm);
  const desktopCustom = structuredClone(old);
  desktopCustom.axes.roll.index = 6;
  assert.equal(restoreRadioProfile(pocket(), null, desktopCustom, "hid").axes.roll.index, 6);
});

function move(setup, raw, index, end) {
  const start = raw[index];
  for (let i = 0; i <= 20; i++) { raw[index] = start + (end - start) * i / 20; setup.sample(raw); }
  raw[index] = start; setup.sample(raw);
}
test("four guided movements learn arbitrary channels, inversion and throttle endpoints", () => {
  const raw = [0, 0, 0, 0, 0, 0, 0, 1], setup = new StickSetup(raw);
  const axes = [[7, -1], [4, -1], [1, 1], [3, -1]];
  for (const [index, end] of axes) {
    move(setup, raw, index, end);
    assert.equal(setup.advance(raw), true);
  }
  assert.equal(setup.axis, null);
  const profile = { ...defaultProfile(), axes: setup.axes };
  assert.deepEqual(radioInput(raw, profile), { throttle: 0, yaw: 0, pitch: 0, roll: 0 });
  raw[7] = -1; raw[4] = -1; raw[1] = 1; raw[3] = -1;
  assert.deepEqual(radioInput(raw, profile), { throttle: 1, yaw: 1, pitch: 1, roll: 1 });
});

test("a binary switch and an already assigned stick cannot satisfy the next wizard step", () => {
  const raw = [0, 0, -1, 0, -1], setup = new StickSetup(raw);
  raw[4] = 1; setup.sample(raw); raw[4] = -1;
  assert.equal(setup.advance(raw), false);
  assert.equal(setup.error, "noAnalog");
  move(setup, raw, 2, 1); assert.equal(setup.advance(raw), true);
  move(setup, raw, 2, 1); assert.equal(setup.advance(raw), false);
  move(setup, raw, 3, 1); assert.equal(setup.advance(raw), true);
});

test("a wizard rejects both directions when it cannot infer inversion", () => {
  const raw = [0, 0, -1, 0], setup = new StickSetup(raw);
  move(setup, raw, 2, 1); setup.advance(raw);
  move(setup, raw, 3, 1); move(setup, raw, 3, -1);
  assert.equal(setup.advance(raw), false);
  assert.equal(setup.error, "oneDirection");
  move(setup, raw, 3, 1); assert.equal(setup.advance(raw), true);
});

test("reduced radio outputs are detected and scaled without creating another transmitter model", () => {
  const raw = [0, 0, 0, 0, -0.45, -1], setup = new StickSetup(raw);
  for (const [index, end] of [[4, 0.45], [2, -0.3], [1, 0.4], [0, 0.25]]) {
    move(setup, raw, index, end);
    assert.equal(setup.signal.state, "detected");
    assert.equal(setup.signal.index, index);
    assert.equal(setup.advance(raw), true);
  }
  const profile = { ...defaultProfile(), axes: setup.axes };
  raw[4] = 0.45; raw[2] = -0.3; raw[1] = 0.4; raw[0] = 0.25;
  assert.deepEqual(radioInput(raw, profile), { throttle: 1, yaw: 1, pitch: 1, roll: 1 });
});

test("live setup diagnostics distinguish absent, binary, reused and weak USB signals", () => {
  const raw = [0, 0, -1, 0, -1], setup = new StickSetup(raw);
  assert.equal(setup.signal.state, "waiting");
  for (const value of [0.005, 0.001, -0.01]) { raw[0] = value; setup.sample(raw); }
  assert.equal(setup.signal.state, "waiting", "stick noise is not a movement");
  raw[4] = 1; setup.sample(raw); raw[4] = -1; setup.sample(raw);
  assert.equal(setup.signal.state, "digital");
  assert.equal(setup.advance(raw), false);
  move(setup, raw, 2, 1); assert.equal(setup.advance(raw), true);
  move(setup, raw, 2, 1); assert.equal(setup.signal.state, "used");
  assert.equal(setup.advance(raw), false);
  setup.beginStep(raw);
  move(setup, raw, 3, 0.15); assert.equal(setup.signal.state, "weak");
  assert.equal(setup.advance(raw), false);
});

test("the live guide uses observed USB axes during setup rather than an unverified preset", () => {
  const raw = [0, 0, 0, 0, -0.5, -1], setup = new StickSetup(raw);
  move(setup, raw, 4, 0.5); setup.advance(raw);
  move(setup, raw, 2, -0.3);
  raw[2] = -0.3; setup.sample(raw);
  assert.deepEqual(radioInput(raw, { deadzone: 0.015, axes: setup.feedbackAxes }), { throttle: 0, yaw: 1 });
  assert.equal(setup.axes.yaw, undefined, "live feedback must not commit an incomplete profile");
  raw[2] = 0;
  assert.equal(radioInput(raw, { deadzone: 0.015, axes: setup.feedbackAxes }).yaw, 0);
});

test("noisy switch endpoints cannot imitate a reduced-range analogue stick", () => {
  const raw = [0, 0, -1, 0, -1], setup = new StickSetup(raw);
  for (const value of [-0.99, -0.96, -0.94, 0.94, 0.97, 1]) { raw[4] = value; setup.sample(raw); }
  assert.ok(setup.samples[4].bins.size >= 6, "there are many values, but no intermediate travel");
  assert.equal(setup.signal.state, "digital");
  assert.equal(setup.advance(raw), false);
});

test("invalid stored profiles fall back to the device default", () => {
  assert.equal(restoreRadioProfile(pocket(), { axes: {} }, { axes: null }, "hid").detectedPreset, "edgetx-classic");
});

test("Android missing channels neutralize input, and a complete learned profile replaces them", (t) => {
  const descriptors = Object.fromEntries(["window", "navigator", "localStorage"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const pad = pocket([0, 0, -1, 0]);
  Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener() {}, dispatchEvent() {} } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { userAgent: android, getGamepads: () => [pad] } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => null, setItem() {} } });
  t.after(() => { for (const [key, descriptor] of Object.entries(descriptors)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  const controller = new Controller(() => {});
  assert.deepEqual(controller.poll(0.01), { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
  assert.equal(controller.radioReady, false);
  controller.startStickSetup();
  for (const [index, end] of [[2, 1], [3, 1], [1, -1], [0, 1]]) {
    move(controller.setup, pad.axes, index, end);
    controller.poll(0.01);
    assert.equal(controller.advanceStickSetup(), true);
  }
  assert.equal(controller.radioReady, true);
  assert.equal(controller.profile.preset, "custom");
  assert.equal(controller.profile.supported, true);
});
