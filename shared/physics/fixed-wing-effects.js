import { clamp } from "./math.js";
import { normalizeSimulation } from "../simulation/options.js";
import { openCircuitCellVoltage } from "./battery.js";
import { windVelocity } from "./wind.js";
import { AirplanePropellerDamage } from "./airplane-propeller.js";
export class AirplaneEffects {
  constructor(config, options) {
    this.config = config;
    this.propeller = new AirplanePropellerDamage(config);
    this.setOptions(options);
  }
  setOptions(options) {
    const previous = this.options;
    this.options = {
      ...normalizeSimulation(options),
      propwash: false,
    };
    if (!previous || previous.battery !== this.options.battery) this.reset();
    if (!this.options.propDamage) this.propeller.reset();
  }
  reset() {
    this.propeller.reset();
    this.time = 0;
    this.usedMah = 0;
    this.charge = 1;
    this.powerFactor = 1;
    this.throttleLimit = 1;
    this.voltage = this.config.battery.cells * 4.2;
    this.currentA = 0;
    this.remainingSeconds = null;
    this.batteryState = "normal";
  }
  wind(position) {
    return windVelocity(
      position,
      this.windTime ?? this.time,
      this.options.wind,
    );
  }
  update(dt, armed, throttle) {
    this.time += dt;
    if (!this.options.battery) return;
    const b = this.config.battery,
      t = this.config.simulation.battery;
    this.currentA = armed
      ? t.idleCurrentA + t.maxCurrentA * throttle ** 1.7
      : 0;
    this.usedMah = Math.min(
      b.capacityMah,
      this.usedMah + (this.currentA * dt) / 3.6,
    );
    this.charge = 1 - this.usedMah / b.capacityMah;
    this.voltage = Math.max(
      b.cells * 2.8,
      openCircuitCellVoltage(this.charge) * b.cells -
        this.currentA * t.resistanceOhm,
    );
    this.batteryState =
      this.charge <= t.reserveFraction
        ? "critical"
        : this.charge <= 0.2
          ? "low"
          : "normal";
    this.throttleLimit = this.batteryState === "critical" ? 0.45 : 1;
    this.powerFactor =
      this.charge === 0
        ? 0
        : clamp((this.voltage / b.nominalVoltage) ** 2, 0.3, 1.3);
    this.remainingSeconds =
      armed && this.currentA > 0.1
        ? (Math.max(0, this.charge - t.reserveFraction) * b.capacityMah * 3.6) /
          this.currentA
        : null;
  }
  get telemetry() {
    return {
      charge: this.charge,
      voltage: this.voltage,
      cellVoltage: this.voltage / this.config.battery.cells,
      currentA: this.currentA,
      usedMah: this.usedMah,
      remainingSeconds: this.remainingSeconds,
      batteryState: this.batteryState,
      throttleLimit: this.throttleLimit,
      propeller: [...this.propeller.blades],
    };
  }
}
