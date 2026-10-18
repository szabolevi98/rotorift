import * as THREE from "three";
import { SCOUT_GEAR } from "../aircraft/airframe.js";
import { configureDronePolymer } from "./drone-rendering.js";
import { batchAirplaneShell } from "./airplane-model-utils.js";

// Original 750 mm foam parkflyer. A rounded pod, raised pusher and slim tail
// boom keep both the nose camera and the complete propeller sweep unobstructed.
export function createScoutModel({ batchStatic = true } = {}) {
  const root = new THREE.Group();
  root.name = "Rift_Aero_75";
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
  // Shape-preserving cubic sections keep the nose, cabin and wing saddle one
  // continuous shell. Glazing boundaries are explicit curved edges of that skin.
  function sectionCurve(rows) {
    const slopes = rows.map((row, j) =>
      row.slice(1).map((_, k) => {
        const left = rows[Math.max(0, j - 1)],
          right = rows[Math.min(rows.length - 1, j + 1)];
        const d0 = j
          ? (row[k + 1] - left[k + 1]) / (row[0] - left[0])
          : (right[k + 1] - row[k + 1]) / (right[0] - row[0]);
        const d1 =
          j === rows.length - 1
            ? d0
            : (right[k + 1] - row[k + 1]) / (right[0] - row[0]);
        return d0 * d1 > 0 ? (2 * d0 * d1) / (d0 + d1) : 0;
      }),
    );
    return (at) => {
      let i = rows.findIndex((row) => row[0] >= at) - 1;
      i = at >= rows.at(-1)[0] ? rows.length - 2 : Math.max(0, i);
      const a = rows[i],
        b = rows[i + 1],
        h = b[0] - a[0],
        t = Math.max(0, Math.min(1, (at - a[0]) / h));
      return a
        .slice(1)
        .map(
          (v, k) =>
            (2 * t ** 3 - 3 * t * t + 1) * v +
            (t ** 3 - 2 * t * t + t) * h * slopes[i][k] +
            (-2 * t ** 3 + 3 * t * t) * b[k + 1] +
            (t ** 3 - t * t) * h * slopes[i + 1][k],
        );
    };
  }
  const bodySection = sectionCurve([
    [-0.215, 0, 0, 0],
    [-0.205, 0.012, 0.014, 0.009],
    [-0.18, 0.023, 0.026, 0.018],
    [-0.158, 0.03, 0.043, 0.025],
    [-0.125, 0.035, 0.059, 0.03],
    [-0.09, 0.036, 0.07, 0.032],
    [-0.05, 0.036, 0.069, 0.031],
    [-0.015, 0.033, 0.066, 0.029],
    [0.025, 0.029, 0.057, 0.026],
    [0.065, 0.024, 0.039, 0.022],
    [0.1, 0.017, 0.022, 0.016],
    [0.14, 0, 0, 0],
  ]);
  const profileCache = new Map();
  function skin(z, angle, offset = 0) {
    if (!profileCache.has(z)) profileCache.set(z, bodySection(z));
    const [width, roof, belly] = profileCache.get(z),
      sin = Math.sin(angle);
    return [
      (width + offset) * Math.cos(angle),
      (sin >= 0 ? roof + offset : belly + offset) * sin,
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
  const shell = new Map([
    [foam, { positions: [], normals: [] }],
    [glass, { positions: [], normals: [] }],
    [ink, { positions: [], normals: [] }],
  ]);
  const glassStart = -0.178,
    glassEnd = -0.033;
  const stations = [
    ...new Set([
      ...Array.from({ length: 41 }, (_, i) => -0.215 + (0.355 * i) / 40),
      glassStart,
      glassEnd,
    ]),
  ].sort((a, b) => a - b);
  function bands(z) {
    const t = (z - glassStart) / (glassEnd - glassStart),
      width = 1.1 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
    const low = Math.PI / 2 - width,
      high = Math.PI / 2 + width,
      rim = Math.min(0.025, width * 0.2);
    return [
      [0, low, 6, foam],
      [low, low + rim, 1, ink],
      [low + rim, high - rim, 12, glass],
      [high - rim, high, 1, ink],
      [high, Math.PI, 6, foam],
      [Math.PI, 2 * Math.PI, 12, foam],
    ];
  }
  for (let row = 0; row < stations.length - 1; row++) {
    const za = stations[row],
      zb = stations[row + 1],
      aa = bands(za),
      bb = bands(zb);
    for (let band = 0; band < aa.length; band++) {
      const [a0, a1, count, mat] = aa[band],
        [b0, b1] = bb[band],
        target = shell.get(mat);
      for (let i = 0; i < count; i++) {
        const a = a0 + ((a1 - a0) * i) / count,
          b = a0 + ((a1 - a0) * (i + 1)) / count,
          c = b0 + ((b1 - b0) * i) / count,
          d = b0 + ((b1 - b0) * (i + 1)) / count;
        const p = [skin(za, a), skin(za, b), skin(zb, d), skin(zb, c)],
          n = [
            skinNormal(za, a),
            skinNormal(za, b),
            skinNormal(zb, d),
            skinNormal(zb, c),
          ];
        for (const j of [0, 1, 2, 0, 2, 3]) {
          target.positions.push(p[j]);
          target.normals.push(...n[j]);
        }
      }
    }
  }
  for (const [mat, name] of [
    [foam, "S75_rounded_foam_pod"],
    [glass, "S75_flush_canopy"],
    [ink, "S75_canopy_seal"],
  ]) {
    const part = shell.get(mat);
    triangles(part.positions, mat, name).geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(part.normals, 3),
    );
  }
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

  // A swept fairing grows out of the wing saddle and blends into a horizontal
  // nacelle. Its rounded nose covers the mount; the brushless bell stays exposed.
  // Model the two silhouette edges directly. Interpolating centre and depth
  // separately introduced bumps even when those individual curves were smooth.
  const bezier = (t, a, b, c, d) =>
    (1 - t) ** 3 * a +
    3 * (1 - t) ** 2 * t * b +
    3 * (1 - t) * t * t * c +
    t ** 3 * d;
  const pylonRows = Array.from(
    { length: 21 },
    (_, i) => -0.006 + (0.131 * i) / 20,
  );
  const pylonPoint = (y, a) => {
    const t = (y + 0.006) / 0.131;
    const front = bezier(t, 0.014, 0.014, 0.075, 0.094);
    const rear = bezier(t, 0.084, 0.1, 0.116, 0.118);
    const width = bezier(t, 0.012, 0.021, 0.011, 0.01);
    return [
      width * Math.cos(a),
      y,
      (front + rear) / 2 - ((rear - front) / 2) * Math.sin(a),
    ];
  };
  solid(
    pylonRows.map((y) =>
      Array.from({ length: 20 }, (_, j) => pylonPoint(y, (j * Math.PI) / 10)),
    ),
    foam,
    "S75_motor_pylon",
  );
  const nacelleSection = sectionCurve([
    [0.075, 0],
    [0.08, 0.006],
    [0.089, 0.012],
    [0.1, 0.0145],
    [0.11, 0.014],
    [0.114, 0.0125],
  ]);
  const nacelle = solid(
    Array.from({ length: 13 }, (_, i) => {
      const z = 0.075 + (0.039 * i) / 12,
        r = nacelleSection(z)[0];
      return Array.from({ length: 20 }, (_, j) => [
        r * Math.cos((j * Math.PI) / 10),
        0.125 + r * Math.sin((j * Math.PI) / 10),
        z,
      ]);
    }),
    foam,
    "S75_streamlined_motor_nacelle",
  );
  // Recess only the upper white cowl into the pylon. Motor and prop stay put.
  nacelle.position.z = 0.008;
  const motor = mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.019, 20),
    ink,
    "S75_brushless_motor",
  );
  motor.rotation.x = Math.PI / 2;
  motor.position.set(0, 0.125, 0.121);
  const collar = mesh(
    new THREE.CylinderGeometry(0.0124, 0.0124, 0.002, 20),
    metal,
    "S75_motor_mount_ring",
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.125, 0.112);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    rod(
      [Math.cos(a) * 0.0122, 0.125 + Math.sin(a) * 0.0122, 0.119],
      [Math.cos(a) * 0.0122, 0.125 + Math.sin(a) * 0.0122, 0.126],
      0.00055,
      metal,
      "S75_motor_cooling_slot",
    );
  }
  // The leads enter the motor base and disappear through a small fairing exit.
  for (let i = 0; i < 3; i++) {
    rod(
      [-0.003 + i * 0.003, 0.114, 0.111],
      [-0.003 + i * 0.003, 0.105, 0.103],
      0.0008,
      i === 0 ? accent : ink,
      "S75_motor_lead",
    );
  }
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
