import * as THREE from 'three';

// Ground paint shares materials with real walls in the source batches. Split
// just the thin, horizontal ground instances so they can receive shadows while
// their nearly coplanar undersides never cast shadow acne onto their own tops.
export function prepareCircuitSurfaces(root, palette) {
  const matrix = new THREE.Matrix4(), materials = new Map();
  for (const mesh of [...root.children]) {
    if (!mesh.isInstancedMesh || !mesh.name.startsWith('box:')) continue;
    const flat = [], solid = [];
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      const e = matrix.elements, height = Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9]);
      (height <= .201 && e[13] + height / 2 <= .221 ? flat : solid).push(matrix.clone());
    }
    if (!flat.length) continue;
    let material = materials.get(mesh.material);
    if (!material) {
      material = mesh.material.clone();
      palette['ground_' + mesh.material.id] = material;
      materials.set(mesh.material, material);
    }
    const ground = new THREE.InstancedMesh(mesh.geometry, material, flat.length);
    ground.name = 'Apex_ground_' + mesh.name;
    ground.userData.groundSurface = true;
    ground.castShadow = false;
    ground.receiveShadow = true;
    flat.forEach((m, i) => ground.setMatrixAt(i, m));
    ground.computeBoundingBox(); ground.computeBoundingSphere(); root.add(ground);
    mesh.count = solid.length;
    if (solid.length) {
      solid.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    } else { mesh.removeFromParent(); mesh.dispose(); }
  }
  root.userData.batches = root.children.filter(mesh=>mesh.isInstancedMesh).length;
}
