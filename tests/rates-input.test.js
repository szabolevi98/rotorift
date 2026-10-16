import test from "node:test";
import assert from "node:assert/strict";
import {
  actualRate,
  validRate,
  defaultRates,
} from "../shared/physics/rates.js";
import {
  Controller,
  radioInput,
  defaultProfile,
} from "../web/input/controller.js";

function inputEnvironment(t) {
  const descriptors = Object.fromEntries(
    ["window", "navigator", "localStorage"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const events = new Map();
  let pads = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: (name, fn) => events.set(name, fn),
      dispatchEvent: () => {},
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { getGamepads: () => pads },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => null, setItem: () => {} },
  });
  t.after(() => {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return { events, setPads: (value) => (pads = value) };
}

test('touch is a mobile-flight fallback only, yields to any detected pad and clears with controller input', t => {
  const env=inputEnvironment(t), c=new Controller(()=>{});
  c.touch={enabled:false,values:{roll:.2,pitch:-.4,yaw:.1,throttle:.3},
    setEnabled(value){if(value!==this.enabled){this.enabled=value;this.reset();}},
    reset(){this.values={roll:0,pitch:0,yaw:0,throttle:0};},sample(){return {...this.values};}};
  c.poll(.01,{touchEnabled:true}); assert.equal(c.usingTouch,true);
  c.touch.values={roll:.2,pitch:-.4,yaw:.1,throttle:.3};
  assert.deepEqual(c.poll(.01,{touchEnabled:true}),c.touch.values);
  c.clear();assert.equal(c.poll(.01,{touchEnabled:true}).throttle,0);
  env.setPads([{id:'Test USB radio',axes:[0,0,-1,0]}]);
  c.poll(.01,{touchEnabled:true});assert.equal(c.usingTouch,false);assert.equal(c.usingRadio,true);
  c.deviceId='Missing selected radio';
  c.poll(.01,{touchEnabled:true});assert.equal(c.usingRadio,false);assert.equal(c.usingTouch,false,'a different detected pad still prevents touch fallback');
  env.setPads([]);c.poll(.01,{touchEnabled:true});assert.equal(c.usingTouch,true);
  c.poll(.01);assert.equal(c.usingTouch,false,'desktop, menus and pauses disable touch');
});
test("keyboard throttle and smooth stick response are independent of render frequency", (t) => {
  inputEnvironment(t);
  const result = [];
  for (const hz of [60, 240]) {
    const c = new Controller(() => {});
    c.pressed.add("KeyW");
    c.pressed.add("ArrowUp");
    for (let i = 0; i < hz; i++) c.poll(1 / hz);
    result.push({ ...c.keyboard });
    c.clear();
    assert.deepEqual(c.keyboard, { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
  }
  for (const axis of ["roll", "pitch", "yaw", "throttle"])
    assert.ok(Math.abs(result[0][axis] - result[1][axis]) < 1e-12);
  assert.ok(Math.abs(result[0].throttle - 0.4) < 1e-12);
});
test("radio connection and loss emit one change action; forced keyboard remains active", (t) => {
  const env = inputEnvironment(t),
    actions = [],
    c = new Controller((action) => actions.push(action));
  c.poll(0.01);
  c.poll(0.01);
  assert.equal(actions.length, 0);
  env.setPads([{ id: "Test USB radio", axes: [0, 0, -1, 0] }]);
  c.poll(0.01);
  assert.equal(c.usingRadio, true);
  assert.deepEqual(actions, ["radioChanged"]);
  c.poll(0.01);
  assert.equal(actions.length, 1);
  env.setPads([]);
  c.poll(0.01);
  c.poll(0.01);
  assert.equal(c.usingRadio, false);
  assert.equal(actions.length, 2);
  c.source = "keyboard";
  env.setPads([{ id: "Test USB radio", axes: [1, 1, 1, 1] }]);
  assert.equal(c.poll(0.01).throttle, 0);
  assert.equal(actions.length, 2);
});

test("automatic device choice prefers RadioMaster; a selected missing device never falls through to another", (t) => {
  const env = inputEnvironment(t), c = new Controller(() => {});
  const xbox = { id: "Xbox 360 Controller", index: 0, mapping: "standard", axes: [0, 1, 0, 0] };
  const pocket = { id: "RadioMaster Pocket Joystick", index: 1, axes: [0, 0, -1, 0, 0, 0, 0, 0] };
  env.setPads([xbox, pocket]); c.poll(0.01);
  assert.equal(c.pad.id, pocket.id);
  c.deviceId = xbox.id; c.poll(0.01);
  assert.equal(c.pad.id, xbox.id);
  env.setPads([pocket]); c.poll(0.01);
  assert.equal(c.pad, null);
  assert.equal(c.usingRadio, false);
  c.deviceId = "auto"; c.poll(0.01);
  assert.equal(c.pad.id, pocket.id);
});
test("keyboard ramps through partial stick before full roll; either Shift gives fine control and release recenters", (t) => {
  inputEnvironment(t);
  for (const hz of [60, 240]) {
    const c = new Controller(() => {});
    c.pressed.add("ArrowRight");
    for (let i = 0; i < hz * 0.1; i++) c.poll(1 / hz);
    assert.ok(c.keyboard.roll > 0.4 && c.keyboard.roll < 0.5, "short presses need useful partial stick control");
    for (let i = 0; i < hz * 0.2; i++) c.poll(1 / hz);
    assert.equal(c.keyboard.roll, 1, "held keys must still reach full roll/pitch rates");
    for (const shift of ["ShiftLeft", "ShiftRight"]) {
      c.pressed.add(shift);
      for (let i = 0; i < hz * 0.2; i++) c.poll(1 / hz);
      assert.ok(Math.abs(c.keyboard.roll - 0.35) < 0.002);
      c.pressed.delete(shift);
    }
    c.pressed.clear();
    for (let i = 0; i < hz * 0.2; i++) c.poll(1 / hz);
    assert.ok(Math.abs(c.keyboard.roll) < 0.003, "release must promptly center the stick");
  }
});
test("keyboard yaw is gentler, reversal crosses neutral, and radio is not ramped or limited", (t) => {
  const env = inputEnvironment(t);
  for (const hz of [60, 240]) {
    const c = new Controller(() => {});
    c.pressed.add("KeyD");
    for (let i = 0; i < hz * 0.1; i++) c.poll(1 / hz);
    assert.ok(Math.abs(c.keyboard.yaw - 0.25) < 1e-12);
    for (let i = 0; i < hz * 0.2; i++) c.poll(1 / hz);
    assert.ok(Math.abs(c.keyboard.yaw - 0.75) < 1e-12);
    assert.ok(Math.abs(actualRate(c.keyboard.yaw) - 390) < 1e-9);
    c.pressed.delete("KeyD"); c.pressed.add("KeyA");
    c.poll(1 / hz);
    assert.ok(c.keyboard.yaw > 0, "reversal cannot jump from one endpoint to the other");
    c.pressed.clear();
    for (let i = 0; i < Math.ceil(hz * 0.08); i++) c.poll(1 / hz);
    assert.equal(c.keyboard.yaw, 0);
  }
  const c = new Controller(() => {});
  env.setPads([{ id: "Test USB radio", axes: [1, 1, -1, 1] }]);
  const input = c.poll(1 / 240);
  assert.equal(input.roll, 1); assert.equal(input.pitch, 1); assert.equal(input.yaw, 1);
});
test("Actual Rates endpoint, centre slope, expo and sign", () => {
  for (const expo of [0, 0.35, 1]) {
    const r = { center: 70, max: 670, expo };
    assert.equal(actualRate(1, r), 670);
    assert.equal(actualRate(-1, r), -670);
    assert.equal(actualRate(0, r), 0);
    assert.ok(Math.abs(actualRate(0.000001, r) / 0.000001 - 70) < 0.001);
    assert.equal(actualRate(-0.4, r), -actualRate(0.4, r));
  }
  assert.equal(actualRate(0.5, { center: 70, max: 670, expo: 0 }), 185);
  assert.equal(actualRate(0.5, { center: 70, max: 670, expo: 1 }), 44.375);
  assert.equal(actualRate(2), 670);
  assert.equal(validRate({ center: 700, max: 670, expo: 0 }), false);
  const a = defaultRates(),
    b = defaultRates();
  a.roll.max = 800;
  assert.equal(b.roll.max, 670);
  assert.equal(a.pitch.max, 670);
});
test("radio uses calibrated ranges, deadzone and channel inversion", () => {
  const p = defaultProfile();
  assert.deepEqual(radioInput([0, 0, -1, 0], p), {
    roll: 0,
    pitch: 0,
    yaw: 0,
    throttle: 0,
  });
  assert.deepEqual(radioInput([1, 1, 1, -1], p), {
    roll: 1,
    pitch: 1,
    yaw: -1,
    throttle: 1,
  });
  assert.equal(radioInput([0.01, 0, 0, 0], p).roll, 0);
  p.axes.roll = { index: 4, invert: false, min: -0.8, max: 0.7, center: 0.1 };
  assert.equal(radioInput([0, 0, 0, 0, 0.7], p).roll, 1);
  assert.equal(radioInput([0, 0, 0, 0, -0.8], p).roll, -1);
  p.axes.throttle.invert = true;
  assert.equal(radioInput([0, 0, 1, 0], p).throttle, 0);
  assert.equal(
    radioInput([], p).throttle,
    0,
    "missing throttle channels must stay at zero even when inverted",
  );
});
