import * as THREE from "three";
import {
  TRAINER_GEAR,
  TRAINER_WING_SHIFT,
} from "../aircraft/airframe.js";
import { batchAirplaneShell, animateFixedWingModel } from "./airplane-model-utils.js";
import { configureDronePolymer } from "./drone-rendering.js";

// One metre-scale source for flight, remote aircraft, ghosts and GLB/showcase.
// The shaped shell and flush paint retain a small solid-material mesh budget.
export function createTrainerModel({ batchStatic = true } = {}) {
  const root = new THREE.Group();
  root.name = "Rift_T15";
  root.userData.proceduralAircraft = true;
  const material = (color, roughness = 0.65, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const white = material("#e7e9df"),
    accent = material("#ff6648", 0.48),
    navy = material("#22343f"),
    rubber = material("#22272a", 0.95),
    metal = material("#9cabb0", 0.32, 0.65),
    glass = material("#365b70", 0.19, 0.25),
    seam = material("#697b80", 0.75),
    light = material("#c6e2e5", 0.2, 0.35);
  accent.userData.droneColorRole = "base";
  configureDronePolymer(accent);
  const mesh = (geometry, mat = white, parent = root, name = "") => {
    const object = new THREE.Mesh(geometry, mat);
    object.name = name;
    object.castShadow = object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const box = (size, p, mat = white, parent = root, name = "") => {
    const object = mesh(new THREE.BoxGeometry(...size), mat, parent, name);
    object.position.set(...p);
    return object;
  };
  function loft(
    rings,
    mat,
    name,
    parent = root,
    { capStart = true, capEnd = true } = {},
  ) {
    const positions = rings.flat(2),
      indices = [],
      n = rings[0].length;
    for (let row = 0; row < rings.length - 1; row++)
      for (let j = 0; j < n; j++) {
        const a = row * n + j,
          b = row * n + ((j + 1) % n);
        indices.push(a, b, b + n, a, b + n, a + n);
      }
    for (let j = 1; j < n - 1; j++) {
      if (capStart) indices.push(0, j + 1, j);
      const end = (rings.length - 1) * n;
      if (capEnd) indices.push(end, end + j, end + j + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return mesh(geometry, mat, parent, name);
  }
  function panel(points, mat, name, parent = root) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points.flat(), 3),
    );
    const indices = [];
    for (let j = 1; j < points.length - 1; j++) indices.push(0, j, j + 1);
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    // Paint and windows have two visible sides without another coplanar shell.
    const object = mesh(geometry, mat, parent, name);
    object.material.side = THREE.DoubleSide;
    return object;
  }
  function rod(a, b, radius, mat = metal, parent = root, name = "") {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b),
      delta = to.clone().sub(from);
    const object = mesh(
      new THREE.CylinderGeometry(radius, radius, delta.length(), 8),
      mat,
      parent,
      name,
    );
    object.position.copy(from).add(to).multiplyScalar(0.5);
    object.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    );
    return object;
  }
  // The cabin is the upper part of this hull, not a second box sitting on it.
  // Shape-preserving cubic sections give the hood, shoulders and rear fairing
  // matching tangents, without overshoot at the thin tail.
  const sections = [
    [-0.465, 0.047, 0.046, 0.013, 0.059],
    [-0.38, 0.06, 0.06, 0.009, 0.069],
    [-0.32, 0.065, 0.068, 0.006, 0.08],
    [-0.25, 0.068, 0.073, 0.003, 0.107],
    [-0.19, 0.069, 0.075, 0.0, 0.121],
    [-0.1, 0.067, 0.074, -0.002, 0.121],
    [-0.02, 0.063, 0.071, -0.003, 0.113],
    [0.075, 0.054, 0.061, -0.001, 0.09],
    [0.16, 0.045, 0.05, 0.003, 0.061],
    [0.28, 0.032, 0.038, 0.012, 0.05],
    [0.43, 0.018, 0.023, 0.026, 0.049],
    [0.54, 0.009, 0.014, 0.036, 0.05],
    [0.558, 0.003, 0.007, 0.036, 0.043],
  ];
  function sectionAt(z) {
    const hi = Math.max(
      1,
      sections.findIndex((row) => row[0] >= z),
    );
    const i = z >= sections.at(-1)[0] ? sections.length - 2 : hi - 1;
    const a = sections[i],
      b = sections[i + 1],
      length = b[0] - a[0];
    const t = Math.max(0, Math.min(1, (z - a[0]) / length));
    const slope = (j, k) => {
      const left = sections[Math.max(0, j - 1)],
        center = sections[j],
        right = sections[Math.min(sections.length - 1, j + 1)];
      const d0 =
        j === 0
          ? (right[k] - center[k]) / (right[0] - center[0])
          : (center[k] - left[k]) / (center[0] - left[0]);
      const d1 =
        j === sections.length - 1
          ? d0
          : (right[k] - center[k]) / (right[0] - center[0]);
      return d0 * d1 > 0 ? (2 * d0 * d1) / (d0 + d1) : 0;
    };
    return a
      .slice(1)
      .map(
        (value, k) =>
          (2 * t ** 3 - 3 * t * t + 1) * value +
          (t ** 3 - 2 * t * t + t) * length * slope(i, k + 1) +
          (-2 * t ** 3 + 3 * t * t) * b[k + 1] +
          (t ** 3 - t * t) * length * slope(i + 1, k + 1),
      );
  }
  const skinPoint = (z, angle) => {
    const [w, h, center, top] = sectionAt(z),
      sine = Math.abs(Math.sin(angle)) < 1e-9 ? 0 : Math.sin(angle),
      up = Math.max(0, sine),
      cosine = Math.abs(Math.cos(angle)) < 1e-9 ? 0 : Math.cos(angle),
      shoulder =
        up > 0 ? Math.min(1, Math.max(0, (top - center - h) / 0.05)) : 0,
      exponent = 1 - shoulder * 0.55;
    // Broad, rounded cabin shoulders support the high wing across its root;
    // the cross-section eases back into an ellipse at the hood and tail.
    return new THREE.Vector3(
      w * Math.sign(cosine) * Math.abs(cosine) ** exponent,
      up > 0 ? center + (top - center) * up ** exponent : center + h * sine,
      z,
    );
  };
  const angleAtHeight = (z, y) => {
    const [, h, center, top] = sectionAt(z);
    const exponent =
      1 - Math.min(1, Math.max(0, (top - center - h) / 0.05)) * 0.55;
    return Math.asin(
      Math.max(0, Math.min(1, (y - center) / (top - center))) ** (1 / exponent),
    );
  };
  const skinNormal = (z, angle) => {
    const dz = skinPoint(Math.min(0.558, z + 0.00001), angle).sub(
      skinPoint(Math.max(-0.465, z - 0.00001), angle),
    );
    const da = skinPoint(z, angle + 0.0001).sub(skinPoint(z, angle - 0.0001));
    return da.cross(dz).normalize();
  };
  const patches = [];
  const skins = new Map();
  function skinStrip(stations, from, to, segments, mat, name, offset = 0) {
    patches.push({ stations, from, to, segments, mat, name, offset });
  }
  function buildSkin() {
    // Reconcile the tessellation of adjoining material patches. A curved
    // window edge and its white surround share every vertex, including where
    // a rounded pane closes into the full hull ring (no T-junction cracks).
    const rings = new Map(),
      round = (value) => Number(value.toFixed(10));
    for (const patch of patches)
      for (const z of patch.stations) {
        if (patch.offset) continue;
        const key = round(z);
        if (!rings.has(key)) rings.set(key, new Set());
        for (let j = 0; j <= patch.segments; j++)
          rings
            .get(key)
            .add(
              round(
                patch.from(z) +
                  ((patch.to(z) - patch.from(z)) * j) / patch.segments,
              ),
            );
      }
    for (const patch of patches) {
      const { from, to, segments, mat, name, offset } = patch;
      if (!skins.has(name))
        skins.set(name, { positions: [], normals: [], indices: [], mat, name });
      const data = skins.get(name),
        rows = [];
      for (const sourceZ of patch.stations) {
        const z = round(sourceZ),
          lo = round(from(sourceZ)),
          hi = round(to(sourceZ));
        const angles = offset
          ? Array.from({ length: segments + 1 }, (_, j) =>
              round(lo + ((hi - lo) * j) / segments),
            )
          : [...rings.get(z)]
              .filter((a) => a >= lo && a <= hi)
              .sort((a, b) => a - b);
        const row = angles.map((angle) => {
          const normal = skinNormal(z, angle),
            index = data.positions.length / 3;
          data.positions.push(
            ...skinPoint(z, angle).addScaledVector(normal, offset).toArray(),
          );
          data.normals.push(...normal.toArray());
          return index;
        });
        rows.push(row);
      }
      const triangle = (a, b, c) => {
        const [p, q, r] = [a, b, c].map((k) =>
          new THREE.Vector3().fromArray(data.positions, k * 3),
        );
        if (q.sub(p).cross(r.sub(p)).lengthSq() > 1e-18)
          data.indices.push(a, b, c);
      };
      for (let row = 0; row < rows.length - 1; row++) {
        const a = rows[row],
          b = rows[row + 1];
        let i = 0,
          j = 0;
        while (i < a.length - 1 || j < b.length - 1) {
          if (
            j === b.length - 1 ||
            (i < a.length - 1 &&
              (i + 1) / (a.length - 1) <= (j + 1) / (b.length - 1))
          ) {
            triangle(a[i], a[i + 1], b[j]);
            i++;
          } else {
            triangle(a[i], b[j + 1], b[j]);
            j++;
          }
        }
      }
    }
  }
  const stations = (start, end, steps = 12) =>
    Array.from(
      { length: steps + 1 },
      (_, i) => start + ((end - start) * i) / steps,
    );
  const fixed = (value) => () => value;
  const bodyStrip = (zs, from, to, n = 6) =>
    skinStrip(zs, from, to, n, white, "T15_fuselage");
  const closedBand = (start, end, steps) =>
    bodyStrip(stations(start, end, steps), fixed(0), fixed(Math.PI * 2), 32);
  closedBand(-0.465, -0.335, 8);
  // One uninterrupted, gently wrapped windshield, with rounded corners.
  const frontStart = -0.335,
    frontEnd = -0.205,
    frontZ = stations(frontStart, frontEnd, 14);
  const windowHalf = (z, start, end, half) =>
    half *
    Math.sqrt(Math.max(0, 1 - ((2 * (z - start)) / (end - start) - 1) ** 8));
  const edge = (z) => Math.PI / 2 - windowHalf(z, frontStart, frontEnd, 0.92);
  bodyStrip(frontZ, fixed(0), edge, 6);
  skinStrip(
    frontZ,
    edge,
    (z) => Math.PI - edge(z),
    14,
    glass,
    "T15_windscreen",
  );
  bodyStrip(frontZ, (z) => Math.PI - edge(z), fixed(Math.PI), 6);
  bodyStrip(frontZ, fixed(Math.PI), fixed(Math.PI * 2), 16);
  closedBand(frontEnd, -0.195, 2);
  function sideWindow(start, end, name) {
    const zs = stations(start, end, 12);
    // Define the pane in actual height, not polar angle: rounded shoulders
    // otherwise squeeze the glazing into a shallow, sloping roof window.
    const edge = (z, side) => {
      const sill = 0.032,
        head = Math.min(0.112, sectionAt(z)[3] - 0.009);
      const y =
        (sill + head) / 2 + side * windowHalf(z, start, end, (head - sill) / 2);
      return angleAtHeight(z, y);
    };
    const lower = (z) => edge(z, -1),
      upper = (z) => edge(z, 1);
    bodyStrip(zs, fixed(0), lower, 4);
    skinStrip(zs, lower, upper, 8, glass, name + "_right");
    bodyStrip(zs, upper, (z) => Math.PI - upper(z), 12);
    skinStrip(
      zs,
      (z) => Math.PI - upper(z),
      (z) => Math.PI - lower(z),
      8,
      glass,
      name + "_left",
    );
    bodyStrip(zs, (z) => Math.PI - lower(z), fixed(Math.PI), 4);
    bodyStrip(zs, fixed(Math.PI), fixed(Math.PI * 2), 16);
  }
  sideWindow(-0.195, -0.085, "T15_front_side_window");
  closedBand(-0.085, -0.077, 2);
  sideWindow(-0.077, 0.07, "T15_rear_side_window");
  closedBand(0.07, 0.558, 18);
  // The colored nose meets the same ring as the white hull. Its short hub is
  // mostly covered by the spinner instead of looking like an extended axle.
  const oval = Array.from({ length: 32 }, (_, i) => [
    Math.cos((i * Math.PI) / 16),
    Math.sin((i * Math.PI) / 16),
  ]);
  loft(
    [
      [-0.523, 0.027, 0.03, 0.015],
      [-0.513, 0.032, 0.035, 0.015],
      [-0.496, 0.04, 0.041, 0.014],
      [-0.48, 0.0445, 0.044, 0.0135],
      [-0.465, 0.047, 0.046, 0.013],
    ].map(([z, w, h, y]) => oval.map(([a, b]) => [a * w, y + b * h, z])),
    accent,
    "T15_moulded_cowl",
    root,
    { capEnd: false },
  );
  for (const side of [-1, 1]) {
    const intake = mesh(
      new THREE.CircleGeometry(0.006, 12),
      navy,
      root,
      "T15_cooling_intake",
    );
    intake.rotation.y = Math.PI;
    intake.scale.set(1.05, 0.65, 1);
    intake.position.set(side * 0.014, -0.001, -0.5232);
    for (let i = 0; i < 3; i++) {
      const start = -0.449 + i * 0.019;
      skinStrip(
        stations(start, start + 0.009, 2),
        fixed(side > 0 ? -0.2 : Math.PI - 0.02),
        fixed(side > 0 ? 0.02 : Math.PI + 0.2),
        2,
        navy,
        "T15_cowl_vents_" + side,
        0.0005,
      );
    }
    // Conformal paint uses the very same hull, including the curved shoulder.
    const stripeAngle = (z, height) => {
      const [, h, center, top] = sectionAt(z);
      const exponent =
        1 - Math.min(1, Math.max(0, (top - center - h) / 0.05)) * 0.55;
      return Math.asin(((h * height) / (top - center)) ** (1 / exponent));
    };
    skinStrip(
      stations(-0.3, 0.43, 38),
      (z) => (side > 0 ? stripeAngle(z, 0.05) : Math.PI - stripeAngle(z, 0.19)),
      (z) => (side > 0 ? stripeAngle(z, 0.19) : Math.PI - stripeAngle(z, 0.05)),
      2,
      accent,
      "T15_fuselage_cheatline_" + side,
      0.0005,
    );
    const handleAngle = angleAtHeight(-0.06, 0.022);
    const handle = skinPoint(
      -0.06,
      side > 0 ? handleAngle : Math.PI - handleAngle,
    );
    box(
      [0.003, 0.003, 0.018],
      handle.toArray(),
      metal,
      root,
      "T15_door_handle",
    );
  }
  buildSkin();
  for (const data of skins.values()) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(data.positions, 3),
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(data.normals, 3),
    );
    geometry.setIndex(data.indices);
    mesh(geometry, data.mat, root, data.name);
  }
  // Close only the small tail end, never a second shell through the windows.
  panel(
    oval.map(([a, b]) => [a * 0.003, 0.036 + b * 0.007, 0.558]),
    white,
    "T15_tail_cap",
  );
  rod(
    [0, 0.015, -0.521],
    [0, 0.015, -0.532],
    0.01,
    metal,
    root,
    "T15_propeller_hub",
  );
  const airfoil = [
    [-0.142, 0],
    [-0.139, 0.008],
    [-0.129, 0.017],
    [-0.108, 0.025],
    [-0.071, 0.03],
    [-0.025, 0.025],
    [0.025, 0.014],
    [0.066, 0.002],
    [0.066, -0.002],
    [0.025, -0.005],
    [-0.025, -0.007],
    [-0.08, -0.007],
    [-0.12, -0.005],
    [-0.138, -0.002],
  ];
  const wingY = (x) => 0.12 + Math.abs(x) * 0.052;
  const wingScale = (x) => 1 - 0.12 * (Math.abs(x) / 0.75) ** 3;
  const spans = [
    -0.75, -0.735, -0.68, -0.52, -0.25, 0, 0.25, 0.52, 0.68, 0.735, 0.75,
  ];
  loft(
    spans.map((x) =>
      airfoil.map(([z, h]) => [
        x,
        wingY(x) + h * (Math.abs(x) > 0.735 ? 0.7 : 1),
        (z === 0.066 ? 0.0645 : z * wingScale(x)) + TRAINER_WING_SHIFT,
      ]),
    ),
    white,
    "T15_airfoil_wing",
  );
  function wingPaint(side, inner, outer, mat, name) {
    const xs = [inner, ...spans.filter((x) => x > inner && x < outer), outer],
      top = airfoil.slice(0, 8),
      positions = [],
      indices = [];
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < top.length - 1; j++) {
        const point = (x, k) => {
          const hi = spans.findIndex((value) => value >= x),
            a = spans[Math.max(0, hi - 1)],
            b = spans[hi],
            t = (x - a) / (b - a);
          const height = (value) =>
            wingY(value) + top[k][1] * (value > 0.735 ? 0.7 : 1);
          return [
            side * x,
            height(a) * (1 - t) + height(b) * t + 0.0007,
            (top[k][0] === 0.066
              ? 0.0645
              : top[k][0] * (wingScale(a) * (1 - t) + wingScale(b) * t)) +
              TRAINER_WING_SHIFT,
          ];
        };
        const points = [
          point(xs[i], j),
          point(xs[i + 1], j),
          point(xs[i + 1], j + 1),
          point(xs[i], j + 1),
        ];
        const start = positions.length / 3;
        positions.push(...points.flat());
        if (side > 0)
          indices.push(
            start,
            start + 2,
            start + 1,
            start,
            start + 3,
            start + 2,
          );
        else
          indices.push(
            start,
            start + 1,
            start + 2,
            start,
            start + 2,
            start + 3,
          );
      }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    mesh(geometry, mat, root, name);
  }
  for (const side of [-1, 1]) {
    wingPaint(side, 0.6, 0.744, accent, "T15_flush_wingtip_paint");
    wingPaint(side, 0.53, 0.555, navy, "T15_flush_wing_band");
    const hinge = new THREE.Group();
    hinge.name =
      side < 0 ? "T15_left_aileron_hinge" : "T15_right_aileron_hinge";
    hinge.position.set(side * 0.48, wingY(0.48), 0.0653 + TRAINER_WING_SHIFT);
    hinge.userData = {
      surface: "aileron",
      side,
      hingeTilt: side * Math.atan(0.052),
    };
    hinge.rotation.z = hinge.userData.hingeTilt;
    root.add(hinge);
    const flapProfile = [
      [0, 0.002],
      [0.055, 0.001],
      [0.055, -0.001],
      [0, -0.002],
    ];
    loft(
      [-0.205, 0.205].map((x) => flapProfile.map(([z, y]) => [x, y, z])),
      accent,
      "T15_aileron",
      hinge,
    );
    for (const x of [0.32, 0.63])
      rod(
        [side * x - 0.004, wingY(x), 0.0649 + TRAINER_WING_SHIFT],
        [side * x + 0.004, wingY(x), 0.0649 + TRAINER_WING_SHIFT],
        0.0018,
        white,
        root,
        "T15_aileron_hinge_pin",
      );
    rod(
      [side * 0.075, -0.025, 0.036],
      [side * 0.46, wingY(0.46) - 0.006, 0.015 + TRAINER_WING_SHIFT],
      0.004,
      white,
      root,
      "T15_wing_strut",
    );
    rod(
      [side * 0.075, -0.025, 0.036],
      [side * 0.4, wingY(0.4) - 0.006, -0.099 + TRAINER_WING_SHIFT],
      0.003,
      metal,
      root,
      "T15_forward_wing_brace",
    );
    // Compact exposed RC servo horn/linkage, attached to the moving aileron.
    box(
      [0.021, 0.006, 0.025],
      [side * 0.4, wingY(0.4) - 0.011, 0.014 + TRAINER_WING_SHIFT],
      navy,
      root,
      "T15_aileron_servo",
    );
    rod(
      [side * 0.4, wingY(0.4) - 0.018, 0.03 + TRAINER_WING_SHIFT],
      [side * 0.4, wingY(0.4) - 0.018, 0.081 + TRAINER_WING_SHIFT],
      0.0011,
      metal,
      root,
      "T15_aileron_pushrod",
    );
  }
  // Tapered horizontal stabilizer and elevator, with an actual hinge gap.
  const tailProfile = [
    [-0.065, 0],
    [-0.052, 0.006],
    [0.048, 0.004],
    [0.048, -0.004],
    [-0.052, -0.006],
  ];
  loft(
    [
      [-0.255, 0.8],
      [-0.22, 1],
      [0, 1],
      [0.22, 1],
      [0.255, 0.8],
    ].map(([x, s]) =>
      tailProfile.map(([z, y]) => [
        x,
        0.044 + y,
        z === 0.048 ? 0.472 : 0.424 + z * s,
      ]),
    ),
    white,
    "T15_stabilizer",
  );
  const elevator = new THREE.Group();
  elevator.name = "T15_elevator_hinge";
  elevator.position.set(0, 0.044, 0.473);
  elevator.userData.surface = "elevator";
  root.add(elevator);
  // A central relief leaves room for the fuselage/rudder during elevator travel.
  for (const spans of [
    [
      [-0.25, 0.8],
      [-0.022, 1],
    ],
    [
      [0.022, 1],
      [0.25, 0.8],
    ],
  ])
    loft(
      spans.map(([x, s]) => [
        [x, 0.004, 0],
        [x, 0.001, 0.052 * s],
        [x, -0.003, 0.052 * s],
        [x, -0.004, 0],
      ]),
      accent,
      "T15_elevator",
      elevator,
    );
  for (const x of [-0.15, 0.15])
    rod(
      [x - 0.004, 0.044, 0.4725],
      [x + 0.004, 0.044, 0.4725],
      0.0018,
      white,
      root,
      "T15_elevator_hinge_pin",
    );
  const finShape = new THREE.Shape();
  finShape.moveTo(0.34, 0.04);
  finShape.quadraticCurveTo(0.379, 0.077, 0.405, 0.18);
  finShape.quadraticCurveTo(0.416, 0.218, 0.444, 0.221);
  finShape.lineTo(0.508, 0.2);
  finShape.lineTo(0.508, 0.044);
  finShape.closePath();
  const fin = mesh(
    new THREE.ExtrudeGeometry(finShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.0005,
      bevelThickness: 0.002,
      curveSegments: 6,
    }),
    white,
    root,
    "T15_swept_fin",
  );
  fin.rotation.y = -Math.PI / 2;
  fin.position.x = 0.006;
  const rudder = new THREE.Group();
  rudder.name = "T15_rudder_hinge";
  rudder.position.set(0, 0.05, 0.5095);
  rudder.userData.surface = "rudder";
  root.add(rudder);
  loft(
    [
      [0, 0.006],
      [0.135, 0.007],
      [0.148, 0.005],
    ].map(([y, w]) => [
      [w, y, 0],
      [w, y, 0.039],
      [-w, y, 0.039],
      [-w, y, 0],
    ]),
    accent,
    "T15_rudder",
    rudder,
  );
  for (const y of [0.08, 0.16])
    rod(
      [0, y - 0.004, 0.509],
      [0, y + 0.004, 0.509],
      0.0018,
      white,
      root,
      "T15_rudder_hinge_pin",
    );
  // Correct-length sprung gear struts meet the axle, with dished hubs/tyres.
  for (const [x, y, z] of TRAINER_GEAR) {
    const forkOffset = x === 0 ? 0.014 : 0.018;
    rod(
      [x * 0.18, -0.05, z],
      [x, y, z],
      x === 0 ? 0.004 : 0.0055,
      metal,
      root,
      "T15_landing_gear_leg",
    );
    if (x !== 0)
      rod(
        [x * 0.18, -0.05, z - 0.05],
        [x, y, z],
        0.0035,
        metal,
        root,
        "T15_gear_brace",
      );
    const tyre = mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.028, 20),
      rubber,
      root,
      "T15_tyre",
    );
    tyre.rotation.z = Math.PI / 2;
    tyre.position.set(x, y, z);
    for (const side of [-1, 1]) {
      const hub = mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.003, 16),
        white,
        root,
        "T15_recessed_wheel_hub",
      );
      hub.rotation.z = Math.PI / 2;
      hub.position.set(x + side * 0.0145, y, z);
      const cap = mesh(
        new THREE.CylinderGeometry(0.009, 0.009, 0.004, 10),
        metal,
        root,
        "T15_axle_cap",
      );
      cap.rotation.z = Math.PI / 2;
      cap.position.set(x + side * forkOffset, y, z);
    }
  }
  const prop = new THREE.Group();
  prop.name = "T15_propeller";
  prop.position.set(0, 0.015, -0.532);
  prop.userData = { propeller: true, motorIndex: 0, phaseOffset: 0, axis: "z" };
  root.add(prop);
  // Swept paddle outlines replace the old pair of rectangular sticks.
  for (const side of [-1, 1]) {
    const blade = new THREE.Shape();
    blade.moveTo(0.006, 0.012);
    blade.bezierCurveTo(0.022, 0.031, 0.028, 0.083, 0.013, 0.123);
    blade.quadraticCurveTo(0.006, 0.133, -0.005, 0.122);
    blade.bezierCurveTo(-0.012, 0.086, -0.007, 0.046, -0.006, 0.012);
    blade.closePath();
    const object = mesh(
      new THREE.ExtrudeGeometry(blade, {
        depth: 0.003,
        bevelEnabled: false,
        curveSegments: 6,
      }),
      navy,
      prop,
      "T15_shaped_prop_blade",
    );
    object.rotation.z = side < 0 ? Math.PI : 0;
    object.position.z = -0.0015;
  }
  const spinner = mesh(
    new THREE.SphereGeometry(0.026, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    accent,
    root,
    "T15_spinner",
  );
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.set(0, 0.015, -0.534);
  spinner.scale.y = 1.35;
  const fpv = mesh(
    new THREE.CylinderGeometry(0.012, 0.013, 0.022, 12),
    navy,
    root,
    "T15_FPV_camera",
  );
  fpv.rotation.x = Math.PI / 2;
  const cameraZ = -0.168 + TRAINER_WING_SHIFT;
  const cameraY = skinPoint(cameraZ, Math.PI / 2).y + 0.01;
  fpv.position.set(0, cameraY, cameraZ);
  const lens = mesh(
    new THREE.CircleGeometry(0.009, 16),
    light,
    root,
    "T15_FPV_lens",
  );
  lens.rotation.y = Math.PI;
  lens.position.set(0, cameraY, cameraZ - 0.012);
  // A small antenna aft of the wing and restrained navigation lenses.
  rod(
    [0, 0.068, 0.14],
    [0, 0.127, 0.16],
    0.0015,
    navy,
    root,
    "T15_receiver_antenna",
  );
  for (const side of [-1, 1]) {
    const nav = mesh(
      new THREE.SphereGeometry(0.005, 8, 6),
      side < 0 ? accent : light,
      root,
      "T15_wingtip_lens",
    );
    nav.position.set(
      side * 0.744,
      wingY(0.744) + 0.012,
      -0.07 + TRAINER_WING_SHIFT,
    );
  }
  root.updateMatrixWorld(true);
  if (batchStatic) batchAirplaneShell(root);
  return root;
}
// Backward-compatible name for the original trainer animation API.
export function animateTrainer(...args) { animateFixedWingModel(...args); }
