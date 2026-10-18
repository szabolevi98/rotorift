import { clamp } from "./math.js";
// Y up, nose -Z. Positive body-X rotation raises the nose; positive body-Z
// rotation banks left. Input pitch/roll/yaw are positive forward/right/right.
export function aerodynamicLoads(
  config,
  velocity,
  rates,
  surfaces,
  out = { force: [0, 0, 0], torque: [0, 0, 0] },
) {
  const [x, y, z] = velocity,
    [p, q, r] = rates,
    a = config.aero;
  const speed = Math.hypot(x, y, z),
    forward = -z,
    yz = Math.hypot(y, z);
  const alpha = speed > 0.01 ? Math.atan2(-y, forward) : 0,
    beta = speed > 0.01 ? Math.asin(clamp(x / speed, -1, 1)) : 0;
  const blend = clamp((Math.abs(alpha) - a.stallAngleRad) / 0.35, 0, 1),
    smooth = blend * blend * (3 - 2 * blend);
  const attached = clamp(a.liftZero + a.liftSlope * alpha, -1.5, 1.65);
  const cl = attached * (1 - smooth) + 1.05 * Math.sin(2 * alpha) * smooth;
  const cd = a.dragZero + a.inducedDrag * cl * cl + 1.1 * Math.sin(alpha) ** 2;
  const pressure = 0.5 * 1.225 * speed * speed * a.areaM2,
    drag = speed > 0.01 ? (pressure * cd) / speed : 0;
  out.force[0] = -x * drag - pressure * 0.8 * beta;
  out.force[1] = -y * drag + (yz > 0.01 ? (pressure * cl * forward) / yz : 0);
  out.force[2] = -z * drag + (yz > 0.01 ? (pressure * cl * y) / yz : 0);
  const chordRate = a.chordM / (2 * Math.max(speed, 1)),
    spanRate = config.wingspanM / (2 * Math.max(speed, 1));
  out.torque[0] =
    pressure *
    a.chordM *
    (a.pitchTrim -
      a.pitchStability * Math.sin(alpha) -
      0.75 * surfaces.pitch -
      8 * p * chordRate);
  out.torque[1] =
    pressure *
    config.wingspanM *
    (-0.12 * beta - 0.12 * surfaces.yaw - 0.65 * q * spanRate);
  out.torque[2] =
    pressure *
    config.wingspanM *
    (-0.18 * surfaces.roll - 0.06 * beta - 0.55 * r * spanRate);
  out.airspeed = speed;
  out.alpha = alpha;
  out.stall = clamp((Math.abs(alpha) - a.stallAngleRad + 0.04) / 0.16, 0, 1);
  return out;
}
