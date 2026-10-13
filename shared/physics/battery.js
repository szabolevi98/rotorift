import { clamp } from "./math.js";
import { motorThrustLimit } from "./propulsion.js";

// Estimated resting LiPo/LiHV curve: fast initial drop, a broad plateau and
// a pronounced empty knee. These points are tuning estimates, not pack data.
const CURVE = [[0, 3.15], [0.03, 3.30], [0.08, 3.50], [0.15, 3.64],
  [0.3, 3.75], [0.5, 3.82], [0.8, 3.97], [0.95, 4.10]];
export function openCircuitCellVoltage(charge, fullCellV = 4.2) {
  const points = [...CURVE, [1, fullCellV]], soc = clamp(charge, 0, 1);
  for (let i = 1; i < points.length; i++) {
    const [end, high] = points[i], [start, low] = points[i - 1];
    if (soc <= end) return low + (high - low) * (soc - start) / (end - start);
  }
  return fullCellV;
}

export function batteryCurrent(config, armed, motorThrust) {
  if (!armed) return 0; // Flight simulation excludes storage/menu consumption.
  const tuning = config.simulation.battery, max = motorThrustLimit(config), linear = tuning.linearCurrentFraction ?? 0.65;
  const fraction = motorThrust.reduce((sum, thrust) => {
    const load = clamp(thrust / max, 0, 1.5);
    // Motor losses plus the nonlinear power required to generate thrust.
    return sum + linear * load + (1 - linear) * load ** 1.5;
  }, 0) / 4;
  return tuning.idleCurrentA + tuning.maxCurrentA * fraction;
}
