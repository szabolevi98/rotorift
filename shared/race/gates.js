import { dot, sub } from "../physics/math.js";
export function gateCrossing(a, b, g) {
  const d0 = dot(sub(a, g.p), g.n),
    d1 = dot(sub(b, g.p), g.n);
  if (d0 >= 0 || d1 < 0 || d1 - d0 < 1e-9) return null;
  const t = -d0 / (d1 - d0),
    p = a.map((v, i) => v + (b[i] - v) * t),
    local = sub(p, g.p),
    right = [-g.n[2], 0, g.n[0]];
  return Math.abs(dot(local, right)) <= g.width / 2 - 0.1 &&
    Math.abs(local[1]) <= g.height / 2 - 0.1
    ? t
    : null;
}
export const newLap = () => ({
  next: 0,
  startedAt: null,
  completed: 0,
  bestMs: null,
  lastMs: null,
  invalid: false,
});
export function advanceLap(lap, previous, current, startTime, endTime, gates) {
  if (gates.length < 2) return [];
  // A packet may contain several consecutive crossings; use each crossing's substep time.
  let events = [],
    cursor = 0;
  for (let count = 0; count < gates.length + 1; count++) {
    const t = gateCrossing(previous, current, gates[lap.next]);
    if (t === null || t < cursor) break;
    cursor = t + 1e-8;
    const at = startTime + (endTime - startTime) * t;
    if (lap.next === 0) {
      if (lap.startedAt !== null) {
        const ms = at - lap.startedAt,
          valid = !lap.invalid && ms > 0;
        lap.lastMs = ms;
        if (valid) {
          lap.completed++;
          lap.bestMs = Math.min(lap.bestMs ?? Infinity, ms);
        }
        events.push({ kind: "lap", ms, valid, at });
      }
      lap.startedAt = at;
      lap.invalid = false;
      events.push({ kind: "start", at });
    } else events.push({ kind: "gate", index: lap.next, at });
    lap.next = (lap.next + 1) % gates.length;
  }
  return events;
}
