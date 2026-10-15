import * as THREE from "three";

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
const bridgeLake = PARK_LAKES.find(lake => lake.id === 'garden-lake');
export const PARK_BRIDGE = { x:bridgeLake.x, z:bridgeLake.z, length:116, width:6, rampLength:16, deckY:2.8 };
export const PARK_BUILDINGS = [
  { id: "boathouse", x: -74, z: -130, width: 16, depth: 12, baseY: 2.75 },
  { id: "cafe", x: 110, z: -155, width: 22, depth: 14, baseY: 2 },
  { id: "community-clubhouse", x: -58, z: 180, width: 38, depth: 28, baseY: 3 },
];
export const PARK_SPORT = {
  clubhouse: PARK_BUILDINGS[2],
  court: { x: -58, z: 238, width: 26, depth: 40, baseY: 3 },
  parking: { x: 58, z: 238, width: 54, depth: 46, baseY: 2.2 },
};
export const PARK_CLEARINGS = [
  { x: 0, z: 0, rx: 55, rz: 48 },
  { x: 5, z: 205, rx: 103, rz: 78 },
  { x: 170, z: -76, rx: 52, rz: 22 },
  { x: -210, z: 180, rx: 30, rz: 30 },
  { x: -52, z: -88, rx: 12, rz: 15 },
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
// the community lawns, paths, water and building approaches.
export const PARK_TREE_POSITIONS = groves.flatMap(([x, z, radius, count], grove) =>
  Array.from({ length: count }, (_, i) => {
    const a = i * 2.39996323 + grove, r = radius * Math.sqrt((i + 0.5) / count);
    return [x + Math.cos(a) * r, z + Math.sin(a) * r];
  }),
).concat(
  Array.from({ length: 19 }, (_, i) => -315 + i * 35).flatMap((z) => [[-20, z], [20, z]]),
  PARK_LAKES.flatMap((lake, i) => lakeOutline(lake, 1.65, i === 0 ? 28 : 18).slice(0, -1)),
  // Stand back from the bridge approaches instead of growing out of its deck.
  [[106, 151], [281, 196]],
);

// Small planting islands break up the large lawns without closing flight lines.
// Fixed centres make the composition reproducible in the game and showcase.
const shrubPatches = [
  [-74,-180], [55,-215], [143,-286], [-155,-307], [-313,-189],
  [-130,-28], [-57,46], [45,65], [-105,98], [92,153],
  [244,10], [276,101], [323,194], [236,260], [177,302],
  [62,320], [-78,318], [-172,249], [-247,208], [-309,65],
  [-197,6], [191,-8], [100,-65], [52,-45],
];
export const PARK_SHRUB_POSITIONS = shrubPatches.flatMap(([x,z], patch) =>
  Array.from({length:7}, (_, i) => {
    const angle=i*2.39996323+patch*.7, radius=2+Math.sqrt(i/6)*(6+patch%4);
    return {x:x+Math.cos(angle)*radius,z:z+Math.sin(angle)*radius,
      height:.55+(i%3)*.18,angle,shade:(patch+i)%3};
  }));

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
  for (const area of [PARK_SPORT.court, PARK_SPORT.parking]) {
    const edge = Math.max(Math.abs(x - area.x) - area.width / 2, Math.abs(z - area.z) - area.depth / 2);
    height = area.baseY + (height - area.baseY) * smooth(3, 14, edge);
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
// The eastern lakeside promenade skirts the boathouse and its veranda.
// Keep the dock on the lake side of this route, rather than across the path.
const lakePromenade = lakeOutline(PARK_LAKES[0], 1.32).map(([x, z]) => {
  const detour = 1 - smooth(15, 49, Math.abs(z + 130));
  return [x > -140 ? x + (-51 - x) * detour : x, z];
});
export const PARK_PATHS = [
  { width: 7, points: [[0, -350], [0, 350]], paving: true },
  { width: 4.2, points: ring },
  { width: 4.2, points: [[0, -65], [-50, -65], [-95, -55], [-140, -38], [-215, -32], [-295, -60], [-345, -100]] },
  { width: 4.2, points: [[0, -110], [45, -128], [80, -135], [110, -135], [130, -105], [146, -76], [194, -76], [235, -60], [295, -45], [345, -30]] },
  { width: 3.4, points: lakePromenade },
  { width: 3.2, points: lakeOutline(PARK_LAKES[1], 1.38) },
  { width: 3.5, points: [[0, 85], [65, 100], [120, 125], [170, 125], [240, 135], [275, 205], [295, 270], [330, 325]] },
  { width: 3.2, points: [[-140, 30], [-190, 80], [-190, 135], [-190, 180], [-208, 213], [-230, 245], [-270, 310]] },
  { width: 3, points: [[-320, -285], [-210, -270], [-100, -250], [0, -235], [110, -255], [225, -295], [320, -300]] },
  { width: 3, points: [[-325, 310], [-220, 290], [-115, 280], [0, 290], [110, 280], [215, 310], [320, 325]] },
  { width: 3, points: [[-51, -114], [-61, -114], [-74, -114], [-74, -121]] },
  { width: 3, points: [[-190, 196], [-201, 197], [-210, 192]] },
  { width: 2.6, points: [[-52, -65], [-52, -74], [-52, -77]] },
  { width: 3, points: [[110, -135], [110, -142.5]] },
  { width: 3, points: [[264, 175], [268, 181], [270, 190]] },
  // Community area branches leave the main promenade uninterrupted.
  { width: 3.4, points: [[0, 202], [-25, 202], [-58, 202], [-58, 194]] },
  { width: 3, points: [[-28, 202], [-28, 223], [-28, 238], [-45, 238]] },
  { width: 3, points: [[-28, 238], [-28, 263], [-40, 279], [-58, 283]] },
  { width: 7, points: [[0, 238], [16, 238], [31, 238]] },
];

// Rendering, furnishing and vegetation all use the same curved centerlines.
export function sampleParkPath(points) {
  const closed = points.length > 3 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1];
  const curve = new THREE.CatmullRomCurve3((closed ? points.slice(0, -1) : points).map(([x, z]) => new THREE.Vector3(x, 0, z)), closed);
  const steps = Math.max(2, Math.ceil(curve.getLength() / 2));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const p = curve.getPoint(i / steps), t = curve.getTangent(i / steps);
    return { x: p.x, z: p.z, tx: t.x, tz: t.z };
  });
}
export const PARK_PATH_SAMPLES = PARK_PATHS.map((path) => sampleParkPath(path.points));
export function pathClearance(x, z) {
  return Math.min(...PARK_PATHS.map((path, index) => {
    const points = PARK_PATH_SAMPLES[index];
    let distance = Infinity;
    for (let i = 1; i < points.length; i++)
      distance = Math.min(distance, segmentDistance(x, z,
        [points[i - 1].x, points[i - 1].z], [points[i].x, points[i].z]));
    return distance - path.width / 2;
  }));
}
export const PARK_GARDEN = { x: -52, z: -88, width: 12, depth: 22 };
// Benches face their promenade; the whole seat sits in an adjacent gravel bay.
export const PARK_BENCHES = [
  [0, 0.12, -1], [0, 0.25, 1], [0, 0.65, -1], [0, 0.91, 1],
  [1, 0.08, -1], [1, 0.31, -1], [1, 0.57, -1], [1, 0.81, -1],
  [4, 0.3, -1], [4, 0.57, -1], [4, 0.76, -1],
  [5, 0.22, -1], [5, 0.6, -1],
].map(([index, t, side]) => {
  const samples = PARK_PATH_SAMPLES[index], p = samples[Math.round(t * (samples.length - 1))];
  const offset = side * (PARK_PATHS[index].width / 2 + 1.9);
  return { x: p.x - p.tz * offset, z: p.z + p.tx * offset,
    angle: Math.atan2(-p.tz, p.tx) + (side < 0 ? Math.PI : 0), tx: p.tx, tz: p.tz };
}).filter(({ x, z }) => pathClearance(x, z) > 1.5);

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
  if (Math.abs(x-PARK_BRIDGE.x) < PARK_BRIDGE.length/2+PARK_BRIDGE.rampLength+8+radius
    && Math.abs(z-PARK_BRIDGE.z) < PARK_BRIDGE.width/2+2+radius) return false;
  for (const lake of PARK_LAKES)
    if (lakeDistance(lake, x, z) < 1.23 + radius / Math.min(lake.rx, lake.rz)) return false;
  for (const b of PARK_BUILDINGS)
    if (Math.abs(x - b.x) < b.width / 2 + 12 + radius && Math.abs(z - b.z) < b.depth / 2 + 12 + radius) return false;
  for (const area of [PARK_SPORT.court, PARK_SPORT.parking])
    if (Math.abs(x - area.x) < area.width / 2 + 3 + radius && Math.abs(z - area.z) < area.depth / 2 + 3 + radius) return false;
  for (const clearing of PARK_CLEARINGS)
    if (Math.hypot((x - clearing.x) / (clearing.rx + radius), (z - clearing.z) / (clearing.rz + radius)) < 1) return false;
  if (pathClearance(x, z) < 3) return false;
  for (const seat of PARK_BENCHES)
    if (Math.hypot(x - seat.x, z - seat.z) < radius + 3.5) return false;
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
