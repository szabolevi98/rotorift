import { windVelocity } from './wind.js';
import { clamp, rotate, inverse } from "./math.js";
import { hoverThrottle } from "./propulsion.js";
import { normalizeSimulation } from "../simulation/options.js";
import { batteryCurrent, openCircuitCellVoltage } from "./battery.js";
import { PropellerDamage } from "./propellers.js";

// Initial estimates live in each aircraft config; these effects supplement the
// normal flight controller rather than modifying its rate settings.
export class FlightEffects {
  constructor(config, options) {
    this.config = config;
    // Also tolerate a catalog already loaded by an older running local server.
    this.fullCellVoltage = config.battery.fullCellVoltage ?? 4.2;
    this.batteryTuning = { polarizationOhm: config.simulation.battery.resistanceOhm * 0.35,
      recoverySeconds: 3, reserveFraction: 0.07, ...config.simulation.battery };
    this.options = normalizeSimulation(options);
    this.propellers = new PropellerDamage(config);
    this.reset();
  }
  reset() {
    this.time = 0;
    this.resetBattery();
    this.propellers.reset();
    this.wash = 0;
  }
  resetBattery() {
    this.usedMah = 0;
    this.charge = 1;
    this.voltage = this.filteredVoltage = this.config.battery.cells * this.fullCellVoltage;
    this.currentA = 0;
    this.averageCurrentA = 0;
    this.polarizationV = 0;
    this.emptySeconds = 0;
    this.lowSeconds = 0;
    this.remainingSeconds = null;
    this.batteryState = "normal";
    this.criticalSeconds = 0;
    this.throttleLimit = 1;
    this.powerFactor = 1;
  }
  setOptions(options) {
    const next = normalizeSimulation(options);
    if (next.battery !== this.options.battery) {
      this.resetBattery();
    }
    this.options = next;
    if (!next.propDamage) this.propellers.reset();
    if (!next.propwash) this.wash = 0;
  }
  update(dt, armed, motorThrust, velocity, quaternion) {
    this.time += dt;
    const c = this.config;
    if (this.options.battery) {
      const battery = this.batteryTuning;
      this.currentA = batteryCurrent(c, armed, motorThrust);
      this.usedMah = Math.min(c.battery.capacityMah, this.usedMah + this.currentA * dt / 3.6);
      this.charge = Math.max(0, 1 - this.usedMah / c.battery.capacityMah);
      const cell = openCircuitCellVoltage(this.charge, this.fullCellVoltage);
      const resistance = battery.resistanceOhm * (1 + 1.5 * (1 - this.charge) ** 2);
      // One RC branch stores polarization sag; it decays after load removal.
      this.polarizationV += (this.currentA * battery.polarizationOhm - this.polarizationV) * (1 - Math.exp(-dt / battery.recoverySeconds));
      this.voltage = Math.max(c.battery.cells * 2.8, cell * c.battery.cells - this.currentA * resistance - this.polarizationV);
      this.filteredVoltage += (this.voltage - this.filteredVoltage) * (1 - Math.exp(-dt / 0.6));
      const filteredCell = this.filteredVoltage / c.battery.cells;
      this.lowSeconds = armed && filteredCell < 3.5 ? this.lowSeconds + dt : 0;
      this.criticalSeconds = armed && filteredCell < 3.15 ? this.criticalSeconds + dt : 0;
      if (this.charge <= battery.reserveFraction || this.criticalSeconds >= 2) this.batteryState = "critical";
      else if (this.batteryState !== "critical" && (this.charge <= 0.2 || this.lowSeconds >= 1.5)) this.batteryState = "low";
      // Warnings stay latched until a fresh pack/reset; sag recovery is not charging.
      const voltagePower = clamp((this.voltage / c.battery.nominalVoltage) ** 2, 0.25, 1.35);
      this.emptySeconds = this.charge === 0 ? this.emptySeconds + dt : 0;
      const targetPower = voltagePower * clamp(1 - this.emptySeconds / 2, 0, 1);
      this.powerFactor += (targetPower - this.powerFactor) * (1 - Math.exp(-dt / 0.05));
      const hover = hoverThrottle(c) / voltagePower ** (1 / c.motor.thrustExponent);
      this.throttleLimit = this.batteryState === "critical" ? clamp(hover * (0.78 + 0.27 * clamp(this.charge / battery.reserveFraction, 0, 1)) + 0.015, 0, 0.58) : 1;
      if (this.emptySeconds >= 2) { this.powerFactor = 0; this.throttleLimit = 0; }
      if (armed) {
        if (this.averageCurrentA === 0) this.averageCurrentA = this.currentA;
        else this.averageCurrentA += (this.currentA - this.averageCurrentA) * (1 - Math.exp(-dt / 5));
      }
      this.remainingSeconds = armed && this.averageCurrentA > 0.1 ? Math.max(0, this.charge - battery.reserveFraction) * c.battery.capacityMah * 3.6 / this.averageCurrentA : null;
    }
    const localVelocity = rotate(velocity, inverse(quaternion));
    // Re-entering the rotor wake during a powered, near-vertical descent.
    const descent = Math.max(0, -localVelocity[1]), sideways = Math.hypot(localVelocity[0], localVelocity[2]);
    const target = this.options.propwash && armed ? clamp((descent - 1.5) / 5, 0, 1) * Math.exp(-sideways / 3) : 0;
    this.wash += (target - this.wash) * (1 - Math.exp(-dt / 0.08));
  }
  motorEfficiency(index) {
    const efficiency = this.options.propDamage ? this.propellers.efficiency(index,this.time) : 1;
    const turbulence = this.wash * this.config.simulation.propwashStrength * (0.55 + 0.45 * Math.sin(this.time * 91 + index * 2.3));
    return efficiency * clamp(1 - turbulence, 0.1, 1);
  }
  impact(index, speed, contactAngle, rotating) {
    if (this.options.propDamage) this.propellers.impact(index,speed,this.time,contactAngle,rotating);
  }
  wind(position) { return windVelocity(position, this.windTime ?? this.time, this.options.wind); }
  get telemetry() {
    return { charge: this.charge, voltage: this.voltage, cellVoltage: this.voltage / this.config.battery.cells,
      currentA: this.currentA, usedMah: this.usedMah, remainingSeconds: this.remainingSeconds,
      batteryState: this.batteryState, throttleLimit: this.throttleLimit,
      propellers: this.propellers.blades.map(blades=>[...blades]), wash: this.wash };
  }
}
