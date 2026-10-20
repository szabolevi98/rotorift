// Y up, cars face -Z. One immutable, metre-scale circuit shared by every client.
export const CIRCUIT_SIZE = 800;
export const CIRCUIT_WIDTH = 18;
export const CIRCUIT_CAR_COUNT = 8;
export const CIRCUIT_TRAFFIC_VERSION = 1;
export const CIRCUIT_CLUBHOUSE = { x: 20, z: 70, width: 68, depth: 26, roof: 9.15 };
export const CIRCUIT_MEDIA = { x: -65, z: 32, roof: 13.7 };
export const CIRCUIT_CONTROL_POINTS = [
  [-220, 150],
  [-90, 150],
  [80, 150],
  [210, 132],
  [270, 75],
  [275, 5],
  [240, -45],
  [265, -110],
  [225, -185],
  [155, -210],
  [100, -155],
  [140, -75],
  [100, -15],
  [25, -40],
  [0, -125],
  [-40, -210],
  [-125, -235],
  [-225, -210],
  [-225, -145],
  [-155, -110],
  [-120, -40],
  [-175, 10],
  [-265, -20],
  [-300, 40],
  [-275, 105],
];
const mod = (a, b) => ((a % b) + b) % b;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function spline(u) {
  const n = CIRCUIT_CONTROL_POINTS.length,
    i = Math.floor(u),
    t = u - i;
  const points = [-1, 0, 1, 2].map(
    (k) => CIRCUIT_CONTROL_POINTS[mod(i + k, n)],
  );
  return [0, 1].map((axis) => {
    const [a, b, c, d] = points.map((p) => p[axis]);
    return (
      0.5 *
      (2 * b +
        (-a + c) * t +
        (2 * a - 5 * b + 4 * c - d) * t * t +
        (-a + 3 * b - 3 * c + d) * t * t * t)
    );
  });
}
const count = CIRCUIT_CONTROL_POINTS.length * 48;
export const CIRCUIT_SAMPLES = Array.from({ length: count }, (_, i) => {
  const [x, z] = spline(i / 48);
  return { x, z, distance: 0, time: 0 };
});
let distance = 0;
for (let i = 0; i < count; i++) {
  const a = CIRCUIT_SAMPLES[i],
    prev = CIRCUIT_SAMPLES[mod(i - 1, count)],
    next = CIRCUIT_SAMPLES[(i + 1) % count];
  if (i) distance += Math.hypot(a.x - prev.x, a.z - prev.z);
  a.distance = distance;
  const dx = next.x - prev.x,
    dz = next.z - prev.z,
    len = Math.hypot(dx, dz);
  a.tx = dx / len;
  a.tz = dz / len;
  const ax = a.x - prev.x,
    az = a.z - prev.z,
    bx = next.x - a.x,
    bz = next.z - a.z;
  a.curvature =
    (2 * (ax * bz - az * bx)) /
    Math.max(
      0.001,
      Math.hypot(ax, az) * Math.hypot(bx, bz) * Math.hypot(ax + bx, az + bz),
    );
  a.speed = clamp(
    Math.sqrt(5.5 / Math.max(0.003, Math.abs(a.curvature))),
    9,
    38,
  );
}
export const CIRCUIT_LENGTH =
  distance +
  Math.hypot(
    CIRCUIT_SAMPLES[0].x - CIRCUIT_SAMPLES.at(-1).x,
    CIRCUIT_SAMPLES[0].z - CIRCUIT_SAMPLES.at(-1).z,
  );
