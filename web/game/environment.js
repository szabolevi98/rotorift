import * as THREE from "three";
import { buildPark } from "./park.js";
import { parkSurfaceHeight } from "/shared/world/park-layout.js";
import { buildConstruction } from "./construction.js";
import { buildPlayground } from "./playground.js";
export function buildEnvironment(scene, world, RAPIER, map, { bakedCollisions } = {}) {
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
  let park, construction, playground;
  const staticWorld = bakedCollisions ? null : world;
  if (map.kind === "park") park = buildPark(scene, staticWorld, RAPIER, { ...map, gates: [], spawn: map.baseSpawn ?? map.spawn });
  else if(map.kind==="playground")playground=buildPlayground(scene,staticWorld,RAPIER,map);
  else construction = buildConstruction(scene, staticWorld, RAPIER, map);
  const environment=park??construction??playground;
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
  pad.position.set(map.spawn[0], (park ? parkSurfaceHeight(map.spawn[0], map.spawn[2]) + 0.065 : environment.heightAt(map.spawn[0], map.spawn[2])) + 0.003, map.spawn[2]);
  root.add(pad);
  return {
    root,
    update: (position, velocity) => {
      environment?.update(position, velocity);
      bakedCollisions?.update(position, velocity);
    },
    heightAt: (x, z) => park ? parkSurfaceHeight(x, z) : environment.heightAt(x, z),
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
      construction?.dispose();
      playground?.dispose();
      bakedCollisions?.dispose();
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
