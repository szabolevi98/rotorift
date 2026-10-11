export const PARK_CHUNK_SIZE = 128;
export const PARK_GRID_STEPS = 32;
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const hill = (x, z, cx, cz, spread, height) =>
  height * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / spread ** 2);

// The same world-space function is sampled on both sides of every chunk edge.
// Central paving is level; the rest of the landscape rolls on indefinitely.
export function parkHeight(x, z) {
  const rolling = 2.8 + Math.sin(x * 0.013) * Math.cos(z * 0.009) * 3.5
    + Math.sin(z * 0.021 + x * 0.005) * 1.8
    + hill(x, z, 170, -65, 78, 11)
    + hill(x, z, -210, 180, 95, 13)
    + hill(x, z, -130, -240, 100, 8);
  const flat = smooth(30, 65, Math.abs(x)) * 0.6
    + smooth(90, 135, Math.abs(z));
  const height = rolling * Math.min(1, flat);
  const lakeDistance = Math.hypot((x - 190) / 34, (z - 145) / 24);
  return -1.3 + (height + 1.3) * smooth(0.72, 1.25, lakeDistance);
}

// Interpolate the same triangles as the rendered terrain and Rapier collider.
// Paths and props therefore sit on the actual surface, not above a second curve.
export function parkSurfaceHeight(x, z) {
  const cell = PARK_CHUNK_SIZE / PARK_GRID_STEPS;
  const ix = Math.floor(x / cell) * cell, iz = Math.floor(z / cell) * cell;
  const u = (x - ix) / cell, v = (z - iz) / cell;
  const a = parkHeight(ix, iz), b = parkHeight(ix + cell, iz);
  const c = parkHeight(ix, iz + cell), d = parkHeight(ix + cell, iz + cell);
  return u + v <= 1 ? a + u * (b - a) + v * (c - a)
    : d + (1 - u) * (c - d) + (1 - v) * (b - d);
}

const ring = Array.from({ length: 145 }, (_, i) => {
  const a = i / 144 * Math.PI * 2;
  return [Math.cos(a) * 148, Math.sin(a) * 115];
});
export const PARK_PATHS = [
  { width: 7, points: [[0, -350], [0, 350]], paving: true },
  { width: 4.2, points: ring },
  { width: 4.2, points: [[0, 65], [-45, 65], [-85, 50], [-115, 25], [-155, 8], [-215, -30], [-275, -70], [-345, -115]] },
  { width: 4.2, points: [[0, -65], [45, -65], [90, -45], [145, -25], [205, -5], [265, 20], [345, 70]] },
  { width: 3.2, points: [[-290, 300], [-230, 235], [-195, 185], [-170, 130], [-148, 50], [-135, -65], [-170, -160], [-230, -235], [-290, -330]] },
  { width: 3.2, points: [[280, -320], [230, -220], [210, -150], [205, -70], [225, 20], [235, 95], [235, 170], [220, 245], [260, 330]] },
  { width: 3, points: [[-320, -285], [-210, -270], [-100, -260], [0, -250], [100, -255], [200, -280], [320, -300]] },
  { width: 3, points: [[-325, 310], [-220, 290], [-115, 280], [0, 270], [110, 280], [215, 310], [320, 325]] },
];

export function segmentDistance(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}

export function parkClearance(x, z, map, radius = 0) {
  // Keep the entire object inside the fence, including its canopy or foliage.
  const half = map.size / 2;
  if (Math.abs(x) + radius >= half || Math.abs(z) + radius >= half) return false;
  if (Math.abs(x) < 29 && Math.abs(z) < 28) return false;
  if (Math.hypot(x - map.spawn[0], z - map.spawn[2]) < 7) return false;
  if (Math.hypot((x - 190) / 43, (z - 145) / 33) < 1) return false;
  for (const path of PARK_PATHS)
    for (let i = 1; i < path.points.length; i++)
      if (segmentDistance(x, z, path.points[i - 1], path.points[i]) < path.width / 2 + 3) return false;
  for (let i = 0; i < map.gates.length; i++) {
    const a = map.gates[i].p, b = map.gates[(i + 1) % map.gates.length].p;
    if (segmentDistance(x, z, [a[0], a[2]], [b[0], b[2]]) < 5) return false;
  }
  return true;
}

export function chunkRandom(cx, cz) {
  let seed = (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ 817) >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
