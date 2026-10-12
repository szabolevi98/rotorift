import { clamp, rotate, inverse } from "./math.js";
import { hoverThrottle, motorThrustLimit } from "./propulsion.js";
import { normalizeSimulation } from "../simulation/options.js";

// Initial estimates live in each aircraft config; these effects supplement the
// normal flight controller rather than modifying its rate settings.
export class FlightEffects {
  constructor(config, options) {
    this.config = config;
    this.options = normalizeSimulation(options);
    this.reset();
  }
  reset() {
    this.time = 0;
    this.usedMah = 0;
    this.charge = 1;
    this.voltage = this.filteredVoltage = this.config.battery.cells * 4.2;
    this.currentA = 0;
    this.batteryState = "normal";
    this.criticalSeconds = 0;
    this.throttleLimit = 1;
    this.powerFactor = 1;
    this.damage = [0, 0, 0, 0];
    this.lastImpact = [-Infinity, -Infinity, -Infinity, -Infinity];
    this.wash = 0;
  }
  setOptions(options) {
    const next = normalizeSimulation(options);
    if (next.battery !== this.options.battery) {
      this.usedMah = 0; this.charge = 1; this.batteryState = "normal";
      this.voltage = this.filteredVoltage = this.config.battery.cells * 4.2;
      this.criticalSeconds = 0; this.powerFactor = 1; this.throttleLimit = 1;
    }
    this.options = next;
    if (!next.propDamage) this.damage.fill(0);
    if (!next.propwash) this.wash = 0;
  }
  update(dt, armed, motorThrust, velocity, quaternion) {
    this.time += dt;
    const c = this.config, tuning = c.simulation;
    if (this.options.battery) {
      const fraction = motorThrust.reduce((sum, force) => sum + (Math.max(0, force) / motorThrustLimit(c)) ** 1.1, 0) / 4;
      this.currentA = armed ? tuning.battery.idleCurrentA + tuning.battery.maxCurrentA * fraction : 0;
      this.usedMah = Math.min(c.battery.capacityMah, this.usedMah + this.currentA * dt / 3.6);
      this.charge = Math.max(0, 1 - this.usedMah / c.battery.capacityMah);
      const cell = 3.3 + 0.55 * Math.sqrt(this.charge) + 0.35 * this.charge;
      this.voltage = Math.max(c.battery.cells * 2.8, cell * c.battery.cells - this.currentA * tuning.battery.resistanceOhm);
      this.filteredVoltage += (this.voltage - this.filteredVoltage) * (1 - Math.exp(-dt / 1.5));
      const filteredCell = this.filteredVoltage / c.battery.cells;
      this.criticalSeconds = filteredCell < 3.15 ? this.criticalSeconds + dt : 0;
      if (this.charge <= 0.06 || this.criticalSeconds >= 2) this.batteryState = "critical";
      else if (this.batteryState !== "critical") this.batteryState = this.charge <= 0.2 || filteredCell < 3.5 ? "low" : "normal";
      this.powerFactor = clamp((this.voltage / c.battery.nominalVoltage) ** 2, 0.45, 1);
      const hover = hoverThrottle(c) / this.powerFactor ** (1 / c.motor.thrustExponent);
      this.throttleLimit = this.batteryState === "critical" ? clamp(hover * (0.55 + 0.45 * clamp(this.charge / 0.06, 0, 1)) + 0.04, 0, 1) : 1;
    }
    const localVelocity = rotate(velocity, inverse(quaternion));
    // Re-entering the rotor wake during a powered, near-vertical descent.
    const descent = Math.max(0, -localVelocity[1]), sideways = Math.hypot(localVelocity[0], localVelocity[2]);
    const target = this.options.propwash && armed ? clamp((descent - 1.5) / 5, 0, 1) * Math.exp(-sideways / 3) : 0;
    this.wash += (target - this.wash) * (1 - Math.exp(-dt / 0.08));
  }
  motorEfficiency(index) {
    const damage = this.options.propDamage ? this.damage[index] : 0;
    const turbulence = this.wash * this.config.simulation.propwashStrength * (0.55 + 0.45 * Math.sin(this.time * 91 + index * 2.3));
    const vibration = damage * 0.06 * (0.5 + 0.5 * Math.sin(this.time * 137 + index));
    return clamp(1 - damage * 0.65 - turbulence - vibration, 0.1, 1);
  }
  impact(index, speed) {
    if (!this.options.propDamage || this.time - this.lastImpact[index] < 0.2) return;
    const tuning = this.config.simulation;
    if (speed <= tuning.propDamageThresholdMps) return;
    this.lastImpact[index] = this.time;
    this.damage[index] = clamp(this.damage[index] + (speed - tuning.propDamageThresholdMps) / 12 * tuning.propDamageScale, 0, 1);
  }
  wind(position) {
    const speed = { calm: 0, light: 2, medium: 5, strong: 9 }[this.options.wind];
    if (!speed) return [0, 0, 0];
    const t = this.windTime ?? this.time, phase = position[0] * 0.025 + position[2] * 0.018;
    const gust = 1 + 0.25 * Math.sin(t * 0.7 + phase) + 0.12 * Math.sin(t * 1.9 - phase);
    const direction = 0.6 + 0.12 * Math.sin(t * 0.17);
    return [speed * gust * Math.cos(direction), speed * 0.035 * Math.sin(t * 1.3 + phase), speed * gust * Math.sin(direction)];
  }
  get telemetry() {
    return { charge: this.charge, voltage: this.voltage, currentA: this.currentA, usedMah: this.usedMah,
      batteryState: this.batteryState, throttleLimit: this.throttleLimit, damage: [...this.damage], wash: this.wash };
  }
}
