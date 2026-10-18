import { clamp } from "./math.js";

// Attitude demand through the actual servos, never a direct pose/velocity fix.
// Y up, nose -Z: body X pitches up and body Z rolls left.
export const AIRPLANE_ANGLE_LIMITS = Object.freeze({
  pitch: (20 * Math.PI) / 180,
  roll: (35 * Math.PI) / 180,
});
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
export function airplaneSurfaceTargets(
  config,
  mode,
  input,
  q,
  rates,
  velocity,
  profile,
  out,
) {
  const travel = profile.travel,
    expo = profile.expo;
  const stick = (axis) => {
    const value = clamp(input[axis] ?? 0, -1, 1);
    return value * (1 - expo) + value ** 3 * expo;
  };
  for (const axis of ["pitch", "roll", "yaw"]) out[axis] = stick(axis) * travel;
  if (mode !== "stabilized") return out;
  const pitch = Math.asin(clamp(2 * (q.w * q.x - q.y * q.z), -1, 1));
  const roll = Math.atan2(
    2 * (q.x * q.y + q.w * q.z),
    1 - 2 * (q.x * q.x + q.z * q.z),
  );
  // Convert gyro body rates to attitude rates so a coordinated banked turn
  // does not look like an unwanted pitch/roll disturbance to the controller.
  const pitchRate = rates[0] * Math.cos(roll) - rates[1] * Math.sin(roll);
  const rollRate =
    rates[2] +
    clamp(Math.tan(pitch), -5, 5) *
      (rates[1] * Math.cos(roll) + rates[0] * Math.sin(roll));
  const targetPitch = -stick("pitch") * AIRPLANE_ANGLE_LIMITS.pitch;
  const targetRoll = -stick("roll") * AIRPLANE_ANGLE_LIMITS.roll;
  // Cancel the airframe's trim/static pitch moment at the current airflow.
  // The remaining error drives a bounded attitude/rate feedback controller.
  const alpha =
    Math.hypot(...velocity) > 0.1 ? Math.atan2(-velocity[1], -velocity[2]) : 0;
  const trim =
    (config.aero.pitchTrim - config.aero.pitchStability * Math.sin(alpha)) /
    0.75;
  out.pitch = clamp(
    (pitch - targetPitch) * 2.2 + pitchRate * 0.45 + trim,
    -travel,
    travel,
  );
  out.roll = clamp(
    wrap(roll - targetRoll) * 2.2 + rollRate * 0.35,
    -travel,
    travel,
  );
  return out;
}
