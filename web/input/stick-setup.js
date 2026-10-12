const STEPS = ["throttle", "yaw", "pitch", "roll"];
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
    this.samples = raw.map((value) => ({ min: value, max: value, bins: new Set([Math.round(value * 20)]) }));
  }
  sample(raw) {
    if (!this.axis) return;
    raw.forEach((value, i) => {
      if (!Number.isFinite(value)) return;
      const samples = this.samples[i];
      if (!samples) return;
      samples.min = Math.min(samples.min, value);
      samples.max = Math.max(samples.max, value);
      samples.bins.add(Math.round(value * 20));
    });
  }
  advance(raw) {
    if (!this.axis) return false;
    this.sample(raw);
    const used = new Set(Object.values(this.axes).map((axis) => axis.index));
    const candidates = this.samples.map((samples, index) => {
      const positive = samples.max - this.baseline[index], negative = this.baseline[index] - samples.min;
      return { index, samples, positive, negative, travel: Math.max(positive, negative) };
    }).filter((candidate) => !used.has(candidate.index) && candidate.travel >= 0.5 && candidate.samples.bins.size >= 6)
      .sort((a, b) => b.travel - a.travel);
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
