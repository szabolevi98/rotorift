import test from "node:test";
import assert from "node:assert/strict";
import { Controller, defaultProfile } from "../web/input/controller.js";
import { ActionBindings, availableBindings, bindingKey, parseBinding } from "../web/input/action-bindings.js";

const button = (pressed) => ({ pressed, value: pressed ? 1 : 0 });
const pad = () => ({ id: "USB radio", axes: [0, 0, -1, 0, -1], buttons: [button(false), button(false)] });
const profile = () => ({ ...defaultProfile(), actions: { arm: { type: "button", index: 0 } } });

test('AUX turtle switch emits explicit on/off, suppresses held-on reconnect, and preserves its binding',t=>{
  const state=new ActionBindings(),p=pad(),config=profile();
  config.actions.turtle={type:'axis',index:4,direction:1};
  p.axes[4]=1;assert.deepEqual(state.sample(p,config,true).events,[]);
  p.axes[4]=-1;assert.deepEqual(state.sample(p,config,true).events,['turtleOff']);
  p.axes[4]=1;assert.deepEqual(state.sample(p,config,true).events,['turtleOn']);
  assert.deepEqual(state.sample(p,config,true).events,[]);
  const env=environment(t),c=new Controller(()=>{});env.setPads([p]);c.poll(.01);
  assert.ok(c.bindAction('turtle',config.actions.turtle));
  const restored=new Controller(()=>{});restored.poll(.01);
  assert.deepEqual(restored.profile.actions.turtle,config.actions.turtle);
});

test("held buttons are suppressed on connect/reset; one action per press, no repeats", () => {
  const state = new ActionBindings(), p = pad(), config = profile();
  p.buttons[0] = button(true);
  assert.deepEqual(state.sample(p, config, true).events, []);
  assert.deepEqual(state.sample(p, config, true).events, []);
  p.buttons[0] = button(false);
  state.sample(p, config, true);
  p.buttons[0] = button(true);
  assert.deepEqual(state.sample(p, config, true).events, ["arm"]);
  assert.deepEqual(state.sample(p, config, true).events, []);
  state.reset();
  assert.deepEqual(state.sample(p, config, true).events, []);
});

test("AUX arm is an on/off switch with hysteresis, and held on never auto-arms", () => {
  const state = new ActionBindings(), p = pad(), config = profile();
  config.actions.arm = { type: "axis", index: 4, direction: 1 };
  p.axes[4] = 1;
  assert.deepEqual(state.sample(p, config, true).events, []);
  p.axes[4] = -1;
  assert.deepEqual(state.sample(p, config, true).events, ["armOff"]);
  p.axes[4] = 1;
  assert.deepEqual(state.sample(p, config, true).events, ["armOn"]);
  for (const value of [0.69, 0.71, 0.4]) {
    p.axes[4] = value;
    assert.deepEqual(state.sample(p, config, true).events, []);
  }
  p.axes[4] = 0.3;
  assert.deepEqual(state.sample(p, config, true).events, ["armOff"]);
  p.axes[4] = 0.4;
  assert.deepEqual(state.sample(p, config, true).events, []);
});

test("flight axes cannot become action controls, including after a stick remap", () => {
  const p = pad(), config = profile(), state = new ActionBindings();
  assert.deepEqual(availableBindings(p, config).map(bindingKey), ["button:0", "button:1", "axis:4:1", "axis:4:-1"]);
  config.actions.arm = { type: "axis", index: 4, direction: 1 };
  state.sample(p, config, true);
  config.axes.roll.index = 4;
  p.axes[4] = 1;
  assert.deepEqual(state.sample(p, config, true).events, []);
  assert.equal(parseBinding("bad"), null);
  assert.deepEqual(parseBinding("axis:4:-1"), { type: "axis", index: 4, direction: -1 });
});

test("learning ignores held inputs and flight sticks, assigns a fresh control without firing it", () => {
  const state = new ActionBindings(), p = pad(), config = profile();
  p.buttons[0] = button(true);
  state.listen("arm", p, config, 0);
  p.axes[0] = 1;
  assert.deepEqual(state.sample(p, config, true, 1), { events: [] });
  p.buttons[0] = button(false);
  state.sample(p, config, true, 2);
  p.buttons[0] = button(true);
  assert.deepEqual(state.sample(p, config, true, 3), {
    events: [], assignment: { action: "arm", binding: { type: "button", index: 0 } },
  });
  assert.equal(state.result, "saved");
  assert.deepEqual(state.sample(p, config, true, 4).events, []);
});

