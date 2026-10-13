import test from "node:test";
import assert from "node:assert/strict";
import { Quaternion, Vector3 } from "three";
import { horizonSegments } from "../web/game/fpv-osd.js";
const attitude = (axis, degrees) => new Quaternion().setFromAxisAngle(new Vector3(...axis), degrees * Math.PI / 180);
test("the FPV horizon is level at rest and follows body pitch with the correct screen direction", () => {
  const level = horizonSegments(new Quaternion());
  assert.equal(level.length, 9); assert.ok(level.every(p => p.y === 64));
  const noseUp = horizonSegments(attitude([1,0,0], 10));
  const noseDown = horizonSegments(attitude([1,0,0], -10));
  assert.ok(noseUp.every(p => p.y === 79));
  assert.ok(noseDown.every(p => p.y === 49));
});
test("right bank tilts the horizon left; yaw does not change the displayed gravity reference", () => {
  const rightBank = attitude([0,0,1], -25), leftBank = attitude([0,0,1], 25);
  const right = horizonSegments(rightBank), left = horizonSegments(leftBank);
  assert.ok(right[0].y > right[8].y); assert.ok(left[0].y < left[8].y);
  for (const yaw of [-180,-90,0,90,180]) {
    const q = attitude([0,1,0], yaw).multiply(rightBank);
    assert.deepEqual(horizonSegments(q), right);
  }
});
test("full flips and combined extreme attitudes keep all nine OSD bars finite and inside the instrument", () => {
  for (let pitch = -180; pitch <= 180; pitch += 15) for (let roll = -180; roll <= 180; roll += 15) {
    const q = attitude([1,0,0], pitch).multiply(attitude([0,0,1], roll));
    for (const p of horizonSegments(q)) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.ok(p.x >= 28 && p.x <= 172 && p.y >= 4 && p.y <= 124);
    }
  }
});