// Brake before a bend, accelerate out of it. Two cyclic passes remove the seam.
for (let pass = 0; pass < 2; pass++) {
  for (let i = count * 2 - 1; i >= 0; i--) {
    const a = CIRCUIT_SAMPLES[i % count],
      b = CIRCUIT_SAMPLES[(i + 1) % count],
      ds = Math.hypot(a.x - b.x, a.z - b.z);
    a.speed = Math.min(a.speed, Math.sqrt(b.speed * b.speed + 2 * 7 * ds));
  }
  for (let i = 0; i < count * 2; i++) {
    const a = CIRCUIT_SAMPLES[i % count],
      b = CIRCUIT_SAMPLES[mod(i - 1, count)],
      ds = Math.hypot(a.x - b.x, a.z - b.z);
    a.speed = Math.min(a.speed, Math.sqrt(b.speed * b.speed + 2 * 4 * ds));
  }
}
let time = 0;
for (let i = 0; i < count; i++) {
  const a = CIRCUIT_SAMPLES[i],
    b = CIRCUIT_SAMPLES[(i + 1) % count];
  a.time = time;
  time += (2 * Math.hypot(a.x - b.x, a.z - b.z)) / (a.speed + b.speed);
}
export const CIRCUIT_LAP_SECONDS = time;
function interval(value, key) {
  let lo = 0,
    hi = count - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (CIRCUIT_SAMPLES[mid][key] <= value) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
function interpolate(i, t, lane, out) {
  const a = CIRCUIT_SAMPLES[i],
    b = CIRCUIT_SAMPLES[(i + 1) % count];
  let tx = a.tx + (b.tx - a.tx) * t,
    tz = a.tz + (b.tz - a.tz) * t;
  const norm = Math.hypot(tx, tz);
  tx /= norm;
  tz /= norm;
  out.x = a.x + (b.x - a.x) * t - tz * lane;
  out.z = a.z + (b.z - a.z) * t + tx * lane;
  out.tx = tx;
  out.tz = tz;
  out.yaw = Math.atan2(-tx, -tz);
  out.curvature = a.curvature + (b.curvature - a.curvature) * t;
  return out;
}
export function circuitPoint(metres, lane = 0, out = {}) {
  const d = mod(metres, CIRCUIT_LENGTH),
    i = interval(d, "distance");
  const end =
    i === count - 1 ? CIRCUIT_LENGTH : CIRCUIT_SAMPLES[i + 1].distance;
  interpolate(
    i,
    (d - CIRCUIT_SAMPLES[i].distance) / (end - CIRCUIT_SAMPLES[i].distance),
    lane,
    out,
  );
  out.distance = d;
  return out;
}
const phases = [0, 0.028, 0.075, 0.12, 0.48, 0.508, 0.555, 0.6];
const pace = [1, 0.94, 1.06, 0.89];
export function circuitCarState(seconds, index, seed = 0, out = {}) {
  const factor = pace[index % 4],
    phase = mod(seed >>> 0, 997) / 997;
  const t = mod(
    seconds * factor + (phases[index] + phase) * CIRCUIT_LAP_SECONDS,
    CIRCUIT_LAP_SECONDS,
  );
  const i = interval(t, "time"),
    a = CIRCUIT_SAMPLES[i],
    b = CIRCUIT_SAMPLES[(i + 1) % count];
  const end = i === count - 1 ? CIRCUIT_LAP_SECONDS : b.time,
    f = (t - a.time) / (end - a.time);
  interpolate(i, f, [-4.5, -1.5, 1.5, 4.5][index % 4], out);
  const segment = Math.hypot(a.x - b.x, a.z - b.z);
  out.speed = (segment / (end - a.time)) * factor;
  out.distance = a.distance + segment * f;
  out.y = 0.008;
  out.steer = -Math.atan(out.curvature * 2.75);
  return out;
}
export function circuitSurfaceHeight(x, z) {
  if (Math.abs(x - CIRCUIT_CLUBHOUSE.x) <= 34 && Math.abs(z - CIRCUIT_CLUBHOUSE.z) <= 13) return CIRCUIT_CLUBHOUSE.roof;
  if (Math.abs(x - CIRCUIT_MEDIA.x) <= 10 && Math.abs(z - CIRCUIT_MEDIA.z) <= 7) return CIRCUIT_MEDIA.roof;
  if (x >= 48 && x <= 82 && z >= 205 && z <= 230) return 20.3;
  if (Math.abs(x) <= 112 && z >= 195 && z <= 224) return 7.15;
  if (Math.abs(x - 115) <= 2.5 && z >= 118 && z <= 182) return 9.2;
  return 0;
}
