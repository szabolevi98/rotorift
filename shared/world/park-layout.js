export const PARK_CHUNK_SIZE = 128;
export const PARK_GRID_STEPS = 64;
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const hill = (x, z, cx, cz, spread, height) =>
  height * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / spread ** 2);

export const PARK_LAKES = [
  { id: "grand-lake", x: -205, z: -130, rx: 86, rz: 60, waterY: 0.35, fountain: true, phase: 0.4 },
  { id: "garden-lake", x: 190, z: 175, rx: 44, rz: 31, waterY: 0.25, fountain: false, phase: 1.7 },
];
export const PARK_BUILDINGS = [
  { id: "boathouse", x: -74, z: -130, width: 16, depth: 12, baseY: 2.75 },
  { id: "cafe", x: 110, z: -155, width: 22, depth: 14, baseY: 2 },
];
export const PARK_CLEARINGS = [
  { x: 0, z: 0, rx: 55, rz: 48 },
  { x: 5, z: 205, rx: 103, rz: 78 },
  { x: 170, z: -76, rx: 52, rz: 22 },
  { x: -210, z: 180, rx: 30, rz: 30 },
];
const groves = [
  [-280, -277, 40, 20], [-105, -275, 38, 16], [-15, -195, 34, 14],
  [235, -258, 42, 22], [292, -120, 35, 18], [297, 30, 38, 20],
  [288, 270, 35, 16], [-285, 140, 43, 22], [-98, 155, 34, 12],
  [-130, 285, 34, 16], [-260, 25, 35, 18], [48, -90, 23, 8],
  // Interior groves connect the outer trees to the promenades and landmarks.
  [80, -280, 40, 19], [165, -210, 31, 13], [238, -165, 36, 17],
  [-90, 30, 32, 13], [75, 35, 32, 15], [85, -45, 25, 9],
  [225, 45, 35, 15], [155, 70, 28, 11], [-180, 85, 30, 13],
  [-280, 245, 32, 13], [135, 295, 30, 13], [-40, 315, 22, 7],
];
// Denser groves, lakeside trees and a regular avenue; clearances below preserve
// the southern freestyle meadow, paths, water and building approaches.
export const PARK_TREE_POSITIONS = groves.flatMap(([x, z, radius, count], grove) =>
  Array.from({ length: count }, (_, i) => {
    const a = i * 2.39996323 + grove, r = radius * Math.sqrt((i + 0.5) / count);
    return [x + Math.cos(a) * r, z + Math.sin(a) * r];
  }),
).concat(
  Array.from({ length: 19 }, (_, i) => -315 + i * 35).flatMap((z) => [[-20, z], [20, z]]),
  PARK_LAKES.flatMap((lake, i) => lakeOutline(lake, 1.65, i === 0 ? 28 : 18).slice(0, -1)),
);

export function lakeRadius(lake, angle) {
  return 1 + Math.sin(angle * 3 + lake.phase) * 0.07 + Math.cos(angle * 5 - lake.phase) * 0.04;
}
export function lakeDistance(lake, x, z) {
  const dx = (x - lake.x) / lake.rx, dz = (z - lake.z) / lake.rz;
  return Math.hypot(dx, dz) / lakeRadius(lake, Math.atan2(dz, dx));
}
export function lakeOutline(lake, scale = 1, count = 128) {
  return Array.from({ length: count + 1 }, (_, i) => {
    const a = i / count * Math.PI * 2, r = lakeRadius(lake, a) * scale;
    return [lake.x + Math.cos(a) * lake.rx * r, lake.z + Math.sin(a) * lake.rz * r];
  });
}

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
  let height = rolling * Math.min(1, flat);
  for (const lake of PARK_LAKES) {
    const distance = lakeDistance(lake, x, z);
    if (distance > 1.65) continue;
    const shore = lake.waterY + 0.13;
    const bed = -1.6 + (shore + 1.6) * smooth(0.72, 1.1, distance);
    height = bed + (height - bed) * smooth(1.1, 1.65, distance);
  }
  for (const b of PARK_BUILDINGS) {
    const edge = Math.max(Math.abs(x - b.x) - b.width / 2, Math.abs(z - b.z) - b.depth / 2);
    const blend = smooth(6, 18, edge);
    height = b.baseY + (height - b.baseY) * blend;
  }
  return height;
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
  { width: 4.2, points: [[0, -65], [-50, -65], [-95, -55], [-140, -38], [-215, -32], [-295, -60], [-345, -100]] },
  { width: 4.2, points: [[0, -110], [45, -135], [110, -138], [130, -100], [146, -76], [194, -76], [235, -60], [295, -45], [345, -30]] },
  { width: 3.4, points: lakeOutline(PARK_LAKES[0], 1.32) },
  { width: 3.2, points: lakeOutline(PARK_LAKES[1], 1.38) },
  { width: 3.5, points: [[0, 85], [65, 100], [120, 125], [170, 125], [240, 135], [275, 205], [295, 270], [330, 325]] },
  { width: 3.2, points: [[-140, 30], [-190, 80], [-210, 135], [-210, 180], [-230, 245], [-270, 310]] },
  { width: 3, points: [[-320, -285], [-210, -270], [-100, -250], [0, -235], [110, -255], [225, -295], [320, -300]] },
  { width: 3, points: [[-325, 310], [-220, 290], [-115, 280], [0, 290], [110, 280], [215, 310], [320, 325]] },
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
  for (const lake of PARK_LAKES)
    if (lakeDistance(lake, x, z) < 1.23 + radius / Math.min(lake.rx, lake.rz)) return false;
  for (const b of PARK_BUILDINGS)
    if (Math.abs(x - b.x) < b.width / 2 + 12 + radius && Math.abs(z - b.z) < b.depth / 2 + 12 + radius) return false;
  for (const clearing of PARK_CLEARINGS)
    if (Math.hypot((x - clearing.x) / (clearing.rx + radius), (z - clearing.z) / (clearing.rz + radius)) < 1) return false;
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
