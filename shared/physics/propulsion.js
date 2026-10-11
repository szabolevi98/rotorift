import { clamp } from "./math.js";

export function motorThrustLimit(config) {
  const voltageRatio = config.battery.nominalVoltage / (config.battery.cells * 3.8);
  return config.motor.maxThrustN * voltageRatio ** 2;
}

// ESC input is not a universal RPM percentage. Each motor/prop combination
// gets its own estimated command-to-thrust curve, without changing full power.
export function throttleToThrust(throttle, config) {
  return motorThrustLimit(config) * clamp(throttle, 0, 1) ** config.motor.thrustExponent;
}

export function hoverThrottle(config, gravity = 9.81) {
  return clamp((config.massKg * gravity / (4 * motorThrustLimit(config))) ** (1 / config.motor.thrustExponent), 0, 1);
}
