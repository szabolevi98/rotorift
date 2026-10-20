import * as THREE from "three";
import { createConstructionParts } from "./construction-parts.js";
import {prepareCircuitSurfaces} from './circuit-surfaces.js';
import {CIRCUIT_PIT_APRON} from '../../shared/world/circuit-apron.js';
import {pitEdge} from '../../shared/world/circuit-pits.js';
import {installCircuitGround} from './circuit-ground.js';
import {
  CIRCUIT_LENGTH,
  CIRCUIT_SAMPLES,
  CIRCUIT_CLUBHOUSE,
  CIRCUIT_MEDIA,
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
export function buildCircuit(scene, world, RAPIER, map, {authorGround = false} = {}) {
  const p = createConstructionParts(scene, world, RAPIER, {
      batchSize: Infinity,
    }),
    { box, cylinder, beam, model, part } = p;
  p.root.name = "Apex_Circuit_motorsport_park";
  for (const [name, color] of Object.entries({
    asphalt: 0x353b40,
    grass: 0x647e43,
    lawn: 0x7a9254,
    planted: 0x4b693b,
    paving: 0x989a8d,
    runoff: 0x477b6e,
    sand: 0xbba98b,
    roof: 0x3c4953,
    pitWall: 0x7e898b,
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

  const trackDistance = (x, z) => {
    let nearest = Infinity;
    for (let i = 0; i < CIRCUIT_SAMPLES.length; i += 4) {
      const s = CIRCUIT_SAMPLES[i];
      nearest = Math.min(nearest, Math.hypot(x - s.x, z - s.z));
    }
    return nearest;
  };
  // Flat landscaping patches give the grounds structure without terrain CCD.
  function patch(x, z, rx, rz, color, angle = 0) {
    const geometry = new THREE.CircleGeometry(1, 36);
    geometry.rotateX(-Math.PI / 2);
    geometry.scale(rx, 1, rz);
    geometry.rotateY(angle);
    geometry.translate(x, -0.035, z);
    p.ground(geometry, color, false);
  }
  function gravelTrap(distance, side) {
    const inner = [], outer = [];
    for (let i = 0; i <= 20; i++) {
      const d = distance - 26 + i * 2.6;
      const a = circuitPoint(d, side * 16.6);
      const b = circuitPoint(d, side * (16.6 + Math.sin(i * Math.PI / 20) * 24));
      if (trackDistance(b.x, b.z) < 15.8) return;
      inner.push(new THREE.Vector2(a.x, -a.z));
      outer.push(new THREE.Vector2(b.x, -b.z));
    }
    const g = new THREE.ShapeGeometry(new THREE.Shape([...inner, ...outer.reverse()]));
    g.rotateX(-Math.PI / 2);
    g.translate(0, -0.025, 0);
    p.ground(g, "sand", false);
  }

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
      const distance = i * CIRCUIT_LENGTH / segments;
      if (side === 1 && (distance < 475 || distance > CIRCUIT_LENGTH - 15)) continue;
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
  for (const [outer, ...holes] of CIRCUIT_PIT_APRON) {
    const points = ring => ring.map(([x,z])=>new THREE.Vector2(x,-z));
    const shape = new THREE.Shape(points(outer));
    shape.holes = holes.map(ring=>new THREE.Path(points(ring)));
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI/2); geometry.translate(0,.04,0);
    p.ground(geometry,'asphalt',false).name = 'Apex_pit_apron';
  }
  // Painted edges follow the same smooth curves as the asphalt. All paint
  // is boolean-cut into the ground mesh by the offline surface compiler.
  for (const offset of [-6, 6]) {
    const edge = pitEdge(offset);
    for (let i=1;i<edge.length;i++) {
      const a=edge[i-1],b=edge[i],dx=b[0]-a[0],dz=b[1]-a[1];
      if(trackDistance((a[0]+b[0])/2,(a[1]+b[1])/2)<10) continue;
      box([Math.hypot(dx,dz),.012,.16],[(a[0]+b[0])/2,.054,(a[1]+b[1])/2],
        "white",false,[0,-Math.atan2(dz,dx),0]);
    }
  }
  // A continuous low pit wall ends before both merging curves.
  box([290,.8,.7],[0,.4,169],"pitWall");
  box([289,.12,.82],[0,.83,169],"white");
  for (const x of [-145,145]) cylinder(.82,.8,[x,.4,169],"pitWall");
  for (const x of [-145,145]) {
    box([1.2,1.9,.25],[x,1.65,170],"roof",false);
    sign(x<0?"PIT IN":"PIT OUT",3.6,.8,[x,2.15,170.2]);
  }
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
    box([224,.12,30],[0,.06,0],"concrete");
    box([221,7,.6],[0,3.5,14],"pitWall");
    // Narrow partitions terminate inside wider posts and the rear wall.
    // Their side/end faces never share a visible plane with those parts.
    for (let x=-110;x<=110;x+=20) {
      box([.32,7,27.7],[x,3.5,.1],"white");
      box([.8,7,1],[x,3.5,-13.8],"roof");
    }
    for (let x=-100;x<=100;x+=20)
      box([19.2,1,1],[x,6.5,-13.8],"roof");
    box([225,.3,30],[0,7,0],"roof");
    box([223,.16,.2],[0,5.93,-14.4],"orange");
    for (const z of [-14.4,14.4]) {
      box([224,.09,.09],[0,8.2,z],"steel");
      box([224,.07,.07],[0,7.65,z],"steel");
      for(let x=-110;x<=110;x+=10)
        box([.09,1.15,.09],[x,7.65,z],"steel");
    }
    for (let x=-100;x<=100;x+=20) {
      box([4.8,.85,1.5],[x,.55,11],"blue");
      for (const dx of [-2,2]) cylinder(.8,.9,[x+dx,.57,7],"rubber",false);
      box([6,.014,5],[x,.14,-20],x%40?"runoff":"asphalt",false);
      for (const dx of [-3.1,3.1])
        box([.12,.016,5],[x+dx,.15,-20],"ochre",false);
    }
  });
  sign("RIFT MOTORSPORT  /  PIT LANE",54,.7,[-35,8.05,195.45],Math.PI);
  for (let i=0;i<11;i++)
    sign(String(i+1).padStart(2,"0"),2.5,.62,[-100+i*20,6.65,195.64],Math.PI);
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
  sign("RACE CONTROL", 24, 1.7, [65, 12.5, 205.9], Math.PI);
  // Spectators' bridge: nine metres clear below, open pedestrian sides above.
  model("Fly_under_pedestrian_bridge", [115, 0, 150], 0, () => {
    for (const z of [-31, 43])
      for (const x of [-2.1, 2.1]) box([0.35, 9, 0.35], [x, 4.5, z], "steel");
    box([4.8, 0.35, 76], [0, 9, 6], "roof");
    for (const x of [-2.35, 2.35]) {
      box([0.12, 1.15, 76], [x, 9.75, 6], "steel");
      box([0.16, 0.12, 76], [x, 10.4, 6], "orange");
    }
    for (const side of [-1, 1])
      for (let i = 0; i < 24; i++)
        box(
          [4.8, 0.18, 1.2],
          [0, 0.2 + i * 0.365, side * (55 - i) + (side > 0 ? 12 : 0)],
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
  sign("ROTORIFT  /  FPV ON THE GO", 70, 2, [-225, 10.4, 230.8], Math.PI);

  // A quiet service court replaces the repeated transporters and awnings.
  model("Rear_service_court", [0,0,242], 0, () => {
    box([224,.016,28],[0,.008,0],"paving",false);
    box([224,.014,7],[0,.02,0],"asphalt",false);
    for (const z of [-4.1,4.1])
      box([222,.012,.14],[0,.036,z],"white",false);
    for (const x of [-96,-48,0,48,96]) {
      box([12,.65,3],[x,.325,11],"pitWall");
      box([11.6,.8,2.6],[x,.95,11],"planted",false);
    }
  });
  patch(0,277,112,19,"lawn");
  box([5,.04,54],[-125,.01,273],"paving",false);
  model("Launch_apron", [-175, 0, 201], 0, () => {
    box([22, 0.012, 14], [0, 0.008, 0], "asphalt", false);
    for (const x of [-8, 8])
      box([0.15, 0.014, 10], [x, 0.02, 0], "orange", false);
    box([16, 0.014, 0.15], [0, 0.02, 5], "white", false);
  });
  sign("PILOTS  /  LAUNCH AREA", 10, 1, [-175, 2.4, 210], Math.PI);

  // A real infield destination: two service wings around a generous, flyable
  // passage, a glazed upper floor and a spectator terrace overlooking the S's.
  model("Infield_clubhouse_and_breezeway", [CIRCUIT_CLUBHOUSE.x, 0, CIRCUIT_CLUBHOUSE.z], 0, () => {
    box([76, 0.12, 42], [0, 0.06, 0], "paving");
    for (const x of [-23, 23]) {
      box([22, 5.1, 26], [x, 2.67, 0], "white");
      box([19, 1.7, 0.1], [x, 2, -13.06], "glass", false);
      box([19, 1.7, 0.1], [x, 2, 13.06], "glass", false);
    }
    box([68, 0.32, 26], [0, 5.38, 0], "roof");
    box([66, 3, 23], [0, 7.05, 0], "white");
    for (const z of [-11.56, 11.56]) {
      box([62, 2, 0.1], [0, 7.1, z], "glass", false);
      for (let x = -28; x <= 28; x += 7)
        box([0.12, 2, 0.15], [x, 7.1, z], "steel", false);
    }
    box([70, 0.35, 28], [0, 8.975, 0], "roof");
    for (const z of [-19, 19]) {
      box([72, 0.12, 0.12], [0, 1.05, z], "steel");
      for (let x = -36; x <= 36; x += 6)
        box([0.12, 1, 0.12], [x, 0.55, z], "steel");
    }
    for (const x of [-27, -18, 18, 27]) {
      cylinder(0.07, 2.7, [x, 1.45, -17], "steel", false);
      part("cone", [5, 0.8, 5], [x, 3, -17], "seatCream", false);
      box([3, 0.12, 1.6], [x, 0.9, -17], "wood");
    }
  });
  sign("APEX  /  DRIVERS CLUB", 42, 1, [20, 5.7, 56.9], Math.PI);
  patch(20, 70, 66, 47, "lawn");
  model("Infield_media_tower", [CIRCUIT_MEDIA.x, 0, CIRCUIT_MEDIA.z], 0, () => {
    for (const x of [-7.5, 7.5]) for (const z of [-4.5, 4.5]) {
      box([0.6, 10, 0.6], [x, 5, z], "steel");
      beam([x, 1, z], [-x, 9, z], 0.13, "steel");
    }
    box([20, 0.35, 14], [0, 10, 0], "roof");
    box([15, 3, 9], [0, 11.65, 0], "blue");
    for (const z of [-4.56, 4.56])
      box([13, 1.6, 0.1], [0, 11.8, z], "glass", false);
    box([20, 0.35, 14], [0, 13.525, 0], "roof");
    for (let i = 0; i < 25; i++)
      box([2.5, 0.18, 0.9], [-11, 0.2 + i * 0.4, 16 - i * 0.8], "concrete");
  });
  sign("LIVE  /  APEX TV", 13, 1, [-65, 10.6, 24.95], Math.PI);

  // Continuous visual planting, paved walks and an occupied camping/service
  // area replace the isolated objects in an otherwise empty green plane.
  box([3, 0.06, 170], [-65, 0.02, 80], "paving", false);
  box([235, 0.06, 3], [-24, 0.02, 112], "paving", false);
  patch(-345, -10, 32, 180, "planted", -0.06);
  patch(-130, -295, 160, 27, "planted");
  patch(350, -115, 30, 155, "planted", 0.08);
  patch(220, 270, 85, 55, "lawn");
  patch(-72, -145, 30, 42, "planted", -0.35);
  patch(180, -68, 24, 50, "lawn", -0.3);
  for (let i = 0; i < 86; i++) {
    const strip = i % 4;
    const x = strip === 0 ? -345 + Math.sin(i * 1.7) * 11
      : strip === 1 ? -275 + (i / 4) * 14
      : strip === 2 ? 350 + Math.sin(i) * 9
      : -65 + Math.cos(i * 2.4) * (23 + i % 18);
    const z = strip === 0 ? -235 + i / 4 * 22
      : strip === 1 ? -295 + Math.sin(i) * 7
      : strip === 2 ? -255 + i / 4 * 17
      : -125 + Math.sin(i * 2.4) * 39;
    if (trackDistance(x, z) < 32) continue;
    cylinder(0.3, 4.5, [x, 2.25, z], "wood");
    part("sphere", [7 + i % 3, 8 + i % 4, 7], [x, 7, z], i % 3 ? "planted" : "lawn", false);
  }

  // Outside-of-corner gravel traps and compact tyre walls follow the actual
  // driving line. Clearance rejects decorations near another part of the track.
  for (let d = 520; d < CIRCUIT_LENGTH - 60; d += 125) {
    const s = circuitPoint(d);
    if (Math.abs(s.curvature) < 0.007) continue;
    const side = s.curvature > 0 ? -1 : 1;
    const trap = circuitPoint(d, side * 31);
    if (trackDistance(trap.x, trap.z) < 27) continue;
    gravelTrap(d, side);
    model("Corner_tyre_wall_" + d, [trap.x, 0, trap.z], -Math.atan2(s.tz, s.tx), () => {
      box([20, 1.1, 1.2], [0, 0.55, side * 9], "rubber");
      for (let x = -9; x <= 9; x += 1.15) for (const y of [0.3, 0.85])
        part("pipe", [1.1, 0.5, 1.1], [x, y, side * 9], Math.abs(x) < 4 ? "seatCream" : "rubber", false);
    });
  }
  for (let d = 120; d < CIRCUIT_LENGTH; d += 220) {
    const post = circuitPoint(d, -24);
    if (trackDistance(post.x, post.z) < 22 || post.z > 160) continue;
    model("Marshal_station_" + d, [post.x, 0, post.z], post.yaw, () => {
      box([5, 0.2, 4], [0, 0.1, 0], "concrete");
      box([4.5, 1.2, 0.15], [0, 0.8, 1.8], "white");
      for (const x of [-2, 2]) for (const z of [-1.6, 1.6])
        cylinder(0.06, 3.2, [x, 1.6, z], "steel", false);
      box([5, 0.18, 4], [0, 3.2, 0], "orange");
      box([0.6, 0.7, 0.15], [0, 2.2, -1.85], "signal", false);
    });
  }
  for (const d of [480, 920, 1370, 1750, 2000]) {
    const board = circuitPoint(d, -20);
    if (trackDistance(board.x, board.z) < 19) continue;
    box([2, 1.3, 0.15], [board.x, 1.2, board.z], "white", false, [0, board.yaw, 0]);
    sign("100", 1.7, 1, [board.x - board.tx * 0.09, 1.2, board.z - board.tz * 0.09], board.yaw);
  }

  model("Visitor_parking", [-20, 0, 342], 0, () => {
    box([310, 0.012, 60], [0, 0.008, 0], "asphalt", false);
    for (let x = -145; x <= 145; x += 10) {
      for (const z of [-18, 18])
        box([0.12, 0.014, 12], [x, 0.024, z], "white", false);
      if (x % 3 === 0) continue;
      for (const z of [-18, 18]) {
        const color = ["white", "blue", "red", "roof"][Math.floor((x + 145) / 10) % 4];
        box([2.1, 0.8, 4.5], [x + 4, 0.65, z], color);
        box([1.8, 0.65, 2.4], [x + 4, 1.3, z + 0.1], "glass");
        for (const dx of [3, 5]) for (const dz of [-1.3, 1.3])
          cylinder(0.37, 0.22, [x + dx, 0.38, z + dz], "rubber", false, [0, 0, Math.PI / 2]);
      }
    }
  });
  model("Fan_village_and_camping", [220, 0, 270], 0, () => {
    box([140, 0.08, 5], [0, 0, 0], "paving", false);
    for (const x of [-48, -24, 0, 24, 48]) {
      for (const xx of [-5, 5]) cylinder(0.07, 3.4, [x + xx, 1.7, -16], "steel", false);
      box([12, 0.2, 9], [x, 3.5, -16], x % 48 ? "blue" : "orange");
      box([8, 1, 1.5], [x, 0.6, -16], "white");
      box([3.5, 2.4, 8], [x, 1.4, 25], "seatCream");
      box([3.6, 0.7, 2], [x, 2.5, 23], "roof", false);
      for (const dx of [-1.8, 1.8]) for (const dz of [22.5, 27.5])
        cylinder(0.42, 0.25, [x + dx, 0.5, dz], "rubber", false, [0, 0, Math.PI / 2]);
    }
  });
  sign("FAN ZONE  /  COFFEE  /  GRILL", 38, 1.4, [220, 3.6, 249.35], Math.PI);
  // Small instanced spectators at terraces and fan areas, outside driving/flying lines.
  for (let i = 0; i < 46; i++) {
    const village = i >= 22;
    const x = village ? 163 + (i - 22) * 4.8 : -12 + i * 3;
    const z = village ? 267 + Math.sin(i * 2.1) * 4 : 49 + Math.sin(i * 2.1) * 1.2;
    cylinder(0.2, 0.85, [x, 0.8, z], i % 3 ? "blue" : "orange", false);
    part("sphere", [0.4, 0.45, 0.4], [x, 1.45, z], "seatCream", false);
  }
  for (const [x, z] of [
    [-180, 209],
    [-170, 209],
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
    [-125, -270],
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
  prepareCircuitSurfaces(result.root, p.palette);
  if (!authorGround) installCircuitGround(result.root, p.palette);
  result.heightAt = circuitSurfaceHeight;
  return result;
}
