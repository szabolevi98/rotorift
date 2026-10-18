import * as THREE from "three";
import { SCOUT_GEAR } from "../aircraft/airframe.js";
import { configureDronePolymer } from "./drone-rendering.js";
import { batchAirplaneShell } from "./airplane-model-utils.js";

// Original 750 mm foam parkflyer. A rounded pod, raised pusher and slim tail
// boom keep both the nose camera and the complete propeller sweep unobstructed.
export function createScoutModel({ batchStatic = true } = {}) {
  const root = new THREE.Group();
  root.name = "Rift_S75";
  root.userData.proceduralAircraft = true;
  const material = (color, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const foam = material("#edece2"),
    accent = material("#ff6648", 0.5),
    ink = material("#243b43"),
    glass = material("#284d61", 0.2, 0.2),
    metal = material("#a8b4b6", 0.35, 0.55),
    rubber = material("#282e30", 0.95);
  accent.userData.droneColorRole = "base";
  configureDronePolymer(accent);
  const mesh = (geometry, mat, name, parent = root) => {
    const m = new THREE.Mesh(geometry, mat);
    m.name = name;
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  function rod(a, b, r, mat, name, parent = root) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b),
      delta = end.sub(start);
    const m = mesh(
      new THREE.CylinderGeometry(r, r, delta.length(), 8),
      mat,
      name,
      parent,
    );
    m.position.copy(start).addScaledVector(delta, 0.5);
    m.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    );
    return m;
  }
  function solid(rings, mat, name, parent = root) {
    const n = rings[0].length,
      indices = [];
    for (let j = 0; j < rings.length - 1; j++)
      for (let i = 0; i < n; i++) {
        const a = j * n + i,
          b = j * n + ((i + 1) % n);
        indices.push(a, b, b + n, a, b + n, a + n);
      }
    for (let i = 1; i < n - 1; i++) {
      indices.push(0, i + 1, i);
      const a = (rings.length - 1) * n;
      indices.push(a, a + i, a + i + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(rings.flat(2), 3),
    );
    g.setIndex(indices);
    g.computeVertexNormals();
    return mesh(g, mat, name, parent);
  }
  function triangles(vertices, mat, name, parent = root) {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices.flat(), 3),
    );
    g.computeVertexNormals();
    return mesh(g, mat, name, parent);
  }
  // Analytic smooth shell; the canopy is part of this skin, never a floating box.
  const profile = (z) => {
    const t = (z + 0.215) / 0.355,
      s = Math.sin(Math.PI * Math.max(0, Math.min(1, t)));
    const width = 0.038 * Math.pow(Math.max(0, s), 0.72);
    const height = 0.032 * Math.pow(Math.max(0, s), 0.78);
    const canopy =
      0.021 * Math.exp(-(((z + 0.104) / 0.07) ** 4)) +
      0.033 * Math.exp(-(((z + 0.021) / 0.052) ** 4));
    return { width, height, canopy };
  };
  function skin(z, angle, offset = 0) {
    const { width, height, canopy } = profile(z),
      sin = Math.sin(angle);
    return [
      (width + offset) * Math.cos(angle),
      (height + offset) * sin + canopy * Math.max(0, sin) ** 2,
      z,
    ];
  }
  function skinNormal(z, angle) {
    z = Math.max(-0.21499, Math.min(0.13999, z));
    const a = new THREE.Vector3(...skin(z, angle + 0.001)).sub(
      new THREE.Vector3(...skin(z, angle - 0.001)),
    );
    const b = new THREE.Vector3(...skin(z + 0.000001, angle)).sub(
      new THREE.Vector3(...skin(z - 0.000001, angle)),
    );
    return a.cross(b).normalize().toArray();
  }
  const body = [],
    canopy = [],
    bodyNormals = [],
    canopyNormals = [];
  for (let row = 0; row < 40; row++)
    for (let i = 0; i < 32; i++) {
      const za = -0.215 + (0.355 * row) / 40,
        zb = -0.215 + (0.355 * (row + 1)) / 40,
        a = (i * Math.PI * 2) / 32,
        b = ((i + 1) * Math.PI * 2) / 32,
        z = (za + zb) / 2,
        angle = (a + b) / 2;
      const glassPatch = z > -0.179 && z < -0.055 && Math.sin(angle) > 0.48;
      const target = glassPatch ? canopy : body;
      const p = [skin(za, a), skin(za, b), skin(zb, b), skin(zb, a)];
      target.push(p[0], p[1], p[2], p[0], p[2], p[3]);
      const normalTarget = glassPatch ? canopyNormals : bodyNormals;
      const normals = [
        skinNormal(za, a),
        skinNormal(za, b),
        skinNormal(zb, b),
        skinNormal(zb, a),
      ];
      normalTarget.push(...[0, 1, 2, 0, 2, 3].flatMap((i) => normals[i]));
    }
  triangles(body, foam, "S75_rounded_foam_pod").geometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(bodyNormals, 3),
  );
  triangles(canopy, glass, "S75_flush_canopy").geometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(canopyNormals, 3),
  );
  // Flush flowing cheek paint with a narrow navy underline, on both sides.
  for (const side of [-1, 1])
    for (const [mat, base, width] of [
      [accent, -0.05, 0.13],
      [ink, -0.2, 0.045],
    ]) {
      const points = [];
      for (let i = 0; i < 32; i++) {
        const za = -0.197 + (0.31 * i) / 32,
          zb = -0.197 + (0.31 * (i + 1)) / 32;
        const angle = (z) =>
          base + 0.22 * Math.sin(((z + 0.197) / 0.31) * Math.PI);
        const a = angle(za),
          b = angle(zb),
          shift = side < 0 ? Math.PI : 0;
        const p = [
          skin(za, shift + side * a, 0.00025),
          skin(zb, shift + side * b, 0.00025),
          skin(zb, shift + side * (b + width), 0.00025),
          skin(za, shift + side * (a + width), 0.00025),
        ];
        points.push(p[0], p[1], p[2], p[0], p[2], p[3]);
      }
      const stripe = triangles(points, mat, "S75_swept_cheek_livery");
      stripe.material.side = THREE.DoubleSide;
    }
  solid(
    [0.07, 0.12, 0.2, 0.285, 0.325].map((z, i) =>
      Array.from({ length: 16 }, (_, j) => {
        const r = [0.018, 0.014, 0.009, 0.006, 0.003][i],
          a = (j * Math.PI) / 8;
        return [r * Math.cos(a), -0.002 + r * Math.sin(a), z];
      }),
    ),
    foam,
    "S75_tapered_tail_boom",
  );

  // Cambered airfoil with rounded tips and mild dihedral. Each aileron has its
  // own trailing segment and hinge, sharing the exact neutral airfoil contour.
  const wingY = (x) => 0.069 + Math.abs(x) * 0.055;
  function wingPoint(x, u, top, tail = false) {
    const span = tail ? 0.135 : 0.375,
      f = Math.abs(x) / span;
    const chord = (tail ? 0.1 : 0.136) * (1 - 0.17 * f ** 3),
      leading = (tail ? 0.235 : -0.098) + 0.018 * f ** 3;
    const thickness =
      (tail ? 0.006 : 0.013) * Math.max(0, Math.sin(Math.PI * u)) ** 0.65;
    const camber = tail ? 0 : 0.0035 * Math.sin(Math.PI * u);
    return [
      x,
      (tail ? 0.017 : wingY(x)) + camber + ((top ? 1 : -1) * thickness) / 2,
      leading + chord * u,
    ];
  }
  function airfoil(
    x0,
    x1,
    u0,
    u1,
    mat,
    name,
    { parent = root, tail = false, origin = [0, 0, 0] } = {},
  ) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    const rings = [];
    for (let row = 0; row <= 8; row++) {
      const x = x0 + ((x1 - x0) * row) / 8,
        ring = [];
      for (const top of [true, false])
        for (let j = 0; j <= 12; j++) {
          const u = top ? u0 + ((u1 - u0) * j) / 12 : u1 - ((u1 - u0) * j) / 12;
          ring.push(wingPoint(x, u, top, tail).map((v, k) => v - origin[k]));
        }
      rings.push(ring);
    }
    return solid(rings, mat, name, parent);
  }
  for (const side of [-1, 1]) {
    const end = side * 0.375,
      aileronStart = side * 0.14;
    airfoil(0, aileronStart, 0, 1, foam, "S75_wing_root");
    airfoil(aileronStart, end, 0, 0.76, foam, "S75_main_wing");
    const origin = wingPoint(side * 0.255, 0.764, false),
      hinge = new THREE.Group();
    hinge.name = "S75_aileron_" + side;
    hinge.position.set(...origin);
    hinge.userData = {
      surface: "aileron",
      side,
      hingeTilt: side * Math.atan(0.055),
    };
    // Geometry includes dihedral; the hinge-local coordinates remove its tilt.
    root.add(hinge);
    hinge.rotation.z = hinge.userData.hingeTilt;
    const panel = airfoil(
      aileronStart,
      end,
      0.768,
      1,
      accent,
      "S75_aileron_panel",
      { parent: hinge, origin },
    );
    panel.geometry.rotateZ(-hinge.rotation.z);
    for (const [start, finish, mat] of [
      [0.29, 0.334, ink],
      [0.341, 0.375, accent],
    ]) {
      const points = [];
      for (let i = 0; i < 6; i++)
        for (let j = 0; j < 8; j++) {
          const xa = side * (start + ((finish - start) * i) / 6),
            xb = side * (start + ((finish - start) * (i + 1)) / 6),
            ua = 0.04 + (0.7 * j) / 8,
            ub = 0.04 + (0.7 * (j + 1)) / 8,
            p = [
              wingPoint(xa, ua, true),
              wingPoint(xb, ua, true),
              wingPoint(xb, ub, true),
              wingPoint(xa, ub, true),
            ];
          p.forEach((v) => (v[1] += 0.0003));
          points.push(p[0], p[1], p[2], p[0], p[2], p[3]);
        }
      const paint = triangles(points, mat, "S75_wingtip_swept_paint");
      paint.material.side = THREE.DoubleSide;
    }
    // Flush small servo, horn and linkage, rather than decorative floating rods.
    const servo = mesh(
      new THREE.BoxGeometry(0.012, 0.004, 0.018),
      ink,
      "S75_aileron_servo",
    );
    servo.position.set(side * 0.21, wingY(0.21) + 0.009, -0.014);
    rod(
      [side * 0.21, wingY(0.21) + 0.011, -0.006],
      [side * 0.21, wingY(0.21) + 0.01, 0.024],
      0.0007,
      metal,
      "S75_aileron_pushrod",
    );
  }
  airfoil(-0.135, 0.135, 0, 0.7, foam, "S75_horizontal_stabilizer", {
    tail: true,
  });
  const elevator = new THREE.Group();
  elevator.name = "S75_elevator";
  elevator.position.set(0, 0.017, 0.305);
  elevator.userData.surface = "elevator";
  root.add(elevator);
  airfoil(-0.135, 0.135, 0.71, 1, accent, "S75_elevator_panel", {
    parent: elevator,
    tail: true,
    origin: [0, 0.017, 0.305],
  });
  // Rounded dorsal fin and rudder profile extruded only a few millimetres.
  function fin(points, mat, name, parent = root) {
    const shape = new THREE.Shape();
    shape.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) shape.lineTo(...points[i]);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.004,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.0015,
      bevelThickness: 0.001,
    });
    // Shape coordinates are Z/Y, extrusion along X.
    g.rotateY(-Math.PI / 2);
    g.translate(0.002, 0, 0);
    return mesh(g, mat, name, parent);
  }
  fin(
    [
      [0.226, 0.014],
      [0.242, 0.036],
      [0.266, 0.094],
      [0.276, 0.109],
      [0.293, 0.111],
      [0.305, 0.101],
      [0.305, 0.015],
    ],
    foam,
    "S75_rounded_vertical_fin",
  );
  const rudder = new THREE.Group();
  rudder.name = "S75_rudder";
  rudder.position.set(0, 0.017, 0.306);
  rudder.userData.surface = "rudder";
  root.add(rudder);
  fin(
    [
      [0.001, 0],
      [0.001, 0.084],
      [0.014, 0.077],
      [0.026, 0.012],
      [0.026, 0],
    ],
    accent,
    "S75_rudder_panel",
    rudder,
  );

  // Raised motor nacelle, brushless bell, ventilation slots, real cable ends.
  const pylon = mesh(
    new THREE.SphereGeometry(1, 16, 10),
    foam,
    "S75_motor_pylon",
  );
  pylon.position.set(0, 0.077, 0.077);
  pylon.scale.set(0.014, 0.052, 0.036);
  const motor = mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.026, 16),
    ink,
    "S75_brushless_motor",
  );
  motor.rotation.x = Math.PI / 2;
  motor.position.set(0, 0.125, 0.118);
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      rod(
        [side * 0.011, 0.124 + (i - 1) * 0.003, 0.111],
        [side * 0.011, 0.124 + (i - 1) * 0.003, 0.122],
        0.0007,
        metal,
        "S75_motor_cooling_slot",
      );
    }
  for (let i = 0; i < 3; i++)
    rod(
      [-0.004 + i * 0.004, 0.107, 0.107],
      [-0.004 + i * 0.004, 0.064, 0.061],
      0.0009,
      i === 0 ? accent : ink,
      "S75_motor_lead",
    );
  rod(
    [0, 0.125, 0.129],
    [0, 0.125, 0.145],
    0.002,
    metal,
    "S75_short_prop_shaft",
  );
  const prop = new THREE.Group();
  prop.name = "S75_pusher_propeller";
  prop.position.set(0, 0.125, 0.142);
  prop.userData.propeller = true;
  root.add(prop);
  for (const sign of [-1, 1]) {
    const rings = [];
    for (const [r, w, sweep] of [
      [0.006, 0.003, 0],
      [0.018, 0.007, 0.002],
      [0.035, 0.009, 0.004],
      [0.052, 0.007, 0.006],
      [0.0635, 0.0006, 0.005],
    ]) {
      rings.push(
        Array.from({ length: 8 }, (_, j) => {
          const a = (j * Math.PI) / 4,
            across = Math.cos(a) * w;
          return [
            sign * (sweep + across),
            sign * r,
            Math.sin(a) * 0.001 + across * (0.65 - r * 5),
          ];
        }),
      );
    }
    solid(rings, ink, "S75_twisted_pusher_blade", prop);
  }
  const hub = mesh(
    new THREE.SphereGeometry(0.005, 12, 8),
    metal,
    "S75_prop_locknut",
  );
  hub.position.set(0, 0.125, 0.146);
  hub.scale.z = 0.65;
  // Three sprung wire legs. Wheel centres are the same points used by physics.
  for (const [i, p] of SCOUT_GEAR.entries()) {
    const anchor =
      i === 2 ? [0, -0.022, -0.145] : [Math.sign(p[0]) * 0.023, -0.024, 0.014];
    rod(anchor, p, 0.0018, metal, "S75_wire_gear");
    const wheel = mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.012, 20),
      rubber,
      "S75_lightweight_wheel",
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(...p);
    const axle = mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.013, 12),
      foam,
      "S75_wheel_hub",
    );
    axle.rotation.z = Math.PI / 2;
    axle.position.set(...p);
    rod(
      [p[0] - 0.007, p[1], p[2]],
      [p[0] + 0.007, p[1], p[2]],
      0.002,
      metal,
      "S75_wheel_axle",
    );
  }
  // Small FPV module in the nose, ahead of all opaque skin along its view axis.
  const camera = mesh(
    new THREE.CylinderGeometry(0.006, 0.007, 0.012, 12),
    ink,
    "S75_FPV_camera",
  );
  camera.rotation.x = Math.PI / 2;
  camera.position.set(0, 0.033, -0.18);
  const lens = mesh(
    new THREE.CircleGeometry(0.0048, 12),
    glass,
    "S75_FPV_lens",
  );
  lens.rotation.y = Math.PI;
  lens.position.set(0, 0.033, -0.1865);
  rod(
    [0.013, 0.028, 0.038],
    [0.014, 0.055, 0.052],
    0.0007,
    ink,
    "S75_receiver_antenna",
  );
  root.updateMatrixWorld(true);
  if (batchStatic) batchAirplaneShell(root, "S75");
  return root;
}
