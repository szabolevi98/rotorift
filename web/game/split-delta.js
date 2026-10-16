import { ghostGateSplits, splitComparison } from '../../shared/race/splits.js';

export const SPLIT_DELTA_VISIBLE_MS = 2600;

export class SplitDeltaHud {
  constructor(root, t) {
    this.root = root; this.t = t;
    this.value = root.querySelector('[data-delta-value]');
    this.reference = root.querySelector('[data-delta-reference]');
    this.hide();
  }
  hide() { this.root.classList.add('hidden'); this.until = 0; }
  prepare(ghost, gates) {
    if (this.replay === ghost?.replay && this.gates === gates) return;
    this.replay = ghost?.replay; this.gates = gates;
    this.ghostSplits = ghostGateSplits(this.replay?.frames, gates);
  }
  update({ lap, gates, context = '', active = false, ghostRequested = false, ghost = null, now = performance.now() } = {}) {
    const run = `${context}:${lap?.startedAt ?? ''}`, split = lap?.lastSplit;
    if (run !== this.run) { this.run = run; this.seen = null; this.hide(); }
    const key = split ? `${split.at}:${split.index}` : null;
    if (!active || !lap || lap.invalid || lap.startedAt == null) { this.seen = key; this.hide(); return; }
    if (key !== this.seen) {
      this.seen = key; this.hide();
      if (split?.startedAt === lap.startedAt) {
        this.prepare(ghost, gates);
        const result = splitComparison(split, { ghostRequested, ghostSplits: this.ghostSplits,
          ghostLabel: ghost?.label, bestLabel: this.t('hud.delta.best') });
        if (result) {
          this.value.textContent = (result.deltaMs < 0 ? '−' : '+') + (Math.abs(result.deltaMs) / 1000).toFixed(2) + ' s';
          this.reference.textContent = result.label; this.reference.title = result.label;
          this.root.setAttribute('aria-label', this.t('hud.delta'));
          this.root.classList.toggle('is-faster', result.deltaMs < 0);
          this.root.classList.toggle('is-slower', result.deltaMs >= 0);
          this.root.classList.remove('hidden'); this.until = now + SPLIT_DELTA_VISIBLE_MS;
        }
      }
    }
    if (now >= this.until) this.hide();
  }
}
