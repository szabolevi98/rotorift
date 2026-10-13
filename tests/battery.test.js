import test from "node:test";
import assert from "node:assert/strict";
import { loadCatalog } from "../server/catalog.js";
import { validateDrone } from "../shared/physics/config.js";
import { FlightEffects } from "../shared/physics/flight-effects.js";
import { batteryCurrent, openCircuitCellVoltage } from "../shared/physics/battery.js";
import { motorThrustLimit } from "../shared/physics/propulsion.js";
const { drones } = await loadCatalog(), q = { x: 0, y: 0, z: 0, w: 1 };
const advance = (effects, seconds, armed, thrust, dt = 1 / 240) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) effects.update(dt, armed, thrust, [0,0,0], q);
};

test("LiPo/LiHV curves retain the plateau, empty knee and configured full voltage", () => {
  for (const full of [4.2, 4.35]) {
    assert.equal(openCircuitCellVoltage(1, full), full);
    assert.equal(openCircuitCellVoltage(0, full), 3.15);
    assert.equal(openCircuitCellVoltage(0.5, full), 3.82);
    assert.ok(openCircuitCellVoltage(0.08, full) - openCircuitCellVoltage(0, full) > 0.3);
    for (let i = 0; i < 100; i++) assert.ok(openCircuitCellVoltage(i / 100, full) <= openCircuitCellVoltage((i + 1) / 100, full));
  }
});
for (const c of drones) {
  test(`${c.id}: coulomb counting follows actual motor load and heavier flying consumes more`, () => {
    const max = motorThrustLimit(c), medium = Array(4).fill(max * 0.4), full = Array(4).fill(max);
    const effects = new FlightEffects(c, { battery: true });
    const current = batteryCurrent(c, true, medium);
    advance(effects, 2, true, medium);
    assert.ok(Math.abs(effects.usedMah - current * 2 / 3.6) < 1e-8);
    assert.ok(batteryCurrent(c, true, full) > current * 2);
    assert.equal(batteryCurrent(c, false, full), 0);
    assert.ok(effects.telemetry.remainingSeconds > 0);
    const used = effects.usedMah, charge = effects.charge;
    advance(effects, 2, false, [0,0,0,0]);
    assert.equal(effects.usedMah, used); assert.equal(effects.charge, charge);
    assert.equal(effects.telemetry.remainingSeconds, null);
  });
  test(`${c.id}: a throttle burst causes sag and slow recovery, without recharging or triggering LAND NOW`, () => {
    const effects = new FlightEffects(c, { battery: true }), full = Array(4).fill(motorThrustLimit(c));
    const resting = effects.voltage;
    advance(effects, 0.5, true, full);
    const loaded = effects.voltage, used = effects.usedMah;
    assert.ok(loaded < resting - 0.15);
    assert.equal(effects.batteryState, "normal", "a fresh pack must tolerate a short burst");
    advance(effects, 1 / 240, false, [0,0,0,0]);
    const released = effects.voltage;
    assert.ok(released > loaded);
    advance(effects, 8, false, [0,0,0,0]);
    assert.ok(effects.voltage > released, "polarization recovers after the instantaneous ohmic recovery");
    assert.equal(effects.usedMah, used);
    assert.ok(effects.charge < 1);
    assert.ok(Math.abs(effects.telemetry.cellVoltage * c.battery.cells - effects.voltage) < 1e-9);
  });
  test(`${c.id}: low, reserve and exhaustion warnings preserve the pack state until reset`, () => {
    const effects = new FlightEffects(c, { battery: true }), hover = Array(4).fill(c.massKg * 9.81 / 4);
    effects.usedMah = c.battery.capacityMah * 0.81;
    advance(effects, 0.1, true, hover);
    assert.equal(effects.batteryState, "low");
    effects.usedMah = c.battery.capacityMah * 0.95;
    advance(effects, 0.1, true, hover);
    assert.equal(effects.batteryState, "critical"); assert.ok(effects.throttleLimit < 0.58);
    advance(effects, 5, false, [0,0,0,0]);
    assert.equal(effects.batteryState, "critical");
    effects.usedMah = c.battery.capacityMah;
    advance(effects, 2.1, true, hover);
    assert.equal(effects.powerFactor, 0); assert.equal(effects.throttleLimit, 0);
    assert.equal(effects.telemetry.remainingSeconds, 0);
    effects.reset();
    assert.equal(effects.voltage, c.battery.cells * c.battery.fullCellVoltage);
    assert.equal(effects.usedMah, 0); assert.equal(effects.polarizationV, 0); assert.equal(effects.powerFactor, 1);
    effects.setOptions({ battery: false });
    advance(effects, 10, true, hover);
    assert.equal(effects.usedMah, 0); assert.equal(effects.powerFactor, 1); assert.equal(effects.throttleLimit, 1);
  });
  test(`${c.id}: battery behavior is consistent at 30, 120 and 240 updates per second`, () => {
    const measured = [30,120,240].map(hz => {
      const effects = new FlightEffects(c, { battery: true }), full = Array(4).fill(motorThrustLimit(c));
      advance(effects, 5, true, full, 1 / hz);
      advance(effects, 3, false, [0,0,0,0], 1 / hz);
      return effects.telemetry;
    });
    for (const state of measured) {
      assert.ok(Math.abs(state.usedMah - measured[0].usedMah) < 0.001);
      assert.ok(Math.abs(state.voltage - measured[0].voltage) < 0.01);
      assert.equal(state.batteryState, measured[0].batteryState);
    }
  });
}
test("invalid battery tuning is rejected before flight", () => {
  for (const [field, value] of [["linearCurrentFraction", -1], ["linearCurrentFraction", 2], ["polarizationOhm", 0], ["recoverySeconds", NaN], ["reserveFraction", 0]]) {
    const c = structuredClone(drones[0]); c.simulation.battery[field] = value;
    assert.throws(() => validateDrone(c));
  }
  const c = structuredClone(drones[0]); c.battery.fullCellVoltage = 5;
  assert.throws(() => validateDrone(c));
});
test("an already-loaded older catalog still produces finite battery telemetry", () => {
  const c = structuredClone(drones[0]); delete c.battery.fullCellVoltage;
  for (const key of ["linearCurrentFraction", "polarizationOhm", "recoverySeconds", "reserveFraction"]) delete c.simulation.battery[key];
  const effects = new FlightEffects(c, { battery: true });
  advance(effects, 2, true, Array(4).fill(c.massKg * 9.81 / 4));
  for (const key of ["charge", "voltage", "cellVoltage", "currentA", "remainingSeconds", "throttleLimit"]) assert.ok(Number.isFinite(effects.telemetry[key]), key);
});