test("AUX learning detects either end, can be cancelled or time out safely", () => {
  const state = new ActionBindings(), p = pad(), config = profile();
  p.axes[4] = 0;
  state.listen("view", p, config, 0);
  p.axes[4] = -1;
  assert.deepEqual(state.sample(p, config, true, 1).assignment, {
    action: "view", binding: { type: "axis", index: 4, direction: -1 },
  });
  state.listen("arm", p, config, 100);
  assert.deepEqual(state.sample(p, config, true, 12100).events, []);
  assert.equal(state.capture, null);
  assert.equal(state.result, "timeout");
  state.listen("arm", p, config, 13000);
  state.reset();
  assert.equal(state.capture, null);
});

function environment(t) {
  const descriptors = Object.fromEntries(["window", "navigator", "localStorage"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const storage = new Map();
  let pads = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener() {}, dispatchEvent() {} } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { getGamepads: () => pads } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } });
  t.after(() => { for (const [key, descriptor] of Object.entries(descriptors)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  } });
  return { setPads(value) { pads = value; }, storage };
}

test("controller supplies same-frame throttle to action and persists bindings per device", (t) => {
  const env = environment(t), p = pad(), calls = [], c = new Controller((kind, input) => calls.push({ kind, input }));
  env.setPads([p]);
  c.poll(0.01);
  assert.equal(c.bindAction("arm", { type: "button", index: 0 }), true);
  c.poll(0.01);
  p.axes[2] = 1; p.buttons[0] = button(true);
  c.poll(0.01);
  assert.equal(calls.at(-1).kind, "arm");
  assert.equal(calls.at(-1).input.throttle, 1);
  const replacement = new Controller(() => {});
  replacement.poll(0.01);
  assert.deepEqual(replacement.profile.actions.arm, { type: "button", index: 0 });
  env.setPads([{ ...pad(), id: "Other radio" }]);
  replacement.poll(0.01);
  assert.equal(replacement.profile.actions.arm, null);
});

test("keyboard source, calibration, reconnect and resume never activate held radio controls", (t) => {
  const env = environment(t), p = pad(), calls = [], c = new Controller((kind) => calls.push(kind));
  env.setPads([p]); c.poll(0.01);
  c.bindAction("arm", { type: "button", index: 0 });
  c.source = "keyboard"; c.poll(0.01);
  p.buttons[0] = button(true); c.poll(0.01);
  c.source = "auto"; c.poll(0.01);
  assert.deepEqual(calls, ["radioChanged"]);
  p.buttons[0] = button(false); c.poll(0.01);
  c.calibrateRange(); p.buttons[0] = button(true); c.poll(0.01);
  c.range = null; c.poll(0.01);
  assert.deepEqual(calls, ["radioChanged"]);
  env.setPads([]); c.poll(0.01); env.setPads([p]); c.poll(0.01);
  c.bindings.reset(); c.poll(0.01);
  assert.equal(calls.filter((kind) => kind === "arm").length, 0);
  p.buttons[0] = button(false); c.poll(0.01); p.buttons[0] = button(true); c.poll(0.01);
  assert.equal(calls.filter((kind) => kind === "arm").length, 1);
});

test("assigning an already used control removes its other action; flight channels rejected", (t) => {
  const env = environment(t), c = new Controller(() => {});
  env.setPads([pad()]); c.poll(0.01);
  c.bindAction("arm", { type: "button", index: 0 });
  c.bindAction("reset", { type: "button", index: 0 });
  assert.equal(c.profile.actions.arm, null);
  assert.equal(c.profile.actions.reset.index, 0);
  assert.equal(c.bindAction("arm", { type: "axis", index: 2, direction: 1 }), false);
  c.bindAction("reset", null);
  assert.equal(c.profile.actions.reset, null);
});

test("replacement at another gamepad index cancels calibration and suppresses held controls", (t) => {
  const env = environment(t), calls = [], c = new Controller((kind) => calls.push(kind));
  const first = { ...pad(), index: 0 }, second = { ...pad(), index: 1 };
  env.setPads([first]); c.poll(0.01);
  c.bindAction("arm", { type: "button", index: 0 }); c.poll(0.01);
  c.calibrateRange();
  second.buttons[0] = button(true);
  env.setPads([second]); c.poll(0.01);
  assert.equal(c.range, null);
  assert.deepEqual(calls, ["radioChanged", "radioChanged"]);
});

test("legacy calibrated radio profiles gain bindings without losing calibration", (t) => {
  const env = environment(t), legacy = defaultProfile();
  delete legacy.actions;
  legacy.axes.throttle = { index: 1, invert: true, center: 0, min: -0.8, max: 0.9 };
  env.storage.set("rotorift.radio.USB radio", JSON.stringify(legacy));
  env.setPads([pad()]);
  const c = new Controller(() => {});
  c.poll(0.01);
  c.bindAction("arm", { type: "button", index: 1 });
  const stored = JSON.parse(env.storage.get("rotorift.radio.USB radio"));
  assert.deepEqual(stored.axes, legacy.axes);
  assert.deepEqual(stored.actions.arm, { type: "button", index: 1 });
});
