import * as THREE from "three";
import { PARK_SPORT } from "../../shared/world/park-layout.js";

export function buildParkCommunity({ root, world, RAPIER, part, palette, geometry, material, materials, textures }) {
  const { clubhouse: club, court, parking } = PARK_SPORT;
  const asphalt = material(0x575f61), courtPaint = material(0x588879);
  const playingSurface = material(0xa67454), white = material(0xf2eee0);
  const red = material(0xbd5140), vehicleGlass = material(0x394e5a, { roughness: 0.2, metalness: 0.4 });
  const tyre = material(0x272b2b);
  const marker = (name, area) => {
    const m = new THREE.Object3D(); m.name = name; m.position.set(area.x, area.baseY, area.z); root.add(m);
  };
  const line = (points, y, radius = 0.055, mat = white) => {
    const curve = new THREE.CurvePath();
    for (let i = 1; i < points.length; i++)
      curve.add(new THREE.LineCurve3(new THREE.Vector3(points[i - 1][0], y, points[i - 1][1]), new THREE.Vector3(points[i][0], y, points[i][1])));
    const mesh = new THREE.Mesh(geometry(new THREE.TubeGeometry(curve, Math.max(2, points.length * 3), radius, 5, false)), mat);
    root.add(mesh);
  };
  const arc = (x, z, radius, start, end, y, mat = white) => line(
    Array.from({ length: 49 }, (_, i) => {
      const a = start + (end - start) * i / 48;
      return [x + Math.cos(a) * radius, z + Math.sin(a) * radius];
    }), y, 0.045, mat);

  // Two small service wings flank an eight-metre, fully open passage.
  // The terrace has its own access, and the pedestrian promenade stays clear.
  marker("community-clubhouse", club);
  const { x: cx, z: cz, baseY: cy } = club;
  part([38, 0.18, 28], [cx, cy + 0.09, cz], palette.paving);
  for (const side of [-1, 1]) {
    const x = cx + side * 10;
    part([12, 4.3, 0.2], [x, cy + 2.33, cz - 10], palette.cedar);
    part([0.2, 4.3, 14], [cx + side * 16, cy + 2.33, cz - 3], palette.cedar);
    part([0.2, 4.3, 14], [cx + side * 4, cy + 2.33, cz - 3], palette.concrete);
    part([12, 1.1, 0.2], [x, cy + 0.73, cz + 4], palette.concrete);
    part([12, 2.9, 0.08], [x, cy + 2.73, cz + 4], vehicleGlass);
    for (const dx of [-5.8, 0, 5.8])
      part([0.09, 4.3, 0.12], [x + dx, cy + 2.33, cz + 4], palette.metal);
  }
  for (const x of [-16, -4, 4, 16])
    part([0.24, 4.3, 0.24], [cx + x, cy + 2.33, cz + 10], palette.metal);
  part([38, 0.24, 26], [cx, cy + 4.6, cz], palette.wood);
  part([38.4, 0.1, 26.4], [cx, cy + 4.77, cz], palette.metal);
  for (let x = -18; x <= 18; x += 0.9)
    part([0.08, 0.06, 25], [cx + x, cy + 4.45, cz], palette.wood, false);
  for (const x of [-11, 11]) {
    part([3, 0.09, 1.2], [cx + x, cy + 0.94, cz + 8], palette.wood);
    for (const dx of [-1.1, 1.1]) part([0.09, 0.72, 1], [cx + x + dx, cy + 0.54, cz + 8], palette.metal);
    for (const z of [-1.2, 1.2]) {
      part([3, 0.08, 0.4], [cx + x, cy + 0.63, cz + 8 + z], palette.wood);
      for (const dx of [-1.1, 1.1]) part([0.08, 0.4, 0.32], [cx + x + dx, cy + 0.38, cz + 8 + z], palette.metal);
    }
  }
  // Roof-mounted solar panels add a recognisable silhouette from above.
  for (const x of [-11, 11]) for (const z of [-5, 1]) {
    part([8, 0.08, 4], [cx + x, cy + 4.89, cz + z], vehicleGlass, false);
    for (let dx = -4; dx <= 4; dx += 1)
      part([0.03, 0.01, 4], [cx + x + dx, cy + 4.94, cz + z], palette.metal, false);
  }
  part([8.2, 0.9, 0.14], [cx, cy + 3.75, cz + 13.25], palette.metal, false);
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 128;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#f3efdd";
    ctx.font = "600 74px sans-serif"; ctx.textAlign = "center"; ctx.fillText("SPORTLIGET", 512, 90);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const signMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true }); materials.add(signMaterial);
    const sign = new THREE.Mesh(geometry(new THREE.PlaneGeometry(7.6, 0.8)), signMaterial);
    sign.position.set(cx, cy + 3.75, cz + 13.33); root.add(sign);
  }

  // Regulation-size basketball playing field inside a paved safety margin.
  // End fences and side rails leave broad, intentional side entrances.
  marker("community-court", court);
  const { x: sx, z: sz, baseY: sy } = court;
  part([26, 0.1, 40], [sx, sy + 0.05, sz], palette.paving);
  part([19, 0.025, 32], [sx, sy + 0.1125, sz], courtPaint);
  part([15, 0.012, 28], [sx, sy + 0.131, sz], playingSurface);
  const ly = sy + 0.155;
  line([[sx - 7.5, sz - 14], [sx + 7.5, sz - 14], [sx + 7.5, sz + 14], [sx - 7.5, sz + 14], [sx - 7.5, sz - 14]], ly);
  line([[sx - 7.5, sz], [sx + 7.5, sz]], ly);
  arc(sx, sz, 1.8, 0, Math.PI * 2, ly);
  for (const side of [-1, 1]) {
    const baseline = sz + side * 14, freeThrow = sz + side * 8.2;
    line([[sx - 2.45, baseline], [sx - 2.45, freeThrow], [sx + 2.45, freeThrow], [sx + 2.45, baseline]], ly);
    arc(sx, freeThrow, 1.8, side > 0 ? Math.PI : 0, side > 0 ? Math.PI * 2 : Math.PI, ly);
    arc(sx, sz + side * 12.425, 6.75, side > 0 ? Math.PI : 0, side > 0 ? Math.PI * 2 : Math.PI, ly);
    const poleZ = sz + side * 17, hoopZ = sz + side * 12.425;
    part([0.18, 3.65, 0.18], [sx, sy + 1.95, poleZ], palette.metal);
    part([0.15, 0.15, 3.8], [sx, sy + 3.5, poleZ - side * 1.9], palette.metal);
    part([1.8, 1.05, 0.1], [sx, sy + 3.65, sz + side * 13], white);
    const rim = new THREE.Mesh(geometry(new THREE.TorusGeometry(0.225, 0.035, 8, 28)), red);
    rim.rotation.x = Math.PI / 2; rim.position.set(sx, sy + 3.175, hoopZ); root.add(rim);
    world.createCollider(RAPIER.ColliderDesc.trimesh(rim.geometry.attributes.position.array, new Uint32Array(rim.geometry.index.array))
      .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }).setTranslation(sx, sy + 3.175, hoopZ));
    const z = sz + side * 19;
    for (let x = -12; x <= 12; x += 4) part([0.08, 3, 0.08], [sx + x, sy + 1.6, z], palette.metal);
    for (const h of [0.4, 1.5, 2.95]) part([24, 0.055, 0.055], [sx, sy + h + 0.1, z], palette.metal);
    for (let x = -12; x <= 12; x += 0.6)
      part([0.018, 2.8, 0.018], [sx + x, sy + 1.55, z], palette.metal, false);
    for (const row of [-1, 1]) {
      const x = sx + side * 12, z = sz + row * 11;
      for (const dz of [-7, 7]) part([0.08, 1.1, 0.08], [x, sy + 0.65, z + dz], palette.metal);
      part([0.055, 0.055, 14], [x, sy + 1.2, z], palette.metal);
    }
  }

  marker("community-parking", parking);
  const { x: px, z: pz, baseY: py } = parking;
  part([54, 0.12, 46], [px, py + 0.06, pz], asphalt);
  for (const side of [-1, 1]) {
    part([54, 0.22, 0.3], [px, py + 0.23, pz + side * 23], palette.concrete);
    // Low carports shade the northern and southern rows, clear of the driveway.
    const rowZ = pz + side * 16;
    for (let x = -24; x <= 24; x += 12)
      part([0.15, 3.3, 0.15], [px + x, py + 1.77, rowZ + side * 4], palette.metal);
    part([52, 0.15, 10], [px, py + 3.49, rowZ], palette.metal);
    for (let x = -24; x <= 24; x += 6) {
      part([0.09, 0.16, 10], [px + x, py + 3.32, rowZ], palette.wood);
      part([0.09, 0.012, 10], [px + x, py + 0.133, rowZ], white, false);
    }
    part([48, 0.012, 0.1], [px, py + 0.133, rowZ - side * 5], white, false);
    for (let x = -21; x <= 21; x += 6)
      part([1.8, 0.12, 0.18], [px + x, py + 0.18, rowZ + side * 2.4], palette.concrete);
  }
  part([0.3, 0.22, 46], [px + 27, py + 0.23, pz], palette.concrete);
  for (const side of [-1, 1])
    part([0.3, 0.22, 18], [px - 27, py + 0.23, pz + side * 14], palette.concrete);
  for (const [x, z, color] of [[-21, -16, 0xbb5c49], [-3, -16, 0xc5c6b9], [15, -16, 0x58778c], [-15, 16, 0x697c57], [9, 16, 0xb5a47d]]) {
    const body = material(color, { roughness: 0.4, metalness: 0.35 });
    const wx = px + x, wz = pz + z;
    part([1.85, 0.65, 4.25], [wx, py + 0.68, wz], body);
    part([1.6, 0.57, 2.3], [wx, py + 1.23, wz - 0.1], vehicleGlass);
    part([1.63, 0.06, 2.35], [wx, py + 1.55, wz - 0.1], body);
    for (const dx of [-0.94, 0.94]) for (const dz of [-1.35, 1.35]) {
      const wheel = new THREE.Mesh(geometry(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 14)), tyre);
      wheel.rotation.z = Math.PI / 2; wheel.position.set(wx + dx, py + 0.44, wz + dz); root.add(wheel);
      wheel.castShadow = true;
    }
    for (const side of [-1, 1]) for (const dx of [-0.6, 0.6])
      part([0.35, 0.16, 0.035], [wx + dx, py + 0.75, wz + side * 2.145], side < 0 ? white : red, false);
  }
}
