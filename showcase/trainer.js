// Reuse the flight model: the showroom never maintains a second airplane mesh.
function createRiftT15() {
  const root = createTrainerModel();
  root.position.y = 0.28;
  const materials = new Set(),
    propellers = [];
  let meshes = 0,
    triangles = 0;
  root.traverse((object) => {
    if (object.userData.propeller)
      propellers.push({ group: object, direction: 1, axis: "z" });
    if (!object.isMesh) return;
    meshes++;
    triangles +=
      (object.geometry.index?.count ??
        object.geometry.attributes.position.count) / 3;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      materials.add(material);
  });
  return {
    root,
    propellers,
    materials: [...materials],
    meshes,
    triangles,
    assemblies: [],
    batteryParts: [],
    actionParts: [],
    setExplode() {},
    setWireframe(value) {
      for (const material of materials) material.wireframe = value;
    },
    setColor(value) {
      applyDroneColor(
        root,
        Object.keys(DRONE_COLORS).find((key) => DRONE_COLORS[key] === value) ??
          "coral",
      );
    },
  };
}
