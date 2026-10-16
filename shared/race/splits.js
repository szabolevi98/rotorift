import { gateCrossing } from './gates.js';

// Replay frames start on gate 0 at t=0. Compare checkpoints 1..N-1 in the
// same order and with the same 3D crossing calculation as live lap timing.
export function ghostGateSplits(frames, gates) {
  const splits = new Array(gates?.length ?? 0).fill(null);
  if (!Array.isArray(frames) || frames.length < 2 || splits.length < 2) return splits;
  let next = 1;
  for (let i = 1; i < frames.length && next < gates.length; i++) {
    const a = frames[i - 1], b = frames[i];
    const from = a.slice(1, 4), to = b.slice(1, 4);
    let cursor = 0;
    while (next < gates.length) {
      const fraction = gateCrossing(from, to, gates[next]);
      if (fraction === null || fraction < cursor) break;
      splits[next++] = a[0] + (b[0] - a[0]) * fraction;
      cursor = fraction + 1e-8;
    }
  }
  return splits;
}

export function splitComparison(split, { ghostRequested = false, ghostSplits, ghostLabel, bestLabel }) {
  if (!split || !Number.isInteger(split.index) || split.index < 1 || !Number.isFinite(split.ms)) return null;
  // A selected ghost is the opponent, even while loading or when its recording
  // misses this gate. Never silently substitute a personal-best split.
  const reference = ghostRequested ? ghostSplits?.[split.index] : split.referenceMs;
  if (!Number.isFinite(reference)) return null;
  return { deltaMs: split.ms - reference, label: ghostRequested ? ghostLabel : bestLabel };
}
