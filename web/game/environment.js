import * as THREE from "three";
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
  box(
    [map.size, 1, map.size],
    [0, -0.5, 0],
    map.kind === "park" ? 0x819663 : 0xb6af9b,
  );
  if (map.kind === "park") {
    box([4, 0.015, 115], [-18, 0.015, 0], 0xc8ba9b, false);
    box([90, 0.018, 3], [0, 0.018, 45], 0xc8ba9b, false);
    let seed = 817;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const canopyGeometry = new THREE.IcosahedronGeometry(1, 1),
      trunkGeometry = new THREE.CylinderGeometry(0.3, 0.45, 1, 8);
    const treeLeaves = new THREE.InstancedMesh(
        canopyGeometry,
        material(0x53734c),
        180,
      ),
      treeTrunks = new THREE.InstancedMesh(
        trunkGeometry,
        material(0x776452),
        60,
      );
    treeLeaves.castShadow = treeTrunks.castShadow = true;
    root.add(treeLeaves, treeTrunks);
    const dummy = new THREE.Object3D();
    let tree = 0;
    for (let attempts = 0; attempts < 300 && tree < 60; attempts++) {
      const x = (random() - 0.5) * (map.size - 12),
        z = (random() - 0.5) * (map.size - 12);
      let clear = Math.hypot(x - map.spawn[0], z - map.spawn[2]) > 6;
      for (let i = 0; i < map.gates.length; i++) {
        const a = map.gates[i].p,
          b = map.gates[(i + 1) % map.gates.length].p,
          dx = b[0] - a[0],
          dz = b[2] - a[2],
          t = THREE.MathUtils.clamp(
            ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz),
            0,
            1,
          );
        if (Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t) < 7) clear = false;
      }
      if (!clear || Math.abs(x + 18) < 4 || Math.abs(z - 45) < 4) continue;
      const height = 4.5 + random() * 4;
      dummy.position.set(x, height * 0.42, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, height * 0.84, 1);
      dummy.updateMatrix();
      treeTrunks.setMatrixAt(tree, dummy.matrix);
      world.createCollider(
        RAPIER.ColliderDesc.cylinder(height * 0.42, 0.4).setTranslation(
          x,
          height * 0.42,
          z,
        ),
      );
      for (let j = 0; j < 3; j++) {
        dummy.position.set(
          x + (random() - 0.5) * 2,
          height * 0.65 + j * 0.7,
          z + (random() - 0.5) * 2,
        );
        dummy.scale.set(2.5 + random(), 2.1 + random(), 2.5 + random());
        dummy.rotation.set(random(), random() * Math.PI, random());
        dummy.updateMatrix();
        treeLeaves.setMatrixAt(tree * 3 + j, dummy.matrix);
      }
      tree++;
    }
    treeLeaves.count = tree * 3;
    treeTrunks.count = tree;
    for (const z of [-35, -10, 15, 38]) {
      box([2.3, 0.15, 0.6], [-22, 0.55, z], 0x9c8261);
      for (const x of [-22.85, -21.15])
        box([0.12, 0.5, 0.5], [x, 0.25, z], 0x3c4743);
      box([2.3, 0.65, 0.12], [-22, 0.94, z + 0.28], 0x9c8261);
    }
    const grass = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.08, 0.3),
      new THREE.MeshStandardMaterial({
        color: 0x809956,
        side: THREE.DoubleSide,
      }),
      2200,
    );
    root.add(grass);
    for (let i = 0; i < 2200; i++) {
      dummy.position.set(
        (random() - 0.5) * map.size,
        0.16,
        (random() - 0.5) * map.size,
      );
      dummy.scale.setScalar(0.5 + random());
      dummy.rotation.set(0, random() * Math.PI, 0);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    }
  } else {
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
  for (const x of [-map.size / 2, map.size / 2])
    box([0.2, 1.1, map.size], [x, 0.55, 0], 0x696f63);
  for (const z of [-map.size / 2, map.size / 2])
    box([map.size, 1.1, 0.2], [0, 0.55, z], 0x696f63);
  const gateMeshes = [];
  map.gates.forEach((gate, i) => {
    const group = new THREE.Group();
    group.position.set(...gate.p);
    group.rotation.y = Math.atan2(gate.n[0], gate.n[2]);
    root.add(group);
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
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(...size.map((v) => v / 2))
          .setTranslation(wp.x, wp.y, wp.z)
          .setRotation(q),
      );
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
    new THREE.CylinderGeometry(1.25, 1.25, 0.018, 48),
    material(0x232f2d),
  );
  pad.position.set(map.spawn[0], 0.025, map.spawn[2]);
  root.add(pad);
  return {
    root,
    highlight: (next, enabled) =>
      gateMeshes.forEach((m, i) => {
        m.color.setHex(
          enabled && i === next ? 0xff6648 : i === 0 ? 0xeda889 : 0xf5f0da,
        );
        m.emissiveIntensity = enabled && i === next ? 0.45 : 0;
      }),
    dispose: () => {
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
