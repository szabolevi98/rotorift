import * as THREE from "three";
import { TRAINER_GEAR } from "../physics/fixed-wing-colliders.js";

// Original trainer design, metres, nose -Z. A few solid lofts and hinged
// surfaces rather than a high-resolution downloaded aircraft asset.
export function createTrainerModel() {
  const root = new THREE.Group();
  root.name = "Rift_T15";
  root.userData.proceduralAircraft = true;
  const white = new THREE.MeshStandardMaterial({
      color: "#e4e7de",
      roughness: 0.65,
    }),
    accent = new THREE.MeshStandardMaterial({
      color: "#ff6648",
      roughness: 0.58,
    });
  accent.userData.droneColorRole = "base";
  const dark = new THREE.MeshStandardMaterial({
      color: "#222c32",
      roughness: 0.65,
    }),
    metal = new THREE.MeshStandardMaterial({
      color: "#82979b",
      metalness: 0.65,
      roughness: 0.3,
    }),
    glass = new THREE.MeshStandardMaterial({
      color: "#375366",
      metalness: 0.25,
      roughness: 0.17,
    });
  const mesh = (geometry, material, parent = root, name = "") => {
    const m = new THREE.Mesh(geometry, material);
    m.name = name;
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (size, p, mat = white, parent = root, name = "") => {
    const m = mesh(new THREE.BoxGeometry(...size), mat, parent, name);
    m.position.set(...p);
    return m;
  };
  function loft(sections, profile, mat, name) {
    const vertices = [],
      indices = [],
      n = profile.length;
    for (const s of sections)
      for (const [a, b] of profile) vertices.push(...s(a, b));
    for (let i = 0; i < sections.length - 1; i++)
      for (let j = 0; j < n; j++) {
        const k = i * n + j,
          l = i * n + ((j + 1) % n);
        indices.push(k, l, l + n, k, l + n, k + n);
      }
    for (let j = 1; j < n - 1; j++) {
      indices.push(0, j + 1, j);
      const k = (sections.length - 1) * n;
      indices.push(k, k + j, k + j + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return mesh(geometry, mat, root, name);
  }
  const oval = Array.from({ length: 10 }, (_, i) => [
    Math.cos((i * Math.PI) / 5),
    Math.sin((i * Math.PI) / 5),
  ]);
  loft(
    [
      [-0.51, 0.032, 0.035, 0.012],
      [-0.36, 0.063, 0.065, 0.01],
      [-0.08, 0.066, 0.07, 0],
      [0.16, 0.045, 0.052, 0],
      [0.43, 0.019, 0.028, 0.024],
      [0.55, 0.009, 0.016, 0.035],
    ].map(([z, w, h, y]) => (a, b) => [a * w, y + b * h, z]),
    oval,
    white,
    "T15_fuselage",
  );
  const wingProfile = [
    [-0.12, 0],
    [-0.11, 0.012],
    [-0.065, 0.024],
    [0.025, 0.015],
    [0.09, 0.002],
    [0.09, -0.004],
    [-0.065, -0.008],
    [-0.115, -0.005],
  ];
  loft(
    [
      [-0.75, 0.16, 0.83],
      [-0.65, 0.15, 0.95],
      [0, 0.12, 1],
      [0.65, 0.15, 0.95],
      [0.75, 0.16, 0.83],
    ].map(([x, y, scale]) => (z, h) => [x, y + h, z * scale - 0.02]),
    wingProfile,
    white,
    "T15_airfoil_wing",
  );
  for (const side of [-1, 1]) {
    const tip = box([0.13, 0.008, 0.185], [side * 0.68, 0.164, -0.032], accent);
    tip.rotation.z = side * 0.06;
    const stripe = box(
      [0.042, 0.006, 0.19],
      [side * 0.49, 0.163, -0.031],
      dark,
    );
    stripe.rotation.z = side * 0.06;
    const hinge = new THREE.Group();
    hinge.position.set(side * 0.48, 0.142, 0.067);
    hinge.userData.surface = "aileron";
    hinge.userData.side = side;
    root.add(hinge);
    box([0.39, 0.009, 0.048], [0, 0, 0.024], accent, hinge, "T15_aileron");
    const strut = mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.52, 6),
      metal,
    );
    const from = new THREE.Vector3(side * 0.06, -0.015, 0.02),
      to = new THREE.Vector3(side * 0.5, 0.135, -0.015);
    strut.position.copy(from).add(to).multiplyScalar(0.5);
    strut.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      to.sub(from).normalize(),
    );
  }
  box([0.5, 0.012, 0.105], [0, 0.045, 0.43], white, root, "T15_stabilizer");
  const elevator = new THREE.Group();
  elevator.position.set(0, 0.045, 0.482);
  elevator.userData.surface = "elevator";
  root.add(elevator);
  box([0.49, 0.01, 0.055], [0, 0, 0.0275], accent, elevator);
  const fin = new THREE.Shape();
  fin.moveTo(0.34, 0.04);
  fin.lineTo(0.43, 0.23);
  fin.lineTo(0.52, 0.19);
  fin.lineTo(0.54, 0.04);
  fin.closePath();
  const finMesh = mesh(
    new THREE.ExtrudeGeometry(fin, { depth: 0.012, bevelEnabled: false }),
    white,
  );
  finMesh.rotation.y = -Math.PI / 2;
  finMesh.position.x = 0.006;
  const rudder = new THREE.Group();
  rudder.position.set(0, 0.045, 0.52);
  rudder.userData.surface = "rudder";
  root.add(rudder);
  box([0.012, 0.145, 0.045], [0, 0.072, 0.0225], accent, rudder);
  const cabin = box(
    [0.112, 0.07, 0.17],
    [0, 0.075, -0.19],
    glass,
    root,
    "T15_cabin",
  );
  cabin.rotation.x = -0.12;
  box([0.116, 0.009, 0.11], [0, 0.113, -0.185], white);
  for (const side of [-1, 1])
    box([0.005, 0.08, 0.009], [side * 0.057, 0.07, -0.15], white);
  box([0.078, 0.006, 0.19], [0, 0.074, -0.345], accent, root, "T15_motor_cowl");
  for (const [x, , z] of TRAINER_GEAR) {
    const leg = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 6), metal);
    leg.position.set(x * 0.5, -0.12, z);
    leg.rotation.z = -Math.atan2(x, 0.18);
    const wheel = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.027, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, -0.22, z);
    const hub = mesh(
      new THREE.CylinderGeometry(0.021, 0.021, 0.029, 10),
      metal,
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(wheel.position);
  }
  const prop = new THREE.Group();
  prop.position.set(0, 0.015, -0.55);
  prop.name = "T15_propeller";
  prop.userData = { propeller: true, motorIndex: 0, phaseOffset: 0, axis: "z" };
  root.add(prop);
  for (const side of [-1, 1]) {
    const blade = box(
      [0.027, 0.115, 0.005],
      [side * 0.007, side * 0.066, 0],
      dark,
      prop,
    );
    blade.rotation.z = side * 0.12;
  }
  const spinner = mesh(new THREE.ConeGeometry(0.025, 0.046, 12), accent);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.set(0, 0.015, -0.568);
  const fpv = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.022, 10), dark);
  fpv.rotation.x = Math.PI / 2;
  fpv.position.set(0, 0.135, -0.22);
  const lens = mesh(new THREE.CircleGeometry(0.009, 12), glass);
  lens.rotation.y = Math.PI;
  lens.position.set(0, 0.135, -0.232);
  root.updateMatrixWorld(true);
  return root;
}
export function animateTrainer(model, surfaces, phase) {
  model.traverse((o) => {
    if (o.userData.propeller) o.rotation.z = phase;
    if (o.userData.surface === "aileron")
      o.rotation.x = -surfaces.roll * o.userData.side * 0.45;
    if (o.userData.surface === "elevator") o.rotation.x = surfaces.pitch * 0.4;
    if (o.userData.surface === "rudder") o.rotation.y = surfaces.yaw * 0.4;
  });
}
