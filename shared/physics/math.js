export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const scale = (a, s) => a.map((v) => v * s);
export const length = (a) => Math.hypot(...a);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function rotate(v, q) {
  const u = [q.x, q.y, q.z],
    t = scale(cross(u, v), 2);
  return add(v, add(scale(t, q.w), cross(u, t)));
}
export const inverse = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
export const vector = (a) => ({ x: a[0], y: a[1], z: a[2] });
export const array = (v) => [v.x, v.y, v.z];
