// Metres, +Y up, arrival from the south looking towards -Z.
export const CONSTRUCTION_BUILDINGS = [
  { id: "tower-a", x: -62, z: -35, width: 48, depth: 42, nx: 4, nz: 3, levels: 11, storey: 4.4 },
  { id: "tower-b", x: 58, z: -85, width: 54, depth: 36, nx: 4, nz: 3, levels: 8, storey: 4.5 },
  { id: "south-frame", x: -68, z: 85, width: 42, depth: 36, nx: 3, nz: 3, levels: 6, storey: 4.4 },
  { id: "east-frame", x: 130, z: 48, width: 48, depth: 42, nx: 4, nz: 3, levels: 5, storey: 4.6 },
  { id: "parking-frame", x: -180, z: -105, width: 54, depth: 42, nx: 4, nz: 3, levels: 3, storey: 4.1 },
  { id: "north-podium", x: -70, z: -235, width: 84, depth: 50, nx: 6, nz: 4, levels: 3, storey: 4.5 },
  { id: "west-annex", x: -205, z: 10, width: 42, depth: 38, nx: 3, nz: 3, levels: 2, storey: 4.5 },
  { id: "east-shell", x: 255, z: -75, width: 36, depth: 40, nx: 3, nz: 3, levels: 4, storey: 4.4 },
];
export const CONSTRUCTION_CRANES = [
  { id: "crane-a", x: -104, z: -72, height: 76, boom: 80, angle: 0.35, color: "ochre" },
  { id: "crane-b", x: 96, z: -125, height: 64, boom: 72, angle: -0.55, color: "red" },
  { id: "crane-c", x: -123, z: 127, height: 48, boom: 62, angle: 2.35, color: "ochre" },
];
export const CONSTRUCTION_PIT = { x: -178, z: 100, width: 48, depth: 40, floor: -4.5, slope: 5 };
export const CONSTRUCTION_HANGAR = { x: -136, z: -20, width: 56, depth: 50 };
export const CONSTRUCTION_ROAD_HEIGHT = 0.085;
export const CONSTRUCTION_VEHICLES = [
  { id: "haul-truck", type: "truck", x: 14, z: 184, angle: 0 },
  { id: "low-loader", type: "truck", x: 185, z: -30, angle: Math.PI / 2, flatbed: true },
  { id: "concrete-mixer", type: "mixer", x: 26, z: 128, angle: 0.3 },
  { id: "excavator", type: "excavator", x: -148, z: 106, angle: 1.15 },
  { id: "bulldozer", type: "bulldozer", x: -135, z: 96, angle: -Math.PI / 2 },
  { id: "site-dumper", type: "dumper", x: 144, z: 166, angle: -0.6 },
  { id: "wheel-loader", type: "loader", x: 184, z: 120, angle: 0.8 },
  { id: "tipper-truck", type: "tipper", x: -128, z: 180, angle: 0.4 },
];
export const CONSTRUCTION_ROADS = [
  { x: 0, z: 0, width: 19, depth: 570 },
  { x: 0, z: 205, width: 515, depth: 16 },
  { x: 0, z: -145, width: 515, depth: 14 },
  { x: 211, z: 30, width: 16, depth: 355 },
  { x: -225, z: 205, width: 15, depth: 110 },
  { x: -246, z: 30, width: 13, depth: 462 },
  { x: 0, z: -276, width: 510, depth: 13 },
  { x: -178, z: 43, width: 148, depth: 12 },
  { x: -136, z: 24, width: 20, depth: 40 },
];
export const CONSTRUCTION_YARDS = [
  { x: 172, z: 175, width: 110, depth: 110, elevation: 1.2 },
  { x: -168, z: 239, width: 84, depth: 66, elevation: 0 },
  { x: 65, z: 246, width: 64, depth: 42, elevation: 0 },
  { x: 66, z: 109, width: 52, depth: 30, elevation: 2 },
];
export const CONSTRUCTION_EARTHWORKS = [
  { ...CONSTRUCTION_PIT, id: "west-foundations", elevation: 0 },
  { id: "north-cut", x: -157, z: -197, width: 64, depth: 48, floor: -4, slope: 8, ramp: true },
  { id: "east-basement", x: 237, z: -225, width: 80, depth: 78, floor: -6, slope: 10, ramp: true },
  { id: "south-foundations", x: -65, z: 173, width: 64, depth: 42, floor: -2.8, slope: 6, ramp: true },
];
// Elongated, overlapping deposits made by successive dumper deliveries.
export const CONSTRUCTION_SPOIL = [
  { x: -215, z: 58, rx: 16, rz: 30, height: 6.5 },
  { x: -218, z: 149, rx: 13, rz: 22, height: 5 },
  { x: 173, z: -252, rx: 13, rz: 30, height: 7.5 },
  { x: 274, z: 52, rx: 14, rz: 51, height: 8 },
  { x: 94, z: 178, rx: 13, rz: 20, height: 4 },
  { x: -136, z: 151, rx: 12, rz: 24, height: 4.5 },
  { x: 58, z: -223, rx: 24, rz: 13, height: 6 },
  { x: 60, z: 49, rx: 18, rz: 29, height: 5.5 },
];
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const distanceToPad = (x, z, p) => Math.max(Math.abs(x - p.x) - p.width / 2, Math.abs(z - p.z) - p.depth / 2, 0);
function rawHeight(x, z) {
  const hill = (cx, cz, radius, height) => height * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / radius ** 2);
  return hill(165, -165, 140, 9) + hill(-160, -220, 100, 6)
    + hill(165, 75, 95, 5) - hill(-185, 100, 80, 2)
    + 0.65 * Math.sin(x * 0.042) * Math.sin(z * 0.033);
}
const pads = [
  ...CONSTRUCTION_CRANES.map(c => ({ ...c, width: 16, depth: 16 })),
  ...CONSTRUCTION_VEHICLES.map(v => ({ ...v, width: 8, depth: 12 })),
  { x: 135, z: -185, width: 78, depth: 52 },
  ...CONSTRUCTION_YARDS,
  { x: 165, z: 244, width: 43, depth: 30, elevation: 0 },
  { x: -178, z: 100, width: 72, depth: 64, elevation: 0 },
  { x: 239, z: 103, width: 49, depth: 28 },
  { x: -136, z: -62, width: 36, depth: 12 },
  ...[[-17,-200],[-205,-195],[83,85],[-128,22],[-231,-25]].map(([x,z]) => ({x,z,width:18,depth:24})),
];
const structuralPads = [...CONSTRUCTION_BUILDINGS, CONSTRUCTION_HANGAR].map(b => ({ ...b, width: b.width + 12, depth: b.depth + 12 }));
function terrainHeight(x, z) {
  let height = rawHeight(x, z);
  for (const p of pads) {
    const blend = 1 - smooth(distanceToPad(x, z, p) / 10);
    height += ((p.elevation ?? rawHeight(p.x, p.z)) - height) * blend;
  }
  for (const p of CONSTRUCTION_SPOIL) {
    const sx = (x - p.x) / p.rx, sz = (z - p.z) / p.rz;
    const radius = Math.hypot(sx, sz);
    const profile = Math.max(0, 1 - radius * radius);
    const uneven = 0.85 + 0.12 * Math.sin(x * 0.37 + z * 0.16) + 0.09 * Math.sin(z * 0.55);
    height += p.height * profile ** 1.25 * uneven;
  }
  // Structural pads take precedence over nearby storage/vehicle aprons. Their
  // entire footprint stays level, including corners near another work zone.
  for (const p of structuralPads) {
    const blend = 1 - smooth(distanceToPad(x, z, p) / 10);
    height += (rawHeight(p.x, p.z) - height) * blend;
  }
  for (const p of CONSTRUCTION_EARTHWORKS) {
    const edge = Math.min(p.width / 2 - Math.abs(x - p.x), p.depth / 2 - Math.abs(z - p.z));
    if (edge <= 0) continue;
    const level = p.elevation ?? rawHeight(p.x, p.z);
    let cut = Math.min(1, edge / p.slope);
    // A ten-metre-wide haul ramp descends from the south rim to the floor.
    if (p.ramp) {
      const lane = 1 - smooth((Math.abs(x - p.x) - 5) / 3);
      const rampCut = Math.max(0, Math.min(1, (p.z + p.depth / 2 - z) / (p.depth * 0.33)));
      cut += (Math.min(cut, rampCut) - cut) * lane;
    }
    height = level + p.floor * cut;
  }
  // The entry spine remains graded; side roads follow the broad site terraces.
  height *= smooth((Math.abs(x) - 11) / 15);
  // A bare, continuous landscape meets the perimeter without a raised seam.
  return height * (1 - smooth((Math.max(Math.abs(x), Math.abs(z)) - 280) / 20));
}
export function constructionHeight(x, z) {
  if (Math.max(Math.abs(x), Math.abs(z)) >= 300) return constructionLandscapeHeight(x, z);
  // Match the two triangles of each two-metre terrain cell exactly. Roads,
  // spawn heights and supports consequently agree with the collision mesh.
  const gx = Math.floor(x / 2) * 2, gz = Math.floor(z / 2) * 2;
  const tx = (x - gx) / 2, tz = (z - gz) / 2;
  if (tx === 0 && tz === 0) return terrainHeight(x, z);
  if (tx + tz <= 1) return terrainHeight(gx, gz) * (1 - tx - tz)
    + terrainHeight(gx + 2, gz) * tx + terrainHeight(gx, gz + 2) * tz;
  return terrainHeight(gx + 2, gz + 2) * (tx + tz - 1)
    + terrainHeight(gx + 2, gz) * (1 - tz) + terrainHeight(gx, gz + 2) * (1 - tx);
}
export function constructionLandscapeHeight(x, z) {
  const radius = Math.max(Math.abs(x), Math.abs(z));
  const blend = smooth((radius - 300) / 120) * (1 - smooth((radius - 24000) / 4000));
  return blend * (1.8 * Math.sin(x * 0.003) * Math.cos(z * 0.004) + 1.2 * Math.sin((x + z) * 0.0018));
}
export function constructionSurfaceHeight(x, z) {
  const road = [...CONSTRUCTION_ROADS, ...CONSTRUCTION_YARDS].some(p => distanceToPad(x, z, p) === 0);
  return constructionHeight(x, z) + (road ? CONSTRUCTION_ROAD_HEIGHT : 0);
}
export function floorOpening(building) {
  return [building.x - building.width / 2 + building.width / building.nx * 1.5,
    building.z - building.depth / 2 + building.depth / building.nz * 1.5];
}
