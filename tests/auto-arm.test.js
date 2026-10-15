import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoArm, AUTO_ARM_LOW, AUTO_ARM_RISE } from '../web/input/auto-arm.js';

const sample = (arm, throttle, state = {}) => arm.update({ throttle, armed: false, allowed: true, ...state });

test('auto arm defaults on and requires low throttle followed by a deliberate rise, once per start', () => {
  const arm = new AutoArm();
  assert.equal(arm.enabled, true);
  assert.equal(sample(arm, 0.8), false, 'a high stick on arrival never arms');
  assert.equal(sample(arm, 0), false, 'zero alone does not arm');
  assert.equal(sample(arm, 0.03), false, 'small endpoint noise does not arm');
  assert.equal(sample(arm, 0.15), true);
  assert.equal(sample(arm, 0), false);
  assert.equal(sample(arm, 0.5), false, 'one start gesture cannot rearm a later disarm');
});

test('threshold hysteresis tolerates endpoint noise without treating ordinary throttle as zero', () => {
  const arm = new AutoArm();
  for (const throttle of [0.04, 0.03, 0.08, 0.5]) assert.equal(sample(arm, throttle), false);
  assert.equal(sample(arm, AUTO_ARM_LOW), false);
  for (const throttle of [0.025, 0.035, 0.05]) assert.equal(sample(arm, throttle), false);
  assert.equal(sample(arm, AUTO_ARM_RISE), true);
});

test('pause, countdown, finished rooms and unavailable radio input discard the earlier zero sample', () => {
  for (const blocked of [{ allowed: false }, { ready: false }]) {
    const arm = new AutoArm();
    sample(arm, 0);
    assert.equal(sample(arm, 0, blocked), false);
    assert.equal(sample(arm, 0.5), false, 'a fabricated neutral input cannot authorize arming');
    assert.equal(sample(arm, 0), false);
    assert.equal(sample(arm, 0.1), true);
  }
});

test('reset and resume require a new low sample, while manual disarm and turtle suppress automatic arming', () => {
  for (const cancel of [arm => arm.cancel(), arm => sample(arm, 0, { turtle: true }), arm => sample(arm, 0, { armed: true })]) {
    const arm = new AutoArm();
    sample(arm, 0);cancel(arm);
    assert.equal(sample(arm, 0), false);
    assert.equal(sample(arm, 0.3), false);
    arm.reset();
    assert.equal(sample(arm, 0.3), false);
    assert.equal(sample(arm, 0), false);
    assert.equal(sample(arm, 0.3), true);
  }
});

test('the saved opt-out stays off through resets; enabling starts a fresh gesture', () => {
  const arm = new AutoArm(false);
  sample(arm, 0);assert.equal(sample(arm, 0.3), false);
  arm.reset();sample(arm, 0);assert.equal(sample(arm, 0.3), false);
  arm.setEnabled(true);
  assert.equal(sample(arm, 0.3), false);
  sample(arm, 0);assert.equal(sample(arm, 0.3), true);
  arm.setEnabled(false);sample(arm, 0);assert.equal(sample(arm, 0.3), false);
});

test('invalid or missing throttle samples do not preserve arming authorization', () => {
  for (const value of [undefined, null, NaN, Infinity, -1, 1.1]) {
    const arm = new AutoArm();sample(arm, 0);
    assert.equal(sample(arm, value), false);
    assert.equal(sample(arm, 0.3), false);
  }
});
