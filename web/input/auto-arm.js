// Require a real low-throttle sample followed by a deliberate rise. Separate
// thresholds avoid arming from endpoint noise on an otherwise idle radio.
export const AUTO_ARM_LOW = 0.02;
export const AUTO_ARM_RISE = 0.06;

export class AutoArm {
  constructor(enabled = true) { this.enabled = enabled; this.reset(); }
  reset() { this.pending = true; this.lowSeen = false; }
  cancel() { this.pending = false; this.lowSeen = false; }
  setEnabled(enabled) { this.enabled = enabled === true; this.reset(); }
  get active() { return this.enabled && this.pending; }
  update({ throttle, armed, allowed, ready = true, turtle = false }) {
    if (armed || turtle) { this.cancel(); return false; }
    if (!this.active) return false;
    if (!allowed || !ready || !Number.isFinite(throttle) || throttle < 0 || throttle > 1) {
      this.lowSeen = false;
      return false;
    }
    if (throttle <= AUTO_ARM_LOW) this.lowSeen = true;
    if (this.lowSeen && throttle >= AUTO_ARM_RISE) { this.cancel(); return true; }
    return false;
  }
}
