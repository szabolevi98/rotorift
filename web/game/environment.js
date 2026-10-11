import * as THREE from "three";
import { buildPark } from "./park.js";
import { parkSurfaceHeight } from "/shared/world/park-layout.js";
export function buildEnvironment(scene, world, RAPIER, map) {
  const root = new THREE.Group();
  scene.add(root);
  const materials = new Map();
  const material = (color) => {
    if (!materials.has(color))
      materials.set(
        color,
        new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
      );
    return materials.get(color);
  };
  const box = (size, p, color, solid = true, q = null) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color));
    m.position.set(...p);
    if (q) m.quaternion.copy(q);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    if (solid) {
      const d = RAPIER.ColliderDesc.cuboid(...size.map((v) => v / 2))
        .setTranslation(...p)
        .setFriction(0.8);
      if (q) d.setRotation(q);
      world.createCollider(d);
    }
    return m;
  };
  let park;
  if (map.kind === "park") {
    park = buildPark(scene, world, RAPIER, map);
  } else {
    box([map.size, 1, map.size], [0, -0.5, 0], 0xb6af9b);
    for (const y of [5, 10]) {
      box([11, 0.35, 44], [-8.5, y, -12], 0x969991);
      box([19, 0.35, 44], [12.5, y, -12], 0x969991);
      for (const x of [-14, 8, 22])
        for (const z of [-34, -12, 10])
          box([0.65, 4.65, 0.65], [x, y - 2.5, z], 0x858b87);
      for (const z of [-34, 10])
        box([36, 0.65, 0.6], [4, y - 0.5, z], 0x737b75);
    }
    for (const [x, z, color] of [
      [-30, 12, 0x8c6550],
      [-30, -5, 0x697d78],
      [40, 14, 0x9b8c63],
    ]) {
      box([7, 3.5, 3], [x, 1.75, z], color);
      for (let i = 0; i < 16; i++)
        box([0.05, 3.3, 3.06], [x - 3.2 + i * 0.42, 1.75, z], 0x45534e, false);
    }
    for (let i = 0; i < 6; i++)
      box([3, 0.25, 1], [34, 0.13 + i * 0.27, -30], 0x9d8d75);
    box([0.55, 20, 0.55], [-24, 10, -32], 0xc8a353);
    box([35, 0.5, 0.55], [-10, 20, -32], 0xc8a353);
    box([0.1, 12, 0.1], [7, 14, -32], 0x454d4a, false);
    for (const z of [0, 8, 16]) {
      box([1.6, 1.2, 0.12], [-8, 0.9, z], 0xecad54);
      box([1.6, 0.15, 0.15], [-8, 0.35, z], 0x424940);
    }
  }
  if (map.kind !== "park") {
  for (const x of [-map.size / 2, map.size / 2])
    box([0.2, 1.1, map.size], [x, 0.55, 0], 0x696f63);
  for (const z of [-map.size / 2, map.size / 2])
    box([map.size, 1.1, 0.2], [0, 0.55, z], 0x696f63);
  }
  const gateMeshes = [], gateGroups = [], gateColliders = [];
  let gatesEnabled = true;
  map.gates.forEach((gate, i) => {
    const group = new THREE.Group();
    group.position.set(...gate.p);
    group.rotation.y = Math.atan2(gate.n[0], gate.n[2]);
    root.add(group);
    gateGroups.push(group);
    const gateMat = new THREE.MeshStandardMaterial({
      color: i === 0 ? 0xff6648 : 0xf5f0da,
      emissive: 0xff6648,
      emissiveIntensity: i === 0 ? 0.2 : 0,
    });
    const parts = [
      [
        [0.14, gate.height, 0.14],
        [-gate.width / 2, 0, 0],
      ],
      [
        [0.14, gate.height, 0.14],
        [gate.width / 2, 0, 0],
      ],
      [
        [gate.width + 0.14, 0.14, 0.14],
        [0, gate.height / 2, 0],
      ],
    ];
    for (const [size, p] of parts) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), gateMat);
      m.position.set(...p);
      m.castShadow = true;
      group.add(m);
      group.updateMatrixWorld(true);
      const wp = m.getWorldPosition(new THREE.Vector3()),
        q = m.getWorldQuaternion(new THREE.Quaternion());
      gateColliders.push(world.createCollider(
        RAPIER.ColliderDesc.cuboid(...size.map((v) => v / 2))
          .setTranslation(wp.x, wp.y, wp.z)
          .setRotation(q),
      ));
    }
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#202624";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 85px Arial";
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), 64, 94);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.65, 0.65),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
    );
    sign.position.set(0, gate.height / 2 + 0.45, 0);
    group.add(sign);
    gateMeshes.push(gateMat);
  });
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.65, 0.002, 48),
    material(0x232f2d),
  );
  pad.position.set(map.spawn[0], (park ? parkSurfaceHeight(map.spawn[0], map.spawn[2]) + 0.065 : 0) + 0.0018, map.spawn[2]);
  root.add(pad);
  return {
    root,
    update: (position) => park?.update(position),
    heightAt: (x, z) => park ? parkSurfaceHeight(x, z) : 0,
    highlight: (next, enabled) => {
      if (gatesEnabled !== enabled) {
        gatesEnabled = enabled;
        for (const group of gateGroups) group.visible = enabled;
        for (const collider of gateColliders) collider.setEnabled(enabled);
      }
      gateMeshes.forEach((m, i) => {
        m.color.setHex(
          enabled && i === next ? 0xff6648 : i === 0 ? 0xeda889 : 0xf5f0da,
        );
        m.emissiveIntensity = enabled && i === next ? 0.45 : 0;
      });
    },
    dispose: () => {
      park?.dispose();
      root.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            m.map?.dispose();
            m.dispose();
          }
        }
      });
      scene.remove(root);
    },
  };
}
