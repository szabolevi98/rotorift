import { dot, sub } from "../physics/math.js";
export function gateBasis(normal){
  const seed=Math.abs(normal[1])>.99?[0,0,1]:[0,1,0];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const raw=cross(seed,normal),length=Math.hypot(...raw),right=raw.map(v=>v/length);
  return {right,up:cross(normal,right)};
}
export function gateCrossing(a, b, g) {
  const d0 = dot(sub(a, g.p), g.n),
    d1 = dot(sub(b, g.p), g.n);
  if (d0 >= 0 || d1 < 0 || d1 - d0 < 1e-9) return null;
  const t = -d0 / (d1 - d0),
    p = a.map((v, i) => v + (b[i] - v) * t),
    local = sub(p, g.p),
    {right,up} = gateBasis(g.n);
  return Math.abs(dot(local, right)) <= g.width / 2 - 0.1 &&
    Math.abs(dot(local,up)) <= g.height / 2 - 0.1
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
