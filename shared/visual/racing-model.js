import * as THREE from "three";
import { aircraftMeshTools, samples } from "./aircraft-mesh-utils.js";
import { batchAirplaneShell } from "./airplane-model-utils.js";
import { configureDronePolymer, DRONE_SURFACES } from "./drone-rendering.js";

export const R5_MOTOR_POSITIONS = [
  [-0.0825, 0.018, -0.0715],
  [0.0825, 0.018, -0.0715],
  [-0.0825, 0.018, 0.0715],
  [0.0825, 0.018, 0.0715],
];
const DIRECTIONS = [1, -1, -1, 1];

function carbonTexture() {
  const size = 128,
    pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const horizontal = (Math.floor(x / 16) + Math.floor(y / 16)) % 4 < 2;
      const across = (horizontal ? y : x) % 16,
        along = horizontal ? x : y;
      const shade =
        29 + 18 * Math.sin((Math.PI * across) / 16) + (along % 4 === 0 ? 6 : 0);
      const i = (y * size + x) * 4;
      pixels.set([shade, shade + 5, shade + 7, 255], i);
    }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function packLabel() {
  const width = 128,
    height = 256,
    pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4)
    pixels.set([214, 221, 217, 255], i);
  const rect = (x, y, w, h, color) => {
    for (let row = y; row < y + h; row++)
      for (let col = x; col < x + w; col++)
        if (row >= 0 && col >= 0 && row < height && col < width)
          pixels.set([...color, 255], (row * width + col) * 4);
  };
  const font = {
    R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    I: ["111", "010", "010", "010", "010", "010", "111"],
    F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
    1: ["010", "110", "010", "010", "010", "010", "111"],
    0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    5: ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  };
  const text = (value, y, scale) => {
    const total =
      [...value].reduce((n, c) => n + (font[c]?.[0].length ?? 3) + 1, 0) *
      scale;
    let x = Math.floor((width - total) / 2);
    for (const c of value) {
      const glyph = font[c];
      if (glyph)
        glyph.forEach((row, j) =>
          [...row].forEach((p, i) => {
            if (p === "1")
              rect(x + i * scale, y + j * scale, scale, scale, [28, 39, 43]);
          }),
        );
      x += ((glyph?.[0].length ?? 3) + 1) * scale;
    }
  };
  rect(0, 0, width, 12, [255, 102, 72]);
  rect(0, 244, width, 12, [255, 102, 72]);
  text("RIFT", 28, 4);
  text("6S", 82, 5);
  text("1050", 148, 4);
  for (let i = 0; i < 24; i++)
    rect(15 + i * 4, 210, i % 3 === 0 ? 2 : 1, 18, [28, 39, 43]);
  const texture = new THREE.DataTexture(pixels, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// Compact true-X racing frame. A single metre-scale factory serves flight,
// remote pilots, ghosts and the showroom; no miniature freestyle conversion.
export function createRacingModel({ batchStatic = true } = {}) {
  const root = new THREE.Group();
  root.name = "Rift_R5";
  root.userData.proceduralAircraft = true;
  const { mesh, rod, tube, box, loft } = aircraftMeshTools(root);
  const mat = (color, roughness = 0.6, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const carbon = new THREE.MeshStandardMaterial({
    color: "#a5afaf",
    map: carbonTexture(),
    metalness: 0.3,
    roughness: 0.5,
  });
  const dark = mat("#1b2428", 0.65),
    rubber = mat("#202426", 0.96),
    silver = mat("#9caaae", 0.3, 0.85),
    copper = mat("#b8763c", 0.4, 0.6),
    gold = mat("#c4a25a", 0.3, 0.7),
    accent = mat("#ff6648", 0.64),
    yellow = mat("#f4bc23", 0.72),
    red = mat("#bb382d", 0.7),
    pcb = new THREE.MeshStandardMaterial(DRONE_SURFACES.pcb),
    glass = new THREE.MeshPhysicalMaterial(DRONE_SURFACES.lens),
    pack = mat("#29383e", 0.5, 0.15);
  accent.userData.droneColorRole = "base";
  configureDronePolymer(accent);
  const propMaterial = new THREE.MeshPhysicalMaterial({
    color: "#315b56",
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.7,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const roundRect = (w, h, r, cx = 0, cy = 0) => {
    const s = new THREE.Shape(),
      x = -w / 2 + cx,
      y = -h / 2 + cy;
    r = Math.min(r, w / 2, h / 2);
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  function rounded(size, p, material, name, parent = root, r = 0.002) {
    const bevel = Math.min(0.00045, ...size.map((v) => v / 8));
    const g = new THREE.ExtrudeGeometry(
      roundRect(
        size[0] - 2 * bevel,
        size[1] - 2 * bevel,
        Math.max(bevel, r - bevel),
      ),
      {
        depth: size[2] - 2 * bevel,
        bevelEnabled: true,
        bevelSize: bevel,
        bevelThickness: bevel,
        bevelSegments: 2,
        curveSegments: 5,
      },
    );
    g.translate(0, 0, -(size[2] - 2 * bevel) / 2);
    const o = mesh(g, material, name, parent);
    o.position.set(...p);
    return o;
  }
  const hole = (x, y, r) => {
    const p = new THREE.Path();
    p.absarc(x, y, r, 0, Math.PI * 2, true);
    return p;
  };
  function carbonPlate(shape, thickness, y, name) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      curveSegments: 10,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y - thickness / 2, 0);
    const positions = g.attributes.position,
      uv = g.attributes.uv;
    for (let i = 0; i < positions.count; i++)
      uv.setXY(i, positions.getX(i) / 0.0096, positions.getZ(i) / 0.0096);
    return mesh(g, carbon, name);
  }
  function bodyPlate(w, length, slots) {
    const shape = roundRect(w, length, 0.006);
    if (slots)
      for (const side of [-1, 1])
        for (const z of [-0.025, 0, 0.025]) {
          shape.holes.push(roundRect(0.0045, 0.014, 0.002, side * 0.009, z));
        }
    for (const x of [-0.014, 0.014])
      for (const z of [-0.033, 0.033]) shape.holes.push(hole(x, z, 0.0016));
    return shape;
  }
  carbonPlate(
    bodyPlate(0.044, 0.094, false),
    0.003,
    -0.006,
    "R5_lower_chassis",
  );
  carbonPlate(
    bodyPlate(0.036, 0.082, true),
    0.002,
    0.019,
    "R5_slotted_top_plate",
  );
  // Four replaceable tapered arms meet a short stack rather than a long deck.
  R5_MOTOR_POSITIONS.forEach(([x, , z], index) => {
    const start = new THREE.Vector2(Math.sign(x) * 0.008, Math.sign(z) * 0.012),
      end = new THREE.Vector2(x, -z),
      // Shape Y becomes -Z after laying the plate horizontally.
      origin = new THREE.Vector2(start.x, -start.y),
      delta = end.clone().sub(origin),
      normal = new THREE.Vector2(-delta.y, delta.x).normalize();
    const arm = new THREE.Shape(),
      r = 0.0115;
    const points = [
      origin.clone().addScaledVector(normal, 0.006),
      origin.clone().lerp(end, 0.73).addScaledVector(normal, 0.004),
      end.clone().addScaledVector(normal, r),
    ];
    arm.moveTo(points[0].x, points[0].y);
    arm.lineTo(points[1].x, points[1].y);
    const a = Math.atan2(normal.y, normal.x);
    arm.absarc(end.x, end.y, r, a, a - Math.PI, true);
    const lower = origin
        .clone()
        .lerp(end, 0.73)
        .addScaledVector(normal, -0.004),
      base = origin.clone().addScaledVector(normal, -0.006);
    arm.lineTo(lower.x, lower.y);
    arm.lineTo(base.x, base.y);
    arm.closePath();
    for (let j = 0; j < 4; j++) {
      const angle = Math.PI / 4 + (j * Math.PI) / 2;
      arm.holes.push(
        hole(
          end.x + Math.cos(angle) * 0.008,
          end.y + Math.sin(angle) * 0.008,
          0.0011,
        ),
      );
    }
    carbonPlate(arm, 0.005, -0.0035, "R5_replaceable_arm_" + index);
    for (const offset of [-0.014, 0.014])
      rod(
        [Math.sign(x) * 0.011, -0.008, offset],
        [Math.sign(x) * 0.011, 0.002, offset],
        0.0015,
        silver,
        "R5_arm_clamp_bolt",
      );
  });
  for (const x of [-0.014, 0.014])
    for (const z of [-0.033, 0.033]) {
      rod([x, -0.004, z], [x, 0.018, z], 0.002, dark, "R5_standoff");
      rod(
        [x, 0.018, z],
        [x, 0.021, z],
        0.0024,
        silver,
        "R5_recessed_top_screw",
        root,
        6,
      );
    }
  // Stacked FC/ESC with exposed solder pads and actually connected conductors.
  rounded([0.033, 0.0015, 0.033], [0, -0.001, 0], pcb, "R5_four_in_one_ESC");
  rounded([0.024, 0.0014, 0.024], [0, 0.009, 0], pcb, "R5_flight_controller");
  for (const x of [-0.012, 0.012])
    for (const z of [-0.012, 0.012])
      rod([x, 0.001, z], [x, 0.011, z], 0.0012, rubber, "R5_stack_grommet");
  rounded([0.007, 0.0012, 0.007], [0, 0.0104, 0], dark, "R5_FC_processor");
  for (const x of [-0.008, 0.008])
    rounded([0.004, 0.0018, 0.007], [x, 0.001, 0], dark, "R5_ESC_MOSFET");
  for (let i = 0; i < 5; i++)
    box(
      [0.0015, 0.001, 0.002],
      [0.009 - i * 0.004, 0.0103, 0.009],
      silver,
      "R5_FC_component",
    );
  // Smooth, slender shark fin with a charcoal body and colored trailing seam.
  const fin = new THREE.Shape();
  fin.moveTo(0.031, 0.02);
  fin.quadraticCurveTo(0.032, 0.047, 0.025, 0.065);
  fin.quadraticCurveTo(0.021, 0.071, 0.018, 0.067);
  fin.quadraticCurveTo(0.02, 0.039, -0.004, 0.024);
  fin.quadraticCurveTo(-0.012, 0.02, -0.026, 0.02);
  fin.closePath();
  const finGeometry = new THREE.ExtrudeGeometry(fin, {
    depth: 0.0028,
    bevelEnabled: true,
    bevelSize: 0.0005,
    bevelThickness: 0.0004,
    bevelSegments: 2,
    curveSegments: 14,
  });
  finGeometry.translate(0, 0, -0.0014);
  finGeometry.rotateY(Math.PI / 2);
  mesh(finGeometry, dark, "R5_shark_fin");
  tube(
    [
      [0, 0.067, -0.019],
      [0, 0.054, -0.018],
      [0, 0.04, -0.012],
      [0, 0.029, 0.001],
      [0, 0.022, 0.017],
    ],
    0.00065,
    accent,
    "R5_fin_accent",
  );
  for (const z of [-0.028, 0.025])
    rod(
      [0, 0.02, z],
      [0, 0.022, z],
      0.0021,
      silver,
      "R5_fin_mount_screw",
      root,
      6,
    );
  // Compact tilted FPV camera supported between two carbon cheeks.
  for (const side of [-1, 1]) {
    const cheek = new THREE.Shape();
    cheek.moveTo(0.048, -0.003);
    cheek.lineTo(0.048, 0.012);
    cheek.quadraticCurveTo(0.044, 0.023, 0.036, 0.02);
    cheek.lineTo(0.024, 0.007);
    cheek.lineTo(0.024, -0.003);
    cheek.closePath();
    cheek.holes.push(hole(0.04, 0.009, 0.002));
    const g = new THREE.ExtrudeGeometry(cheek, {
      depth: 0.0018,
      bevelEnabled: false,
      curveSegments: 10,
    });
    g.translate(0, 0, -0.0009);
    g.rotateY(Math.PI / 2);
    const o = mesh(g, carbon, "R5_camera_cheek");
    o.position.x = side * 0.0145;
    rod(
      [side * 0.012, 0.009, -0.04],
      [side * 0.0165, 0.009, -0.04],
      0.002,
      silver,
      "R5_camera_pivot",
    );
  }
  const cameraGroup = new THREE.Group();
  cameraGroup.position.set(0, 0.009, -0.04);
  cameraGroup.rotation.x = (32 * Math.PI) / 180;
  root.add(cameraGroup);
  rounded(
    [0.025, 0.019, 0.014],
    [0, 0, 0],
    dark,
    "R5_micro_camera_housing",
    cameraGroup,
    0.003,
  );
  const lensBarrel = mesh(
    new THREE.CylinderGeometry(0.0063, 0.0068, 0.008, 24),
    dark,
    "R5_lens_barrel",
    cameraGroup,
  );
  lensBarrel.rotation.x = -Math.PI / 2;
  lensBarrel.position.z = -0.01;
  const lens = mesh(
    new THREE.CylinderGeometry(0.0051, 0.0051, 0.0006, 28),
    glass,
    "FPV_multicoated_lens",
    cameraGroup,
  );
  lens.rotation.x = -Math.PI / 2;
  lens.position.z = -0.0143;
  rounded(
    [0.027, 0.005, 0.012],
    [0, -0.006, -0.001],
    accent,
    "R5_camera_bumper",
    cameraGroup,
  );
  rounded(
    [0.009, 0.004, 0.003],
    [0, -0.004, 0.0075],
    dark,
    "R5_camera_rear_plug",
    cameraGroup,
    0.0005,
  );
  cameraGroup.updateMatrixWorld(true);
  root.userData.fpvCameraOffset = lens
    .getWorldPosition(new THREE.Vector3())
    .add(
      new THREE.Vector3(0, 0, -0.001).applyQuaternion(cameraGroup.quaternion),
    )
    .toArray();
  for (const [offset, material] of [
    [-0.002, red],
    [0, dark],
    [0.002, yellow],
  ]) {
    const start = cameraGroup
      .localToWorld(new THREE.Vector3(offset, -0.004, 0.009))
      .toArray();
    tube(
      [
        start,
        [offset, 0.005, -0.023],
        [offset, 0.012, -0.015],
        [offset, 0.0102, -0.009],
      ],
      0.00045,
      material,
      "R5_camera_harness",
    );
    box(
      [0.0015, 0.0003, 0.0018],
      [offset, 0.00985, -0.009],
      gold,
      "R5_camera_FC_pad",
    );
    const solder = mesh(
      new THREE.SphereGeometry(0.0008, 8, 6),
      silver,
      "R5_camera_solder",
    );
    solder.scale.y = 0.55;
    solder.position.set(offset, 0.0102, -0.009);
  }
  // Underslung 6S pack and two straps passing through the lower chassis.
  const battery = new THREE.Group();
  battery.name = "R5_underslung_battery";
  root.add(battery);
  rounded(
    [0.035, 0.034, 0.068],
    [0, -0.0335, 0.003],
    pack,
    "R5_6S_1050mAh_pack",
    battery,
    0.003,
  );
  for (let i = 1; i < 6; i++)
    for (const side of [-1, 1])
      box(
        [0.0003, 0.00025, 0.059],
        [side * 0.01755, -0.0505 + i * 0.0056, 0.003],
        silver,
        "R5_cell_wrapper_seam",
        battery,
      );
  const label = new THREE.MeshStandardMaterial({
    map: packLabel(),
    color: "#ffffff",
    roughness: 0.75,
  });
  const print = mesh(
    new THREE.PlaneGeometry(0.028, 0.056),
    label,
    "R5_battery_label",
    battery,
  );
  print.rotation.x = Math.PI / 2;
  print.position.set(0, -0.05065, 0.003);
  for (const z of [-0.019, 0.025]) {
    for (const side of [-1, 1])
      box(
        [0.001, 0.049, 0.0075],
        [side * 0.018, -0.026, z],
        rubber,
        "R5_battery_strap",
        battery,
      );
    box(
      [0.037, 0.001, 0.0075],
      [0, -0.0515, z],
      rubber,
      "R5_battery_strap_bottom",
      battery,
    );
    rounded(
      [0.009, 0.003, 0.009],
      [0.012, -0.001, z],
      dark,
      "R5_strap_buckle",
      battery,
      0.001,
    );
  }
  for (const [x, material] of [
    [-0.004, red],
    [0.004, dark],
  ])
    tube(
      [
        [x, -0.034, 0.037],
        [x, -0.032, 0.048],
        [x, -0.011, 0.054],
        [x, 0.007, 0.052],
      ],
      0.0013,
      material,
      "R5_battery_power_lead",
      battery,
    );
  rounded(
    [0.014, 0.008, 0.013],
    [0, 0.008, 0.052],
    yellow,
    "R5_XT60_connector",
  );
  for (const x of [-0.0035, 0.0035]) {
    rod([x, 0.008, 0.058], [x, 0.008, 0.059], 0.002, dark, "R5_XT60_socket");
    rod(
      [x, 0.008, 0.0587],
      [x, 0.008, 0.0592],
      0.0012,
      gold,
      "R5_XT60_contact",
    );
  }
  for (const [x, material] of [
    [-0.004, red],
    [0.004, dark],
  ]) {
    tube(
      [
        [x, 0.007, 0.046],
        [x, 0.003, 0.031],
        [x, -0.0001, 0.013],
      ],
      0.0012,
      material,
      "R5_ESC_power_pigtail",
    );
    const solder = mesh(
      new THREE.SphereGeometry(0.0018, 8, 6),
      silver,
      "R5_ESC_power_solder",
    );
    solder.scale.y = 0.55;
    solder.position.set(x, 0.0004, 0.013);
  }
  rounded([0.014, 0.0015, 0.019], [0, 0.004, 0.031], pcb, "R5_VTX_board");
  rounded([0.007, 0.002, 0.009], [0, 0.0055, 0.031], dark, "R5_VTX_shield");
  tube(
    [
      [0.004, 0.006, 0.036],
      [0.009, 0.011, 0.041],
      [0.007, 0.022, 0.049],
      [0, 0.031, 0.054],
    ],
    0.00055,
    dark,
    "R5_VTX_coax",
  );
  rod([0, 0.03, 0.054], [0, 0.049, 0.061], 0.0011, dark, "R5_antenna_stem");
  rod(
    [0, 0.048, 0.061],
    [0, 0.054, 0.063],
    0.0034,
    dark,
    "R5_antenna_head",
    root,
    14,
  );
  rod(
    [0, 0.049, 0.0613],
    [0, 0.05, 0.0617],
    0.0035,
    accent,
    "R5_antenna_color_ring",
    root,
    14,
  );
  // Detailed 2207 outrunners: copper stator, vented bells, shaft and locknut.
  R5_MOTOR_POSITIONS.forEach(([x, y, z], index) => {
    const cylinder = (r, h, cy, material, name, segments = 24) => {
      const o = mesh(
        new THREE.CylinderGeometry(r, r, h, segments),
        material,
        name,
      );
      o.position.set(x, cy, z);
      return o;
    };
    cylinder(0.0105, 0.003, -0.0001, silver, "R5_motor_mount");
    cylinder(0.0085, 0.008, 0.004, dark, "R5_stator");
    for (let j = 0; j < 12; j++) {
      const angle = (j * Math.PI) / 6;
      const coil = rounded(
        [0.0025, 0.006, 0.0025],
        [x + Math.cos(angle) * 0.0088, 0.004, z + Math.sin(angle) * 0.0088],
        copper,
        "R5_copper_winding",
        root,
        0.0006,
      );
      coil.rotation.y = -angle;
      const rib = box(
        [0.002, 0.009, 0.002],
        [x + Math.cos(angle) * 0.012, 0.006, z + Math.sin(angle) * 0.012],
        dark,
        "R5_vented_bell_rib",
      );
      rib.rotation.y = -angle;
    }
    cylinder(0.0133, 0.0015, 0.0108, dark, "R5_motor_bell_top");
    cylinder(0.009, 0.001, 0.012, accent, "R5_motor_color_ring");
    cylinder(0.003, 0.005, 0.014, silver, "R5_motor_shaft");
    cylinder(0.0036, 0.003, 0.0215, silver, "R5_propeller_locknut", 6);
    for (let j = 0; j < 4; j++) {
      const a = Math.PI / 4 + (j * Math.PI) / 2;
      rod(
        [x + Math.cos(a) * 0.008, -0.007, z + Math.sin(a) * 0.008],
        [x + Math.cos(a) * 0.008, 0.001, z + Math.sin(a) * 0.008],
        0.0012,
        silver,
        "R5_motor_screw",
      );
    }
    // Twelve individually soldered motor wires hug the upper arm surface.
    for (let wire = 0; wire < 3; wire++) {
      const pad = [
        Math.sign(x) * (0.0135 + wire * 0.0011),
        0.0001,
        Math.sign(z) * (0.006 + wire * 0.0033),
      ];
      const start = [x - Math.sign(x) * 0.008, 0.001, z + (wire - 1) * 0.002];
      tube(
        [
          start,
          [x * 0.65, -0.0002, z * 0.65 + (wire - 1) * 0.002],
          [x * 0.35, -0.0002, z * 0.35 + (wire - 1) * 0.002],
          pad,
        ],
        0.0006,
        dark,
        "R5_motor_wire_" + index + "_" + wire,
      );
      const solder = mesh(
        new THREE.SphereGeometry(0.00115, 8, 6),
        silver,
        "R5_motor_solder",
      );
      solder.scale.y = 0.55;
      solder.position.set(...pad);
      box(
        [0.0018, 0.0003, 0.0024],
        [pad[0], -0.0001, pad[2]],
        gold,
        "R5_motor_pad",
      );
    }
    const prop = new THREE.Group();
    prop.name = "Propeller_" + index;
    prop.position.set(x, y, z);
    prop.userData = {
      propeller: true,
      motorIndex: index,
      direction: DIRECTIONS[index],
      phaseOffset: 0,
    };
    root.add(prop);
    mesh(
      new THREE.CylinderGeometry(0.0057, 0.0057, 0.0028, 18),
      propMaterial,
      "R5_propeller_hub",
      prop,
    );
    for (let bladeIndex = 0; bladeIndex < 3; bladeIndex++) {
      const blade = new THREE.Group();
      blade.name = "Blade_" + bladeIndex;
      blade.userData.bladeIndex = bladeIndex;
      blade.rotation.y = (bladeIndex * 2 * Math.PI) / 3;
      prop.add(blade);
      const rows = [
        [0.0065, 0.003, 0],
        [0.014, 0.007, 0.0005],
        [0.032, 0.012, 0.002],
        [0.049, 0.011, 0.004],
        [0.06, 0.006, 0.005],
        [0.0632, 0.0005, 0.004],
      ].map(([r, width, sweep]) => {
        const pitch = (0.5 - (0.3 * r) / 0.0635) * DIRECTIONS[index];
        return [
          [-1, 1],
          [1, 1],
          [1, -1],
          [-1, -1],
        ].map(([edge, face]) => {
          const z = sweep + (edge * width) / 2,
            x = Math.min(r, Math.sqrt(Math.max(0, 0.0635 ** 2 - z * z)));
          return [x, (edge * width * pitch) / 2 + face * 0.00045, z];
        });
      });
      loft(rows, propMaterial, "R5_twisted_blade", blade);
    }
  });
  root.updateMatrixWorld(true);
  if (batchStatic) {
    batchAirplaneShell(root, "R5");
    batchAirplaneShell(battery, "R5_battery");
  }
  return root;
}
