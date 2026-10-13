import test from "node:test";
import assert from "node:assert/strict";
import { radioGuideTarget, radioStickPositions } from "../web/input/radio-guide-state.js";

test("the Mode 2 centre guide keeps throttle down and the other three axes centred", () => {
  const guide = radioGuideTarget("centres", 500);
  assert.deepEqual(guide.pose, { throttle: 0, yaw: 0, pitch: 0, roll: 0 });
  assert.deepEqual(radioStickPositions(guide.pose), [[0, -1], [0, 0]]);
});

test("individual demonstrations move the correct stick axis and leave the others at rest", () => {
  for (const [axis, expected] of [["throttle", [[0, 1], [0, 0]]], ["yaw", [[1, -1], [0, 0]]], ["pitch", [[0, -1], [0, 1]]], ["roll", [[0, -1], [1, 0]]]]) {
    assert.deepEqual(radioStickPositions(radioGuideTarget(axis, 500).pose), expected, axis);
  }
  assert.deepEqual(radioStickPositions({ throttle: 0, yaw: -1, pitch: -1, roll: -1 }), [[-1, -1], [-1, -1]]);
});

test("endpoint guidance covers all four full ranges and follows the actual calibration countdown", () => {
  const range = { start: 1000, end: 7000 }, samples = [];
  for (let now = 1000; now <= 7000; now += 250) samples.push(radioGuideTarget("yaw", 0, range, now));
  for (const axis of ["yaw", "pitch", "roll", "throttle"]) {
    const values = samples.map(s => s.pose[axis]);
    assert.equal(Math.max(...values), 1, axis);
    assert.equal(Math.min(...values), axis === "throttle" ? 0 : -1, axis);
  }
  assert.equal(samples[0].mode, "range");
  assert.equal(samples[0].seconds, 6); assert.equal(samples.at(-1).seconds, 0);
});

test("stick detection demonstrates only the requested direction and starts from neutral", () => {
  for (const axis of ["yaw", "pitch", "roll", "throttle"]) {
    const values = Array.from({ length: 33 }, (_, i) => radioGuideTarget(axis, i * 150, null, 0, true).pose[axis]);
    assert.equal(values[0], 0);
    assert.equal(Math.min(...values), 0);
    assert.equal(Math.max(...values), 1);
  }
});
