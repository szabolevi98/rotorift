import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { loadCatalog } from "../server/catalog.js";
import { hoverThrottle } from "../shared/physics/propulsion.js";
import { measureRotation, measureCruise, measureRecovery, measureCoast } from "../scripts/measure-flight.mjs";

await RAPIER.init();
const { drones } = await loadCatalog();
for (const config of drones) {
  test(`${config.id}: both stick directions and all axes retain control at low, hover and full throttle`, () => {
    for (const throttle of [0.08, hoverThrottle(config), 1]) {
      for (const axis of ["roll", "pitch", "yaw"]) {
        for (const stick of [1, -1, 0.25]) {
          const r = measureRotation(config, axis, stick, throttle);
          const label = `${axis} stick=${stick} throttle=${throttle}`;
          assert.ok(Math.abs(r.steadyDegS / r.targetDegS - 1) < 0.035, `${label}: steady ${r.steadyDegS}`);
          assert.ok(r.peakDegS < r.targetDegS * 1.1, `${label}: overshoot ${r.peakDegS}`);
          assert.ok(r.response90S !== null && r.response90S < 0.25, `${label}: slow response ${r.response90S}`);
          assert.ok(r.brakeS !== null && r.brakeS < 0.3, `${label}: braking ${r.brakeS}`);
          assert.ok(r.residualDegS < 12, `${label}: keeps oscillating after release ${r.residualDegS}`);
          assert.ok(r.reboundDeg < 3, `${label}: reverse bounce ${r.reboundDeg}`);
          assert.ok(r.crossPeakDegS < 20, `${label}: unwanted cross-axis rotation ${r.crossPeakDegS}`);
          if (Math.abs(stick) === 1) assert.ok(r.fullTurnS !== null && r.fullTurnS < 0.7, `${label}: full turn ${r.fullTurnS}`);
        }
      }
    }
  });
  test(`${config.id}: Acro retains attitude and Angle/Horizon recover a 35-degree tilt`, () => {
    for (const mode of ["acro", "angle", "horizon"]) {
      const r = measureRecovery(config, mode);
      if (mode === "acro") {
        assert.equal(r.levelWithin2DegS, null);
        assert.ok(Math.abs(r.finalTiltDeg - 35) < 1);
      } else {
        assert.ok(r.levelWithin2DegS !== null && r.levelWithin2DegS < 0.6);
        assert.ok(r.finalTiltDeg < 0.5);
      }
    }
  });
  test(`${config.id}: the flight pipeline gives similar angular response at 120 and 240 Hz`, () => {
    for (const axis of ["roll", "pitch", "yaw"]) {
      const a = measureRotation(config, axis), b = measureRotation(config, axis, 1, hoverThrottle(config), 1 / 120);
      assert.ok(Math.abs(a.fullTurnS - b.fullTurnS) < 0.025, `${axis}: turn timing changes with frame rate`);
      assert.ok(Math.abs(a.steadyDegS - b.steadyDegS) < 15, `${axis}: rate changes with frame rate`);
      assert.ok(b.peakDegS < b.targetDegS * 1.1, `${axis}: unstable at 120 Hz`);
    }
  });
  test(`${config.id}: rotation is independent of altitude and distance from the world origin`, () => {
    for (const axis of ["roll", "pitch", "yaw"]) {
      const close = measureRotation(config, axis, 0.25, 1, 1 / 240, [0, 10, 0]);
      const far = measureRotation(config, axis, 0.25, 1, 1 / 240, [4000, 1000, -4000]);
      assert.ok(Math.abs(close.steadyDegS - far.steadyDegS) < 0.1, `${axis}: steady rate varies with world coordinates`);
      assert.ok(Math.abs(close.peakDegS - far.peakDegS) < 0.1, `${axis}: overshoot varies with world coordinates`);
      assert.ok(Math.abs(close.residualDegS - far.residualDegS) < 0.1, `${axis}: release jitter varies with world coordinates`);
    }
  });
}

test("category-specific acceleration, sustainable cruise and coasting distinguish the five aircraft", () => {
  const bands = { "rift-65": [70, 85], "rift-75": [85, 100], "rift-c3": [110, 130], "rift-x35": [145, 165], "rift-x5": [190, 205] };
  const measured = Object.fromEntries(drones.map(c => [c.id, { cruise: measureCruise(c), coast: measureCoast(c) }]));
  for (const c of drones) {
    const { cruise, coast } = measured[c.id], [low, high] = bands[c.id];
    assert.ok(cruise.horizontalKmh > low && cruise.horizontalKmh < high, `${c.id}: ${cruise.horizontalKmh} km/h`);
    assert.ok(Math.abs(cruise.verticalMps) < 0.3, `${c.id}: cruise test must be approximately level, not a dive`);
    assert.ok(cruise.settleDeltaKmh < 0.1, `${c.id}: speed must converge`);
    assert.ok(cruise.to50S > 0.1 && cruise.to50S < 0.6, `${c.id}: invalid acceleration ${cruise.to50S}`);
    assert.ok(coast.halfSpeedS > 0.2 && coast.halfSpeedS < 5);
  }
  assert.equal(measured["rift-65"].cruise.to100S, null);
  assert.ok(measured["rift-x5"].cruise.to100S < measured["rift-c3"].cruise.to100S);
  assert.ok(measured["rift-65"].coast.distanceM < measured["rift-c3"].coast.distanceM);
  assert.ok(measured["rift-c3"].coast.distanceM < measured["rift-x5"].coast.distanceM);
});
