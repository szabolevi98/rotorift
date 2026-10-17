// Tuned acoustic characters, not recordings or measured RPM specifications.
// One reusable native Web Audio graph; no per-sample JavaScript or audio files.
export const DRONE_SOUND_PROFILES = Object.freeze({
  'rift-65':  { rotorHz: 1400, body: .12, blade: 1, air: .035, highpass: 850, cutoff: 7800, resonance: 2900, ductDb: 3, gain: .80 },
  'rift-75':  { rotorHz: 1150, body: .18, blade: 1, air: .041, highpass: 650, cutoff: 7200, resonance: 2350, ductDb: 2.5, gain: .85 },
  'rift-c3':  { rotorHz: 760, body: .30, blade: .85, air: .052, highpass: 260, cutoff: 5500, resonance: 1350, ductDb: 4, gain: .90 },
  'rift-x35': { rotorHz: 660, body: .38, blade: 1, air: .060, highpass: 180, cutoff: 6800, resonance: 1100, ductDb: 0, gain: .95 },
  'rift-x5':  { rotorHz: 530, body: .52, blade: 1, air: .073, highpass: 110, cutoff: 6200, resonance: 850, ductDb: 0, gain: 1 },
});
const unit = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const target = (param, value, time, response = .018) => param.setTargetAtTime(value, time, response);

function rotorWave(ctx, profile, rough = false) {
  const real = new Float32Array(25), imag = new Float32Array(25);
  imag[1] = profile.body * (rough ? 2 : 1);
  imag[2] = profile.body * (rough ? .8 : .25);
  for (let harmonic = 1; harmonic <= 8; harmonic++)
    imag[harmonic * 3] = profile.blade / harmonic ** (rough ? 1.2 : 1.65);
  imag[7] += .045; // Small motor/electrical component beneath the blade-pass harmonics.
  return ctx.createPeriodicWave(real, imag);
}
function airBuffer(ctx) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 0x72696674, low = 0;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const white = seed / 2147483648 - 1;
    low = .96 * low + .04 * white;
    // Broadband airflow plus a little low-frequency texture. Taper the loop join.
    const edge = Math.min(1, i / 256, (samples.length - 1 - i) / 256);
    samples[i] = (white * .72 + low * 1.4) * edge;
  }
  return buffer;
}

export class DroneSound {
  constructor(ctx, config, { win = globalThis.window } = {}) {
    this.ctx = ctx;
    this.nodes = [];
    const node = value => { this.nodes.push(value); return value; };
    this.master = node(ctx.createGain()); this.master.gain.value = 0;
    this.filter = node(ctx.createBiquadFilter()); this.filter.type = 'lowpass'; this.filter.Q.value = .55;
    this.duct = node(ctx.createBiquadFilter()); this.duct.type = 'peaking'; this.duct.Q.value = 1.2;
    this.filter.connect(this.duct); this.duct.connect(this.master); this.master.connect(ctx.destination);
    this.rotors = Array.from({ length: 4 }, (_, i) => {
      const osc = node(ctx.createOscillator()), gain = node(ctx.createGain()), pan = node(ctx.createStereoPanner());
      osc.detune.value = [-7, 5, 9, -3][i];
      gain.gain.value = 0; pan.pan.value = [-.18, .18, -.12, .12][i];
      osc.connect(gain); gain.connect(pan); pan.connect(this.filter);
      return { osc, gain, rough: false };
    });
    this.air = node(ctx.createBufferSource()); this.air.buffer = airBuffer(ctx); this.air.loop = true;
    this.airHighpass = node(ctx.createBiquadFilter()); this.airHighpass.type = 'highpass'; this.airHighpass.Q.value = .5;
    this.airGain = node(ctx.createGain()); this.airGain.gain.value = 0;
    this.air.connect(this.airHighpass); this.airHighpass.connect(this.airGain); this.airGain.connect(this.filter);
    this.configure(config);
    this.rotors.forEach(({ osc }, i) => osc.start(ctx.currentTime + i * .0007));
    this.air.start();
    // Safari/mobile can suspend a context created after asynchronous map loading.
    // Retry from the next real gesture, without starting additional oscillators.
    this.win = win;
    this.unlock = () => this.resume();
    win?.addEventListener('pointerdown', this.unlock, { passive: true });
    win?.addEventListener('keydown', this.unlock);
  }
  configure(config) {
    this.profile = DRONE_SOUND_PROFILES[config?.id] ?? DRONE_SOUND_PROFILES['rift-x5'];
    this.cleanWave = rotorWave(this.ctx, this.profile);
    this.roughWave = rotorWave(this.ctx, this.profile, true);
    for (const rotor of this.rotors) { rotor.osc.setPeriodicWave(this.cleanWave); rotor.rough = false; }
    this.airHighpass.frequency.value = this.profile.highpass;
    this.duct.frequency.value = this.profile.resonance;
    this.duct.gain.value = this.profile.ductDb;
    this.mute();
  }
  resume() {
    if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => {});
  }
  update(speeds, { enabled = true, volume = .7, armed = false, chase = false, speed = 0, vertical = 0, propwash = false, blades } = {}) {
    const now = this.ctx.currentTime, profile = this.profile;
    let load = 0, roughness = 0;
    for (const [i, rotor] of this.rotors.entries()) {
      const rpm = armed && enabled ? unit(speeds?.[i]) : 0;
      const damage = blades?.[i];
      const remaining = damage ? damage.reduce((sum, state) => sum + [1, .9, .55, .08][state], 0) / 3 : 1;
      const rough = remaining < .99;
      if (rough !== rotor.rough) { rotor.osc.setPeriodicWave(rough ? this.roughWave : this.cleanWave); rotor.rough = rough; }
      const flutter = 1 + Math.sin(now * (19 + i * 2) + i) * (rough ? .012 : .002);
      target(rotor.osc.frequency, Math.max(25, profile.rotorHz * rpm * flutter), now, .012);
      target(rotor.gain.gain, .034 * rpm ** 1.5 * (.18 + .82 * remaining), now);
      load += rpm / 4; roughness += (1 - remaining) * rpm / 4;
    }
    const descent = propwash ? unit((-vertical - 1.5) / 7) * unit(load * 2) : 0;
    const rush = Number.isFinite(speed) ? unit(Math.abs(speed) / 45) : 0;
    target(this.airGain.gain, profile.air * load ** 1.7 * (1 + rush * .4 + roughness * .9 + descent * .8), now, .035);
    target(this.filter.frequency, Math.min(this.ctx.sampleRate * .44, 900 + profile.cutoff * (.25 + load * .75)), now, .03);
    // Previous output peaked near -25 dB even at full throttle. Bring it into a
    // useful listening range; bounded voices retain headroom at full volume.
    target(this.master.gain, enabled && armed && load > .001 ? 4 * unit(volume) * profile.gain * (chase ? .78 : 1) : 0, now, .012);
  }
  mute() {
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    target(this.master.gain, 0, now, .008);
  }
  dispose() {
    this.win?.removeEventListener('pointerdown', this.unlock);
    this.win?.removeEventListener('keydown', this.unlock);
    this.rotors.forEach(({ osc }) => osc.stop()); this.air.stop();
    for (const node of this.nodes) node.disconnect();
    return this.ctx.close?.();
  }
}
