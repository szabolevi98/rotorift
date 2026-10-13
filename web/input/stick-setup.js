const STEPS = ["throttle", "yaw", "pitch", "roll"];
const MIN_TRAVEL = 0.2;
const MIN_LEVELS = 6;
const BIN_SCALE = 64;
const isAnalogue = ({ samples, travel }) => {
  if (travel < MIN_TRAVEL || samples.bins.size < MIN_LEVELS) return false;
  const span = samples.max - samples.min;
  const low = (samples.min + span * 0.2) * BIN_SCALE, high = (samples.max - span * 0.2) * BIN_SCALE;
  // Noisy switch endpoints can occupy several bins too. Require actual
  // intermediate positions, not just jitter around two endpoint clusters.
  return [...samples.bins].filter(bin => bin >= low && bin <= high).length >= 3;
};
export class StickSetup {
  constructor(raw) {
    this.step = 0;
    this.axes = {};
    this.error = null;
    this.beginStep(raw);
  }
  get axis() { return STEPS[this.step] ?? null; }
  beginStep(raw) {
    this.baseline = Array.from(raw);
    this.samples = raw.map((value) => ({ min: value, max: value, bins: new Set([Math.round(value * BIN_SCALE)]) }));
  }
  sample(raw) {
    if (!this.axis) return;
    raw.forEach((value, i) => {
      if (!Number.isFinite(value)) return;
      const samples = this.samples[i];
      if (!samples) return;
      samples.min = Math.min(samples.min, value);
      samples.max = Math.max(samples.max, value);
      samples.bins.add(Math.round(value * BIN_SCALE));
    });
  }
  get movements() {
    const used = new Set(Object.values(this.axes).map(axis => axis.index));
    return this.samples.map((samples, index) => {
      const positive = samples.max - this.baseline[index], negative = this.baseline[index] - samples.min;
      return { index, samples, positive, negative, used: used.has(index), travel: Math.max(positive, negative) };
    }).sort((a, b) => b.travel - a.travel);
  }
  get signal() {
    const movements = this.movements;
    const analogue = movements.find(m => !m.used && isAnalogue(m));
    if (analogue) return { ...analogue, state: "detected" };
    const moved = movements[0];
    if (!moved || moved.travel < 0.025) return { state: "waiting" };
    return { ...moved, state: moved.used ? "used" : moved.travel >= MIN_TRAVEL && !isAnalogue(moved) ? "digital" : "weak" };
  }
  get feedbackAxes() {
    const axes = { ...this.axes }, signal = this.signal;
    if (this.axis && signal.state === "detected") {
      const center = this.baseline[signal.index];
      axes[this.axis] = this.axis === "throttle"
        ? { index: signal.index, invert: signal.negative > signal.positive, center: 0, min: signal.samples.min, max: signal.samples.max }
        : { index: signal.index, invert: signal.negative > signal.positive, center,
          min: Math.max(-1, center - signal.travel), max: Math.min(1, center + signal.travel) };
    }
    return axes;
  }
  advance(raw) {
    if (!this.axis) return false;
    this.sample(raw);
    const candidates = this.movements.filter(candidate => !candidate.used && isAnalogue(candidate));
    if (!candidates.length) { this.error = "noAnalog"; return false; }
    const best = candidates[0];
    if (Math.min(best.positive, best.negative) > best.travel * 0.4) {
      this.error = "oneDirection"; this.beginStep(this.baseline); return false;
    }
    const invert = best.negative > best.positive;
    const center = this.baseline[best.index];
    this.axes[this.axis] = this.axis === "throttle"
      ? { index: best.index, invert, center: 0, min: best.samples.min, max: best.samples.max }
      : { index: best.index, invert, center,
        min: Math.max(-1, center - best.travel), max: Math.min(1, center + best.travel) };
    this.error = null;
    this.step++;
    this.beginStep(raw);
    return true;
  }
}
