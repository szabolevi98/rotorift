import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { aircraftMeshTools } from "../../shared/visual/aircraft-mesh-utils.js";
import {
  circuitCarState,
  CIRCUIT_CAR_COUNT,
} from "../../shared/world/circuit-layout.js";

const COLORS = [
  0xff5738, 0x2f83e8, 0xffc333, 0x41c6aa, 0xf5f0dc, 0x8a62cf, 0xf16eac,
  0x86c641,
];
// Original GT coupe: closed body/glazing, low splitter, roll-cage pillars and rear
// wing. Material batches instance all eight cars; wheels have their own matrices.
function carGeometry() {
  const root = new THREE.Group(),
    t = aircraftMeshTools(root);
  const mats = {
    paint: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.35,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x17323e,
      roughness: 0.16,
      metalness: 0.45,
    }),
    carbon: new THREE.MeshStandardMaterial({ color: 0x182023, roughness: 0.7 }),
    stripe: new THREE.MeshStandardMaterial({ color: 0xf4eddd, roughness: 0.5 }),
    light: new THREE.MeshStandardMaterial({
      color: 0xfff4cf,
      emissive: 0xffeac0,
      emissiveIntensity: 0.6,
    }),
    tail: new THREE.MeshStandardMaterial({
      color: 0xe72c32,
      emissive: 0xc90d12,
      emissiveIntensity: 0.5,
    }),
  };
  const sections = [
    [-2.23, 0.77, 0.59],
    [-1.94, 0.94, 0.74],
    [-1.25, 0.98, 0.79],
    [-0.65, 0.96, 0.82],
    [0.75, 0.97, 0.82],
    [1.65, 0.98, 0.78],
    [2.16, 0.89, 0.68],
  ];
  t.loft(
    sections.map(([z, w, h]) => [
      [-w * 0.86, 0.18, z],
      [w * 0.86, 0.18, z],
      [w, 0.32, z],
      [w, h - 0.08, z],
      [w * 0.86, h, z],
      [-w * 0.86, h, z],
      [-w, h - 0.08, z],
      [-w, 0.32, z],
    ]),
    mats.paint,
    "GT_body",
  );
  t.loft(
    [
      [-1.05, 0.76, 0.81],
      [-0.25, 0.64, 1.34],
      [0.65, 0.64, 1.34],
      [1.25, 0.77, 0.81],
    ].map(([z, w, h]) => [
      [-w, 0.76, z],
      [w, 0.76, z],
      [w, h, z],
      [-w, h, z],
    ]),
    mats.glass,
    "GT_cabin",
  );
  t.box([1.28, 0.035, 0.9], [0, 1.358, 0.2], mats.paint, "GT_roof");
  for (const x of [-1, 1]) {
    t.rod(
      [x * 0.77, 0.81, -1.05],
      [x * 0.64, 1.345, -0.25],
      0.026,
      mats.paint,
      "GT_A_pillar",
    );
    t.rod(
      [x * 0.64, 1.345, 0.65],
      [x * 0.77, 0.81, 1.25],
      0.035,
      mats.paint,
      "GT_C_pillar",
    );
    t.box(
      [0.04, 0.5, 0.045],
      [x * 0.657, 1.06, 0.32],
      mats.paint,
      "GT_B_pillar",
    );
    t.box(
      [0.28, 0.075, 0.17],
      [x * 1.04, 0.94, -0.55],
      mats.paint,
      "GT_mirror",
    );
    t.box(
      [0.06, 0.52, 0.07],
      [x * 0.65, 1.02, 1.82],
      mats.carbon,
      "GT_wing_stay",
    );
    t.box(
      [0.055, 0.24, 0.4],
      [x * 1.01, 1.38, 1.83],
      mats.paint,
      "GT_wing_endplate",
    );
    t.box(
      [0.43, 0.1, 0.035],
      [x * 0.57, 0.64, -2.238],
      mats.light,
      "GT_headlight",
    );
    t.box(
      [0.45, 0.075, 0.035],
      [x * 0.58, 0.64, 2.172],
      mats.tail,
      "GT_tail_light",
    );
  }
  t.box(
    [2.08, 0.055, 0.43],
    [0, 0.19, -2.07],
    mats.carbon,
    "GT_front_splitter",
  );
  t.box([1.14, 0.18, 0.03], [0, 0.46, -2.24], mats.carbon, "GT_air_intake");
  t.box([1.8, 0.14, 0.26], [0, 0.23, 2.12], mats.carbon, "GT_rear_diffuser");
  t.box([2.05, 0.055, 0.37], [0, 1.32, 1.82], mats.carbon, "GT_rear_wing");
  for (const x of [-0.24, 0.24]) {
    t.loft(
      [
        [-1.94, 0.74],
        [-1.25, 0.79],
        [-1.05, 0.8],
      ].map(([z, y]) => [
        [x - 0.07, y + 0.002, z],
        [x + 0.07, y + 0.002, z],
        [x + 0.07, y + 0.005, z],
        [x - 0.07, y + 0.005, z],
      ]),
      mats.stripe,
      "GT_bonnet_stripe",
    );
    t.box([0.14, 0.005, 0.9], [x, 1.38, 0.2], mats.stripe, "GT_roof_stripe");
  }
  root.updateMatrixWorld(true);
  const parts = [];
  for (const [name, material] of Object.entries(mats)) {
    const pieces = [];
    root.traverse((o) => {
      if (o.isMesh && o.material === material)
        pieces.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
    });
    const flat = pieces.map((g) => (g.index ? g.toNonIndexed() : g));
    for (const g of flat) g.deleteAttribute("uv");
    const geometry = mergeGeometries(flat);
    for (const g of new Set([...pieces, ...flat])) g.dispose();
    parts.push({ geometry, material, colored: name === "paint" });
  }
  const owned = new Set();
  root.traverse((o) => {
    if (o.geometry) owned.add(o.geometry);
  });
  for (const g of owned) g.dispose();
  return parts;
}
export class CircuitTraffic {
  constructor(scene, world, RAPIER) {
    Object.assign(this, { scene, world, RAPIER });
    this.root = new THREE.Group();
    this.root.name = "Apex_synchronized_GT_traffic";
    scene.add(this.root);
    this.batches = carGeometry().map(({ geometry, material, colored }) => {
      const mesh = new THREE.InstancedMesh(
        geometry,
        material,
        CIRCUIT_CAR_COUNT,
      );
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.name = "Apex_GT_" + (colored ? "livery" : material.uuid);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (colored)
        COLORS.forEach((color, i) =>
          mesh.setColorAt(i, new THREE.Color(color)),
        );
      mesh.frustumCulled = false;
      this.root.add(mesh);
      return mesh;
    });
    const tire = new THREE.CylinderGeometry(0.345, 0.345, 0.25, 18);
    tire.rotateZ(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(0.065, 0.065, 0.27, 12);
    hub.rotateZ(Math.PI / 2);
    const rimParts = [hub];
    for (const side of [-1, 1]) {
      const ring = new THREE.TorusGeometry(0.215, 0.018, 5, 16);
      ring.rotateY(Math.PI / 2);
      ring.translate(side * 0.135, 0, 0);
      rimParts.push(ring);
      for (let i = 0; i < 6; i++)
        rimParts.push(
          new THREE.BoxGeometry(0.015, 0.16, 0.026)
            .translate(side * 0.135, 0.13, 0)
            .rotateX((i * Math.PI) / 3),
        );
    }
    const rim = mergeGeometries(rimParts);
    for (const g of rimParts) g.dispose();
    this.wheels = new THREE.InstancedMesh(
      tire,
      new THREE.MeshStandardMaterial({ color: 0x171b1d, roughness: 0.95 }),
      CIRCUIT_CAR_COUNT * 4,
    );
    this.rims = new THREE.InstancedMesh(
      rim,
      new THREE.MeshStandardMaterial({
        color: 0xc4cbd0,
        metalness: 0.65,
        roughness: 0.35,
      }),
      CIRCUIT_CAR_COUNT * 4,
    );
    for (const mesh of [this.wheels, this.rims]) {
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.root.add(mesh);
    }
    this.states = Array.from({ length: CIRCUIT_CAR_COUNT }, () => ({}));
    this.bodies = world
      ? Array.from({ length: CIRCUIT_CAR_COUNT }, (_, i) => {
          const s = circuitCarState(0, i),
            body = world.createRigidBody(
              RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
                s.x,
                0.008,
                s.z,
              ),
            );
          world.createCollider(
            RAPIER.ColliderDesc.cuboid(0.97, 0.58, 2.18)
              .setTranslation(0, 0.72, 0)
              .setFriction(0.55)
              .setRestitution(0.05),
            body,
          );
          world.createCollider(
            RAPIER.ColliderDesc.cuboid(0.65, 0.15, 0.75)
              .setTranslation(0, 1.22, 0.2)
              .setFriction(0.55),
            body,
          );
          return body;
        })
      : [];
    this.matrix = new THREE.Matrix4();
    this.wheelMatrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.rotation = new THREE.Quaternion();
    this.wheelRotation = new THREE.Quaternion();
    this.unit = new THREE.Vector3(1, 1, 1);
    this.euler = new THREE.Euler();
    this.lastTime = null;
    this.seed = null;
    this.render(0, 0);
  }
  step(time, seed = 0) {
    const teleport =
      this.lastTime === null ||
      this.seed !== seed ||
      Math.abs(time - this.lastTime) > 0.2;
    for (const [i, body] of this.bodies.entries()) {
      const s = circuitCarState(time, i, seed, this.states[i]),
        p = { x: s.x, y: s.y, z: s.z },
        q = { x: 0, y: Math.sin(s.yaw / 2), z: 0, w: Math.cos(s.yaw / 2) };
      if (teleport) {
        body.setTranslation(p, true);
        body.setRotation(q, true);
      }
      body.setNextKinematicTranslation(p);
      body.setNextKinematicRotation(q);
    }
    this.lastTime = time;
    this.seed = seed;
  }
  render(time, seed = 0) {
    for (let i = 0; i < CIRCUIT_CAR_COUNT; i++) {
      const s = circuitCarState(time, i, seed, this.states[i]);
      this.position.set(s.x, s.y, s.z);
      this.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, s.yaw);
      this.matrix.compose(this.position, this.rotation, this.unit);
      for (const mesh of this.batches) mesh.setMatrixAt(i, this.matrix);
      for (let j = 0; j < 4; j++) {
        this.position.set(j % 2 ? 1.0 : -1.0, 0.345, j < 2 ? -1.35 : 1.35);
        this.euler.set(-s.distance / 0.345, j < 2 ? s.steer : 0, 0, "YXZ");
        this.wheelRotation.setFromEuler(this.euler);
        this.wheelMatrix
          .compose(this.position, this.wheelRotation, this.unit)
          .premultiply(this.matrix);
        this.wheels.setMatrixAt(i * 4 + j, this.wheelMatrix);
        this.rims.setMatrixAt(i * 4 + j, this.wheelMatrix);
      }
    }
    for (const mesh of [...this.batches, this.wheels, this.rims])
      mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    for (const body of this.bodies)
      if (body.isValid()) this.world.removeRigidBody(body);
    for (const mesh of [...this.batches, this.wheels, this.rims]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose();
    }
    this.root.removeFromParent();
    this.bodies = [];
  }
}
