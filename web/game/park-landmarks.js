import * as THREE from "three";
import { PARK_BUILDINGS, PARK_LAKES, parkSurfaceHeight } from "../../shared/world/park-layout.js";

export function buildParkLandmarks({ root, world, RAPIER, part, palette, geometry, material, materials, textures }) {
  const markers = [];
  const mark = (id, p) => {
    const marker = new THREE.Object3D(); marker.name = id; marker.position.set(...p);
    root.add(marker); markers.push(marker);
  };
  // An open boathouse: its front bays, side aisle, veranda and jetty can be flown.
  const boat = PARK_BUILDINGS.find((b) => b.id === "boathouse");
  const { x: bx, z: bz, baseY: by } = boat;
  mark("boathouse", [bx, by, bz]);
  part([20, 0.25, 18], [bx, by + 0.125, bz], palette.paving);
  for (const x of [-7.5, 0, 7.5]) for (const z of [-5.5, 5.5])
    part([0.22, 3.43, 0.22], [bx + x, by + 1.965, bz + z], palette.wood);
  part([16, 3.43, 0.16], [bx, by + 1.965, bz - 5.5], palette.cedar);
  part([0.16, 3.43, 11], [bx + 7.5, by + 1.965, bz], palette.cedar);
  part([21, 0.24, 17], [bx, by + 3.8, bz], palette.metal);
  for (let i = 0; i < 9; i++)
    part([0.06, 0.035, 17], [bx - 10 + i * 2.5, by + 3.9375, bz], palette.dark, false);
  for (const z of [-5.5, 5.5])
    part([15, 0.18, 0.2], [bx, by + 3.57, bz + z], palette.wood);
  // Short jetty projects into the large lake, with a generous clear underside.
  const dockY = by + 0.25, dockStart = bx - 10, dockEnd = -167;
  mark("lake-jetty", [(dockStart + dockEnd) / 2, dockY, bz]);
  const narrowEnd = dockEnd + 12;
  part([dockStart - narrowEnd, 0.2, 4.8], [(dockStart + narrowEnd) / 2, dockY - 0.1, bz], palette.wood);
  for (let x = narrowEnd + 1; x <= dockStart; x += 8) for (const side of [-1, 1]) {
    const z = bz + side * 2.1, ground = parkSurfaceHeight(x, z);
    const bottom = Math.min(ground - 0.3, dockY - 0.35);
    part([0.18, dockY - bottom, 0.18], [x, (dockY + bottom) / 2, z], palette.wood);
    part([0.065, 0.95, 0.065], [x, dockY + 0.475, z], palette.metal);
  }
  for (const side of [-1, 1])
    part([dockStart - narrowEnd, 0.055, 0.055], [(dockStart + narrowEnd) / 2, dockY + 0.92, bz + side * 2.1], palette.metal);
  for (let x = dockEnd; x < dockStart; x += 0.65)
    part([0.025, 0.008, 4.75], [x, dockY + 0.006, bz], palette.cedar, false);
  part([12, 0.2, 12], [dockEnd + 6, dockY - 0.1, bz], palette.wood);
  for (const x of [dockEnd + 0.3, narrowEnd - 0.3]) for (const side of [-1, 1]) {
    const z = bz + side * 5.7, ground = parkSurfaceHeight(x, z) - 0.3;
    part([0.22, dockY - ground, 0.22], [x, (dockY + ground) / 2, z], palette.wood);
    part([0.075, 0.95, 0.075], [x, dockY + 0.475, z], palette.metal);
  }
  for (const side of [-1, 1]) {
    part([11.4, 0.055, 0.055], [dockEnd + 6, dockY + 0.92, bz + side * 5.7], palette.metal);
    part([0.055, 0.055, 3.6], [narrowEnd - 0.3, dockY + 0.92, bz + side * 3.9], palette.metal);
  }
  part([0.055, 0.055, 11.4], [dockEnd + 0.3, dockY + 0.92, bz], palette.metal);

  // Small cafe with a covered terrace and open side bays rather than a solid box.
  const cafe = PARK_BUILDINGS.find((b) => b.id === "cafe");
  const { x: cx, z: cz, baseY: cy } = cafe;
  mark("terrace-cafe", [cx, cy, cz]);
  part([30, 0.2, 25], [cx, cy + 0.1, cz], palette.paving);
  for (const x of [-11, 0, 11]) for (const z of [-8, 8])
    part([0.2, 4.2, 0.2], [cx + x, cy + 2.3, cz + z], palette.metal);
  part([22, 4.2, 0.18], [cx, cy + 2.3, cz - 8], palette.cedar);
  part([0.18, 4.2, 10], [cx - 11, cy + 2.3, cz - 3], palette.cedar);
  part([8.5, 1.2, 0.2], [cx - 6.7, cy + 0.8, cz + 2], palette.concrete);
  part([8.5, 2.75, 0.08], [cx - 6.7, cy + 2.775, cz + 2], palette.glass);
  for (const x of [-10.8, -6.7, -2.5])
    part([0.08, 3.95, 0.12], [cx + x, cy + 2.225, cz + 2], palette.metal);
  part([26.6, 0.2, 20.6], [cx, cy + 4.5, cz], palette.wood);
  part([27, 0.1, 21], [cx, cy + 4.65, cz], palette.metal);
  for (let x = -12; x <= 12; x += 0.8)
    part([0.1, 0.07, 18], [cx + x, cy + 4.365, cz], palette.wood, false);
  part([7.5, 0.85, 0.18], [cx + 5.7, cy + 3.65, cz + 8.1], palette.metal, false);
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f7f0d8"; ctx.font = "600 72px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("LIGET CAFÉ", 512, 90);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const signMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true }); materials.add(signMaterial);
    const sign = new THREE.Mesh(geometry(new THREE.PlaneGeometry(7, 0.75)), signMaterial);
    sign.position.set(cx + 5.7, cy + 3.65, cz + 8.21); root.add(sign);
  }
  for (const x of [-5, 6]) {
    part([2.2, 0.09, 1.1], [cx + x, cy + 0.96, cz + 9.5], palette.wood);
    for (const side of [-0.8, 0.8]) {
      part([0.08, 0.72, 0.7], [cx + x + side, cy + 0.56, cz + 9.5], palette.metal);
      part([0.1, 0.08, 2.4], [cx + x + side, cy + 0.58, cz + 9.5], palette.metal);
    }
    for (const side of [-1, 1])
      part([2.2, 0.08, 0.35], [cx + x, cy + 0.65, cz + 9.5 + side], palette.wood);
  }

  // The smaller lake has a real pedestrian bridge, with clear gaps between piers.
  const small = PARK_LAKES.find((lake) => !lake.fountain);
  const bridgeY = 2.8, length = 116;
  mark("garden-bridge", [small.x, bridgeY, small.z]);
  part([length, 0.22, 6], [small.x, bridgeY - 0.11, small.z], palette.wood);
  for (const side of [-1, 1]) {
    for (const x of [-54, -27, 0, 27, 54]) {
      const wx = small.x + x, wz = small.z + side * 2.65;
      const ground = Math.min(parkSurfaceHeight(wx, wz) - 0.35, bridgeY - 0.4);
      part([0.24, bridgeY - ground, 0.24], [wx, (bridgeY + ground) / 2, wz], palette.concrete);
      part([0.08, 1.15, 0.08], [wx, bridgeY + 0.575, wz], palette.metal);
    }
    for (const h of [0.42, 1.1])
      part([length, 0.055, 0.055], [small.x, bridgeY + h, small.z + side * 2.65], palette.metal);
    part([length, 0.28, 0.16], [small.x, bridgeY - 0.32, small.z + side * 2.55], palette.cedar);
  }
  for (let x = -length / 2; x < length / 2; x += 0.8)
    part([0.025, 0.008, 5.8], [small.x + x, bridgeY + 0.006, small.z], palette.cedar, false);
  for (const side of [-1, 1]) {
    const startX = small.x + side * length / 2, endX = startX + side * 16;
    const positions = [startX, bridgeY, small.z - 3, startX, bridgeY, small.z + 3,
      endX, parkSurfaceHeight(endX, small.z - 3) + 0.06, small.z - 3,
      endX, parkSurfaceHeight(endX, small.z + 3) + 0.06, small.z + 3];
    const rampGeometry = geometry(new THREE.BufferGeometry());
    rampGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    rampGeometry.setIndex(side > 0 ? [0, 1, 2, 1, 3, 2] : [0, 2, 1, 1, 2, 3]);
    rampGeometry.computeVertexNormals();
    const ramp = new THREE.Mesh(rampGeometry, palette.wood); ramp.receiveShadow = true; root.add(ramp);
    world.createCollider(RAPIER.ColliderDesc.trimesh(rampGeometry.attributes.position.array,
      new Uint32Array(rampGeometry.index.array)).setFriction(0.9));
  }

  // Linear, open shade arcade: long runs, column slalom, and side exits.
  const ax = 170, az = -76;
  let top = 0;
  for (let x = -24; x <= 24; x += 8) for (const z of [-4, 4])
    top = Math.max(top, parkSurfaceHeight(ax + x, az + z) + 4.8);
  mark("shade-arcade", [ax, top, az]);
  for (const z of [-4, 4]) {
    for (let x = -24; x <= 24; x += 8) {
      const ground = parkSurfaceHeight(ax + x, az + z), height = top - ground;
      part([0.2, height, 0.2], [ax + x, ground + height / 2, az + z], palette.concrete);
    }
    part([50, 0.22, 0.22], [ax, top + 0.11, az + z], palette.wood);
  }
  for (let x = -25; x <= 25; x += 0.85)
    part([0.14, 0.14, 10], [ax + x, top + 0.29, az], palette.wood);

  // Octagonal hilltop pavilion, with space to thread between its columns.
  const gx = -210, gz = 180;
  let floor = parkSurfaceHeight(gx, gz) + 0.45;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    floor = Math.max(floor, parkSurfaceHeight(gx + Math.cos(a) * 6, gz + Math.sin(a) * 6) + 0.3);
  }
  mark("hilltop-pavilion", [gx, floor, gz]);
  part([6.5, 0.25, 6.5], [gx, floor - 0.125, gz], palette.wood, true, 0, "cylinder");
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, x = gx + Math.cos(a) * 5.7, z = gz + Math.sin(a) * 5.7;
    part([0.2, 4.3, 0.2], [x, floor + 2.15, z], palette.wood);
    const ground = parkSurfaceHeight(x, z);
    part([0.26, floor - ground, 0.26], [x, (floor + ground) / 2, z], palette.concrete);
  }
  const roof = new THREE.Mesh(geometry(new THREE.ConeGeometry(8, 2, 8)), palette.metal);
  roof.position.set(gx, floor + 5.3, gz); roof.castShadow = roof.receiveShadow = true; root.add(roof);
  world.createCollider(RAPIER.ColliderDesc.cone(1, 8).setTranslation(gx, floor + 5.3, gz));
  const stairEnd = parkSurfaceHeight(gx, gz + 11) + 0.06;
  for (let i = 0; i < 7; i++) {
    const z = gz + 6.5 + (i + 0.5) * 0.65, ground = parkSurfaceHeight(gx, z);
    const top = floor + (stairEnd - floor) * (i + 1) / 7;
    if (top > ground) part([3.5, top - ground, 0.67], [gx, (top + ground) / 2, z], palette.wood);
  }

  // Fountain jets and moving droplets. Water has no solid jet colliders.
  const large = PARK_LAKES.find((lake) => lake.fountain);
  const fountain = new THREE.Group(); fountain.name = "lake-fountain"; root.add(fountain);
  const center = new THREE.Vector3(large.x, large.waterY + 0.2, large.z);
  part([1.8, 0.3, 1.8], [large.x, large.waterY - 0.1, large.z], palette.concrete, true, 0, "cylinder");
  part([0.18, 0.8, 0.18], [large.x, large.waterY + 0.4, large.z], palette.metal, true, 0, "cylinder");
  const jetMaterial = material(0xd2edeb, { roughness: 0.22, transparent: true, opacity: 0.62, depthWrite: false });
  const trajectories = [];
  for (let i = 0; i < 13; i++) {
    const a = i / 12 * Math.PI * 2, radius = i === 12 ? 0.3 : 6;
    const height = i === 12 ? 10 : 6.5;
    const points = Array.from({ length: 33 }, (_, j) => {
      const u = j / 32;
      return center.clone().add(new THREE.Vector3(Math.cos(a) * radius * u, 4 * height * u * (1 - u), Math.sin(a) * radius * u));
    });
    const curve = new THREE.CatmullRomCurve3(points);
    trajectories.push(curve);
    const jet = new THREE.Mesh(geometry(new THREE.TubeGeometry(curve, 32, i === 12 ? 0.075 : 0.045, 5, false)), jetMaterial);
    fountain.add(jet);
  }
  const dropletsGeometry = geometry(new THREE.BufferGeometry());
  const droplets = new Float32Array(trajectories.length * 24 * 3);
  dropletsGeometry.setAttribute("position", new THREE.BufferAttribute(droplets, 3));
  const dropletMaterial = new THREE.PointsMaterial({ color: 0xe8ffff, size: 0.13, transparent: true, opacity: 0.8, depthWrite: false });
  materials.add(dropletMaterial);
  const spray = new THREE.Points(dropletsGeometry, dropletMaterial); spray.frustumCulled = false; fountain.add(spray);
  const point = new THREE.Vector3();
  function update(time) {
    for (let jet = 0; jet < trajectories.length; jet++) for (let drop = 0; drop < 24; drop++) {
      const u = (drop / 24 + time * 0.24 + jet * 0.071) % 1;
      trajectories[jet].getPoint(u, point);
      point.x += Math.sin(drop * 3.7 + time * 5) * 0.055;
      point.z += Math.cos(drop * 2.3 + time * 6) * 0.055;
      point.toArray(droplets, (jet * 24 + drop) * 3);
    }
    dropletsGeometry.attributes.position.needsUpdate = true;
  }
  update(0);
  return { update, markers };
}
