import test from "node:test";
import assert from "node:assert/strict";
import { armPrompt } from "../web/game/arm-prompt.js";

const t = (key, values = {}) => key + (values.control ? ":" + values.control : "");
const keyboard = { armed: false, canArm: true, radio: false, lowThrottle: true, control: "Space" };

test("the ARM invitation hides while armed or when a room does not allow arming", () => {
  assert.equal(armPrompt({ ...keyboard, armed: true }, t), null);
  assert.equal(armPrompt({ ...keyboard, canArm: false }, t), null);
  assert.equal(armPrompt(keyboard, t).title, "hud.pressToArm:Space");
  assert.equal(armPrompt({ ...keyboard, control: "T" }, t).title, "hud.pressToArm:T");
});

test("ARM instructions follow the real input source and never invent an unassigned radio button", () => {
  const radio = { ...keyboard, radio: true, radioReady: true, control: "Button 4", binding: { type: "button", index: 3 } };
  assert.equal(armPrompt(radio, t).title, "hud.pressToArm:Button 4");
  assert.equal(armPrompt({ ...radio, control: "CH 6 +", binding: { type: "axis", index: 5, direction: 1 } }, t).title, "hud.switchToArm:CH 6 +");
  assert.equal(armPrompt({ ...radio, binding: null }, t).title, "hud.screenToArm");
  assert.equal(armPrompt({ ...radio, mobile: true }, t).title, "hud.screenToArm");
  assert.equal(armPrompt({ ...keyboard, mobile: true }, t).title, "hud.screenToArm");
  assert.equal(armPrompt({ ...radio, radioReady: false }, t).title, "hud.armRadioUnavailable");
});

test("lowering throttle comes before the ARM shortcut when throttle is too high", () => {
  assert.deepEqual(armPrompt({ ...keyboard, lowThrottle: false }, t), {
    title: "hud.lowThrottle", detail: "hud.pressToArm:Space",
  });
});

test('automatic arming explains the throttle gesture and still prioritizes missing radio setup', () => {
  const auto = { ...keyboard, autoArm: true, throttleControl: 'W' };
  assert.deepEqual(armPrompt(auto, t), { title: 'hud.autoArmOn', detail: 'hud.autoArmKeyboard:W' });
  assert.equal(armPrompt({ ...auto, mobile: true }, t).detail, 'hud.autoArmTouch');
  const radio = { ...auto, radio: true, radioReady: true };
  assert.equal(armPrompt(radio, t).detail, 'hud.autoArmLower');
  assert.equal(armPrompt({ ...radio, autoArmReady: true }, t).detail, 'hud.autoArmRaise');
  assert.equal(armPrompt({ ...radio, radioReady: false }, t).title, 'hud.armRadioUnavailable');
  assert.equal(armPrompt({ ...auto, autoArm: false }, t).title, 'hud.pressToArm:Space');
  assert.equal(armPrompt({ ...auto, armed: true }, t), null);
  assert.equal(armPrompt({ ...auto, canArm: false }, t), null);
});
