import * as THREE from "three";
import { createConstructionParts } from "./construction-parts.js";
import {
  CIRCUIT_LENGTH,
  CIRCUIT_SAMPLES,
  circuitPoint,
  circuitSurfaceHeight,
} from "../../shared/world/circuit-layout.js";

// Strip vertices share boundaries instead of stacking asphalt/paint on grass.
function trackGeometry() {
  const positions = [],
    colors = [],
    indices = [];
  const bands = [
    [-13.5, -11.5, 0xbba98b],
    [-11.5, -10.25, 0x477b6e],
    [-10.25, -9.18, null],
    [-9.18, -9, 0xefeee3],
    [-9, 9, 0x343b40],
    [9, 9.18, 0xefeee3],
    [9.18, 10.25, null],
    [10.25, 11.5, 0x477b6e],
    [11.5, 13.5, 0xbba98b],
  ];
  const color = new THREE.Color();
  for (const [left, right, tint] of bands)
    for (let i = 0; i < CIRCUIT_SAMPLES.length; i++) {
      const a = CIRCUIT_SAMPLES[i],
        b = CIRCUIT_SAMPLES[(i + 1) % CIRCUIT_SAMPLES.length],
        at = positions.length / 3;
      color.set(tint ?? (Math.floor(a.distance / 3) % 2 ? 0xeee9d9 : 0xcf493e));
      for (const [s, offset] of [
        [a, left],
        [a, right],
        [b, left],
        [b, right],
      ]) {
        positions.push(
          s.x - s.tz * offset,
          tint === null ? 0.03 : 0.009,
          s.z + s.tx * offset,
        );
        colors.push(color.r, color.g, color.b);
      }
      indices.push(at, at + 1, at + 2, at + 1, at + 3, at + 2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
export function buildCircuit(scene, world, RAPIER, map) {
  const p = createConstructionParts(scene, world, RAPIER, {
      batchSize: Infinity,
    }),
    { box, cylinder, beam, model, part } = p;
  p.root.name = "Apex_Circuit_motorsport_park";
  for (const [name, color] of Object.entries({
    asphalt: 0x353b40,
    grass: 0x718b50,
    runoff: 0x477b6e,
    sand: 0xbba98b,
    roof: 0x3c4953,
    seatRed: 0xd65239,
    seatBlue: 0x377d9b,
    seatCream: 0xc8c7ac,
    dark: 0x17262d,
    signal: 0x8fbd76,
  }))
    p.palette[name] = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.88,
      metalness: name === "roof" ? 0.25 : 0,
    });
  p.palette.racingSurface = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.98,
  });
  // The large, analytic ground stays cheap for every aircraft's CCD.
  box([262144, 0.2, 262144], [0, -0.1, 0], "grass", true, undefined, false);
  const ground = new THREE.PlaneGeometry(24000, 24000);
  ground.rotateX(-Math.PI / 2);
  // Keep visual turf clear of the thin asphalt at grazing camera angles.
  // The analytic collision surface remains at y=0.
  ground.translate(0, -0.05, 0);
  p.ground(ground, "grass", false).name = "Apex_grass_landscape";
  p.ground(trackGeometry(), "racingSurface", false).name =
    "Apex_asphalt_kerbs_runoff";

  function sign(text, width, height, position, angle = 0) {
    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#15262d";
    ctx.fillRect(0, 0, 1024, 128);
    ctx.fillStyle = "#ff6648";
    ctx.fillRect(0, 0, 16, 128);
    ctx.fillStyle = "#f4f1e7";
    ctx.font = "bold 72px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 520, 66, 960);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.8,
    });
    p.palette["sign" + Object.keys(p.palette).length] = material;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      material,
    );
    mesh.position.set(...position);
    mesh.rotation.y = angle;
    p.root.add(mesh);
  }
  // Crash barriers follow the same sampled road as cars, on the outside of runoff.
  const segments = Math.ceil(CIRCUIT_LENGTH / 7),
    a = {},
    b = {};
  for (let i = 0; i < segments; i++)
    for (const side of [-1, 1]) {
      circuitPoint((i * CIRCUIT_LENGTH) / segments, side * 16, a);
      circuitPoint(((i + 1) * CIRCUIT_LENGTH) / segments, side * 16, b);
      // Open access to the entire pit apron from the south main straight.
      if (side === 1 && a.z > 144 && a.x > -208 && a.x < 175) continue;
      const dx = b.x - a.x,
        dz = b.z - a.z,
        len = Math.hypot(dx, dz),
        yaw = -Math.atan2(dz, dx);
      box(
        [len + 0.05, 0.62, 0.2],
        [(a.x + b.x) / 2, 0.77, (a.z + b.z) / 2],
        "steel",
        true,
        [0, yaw, 0],
      );
      box([0.12, 1.15, 0.12], [a.x, 0.575, a.z], "steel", false);
    }
  // Pit lane and merging mouths, alongside the +X main straight.
  box([385, 0.012, 14], [-10, 0.007, 180], "asphalt", false);
  for (const x of [-185, 175])
    box([50, 0.012, 15], [x, 0.008, 167], "asphalt", false, [
      0,
      x < 0 ? -0.4 : 0.4,
      0,
    ]);
  for (let x = -177; x < 165; x += 8) {
    box([4, 0.014, 0.14], [x, 0.016, 174], "white", false);
    box([4, 0.014, 0.14], [x, 0.016, 186], "white", false);
  }
  for (let x = -190; x <= 165; x += 14)
    box([11, 0.6, 0.55], [x, 0.3, 169], "white");
  // Marked starting grid, checker stripe and timing gantry.
  for (let x = -145; x < 20; x += 16)
    for (const side of [-1, 1]) {
      box([0.14, 0.012, 2.8], [x, 0.02, 150 + side * 4.3], "white", false);
      box(
        [3.8, 0.012, 0.14],
        [x - 1.8, 0.02, 150 + side * 5.7],
        "white",
        false,
      );
    }
  for (let row = 0; row < 3; row++)
    for (let j = 0; j < 18; j++)
      box(
        [0.7, 0.014, 1],
        [-156 + row * 0.7, 0.02, 141.5 + j],
        (row + j) % 2 ? "white" : "dark",
        false,
      );
  model("Start_finish_gantry", [-153, 0, 150], 0, () => {
    for (const z of [-13, 13]) {
      box([1.3, 0.5, 1.3], [0, 0.25, z], "concrete");
      beam([0, 0.5, z], [0, 8, z], 0.23, "steel");
    }
    box([0.65, 1.5, 27], [0, 7.8, 0], "roof");
    for (let z = -4; z <= 4; z += 2)
      cylinder(0.35, 0.15, [-0.4, 6.8, z], "signal", false, [
        0,
        0,
        Math.PI / 2,
      ]);
  });
  sign("APEX  /  CIRCUIT", 24, 1.3, [-153.34, 7.8, 150], -Math.PI / 2);

  model("Pit_garages_and_roof_terrace", [0, 0, 210], 0, () => {
    box([224, 0.12, 32], [0, 0.06, 0], "concrete");
    box([224, 6.8, 0.35], [0, 3.4, 14], "white");
    for (const x of [-112, 112]) box([0.4, 6.8, 28], [x, 3.4, 0], "white");
    for (let x = -110; x <= 110; x += 20) {
      box([0.4, 6.8, 28], [x, 3.4, 0], "white");
      box([0.4, 6.8, 0.4], [x, 3.4, -14], "roof");
    }
    box([225, 0.3, 30], [0, 7, 0], "roof");
    for (const z of [-14.4, 14.4]) {
      box([224, 1, 0.12], [0, 7.65, z], "steel");
      box([224, 0.12, 0.12], [0, 8.25, z], "steel");
    }
    for (let x = -100; x <= 100; x += 20) {
      box([18, 0.45, 0.25], [x, 5.6, -14.1], "orange");
      box([4.8, 0.85, 1.5], [x, 0.55, 10], "blue");
      for (const dx of [-2, 2])
        cylinder(0.8, 0.9, [x + dx, 0.45, 6], "rubber", false);
      box([6, 0.014, 5], [x, 0.14, -20], x % 40 ? "runoff" : "asphalt", false);
      for (const dx of [-3.1, 3.1])
        box([0.12, 0.016, 5], [x + dx, 0.15, -20], "ochre", false);
    }
  });
  sign("RIFT MOTORSPORT  /  PIT LANE", 70, 1.5, [0, 6.4, 195.75]);
  for (let i = 0; i < 11; i++)
    sign(String(i + 1).padStart(2, "0"), 2.5, 1.1, [-100 + i * 20, 5.1, 195.7]);
  model("Race_control_tower", [65, 0, 217], 0, () => {
    box([32, 13, 22], [0, 13.5, 0], "white");
    box([33, 0.35, 23], [0, 18.2, 0], "roof");
    for (const z of [-11.1, 11.1])
      box([30, 3, 0.08], [0, 15.8, z], "glass", false);
    for (const x of [-16.1, 16.1])
      box([0.08, 3, 20], [x, 15.8, 0], "glass", false);
    box([34, 0.35, 24], [0, 20.1, 0], "roof");
    cylinder(0.1, 8, [-12, 24.3, 0], "steel");
  });
  sign("RACE CONTROL", 24, 1.7, [65, 12.5, 205.9]);
  // Spectators' bridge: nine metres clear below, open pedestrian sides above.
  model("Fly_under_pedestrian_bridge", [115, 0, 150], 0, () => {
    for (const z of [-31, 31])
      for (const x of [-2.1, 2.1]) box([0.35, 9, 0.35], [x, 4.5, z], "steel");
    box([4.8, 0.35, 64], [0, 9, 0], "roof");
    for (const x of [-2.35, 2.35]) {
      box([0.12, 1.15, 64], [x, 9.75, 0], "steel");
      box([0.16, 0.12, 64], [x, 10.4, 0], "orange");
    }
    for (const side of [-1, 1])
      for (let i = 0; i < 24; i++)
        box(
          [4.8, 0.18, 1.2],
          [0, 0.2 + i * 0.365, side * (55 - i)],
          "concrete",
        );
  });
  sign("APEX  /  FLY THE LINE", 24, 1.2, [112.56, 9.8, 150], -Math.PI / 2);

  function grandstand(name, x, z, width, angle = 0) {
    model(name, [x, 0, z], angle, () => {
      for (let row = 0; row < 10; row++) {
        const depth = 3,
          zz = -15 + row * 3,
          y = 0.6 + row * 0.8;
        box([width, y, depth], [0, y / 2, zz], "concrete");
        for (let xx = -width / 2 + 2; xx < width / 2 - 1; xx += 1.9) {
          if (Math.abs(xx) < 2) continue;
          box(
            [1.25, 0.18, 1.1],
            [xx, y + 0.18, zz],
            row % 3 === 0 ? "seatCream" : row % 2 ? "seatBlue" : "seatRed",
            false,
          );
          box(
            [1.25, 0.7, 0.15],
            [xx, y + 0.55, zz + 0.5],
            row % 3 === 0 ? "seatCream" : row % 2 ? "seatBlue" : "seatRed",
            false,
          );
        }
        box([3, 0.12, 1.5], [0, y + 0.07, zz - 1], "white");
      }
      for (const xx of [-width / 2, width / 2])
        for (const zz of [-17, 17])
          beam([xx, 0, zz], [xx, 13, zz], 0.23, "steel");
      box([width + 4, 0.3, 39], [0, 13.1, 0], "roof");
      for (const xx of [-width / 2, width / 2])
        beam([xx, 10, -17], [xx, 13, 17], 0.15, "orange");
    });
  }
  grandstand("Main_grandstand", -225, 248, 108);
  grandstand("North_grandstand", 10, -265, 90, Math.PI);
  grandstand("East_curve_grandstand", 313, 7, 70, Math.PI / 2);
  sign("ROTORIFT  /  FPV ON THE GO", 70, 2, [-225, 10.4, 230.8]);

  // Paddock, transporters and safe launch apron behind the pit-lane entry.
  model("Paddock_transporters", [-30, 0, 272], 0, () => {
    box([270, 0.015, 45], [0, 0.008, 0], "asphalt", false);
    for (let x = -100; x <= 100; x += 40) {
      box([7, 3.8, 17], [x, 2, 0], x % 80 ? "blue" : "white");
      box([7, 3.5, 5], [x, 1.85, -10], "roof");
      for (const dx of [-3.4, 3.4])
        for (const zz of [-11, 2, 6])
          part(
            "cylinder",
            [1.2, 0.6, 1.2],
            [x + dx, 0.7, zz],
            "rubber",
            false,
            [0, 0, Math.PI / 2],
          );
      for (const dx of [-3, 3]) box([0.15, 4, 0.15], [x + dx, 2, 14], "steel");
      box([13, 0.18, 9], [x, 4.1, 17], "orange");
    }
  });
  model("Launch_apron", [-175, 0, 201], 0, () => {
    box([22, 0.012, 14], [0, 0.008, 0], "asphalt", false);
    for (const x of [-8, 8])
      box([0.15, 0.014, 10], [x, 0.02, 0], "orange", false);
    box([16, 0.014, 0.15], [0, 0.02, 5], "white", false);
  });
  sign("PILOTS  /  LAUNCH AREA", 10, 1, [-175, 2.4, 210]);
  for (const [x, z] of [
    [-180, 202],
    [-170, 202],
    [-130, 230],
    [130, 235],
  ]) {
    box([3, 0.15, 0.8], [x, 0.7, z], "wood");
    for (const dx of [-1.1, 1.1])
      box([0.1, 0.65, 0.65], [x + dx, 0.325, z], "steel");
  }
  // Repeating sponsor boards and lamps provide clear speed/scale references.
  for (let x = -100; x <= 60; x += 40) {
    box([13, 1, 0.15], [x, 0.7, 128], "roof");
    sign("RIFT  /  RACING", 12, 0.8, [x, 0.7, 128.09]);
  }
  for (const [x, z] of [
    [-190, 220],
    [-125, 250],
    [120, 235],
    [290, 105],
    [-310, 110],
    [145, -238],
    [-125, -235],
  ]) {
    cylinder(0.18, 17, [x, 8.5, z], "steel");
    box([4, 0.16, 0.2], [x, 17, z], "steel");
    for (const dx of [-1.4, 1.4])
      box([0.8, 0.4, 0.3], [x + dx, 16.8, z], "white", false, [-0.3, 0, 0]);
  }
  for (let i = 0; i < 90; i++) {
    const a = i * 2.399963,
      r = 430 + (i % 7) * 27,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    cylinder(0.45, 5, [x, 2.5, z], "wood", false);
    part(
      "sphere",
      [8 + (i % 3), 10, 8],
      [x, 9, z],
      i % 3 ? "grass" : "runoff",
      false,
    );
  }
  const result = p.finish();
  result.root.traverse((mesh) => {
    // Ground aprons receive building/car shadows; their near-coplanar bottom
    // faces must not cast a second shadow onto the road or their own top.
    if (mesh.isMesh && mesh.material === p.palette.asphalt) mesh.castShadow = false;
  });
  result.heightAt = circuitSurfaceHeight;
  return result;
}
