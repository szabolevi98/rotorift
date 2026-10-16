import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchSticks } from '../web/input/touch-sticks.js';
import { AutoArm } from '../web/input/auto-arm.js';

const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
function setup(size = 200) {
  const classes = () => {
    const set = new Set();
    return { add: key => set.add(key), remove: key => set.delete(key),
      toggle: (key, value) => value ? set.add(key) : set.delete(key), contains: key => set.has(key) };
  };
  const pad = () => {
    const events = new Map(), captured = new Set();
    return { classList: classes(), addEventListener: (name, fn) => events.set(name, fn),
      getBoundingClientRect: () => ({ width: size, height: size }),
      setPointerCapture: id => captured.add(id), hasPointerCapture: id => captured.has(id),
      releasePointerCapture(id) { captured.delete(id); this.send('lostpointercapture', id); },
      send(name, id, x = 100, y = 100, pointerType = 'touch') {
        events.get(name)?.({ pointerId: id, clientX: x, clientY: y, pointerType, preventDefault() {} });
      },
    };
  };
  const pads = [pad(), pad()], hud = { classList: classes() }, events = new Map();
  const sticks = new TouchSticks({ querySelectorAll: () => pads }, hud, { addEventListener: (name, fn) => events.set(name, fn) });
  sticks.setEnabled(true);
  return { sticks, left: pads[0], right: pads[1], hud, events, travel: size * .38 };
}

test('two independent fingers control all Mode 2 axes; touching alone cannot auto-arm', () => {
  const { sticks, left, right, travel } = setup(), auto = new AutoArm();
  auto.update({ throttle: 0, armed: false, allowed: true });
  left.send('pointerdown', 1); right.send('pointerdown', 2);
  assert.deepEqual(sticks.sample(), neutral);
  assert.equal(auto.update({ ...sticks.sample(), armed: false, allowed: true }), false);
  left.send('pointermove', 1, 100 + travel / 2, 100 - travel);
  right.send('pointermove', 2, 100 - travel, 100 + travel / 2);
  assert.deepEqual(sticks.sample(), { throttle: .5, yaw: .5, roll: -1, pitch: -.5 });
  assert.equal(auto.update({ ...sticks.sample(), armed: false, allowed: true }), true);
  left.send('pointerup', 1);
  assert.deepEqual(sticks.sample(), { throttle: .5, yaw: 0, roll: -1, pitch: -.5 });
  right.send('pointerup', 2);
  assert.deepEqual(sticks.sample(), { ...neutral, throttle: .5 });
  left.send('pointerdown', 3, 50, 150);
  assert.equal(sticks.sample().throttle, .5, 're-touch holds the current throttle');
  left.send('pointermove', 3, 50, 150 + travel);
  assert.equal(sticks.sample().throttle, 0);
});

test('screen-size scaling, endpoints and pointer capture work outside the visible pad', () => {
  for (const size of [144, 170, 210]) {
    const { sticks, left, right } = setup(size);
    left.send('pointerdown', 1); right.send('pointerdown', 2);
    left.send('pointermove', 1, 10000, -10000);
    right.send('pointermove', 2, -10000, 10000);
    assert.deepEqual(sticks.sample(), { throttle: 1, yaw: 1, roll: -1, pitch: -1 });
    left.send('pointermove', 1, -10000, 10000);
    assert.equal(sticks.sample().throttle, 0);
    assert.equal(left.hasPointerCapture(1), true);
  }
});

test('third fingers cannot steal sticks or release another pointer', () => {
  const { sticks, left, travel } = setup();
  left.send('pointerdown', 1); left.send('pointerdown', 3);
  left.send('pointermove', 3, 100 + travel, 0); left.send('pointerup', 3);
  assert.deepEqual(sticks.sample(), neutral);
  left.send('pointermove', 1, 100, 100 - travel);
  assert.equal(sticks.sample().throttle, .5);
});

for (const interrupt of ['pointercancel', 'lostpointercapture', 'resize', 'disable', 'reset']) test(`${interrupt} clears latched throttle and both fingers`, () => {
  const { sticks, left, right, events, hud, travel } = setup();
  left.send('pointerdown', 1); right.send('pointerdown', 2);
  left.send('pointermove', 1, 100, 100 - travel); right.send('pointermove', 2, 100 + travel, 100);
  if (interrupt === 'resize') events.get('resize')();
  else if (interrupt === 'disable') sticks.setEnabled(false);
  else if (interrupt === 'reset') sticks.reset();
  else left.send(interrupt, 1);
  assert.deepEqual(sticks.sample(), neutral);
  assert.equal(left.hasPointerCapture(1), false); assert.equal(right.hasPointerCapture(2), false);
  right.send('pointermove', 2, -1000, -1000);
  assert.deepEqual(sticks.sample(), neutral);
  if (interrupt === 'disable') {
    assert.equal(hud.classList.contains('touch-controls'), false);
    left.send('pointerdown', 3); left.send('pointermove', 3, 0, 0);
    assert.deepEqual(sticks.sample(), neutral);
  }
});
