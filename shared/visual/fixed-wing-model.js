import * as THREE from "three";
import { TRAINER_GEAR } from "../physics/fixed-wing-colliders.js";

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
  const oval = Array.from({ length: 16 }, (_, i) => [
    Math.cos((i * Math.PI) / 8),
    Math.sin((i * Math.PI) / 8),
  ]);
  const fuselageSections = [
    [-0.465, 0.047, 0.046, 0.013],
    [-0.38, 0.06, 0.06, 0.009],
    [-0.29, 0.067, 0.072, 0.005],
    [-0.15, 0.068, 0.075, 0],
    [-0.02, 0.063, 0.071, -0.003],
    [0.13, 0.048, 0.054, 0.001],
    [0.28, 0.032, 0.038, 0.012],
    [0.43, 0.018, 0.023, 0.026],
    [0.54, 0.009, 0.014, 0.036],
    [0.558, 0.003, 0.007, 0.036],
  ];
  loft(
    fuselageSections.map(([z, w, h, y]) =>
      oval.map(([a, b]) => [
        a * w,
        z >= -0.29 && z <= 0.13 ? Math.min(0.034, y + b * h) : y + b * h,
        z,
      ]),
    ),
    white,
    "T15_fuselage",
    root,
    { capStart: false },
  );
  // Separate fitted cowl, with lower cooling intake and visible motor hub.
  loft(
    [
      [-0.52, 0.026, 0.031],
      [-0.494, 0.037, 0.04],
      [-0.465, 0.047, 0.046],
    ].map(([z, w, h]) => oval.map(([a, b]) => [a * w, 0.013 + b * h, z])),
    accent,
    "T15_moulded_cowl",
    root,
    { capEnd: false },
  );
  box(
    [0.031, 0.013, 0.004],
    [0, -0.006, -0.5205],
    navy,
    root,
    "T15_cooling_intake",
  );
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const point = (z, y) => {
          const t = (z + 0.465) / (0.465 - 0.38),
            w = 0.047 + (0.06 - 0.047) * t,
            h = 0.046 + (0.06 - 0.046) * t,
            center = 0.013 + (0.009 - 0.013) * t;
          const f = Math.abs(y - center) / (h * Math.sin(Math.PI / 8));
          return [
            side * (w * (1 - f + f * Math.cos(Math.PI / 8)) + 0.0007),
            y,
            z,
          ];
        },
        z = -0.453 + i * 0.019;
      panel(
        [
          point(z, -0.003),
          point(z, 0.009),
          point(z + 0.009, 0.009),
          point(z + 0.009, -0.003),
        ],
        navy,
        "T15_cowl_vent",
      );
    }
  rod([0, 0.015, -0.516], [0, 0.015, -0.55], 0.011, metal);
  // Shaped cabin: sloped windscreen and trapezoid side windows, rather than a box.
  const cabinRings = [
    [-0.305, 0.053, 0.06],
    [-0.222, 0.055, 0.128],
    [-0.075, 0.054, 0.128],
    [0.045, 0.044, 0.07],
  ];
  const cabinAt = (z) => {
    const hi = cabinRings.findIndex((row) => row[0] >= z),
      a = cabinRings[Math.max(0, hi - 1)],
      b = cabinRings[hi];
    const t = a === b ? 0 : (z - a[0]) / (b[0] - a[0]);
    return { z, w: a[1] + (b[1] - a[1]) * t, top: a[2] + (b[2] - a[2]) * t };
  };
  const cabinPoint = (z, side, y) => [side * cabinAt(z).w, y, z];
  // Glazing replaces shell faces, rather than intersecting a second white hull.
  const roofPoint = (u, t) => {
    const a = cabinRings[0],
      b = cabinRings[1];
    return [
      u * 0.78 * (a[1] + (b[1] - a[1]) * t),
      a[2] + (b[2] - a[2]) * t,
      a[0] + (b[0] - a[0]) * t,
    ];
  };
  const us = [-1, -0.91, -0.025, 0.025, 0.91, 1],
    ts = [0, 0.12, 0.9, 1];
  for (let i = 0; i < us.length - 1; i++)
    for (let j = 0; j < ts.length - 1; j++) {
      const glazed = j === 1 && i !== 0 && i !== 2 && i !== us.length - 2;
      panel(
        [
          roofPoint(us[i], ts[j]),
          roofPoint(us[i + 1], ts[j]),
          roofPoint(us[i + 1], ts[j + 1]),
          roofPoint(us[i], ts[j + 1]),
        ],
        glazed ? glass : white,
        glazed ? "T15_windscreen" : "T15_windscreen_frame",
      );
    }
  for (let i = 1; i < cabinRings.length - 1; i++) {
    const a = cabinAt(cabinRings[i][0]),
      b = cabinAt(cabinRings[i + 1][0]);
    panel(
      [
        [-a.w * 0.78, a.top, a.z],
        [a.w * 0.78, a.top, a.z],
        [b.w * 0.78, b.top, b.z],
        [-b.w * 0.78, b.top, b.z],
      ],
      white,
      "T15_cabin_roof",
    );
  }
  for (const z of [cabinRings[0][0], cabinRings.at(-1)[0]]) {
    const c = cabinAt(z);
    panel(
      [
        [c.w, 0.028, z],
        [c.w, c.top - 0.012, z],
        [c.w * 0.78, c.top, z],
        [-c.w * 0.78, c.top, z],
        [-c.w, c.top - 0.012, z],
        [-c.w, 0.028, z],
      ],
      white,
      "T15_cabin_end",
    );
  }
  for (const side of [-1, 1]) {
    const cabinStations = [
      -0.305, -0.284, -0.222, -0.14, -0.132, -0.075, 0.006, 0.045,
    ];
    for (let i = 0; i < cabinStations.length - 1; i++) {
      const a = cabinAt(cabinStations[i]),
        b = cabinAt(cabinStations[i + 1]),
        glazed =
          a.z >= -0.284 && b.z <= 0.006 && !(a.z >= -0.14 && b.z <= -0.132);
      const lower = 0.043;
      panel(
        [
          cabinPoint(a.z, side, 0.028),
          cabinPoint(b.z, side, 0.028),
          cabinPoint(b.z, side, lower),
          cabinPoint(a.z, side, lower),
        ],
        white,
        "T15_cabin_sill",
      );
      panel(
        [
          cabinPoint(a.z, side, lower),
          cabinPoint(b.z, side, lower),
          cabinPoint(b.z, side, b.top - 0.012),
          cabinPoint(a.z, side, a.top - 0.012),
        ],
        glazed ? glass : white,
        glazed
          ? b.z <= -0.14
            ? "T15_front_side_window"
            : "T15_rear_side_window"
          : "T15_window_pillar",
      );
      panel(
        [
          cabinPoint(a.z, side, a.top - 0.012),
          cabinPoint(b.z, side, b.top - 0.012),
          [side * b.w * 0.78, b.top, b.z],
          [side * a.w * 0.78, a.top, a.z],
        ],
        white,
        "T15_cabin_roof_rail",
      );
    }
    rod(
      [side * 0.057, 0.034, -0.284],
      [side * 0.057, 0.034, 0.01],
      0.0012,
      seam,
      root,
      "T15_door_sill",
    );
    box(
      [0.003, 0.003, 0.02],
      [side * 0.058, 0.034, -0.08],
      metal,
      root,
      "T15_door_handle",
    );
    // Follow the actual faceted shell, so the stripe cannot cut into the body.
    const positions = [],
      indices = [],
      stations = fuselageSections.slice(2, -2);
    for (const [z, w, h, y] of stations)
      for (const t of [0.04, 0.5])
        positions.push(
          side * (w * (1 - t + t * Math.cos(Math.PI / 8)) + 0.0006),
          y + h * t * Math.sin(Math.PI / 8),
          z,
        );
    for (let i = 0; i < stations.length - 1; i++) {
      const k = i * 2;
      if (side > 0) indices.push(k, k + 1, k + 3, k, k + 3, k + 2);
      else indices.push(k, k + 3, k + 1, k, k + 2, k + 3);
    }
    const paint = new THREE.BufferGeometry();
    paint.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    paint.setIndex(indices);
    paint.computeVertexNormals();
    mesh(paint, accent, root, "T15_fuselage_cheatline");
  }
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
        z === 0.066 ? 0.0645 : z * wingScale(x),
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
            top[k][0] === 0.066
              ? 0.0645
              : top[k][0] * (wingScale(a) * (1 - t) + wingScale(b) * t),
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
    hinge.position.set(side * 0.48, wingY(0.48), 0.0653);
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
        [side * x - 0.004, wingY(x), 0.0649],
        [side * x + 0.004, wingY(x), 0.0649],
        0.0018,
        white,
        root,
        "T15_aileron_hinge_pin",
      );
    rod(
      [side * 0.075, -0.025, 0.036],
      [side * 0.46, wingY(0.46) - 0.006, 0.015],
      0.004,
      white,
      root,
      "T15_wing_strut",
    );
    rod(
      [side * 0.075, -0.025, 0.036],
      [side * 0.4, wingY(0.4) - 0.006, -0.099],
      0.003,
      metal,
      root,
      "T15_forward_wing_brace",
    );
    // Compact exposed RC servo horn/linkage, attached to the moving aileron.
    box(
      [0.021, 0.006, 0.025],
      [side * 0.4, wingY(0.4) - 0.011, 0.014],
      navy,
      root,
      "T15_aileron_servo",
    );
    rod(
      [side * 0.4, wingY(0.4) - 0.018, 0.03],
      [side * 0.4, wingY(0.4) - 0.018, 0.081],
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
  prop.position.set(0, 0.015, -0.55);
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
  spinner.position.set(0, 0.015, -0.552);
  spinner.scale.y = 1.65;
  const fpv = mesh(
    new THREE.CylinderGeometry(0.012, 0.013, 0.022, 12),
    navy,
    root,
    "T15_FPV_camera",
  );
  fpv.rotation.x = Math.PI / 2;
  fpv.position.set(0, 0.135, -0.22);
  const lens = mesh(
    new THREE.CircleGeometry(0.009, 16),
    light,
    root,
    "T15_FPV_lens",
  );
  lens.rotation.y = Math.PI;
  lens.position.set(0, 0.135, -0.232);
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
    nav.position.set(side * 0.744, wingY(0.744) + 0.012, -0.07);
  }
  root.updateMatrixWorld(true);
  if (batchStatic) batchTrainerShell(root);
  return root;
}
// Static details share one draw per material. Hinges and the propeller remain
// independent; adding a vent or a wheel hub does not add another flight draw.
function batchTrainerShell(root) {
  const batches = new Map();
  for (const object of [...root.children]) {
    if (!object.isMesh) continue;
    const geometry = object.geometry.index
      ? object.geometry.toNonIndexed()
      : object.geometry.clone();
    geometry.applyMatrix4(object.matrix);
    if (!batches.has(object.material))
      batches.set(object.material, { positions: [], normals: [], parts: [] });
    const batch = batches.get(object.material);
    batch.positions.push(...geometry.attributes.position.array);
    batch.normals.push(...geometry.attributes.normal.array);
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
    const object = new THREE.Mesh(geometry, material);
    object.name = "T15_static_shell_" + index++;
    object.userData.parts = batch.parts;
    object.castShadow = object.receiveShadow = true;
    root.add(object);
  }
  root.updateMatrixWorld(true);
}
export function animateTrainer(model, surfaces, phase) {
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
