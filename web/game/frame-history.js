// Bounded flight recorder. No DOM, GPU queries or per-frame history copies.
export class FrameHistory {
  constructor(capacity = 2000) {
    this.slots = new Array(capacity);
    this.reset();
  }
  reset() {
    this.slots.fill(undefined);
    this.cursor = this.size = 0;
    this.worstSinceReset = null;
    this.idle();
  }
  idle() { this.previousAt = null; this.previousSample = null; }
  begin(at) {
    if (this.previousSample) {
      this.previousSample.frameMs = at - this.previousAt;
      if (!this.worstSinceReset || this.previousSample.frameMs > this.worstSinceReset.frameMs)
        this.worstSinceReset = this.previousSample;
    }
    const sample = {at, frameMs:null, physicsMs:0, worldMs:0, renderMs:0, steps:0, droppedMs:0};
    this.previousAt = at;
    this.previousSample = sample;
    return sample;
  }
  record(sample, cpuMs, context) {
    Object.assign(sample, context, {cpuMs,
      otherMs:Math.max(0, cpuMs - sample.physicsMs - sample.worldMs - sample.renderMs)});
    this.slots[this.cursor] = sample;
    this.cursor = (this.cursor + 1) % this.slots.length;
    this.size = Math.min(this.size + 1, this.slots.length);
  }
  samples() {
    const samples = [], latest = this.slots[(this.cursor - 1 + this.slots.length) % this.slots.length];
    if (!latest) return samples;
    for (let i = 0; i < this.size; i++) {
      const sample = this.slots[(this.cursor - this.size + i + this.slots.length) % this.slots.length];
      if (sample.at >= latest.at - 10000 && Number.isFinite(sample.frameMs)) samples.push(sample);
    }
    return samples;
  }
}
