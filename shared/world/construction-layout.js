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
export function constructionHeight(x, z) {
  const p = CONSTRUCTION_PIT;
  const edge = Math.min(p.width / 2 - Math.abs(x - p.x), p.depth / 2 - Math.abs(z - p.z));
  return edge <= 0 ? 0 : p.floor * Math.min(1, edge / p.slope);
}
export function floorOpening(building) {
  return [building.x - building.width / 2 + building.width / building.nx * 1.5,
    building.z - building.depth / 2 + building.depth / building.nz * 1.5];
}
