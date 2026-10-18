import * as THREE from "three";

// Static details share one draw per material. Hinges and the propeller remain
// independent; adding a vent or a wheel hub does not add another flight draw.
export function batchAirplaneShell(root, prefix = "T15") {
  const batches = new Map();
  for (const object of [...root.children]) {
    if (!object.isMesh) continue;
    const geometry = object.geometry.index
      ? object.geometry.toNonIndexed()
      : object.geometry.clone();
    geometry.applyMatrix4(object.matrix);
    if (!batches.has(object.material))
      batches.set(object.material, { positions: [], normals: [], uvs: [], parts: [] });
    const batch = batches.get(object.material);
    batch.positions.push(...geometry.attributes.position.array);
    batch.normals.push(...geometry.attributes.normal.array);
    if(object.material.map)batch.uvs.push(...(geometry.attributes.uv?.array ?? new Float32Array(geometry.attributes.position.count*2)));
    batch.parts.push(object.name);
    root.remove(object);
    geometry.dispose();
    object.geometry.dispose();
  }
  let index = 0;
  for (const [material, batch] of batches) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(batch.positions, 3),
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(batch.normals, 3),
    );
    if(batch.uvs.length)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uvs,2));
    const object = new THREE.Mesh(geometry, material);
    object.name = prefix + "_static_shell_" + index++;
    object.userData.parts = batch.parts;
    object.castShadow = object.receiveShadow = true;
    root.add(object);
  }
  root.updateMatrixWorld(true);
}
export function animateFixedWingModel(model, surfaces, phase) {
  model.traverse((object) => {
    if (object.userData.propeller) object.rotation.z = phase;
    if (object.userData.surface === "aileron") {
      object.rotation.set(0, 0, object.userData.hingeTilt ?? 0);
      object.rotateX(-surfaces.roll * object.userData.side * 0.45);
    }
    if (object.userData.surface === "elevator")
      object.rotation.x = surfaces.pitch * 0.4;
    if (object.userData.surface === "rudder")
      object.rotation.y = surfaces.yaw * 0.4;
  });
}
