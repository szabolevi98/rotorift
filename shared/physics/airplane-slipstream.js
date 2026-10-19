import { aircraftAirframe } from "../aircraft/airframe.js";
import { clamp } from "./math.js";

const AIR_DENSITY = 1.225;
const SURFACE_SAMPLES = 9;
// Finite surface samples, not extra bodies or a particle wake. These coefficients
// are conservative RC-game estimates, not measured airframe/propeller data.
export class AirplaneSlipstream {
  constructor(config) {
    this.config = config;
    const frame = aircraftAirframe(config);
    this.samples = [];
    for (const [axis, part] of [
      [1, frame.tail],
      [0, frame.fin],
    ]) {
      const across = axis === 1 ? 0 : 1,
        count = SURFACE_SAMPLES;
      const area = (4 * part.half[across] * part.half[2]) / count;
      for (let i = 0; i < count; i++) {
        const point = [...part.p];
        point[across] += (((i + 0.5) / count) * 2 - 1) * part.half[across];
        this.samples.push({ axis, point, area });
      }
    }
  }
  addLoads(out, velocity, rates, surfaces, thrust) {
    if (!(thrust > 0)) return out;
    const c = this.config,
      motor = c.motors[0],
      radius = c.propDiameterM / 2;
    const forward = Math.max(0, -velocity[2]);
    // Actuator-disc induced velocity; developed wake approaches twice this.
    const induced =
      (Math.sqrt(
        forward ** 2 + (2 * thrust) / (AIR_DENSITY * Math.PI * radius ** 2),
      ) -
        forward) /
      2;
    for (const { axis, point, area } of this.samples) {
      const distance = point[2] - motor.positionM[2];
      if (distance <= 0) continue; // A pusher never blows over surfaces ahead of it.
      const added = induced * (1 + distance / Math.hypot(distance, radius));
      const axial = forward + added;
      const wakeRadius = radius * Math.sqrt((forward + induced) / axial);
      // Relative crossflow carries the wake away from the propeller axis.
      const time = distance / Math.max(axial, 0.1);
      const x = point[0] - motor.positionM[0] + velocity[0] * time;
      const y = point[1] - motor.positionM[1] + velocity[1] * time;
      const radial = Math.hypot(x, y);
      const coverage = clamp(
        (wakeRadius * 1.15 - radial) / (wakeRadius * 0.3),
        0,
        1,
      );
      if (!coverage) continue;
      const rx = point[0] - c.centerOfMassM[0],
        ry = point[1] - c.centerOfMassM[1],
        rz = point[2] - c.centerOfMassM[2];
      const vx = velocity[0] + rates[1] * rz - rates[2] * ry;
      const vy = velocity[1] + rates[2] * rx - rates[0] * rz;
      const vz = velocity[2] + rates[0] * ry - rates[1] * rx;
      // A bounded solid-core swirl follows motor rotation and disappears with thrust.
      const swirl = (0.035 * added * motor.direction) / wakeRadius;
      const normal = axis === 1 ? vy : vx;
      const washedNormal = axis === 1 ? vy - swirl * x : vx + swirl * y;
      const baseForward = -vz,
        washedForward = baseForward + added;
      const baseAngle = Math.atan2(
        axis === 1 ? -normal : normal,
        Math.max(baseForward, 0.1),
      );
      const washedAngle = Math.atan2(
        axis === 1 ? -washedNormal : washedNormal,
        Math.max(washedForward, 0.1),
      );
      const control = axis === 1 ? surfaces.pitch : surfaces.yaw;
      const baseCl = clamp(2.4 * baseAngle + 1.2 * control, -1.1, 1.1);
      const washedCl = clamp(2.4 * washedAngle + 1.2 * control, -1.1, 1.1);
      const basePressure = 0.5 * AIR_DENSITY * (baseForward ** 2 + normal ** 2);
      const washedPressure =
        0.5 * AIR_DENSITY * (washedForward ** 2 + washedNormal ** 2);
      const force =
        (axis === 1 ? 1 : -1) *
        area *
        coverage *
        (washedPressure * washedCl - basePressure * baseCl);
      // Only the extra tail load is added: baseline aerodynamics already includes
      // the unwashed tail. Matching force and moment also prevents free rotations.
      out.force[axis] += force;
      if (axis === 1) {
        out.torque[0] -= rz * force;
        out.torque[2] += rx * force;
      } else {
        out.torque[1] += rz * force;
        out.torque[2] -= ry * force;
      }
      const drag =
        area *
        coverage *
        0.06 *
        (washedPressure * washedCl ** 2 - basePressure * baseCl ** 2);
      out.force[2] += drag;
      out.torque[0] += ry * drag;
      out.torque[1] -= rx * drag;
    }
    return out;
  }
}
