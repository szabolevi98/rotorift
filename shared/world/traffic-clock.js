import { CIRCUIT_TRAFFIC_VERSION } from './circuit-layout.js';
// Synchronize to the room's immutable epoch, not local frame counts or a join time.
// Small network-clock corrections are slewed; long suspension catches up directly.
export class TrafficClock {
  constructor() {
    this.key = null;
    this.time = 0;
  }
  sample(traffic, serverNow, elapsed) {
    if (
      !traffic ||
      traffic.version !== CIRCUIT_TRAFFIC_VERSION ||
      !Number.isFinite(traffic.epoch) ||
      !Number.isInteger(traffic.seed)
    )
      return null;
    const key = traffic.epoch + ":" + traffic.seed,
      desired = Math.max(0, (serverNow - traffic.epoch) / 1000);
    const dt = Math.max(0, Math.min(0.25, elapsed));
    if (key !== this.key || Math.abs(desired - this.time - dt) > 1) {
      this.key = key;
      this.time = desired;
    } else {
      const predicted = this.time + dt;
      this.time =
        predicted +
        Math.max(-dt * 0.1, Math.min(dt * 0.1, desired - predicted));
    }
    return this.time;
  }
}
