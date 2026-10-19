import * as THREE from "three";
import {
  aircraftMeshTools,
  sectionSampler,
  samples,
  airfoilContour,
  airfoilHeight,
} from "./aircraft-mesh-utils.js";
import { batchAirplaneShell } from "./airplane-model-utils.js";
import { configureDronePolymer } from "./drone-rendering.js";

// Original 400 mm foam warbird, inspired by the P-51D's silhouette. Metres,
// Y up, -Z forward. Windows replace the skin; paint never conceals a second hull.
export function createWarbirdModel({ batchStatic = true } = {}) {
  const root = new THREE.Group();
  root.name = "Rift_Aero_40";
  root.userData.proceduralAircraft = true;
  const { mesh, loft, rod, tube, box } = aircraftMeshTools(root);
  const material = (color, roughness = 0.55, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const silver = material("#b9c4c6", 0.48, 0.32),
    dark = material("#253137", 0.7),
    accent = material("#ff6648", 0.5),
    white = material("#e7e9dd"),
    glass = material("#244a5b", 0.17, 0.28),
    olive = material("#45504a", 0.73),
    metal = material("#9ca6a8", 0.3, 0.7),
    rubber = material("#202629", 0.95);
  accent.userData.droneColorRole = "base";
  configureDronePolymer(accent);
  const body = sectionSampler([
    [-0.145, 0.0128, 0.0128, 0.001],
    [-0.132, 0.0175, 0.016, 0.001],
    [-0.107, 0.0202, 0.018, 0.001],
    [-0.075, 0.0205, 0.0185, 0],
    [-0.043, 0.019, 0.018, 0],
    [-0.012, 0.0178, 0.0175, 0],
    [0.022, 0.0159, 0.0162, 0.001],
    [0.055, 0.0125, 0.013, 0.003],
    [0.09, 0.0085, 0.009, 0.006],
    [0.123, 0.0047, 0.0057, 0.009],
    [0.145, 0.0014, 0.0023, 0.01],
  ]);
  const canopyStart = -0.048,
    canopyEnd = 0.041;
  function skin(z, angle, offset = 0) {
    const [w, h, cy] = body(z),
      t = THREE.MathUtils.clamp(
        (z - canopyStart) / (canopyEnd - canopyStart),
        0,
        1,
      );
    // A low, rounded bubble with continuous crown curvature and tangent deck joins.
    const bump = 0.012075 * Math.sin(Math.PI * t) ** 2;
    return new THREE.Vector3(
      (w + offset) * Math.cos(angle),
      cy + (h + offset + (Math.sin(angle) > 0 ? bump : 0)) * Math.sin(angle),
      z,
    );
  }
  function normal(z, angle) {
    return skin(z, angle + 0.0001)
      .sub(skin(z, angle - 0.0001))
      .cross(skin(z + 0.00001, angle).sub(skin(z - 0.00001, angle)))
      .normalize();
  }
  function strip(zs, from, to, steps, mat, name, offset = 0) {
    const positions = [],
      normals = [],
      indices = [];
    zs.forEach((z) =>
      samples(from(z), to(z), steps).forEach((angle) => {
        const n = normal(z, angle),
          p = skin(z, angle).addScaledVector(n, offset);
        positions.push(...p.toArray());
        normals.push(...n.toArray());
      }),
    );
    for (let i = 0; i < zs.length - 1; i++)
      for (let j = 0; j < steps; j++) {
        const a = i * (steps + 1) + j,
          b = a + 1,
          c = b + steps + 1,
          d = a + steps + 1;
        indices.push(a, b, c, a, c, d);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    g.setIndex(indices);
    return mesh(g, mat, name);
  }
  const constant = (v) => () => v;
  for (const [start, end, n] of [
    [-0.145, canopyStart, 24],
    [canopyEnd, 0.145, 24],
  ])
    strip(
      samples(start, end, n),
      constant(0),
      constant(2 * Math.PI),
      32,
      silver,
      "A40_fuselage",
    );
  const windowEdge = (z) => {
    const t = (z - canopyStart) / (canopyEnd - canopyStart);
    const [, h, cy] = body(z);
    const crown = skin(z, Math.PI / 2).y - cy;
    // Keep the sill near the fuselage shoulder instead of lifting it with
    // the dome. This gives the bubble a clean outline from the side as well.
    const sill = h - 0.0035 * Math.sin(Math.PI * t);
    return Math.asin(THREE.MathUtils.clamp(sill / crown, 0, 1));
  };
  const zs = samples(canopyStart, canopyEnd, 32);
  strip(zs, constant(0), windowEdge, 8, silver, "A40_cabin_shoulder_right");
  strip(
    zs,
    windowEdge,
    (z) => Math.PI - windowEdge(z),
    16,
    glass,
    "A40_flush_bubble_canopy",
  );
  strip(
    zs,
    (z) => Math.PI - windowEdge(z),
    constant(Math.PI),
    8,
    silver,
    "A40_cabin_shoulder_left",
  );
  strip(
    zs,
    constant(Math.PI),
    constant(2 * Math.PI),
    16,
    silver,
    "A40_cabin_belly",
  );
  strip(
    samples(-0.138, -0.052, 15),
    constant(0.87),
    constant(Math.PI - 0.87),
    8,
    olive,
    "A40_anti_glare_panel",
    0.00015,
  );
  for (const side of [1, -1]) {
    tube(
      zs.map((z) =>
        skin(
          z,
          side > 0 ? windowEdge(z) : Math.PI - windowEdge(z),
          0.00015,
        ).toArray(),
      ),
      0.00038,
      dark,
      "A40_canopy_seal",
    );
    // A shallow anti-glare panel, exhausts and a conformal fuselage accent band.
    strip(
      samples(0.05, 0.064, 4),
      constant(side > 0 ? -0.45 : Math.PI - 0.45),
      constant(side > 0 ? 0.45 : Math.PI + 0.45),
      6,
      accent,
      "A40_tail_identification_band",
      0.00018,
    );
    for (let i = 0; i < 6; i++) {
      const z = -0.127 + i * 0.0063,
        p = skin(z, side > 0 ? -0.05 : Math.PI + 0.05, 0.0001);
      rod(
        p.toArray(),
        p
          .clone()
          .add(new THREE.Vector3(side * 0.003, -0.0015, 0.0015))
          .toArray(),
        0.00115,
        dark,
        "A40_exhaust_stub",
      );
    }
  }
  // The cowl ring and spinner meet within 0.7 mm; no protruding axle.
  const ring = (z, r, y = 0.001) =>
    samples(0, Math.PI * 2, 31)
      .slice(0, -1)
      .map((a) => [Math.cos(a) * r, y + Math.sin(a) * r, z]);
  loft([ring(-0.151, 0.0115), ring(-0.145, 0.0128)], accent, "A40_nose_band");
  rod([0, 0.001, -0.151], [0, 0.001, -0.153], 0.003, metal, "A40_prop_hub");
  loft(
    [
      [-0.17, 0.0004],
      [-0.168, 0.004],
      [-0.163, 0.008],
      [-0.158, 0.0105],
      [-0.152, 0.0115],
    ].map(([z, r]) => ring(z, r)),
    accent,
    "A40_spinner",
  );
  const prop = new THREE.Group();
  prop.name = "A40_tractor_propeller";
  prop.position.set(0, 0.001, -0.152);
  prop.userData.propeller = true;
  root.add(prop);
  // Two working blades suit the 1S micro airframe; broad, swept and pitched.
  for (const side of [-1, 1]) {
    const blade = loft(
      [
        [0.007, 0.003],
        [0.018, 0.006],
        [0.043, 0.0065],
        [0.059, 0.0045],
        [0.064, 0.0003],
      ].map(([r, w]) => [
        [side * r, -w, 0.0018],
        [side * r, w, 0.0002],
        [side * r, w, -0.0008],
        [side * r, -w, -0.0002],
      ]),
      dark,
      "A40_propeller_blade",
      prop,
    );
    blade.userData.bladeIndex = side > 0 ? 0 : 1;
    if (side < 0) {
      const index = blade.geometry.index;
      for (let i = 0; i < index.count; i += 3) {
        const b = index.getX(i + 1);
        index.setX(i + 1, index.getX(i + 2));
        index.setX(i + 2, b);
      }
      blade.geometry.computeVertexNormals();
    }
  }
  const wing = sectionSampler([
    [0, -0.071, 0.09],
    [0.055, -0.067, 0.084],
    [0.11, -0.059, 0.074],
    [0.155, -0.049, 0.061],
    [0.18, -0.042, 0.049],
    [0.19, -0.036, 0.036],
    [0.197, -0.029, 0.019],
    [0.2, -0.021, 0.001],
  ]);
  const wingY = (x) => -0.011 + Math.abs(x) * 0.065;
  function wingRing(x, end = 1, start = 0, paint = 0) {
    const [le, chord] = wing(Math.abs(x));
    return airfoilContour(chord, le, 0.11, end, start).map(([y, z], i) => [
      x,
      wingY(x) + y + (i <= 16 ? paint : -paint),
      z,
    ]);
  }
  const hingeZ = -0.008,
    aileronStart = 0.076,
    aileronEnd = 0.174;
  for (const side of [-1, 1]) {
    for (const [start, end, cut] of [
      [0, aileronStart, false],
      [aileronStart, aileronEnd, true],
      [aileronEnd, 0.2, false],
    ]) {
      const rings = samples(start, end, 12).map((r) => {
        const [le, chord] = wing(r);
        return wingRing(side * r, cut ? (hingeZ - le) / chord : 1);
      });
      if (side < 0) rings.reverse();
      loft(rings, silver, "A40_laminar_wing_" + side);
    }
    const pivot = new THREE.Group();
    pivot.name = "A40_aileron_" + side;
    pivot.userData = {
      surface: "aileron",
      side,
      hingeTilt: side * Math.atan(0.065),
    };
    pivot.position.set(
      (side * (aileronStart + aileronEnd)) / 2,
      wingY((aileronStart + aileronEnd) / 2),
      hingeZ,
    );
    pivot.rotation.z = pivot.userData.hingeTilt;
    root.add(pivot);
    pivot.updateMatrixWorld(true);
    const inverse = pivot.matrixWorld.clone().invert();
    const moving = samples(
      aileronStart + 0.00025,
      aileronEnd - 0.00025,
      10,
    ).map((r) => {
      const [le, chord] = wing(r);
      return wingRing(side * r, 1, (hingeZ + 0.00012 - le) / chord).map((p) =>
        new THREE.Vector3(...p).applyMatrix4(inverse).toArray(),
      );
    });
    if (side < 0) moving.reverse();
    loft(moving, silver, "A40_aileron_skin_" + side, pivot);
    // Painted invasion stripes follow the upper and lower airfoil exactly.
    for (const [a, b, mat] of [
      [0.103, 0.113, white],
      [0.113, 0.124, dark],
      [0.124, 0.135, white],
      [0.135, 0.146, dark],
      [0.146, 0.157, white],
      [0.183, 0.194, accent],
    ]) {
      const movingBand = a >= aileronStart && b <= aileronEnd;
      const front = samples(a, b, 3).map((r) => {
        const [le, chord] = wing(r);
        return wingRing(
          side * r,
          movingBand ? (hingeZ - le) / chord : 1,
          0,
          0.00017,
        );
      });
      if (side < 0) front.reverse();
      loft(front, mat, "A40_wing_paint_" + side, root, false);
      if (movingBand) {
        const aft = samples(a, b, 3).map((r) => {
          const [le, chord] = wing(r);
          return wingRing(
            side * r,
            1,
            (hingeZ + 0.00012 - le) / chord,
            0.00017,
          ).map((p) => new THREE.Vector3(...p).applyMatrix4(inverse).toArray());
        });
        if (side < 0) aft.reverse();
        loft(aft, mat, "A40_aileron_paint_" + side, pivot, false);
      }
    }
    function insignia(shape, mat, height, name) {
      const geometry = new THREE.ShapeGeometry(shape, 20),
        positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = side * 0.051 + positions.getX(i),
          z = -0.033 + positions.getY(i),
          [le, chord] = wing(Math.abs(x));
        const y =
          wingY(x) + airfoilHeight(chord, (z - le) / chord, 1, 0.11) + height;
        positions.setXYZ(i, x, y, z);
      }
      // Shape coordinates are X/Z, so reverse winding for the upper face.
      const index = geometry.index;
      for (let i = 0; i < index.count; i += 3) {
        const b = index.getX(i + 1);
        index.setX(i + 1, index.getX(i + 2));
        index.setX(i + 2, b);
      }
      geometry.computeVertexNormals();
      mesh(geometry, mat, name);
    }
    const badge = new THREE.Shape();
    badge.absarc(0, 0, 0.0084, 0, Math.PI * 2, false);
    insignia(badge, dark, 0.00025, "A40_wing_roundel");
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5,
        r = i % 2 ? 0.0031 : 0.0072;
      const point = [Math.cos(angle) * r, Math.sin(angle) * r];
      i ? star.lineTo(...point) : star.moveTo(...point);
    }
    star.closePath();
    insignia(star, white, 0.00031, "A40_wing_star");
  }
  // Rounded tailplanes with actual hinges, flush at neutral.
  const tail = sectionSampler([
    [0, 0.096, 0.051],
    [0.04, 0.104, 0.042],
    [0.064, 0.116, 0.026],
    [0.073, 0.127, 0.006],
  ]);
  const tailRing = (x, end = 1) => {
    const [le, chord] = tail(Math.abs(x));
    return airfoilContour(chord, le, 0.07, end).map(([y, z]) => [
      x,
      0.012 + y,
      z,
    ]);
  };
  loft(
    samples(-0.073, 0.073, 24).map((x) => {
      const [le, chord] = tail(Math.abs(x));
      return tailRing(x, Math.min(1, (0.128 - le) / chord));
    }),
    silver,
    "A40_horizontal_stabilizer",
  );
  const elevator = new THREE.Group();
  elevator.name = "A40_elevator";
  elevator.userData.surface = "elevator";
  elevator.position.set(0, 0.012, 0.128);
  root.add(elevator);
  loft(
    samples(-0.069, 0.069, 24).map((x) => {
      const [le, chord] = tail(Math.abs(x)),
        te = le + chord;
      return [
        [x, 0, 0.00015],
        [x, 0.0011, Math.max(0.0003, te - 0.128)],
        [x, -0.0011, Math.max(0.0003, te - 0.128)],
        [x, -0.0004, 0.00015],
      ];
    }),
    accent,
    "A40_elevator_skin",
    elevator,
  );
  const fin = [
    [0.009, 0.092],
    [0.024, 0.106],
    [0.059, 0.119],
    [0.072, 0.127],
    [0.075, 0.132],
    [0.071, 0.138],
    [0.015, 0.138],
  ];
  loft(
    [-0.0015, 0.0015].map((x) => fin.map(([y, z]) => [x, y, z])),
    silver,
    "A40_swept_vertical_fin",
  );
  const rudder = new THREE.Group();
  rudder.name = "A40_rudder";
  rudder.userData.surface = "rudder";
  rudder.position.set(0, 0.015, 0.138);
  root.add(rudder);
  loft(
    [-0.0014, 0.0014].map((x) => [
      [x, 0, 0.00015],
      [x, 0.056, 0.00015],
      [x, 0.057, 0.003],
      [x, 0.049, 0.01],
      [x, 0.005, 0.017],
      [x, 0, 0.014],
    ]),
    accent,
    "A40_rudder_skin",
    rudder,
  );
  // P-51 belly radiator, a recessed dark mouth and a small outlet lip.
  loft(
    [
      [-0.005, 0.009, 0.008],
      [0.015, 0.011, 0.012],
      [0.044, 0.008, 0.007],
    ].map(([z, w, d]) => [
      [w, -0.013, z],
      [-w, -0.013, z],
      [-w, -0.013 - d, z],
      [w, -0.013 - d, z],
    ]),
    silver,
    "A40_belly_radiator",
  );
  const intake = mesh(
    new THREE.PlaneGeometry(0.013, 0.004),
    dark,
    "A40_radiator_intake",
  );
  intake.rotation.y = Math.PI;
  intake.position.set(0, -0.019, -0.0052);
  // Light fixed micro-model undercarriage: slender main legs and a tail wheel.
  for (const side of [-1, 1]) {
    rod(
      [side * 0.041, -0.008, -0.023],
      [side * 0.047, -0.056, -0.027],
      0.0012,
      metal,
      "A40_main_gear",
    );
    const wheel = mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.007, 18),
      rubber,
      "A40_main_tire",
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.047, -0.056, -0.027);
    const hub = mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.0073, 14),
      metal,
      "A40_wheel_hub",
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(wheel.position);
  }
  rod(
    [0, 0.004, 0.125],
    [0, -0.013, 0.137],
    0.0007,
    metal,
    "A40_tailwheel_leg",
  );
  const rear = mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 0.003, 12),
    rubber,
    "A40_tailwheel",
  );
  rear.rotation.z = Math.PI / 2;
  rear.position.set(0, -0.014, 0.138);
  // Small nose-mounted FPV pod, seated on the cowl. The optical point is just
  // ahead of its lens, clear of the housing, with the propeller in front.
  box([0.008, 0.003, 0.008], [0, 0.0205, -0.096], silver, "A40_FPV_mount");
  const camera = mesh(
    new THREE.CylinderGeometry(0.0045, 0.0048, 0.009, 12),
    dark,
    "A40_FPV_camera",
  );
  camera.rotation.x = Math.PI / 2;
  camera.position.set(0, 0.025, -0.096);
  const lens = mesh(
    new THREE.CircleGeometry(0.0032, 16),
    glass,
    "A40_FPV_lens",
  );
  lens.rotation.y = Math.PI;
  lens.position.set(0, 0.025, -0.101);
  root.userData.fpvCameraOffset = [0, 0.025, -0.102];
  root.updateMatrixWorld(true);
  if (batchStatic) batchAirplaneShell(root, "A40");
  return root;
}
