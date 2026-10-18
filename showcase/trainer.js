// Reuse the flight model: the showroom never maintains a second airplane mesh.
function createRiftA40() {
  return createShowcaseAirplane(createWarbirdModel(), 0.071, 0.064, 1);
}
function createRiftT15() {
  return createShowcaseAirplane(createTrainerModel(), 0.28, 0.127, 1);
}
function createRiftS75() {
  return createShowcaseAirplane(createScoutModel(), 0.115, 0.0635, -1);
}
function createShowcaseAirplane(root, groundHeight, propRadius, direction) {
  const exposure = new AirplanePropellerExposure(root, propRadius);
  root.position.y = groundHeight;
  const materials = new Set(),
    propellers = [];
  let meshes = 0,
    triangles = 0;
  root.traverse((object) => {
    if (object.userData.propeller)
      propellers.push({ group: object, direction, axis: "z" });
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
    rotorSpeed: AIRPLANE_VISUAL_ROTOR_SPEED,
    setMotorSpeed(value) {
      exposure.update(value);
    },
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
