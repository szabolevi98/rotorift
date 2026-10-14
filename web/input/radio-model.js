import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Conventional full-size transmitter proportions, with a separate mechanical
// gimbal rig so the calibration animation remains independent of the shell.
export function createRadioModel(createCanvas = () => document.createElement("canvas")) {
  const root = new THREE.Group(); root.name = "Rotorift_full_size_radio";
  const finish = (color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const shell = finish(0x424850, .58, .08), front = finish(0x343b43, .62, .08);
  const rubber = finish(0x15191e, .92), black = finish(0x0c1117, .68);
  const metal = finish(0xadb7c3, .29, .8), darkMetal = finish(0x414b56, .35, .55);
  const accent = finish(0xff6648, .44, .2), ink = finish(0xa8b3bf, .65);
  const mesh = (geometry, material, x, y, z, parent = root) => {
    const item = new THREE.Mesh(geometry, material); item.position.set(x, y, z); parent.add(item); return item;
  };
  const box = (w, h, d, material, x, y, z, radius = .025, parent = root) =>
    mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2, h / 2, d / 2)), material, x, y, z, parent);
  const cylinder = (r, length, material, x, y, z, parent = root, top = r, sides = 20) => {
    const item = mesh(new THREE.CylinderGeometry(top, r, length, sides), material, x, y, z, parent);
    item.rotation.x = Math.PI / 2; return item;
  };
  const ring = (r, thickness, material, x, y, z, parent = root) =>
    mesh(new THREE.TorusGeometry(r, thickness, 6, 40), material, x, y, z, parent);
  const between = (a, b, radius, material, parent = root) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
    const item = mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 10), material, 0, 0, 0, parent);
    item.position.copy(start.add(end).multiplyScalar(.5));
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); return item;
  };
  const screw = (x, y, z, parent = root, radius = .022) => {
    cylinder(radius, .016, darkMetal, x, y, z, parent, radius, 12);
    box(radius * 1.2, .009, .006, black, x, y, z + .011, .002, parent);
  };
  const lettering = (text, width, height, x, y, z, color = "#aab5c2") => {
    const canvas = createCanvas(); canvas.width = 512; canvas.height = 96;
    const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, 512, 96);
    ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "600 48px Arial"; ctx.fillText(text, 256, 48);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    return mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }), x, y, z);
  };

  // Flat-bottomed, rounded shoulders: the grips are part of the housing,
  // rather than the hanging handles of a gamepad.
  const outline = new THREE.Shape();
  outline.moveTo(-1.05, -1.25); outline.quadraticCurveTo(-1.40, -1.22, -1.42, -.91);
  outline.lineTo(-1.44, .54); outline.quadraticCurveTo(-1.39, .91, -1.07, .94);
  outline.quadraticCurveTo(0, 1.04, 1.07, .94); outline.quadraticCurveTo(1.39, .91, 1.44, .54);
  outline.lineTo(1.42, -.91); outline.quadraticCurveTo(1.40, -1.22, 1.05, -1.25);
  outline.quadraticCurveTo(0, -1.34, -1.05, -1.25);
  const bodyGeometry = new THREE.ExtrudeGeometry(outline, { depth: .40, bevelEnabled: true, bevelSegments: 3, bevelSize: .065, bevelThickness: .055, curveSegments: 10 });
  mesh(bodyGeometry, shell, 0, 0, -.21).name = "Radio_rear_shell";
  mesh(new THREE.ExtrudeGeometry(outline, { depth: .095, bevelEnabled: true, bevelSegments: 2, bevelSize: .055, bevelThickness: .035, curveSegments: 10 }), front, 0, 0, .23).name = "Radio_front_shell";

  for (const side of [-1, 1]) {
    const grip = box(.23, 1.20, .43, rubber, side * 1.35, -.38, -.015, .08); grip.rotation.z = side * -.035;
    for (let i = 0; i < 8; i++) {
      const rib = box(.17, .024, .045, black, side * 1.37, -.08 - i * .115, .218, .008); rib.rotation.z = side * -.10;
    }
    box(.25, .55, .20, rubber, side * 1.14, .64, -.33, .065);
    for (const y of [.76, -1.06]) screw(side * 1.21, y, .371);
  }

  // Four real toggle switches on the shoulders, with threaded metal collars.
  for (const [index, x] of [-1.23, -.93, .93, 1.23].entries()) {
    const y = Math.abs(x) > 1 ? .75 : .87;
    cylinder(.080, .026, black, x, y, .385);
    cylinder(.053, .04, metal, x, y, .408, root, .053, 6);
    const end = [x + (x < 0 ? -.035 : .035), y + .14, .55];
    between([x, y, .428], end, .014, metal);
    const tip = box(.043, .066, .043, metal, ...end, .01); tip.rotation.x = -.45;
    lettering(["SA", "SB", "SC", "SD"][index], .105, .032, x, y - .11, .371);
  }
  for (const x of [-.43, .43]) {
    cylinder(.095, .02, black, x, .86, .375);
    cylinder(.073, .075, rubber, x, .86, .428, root, .07, 16);
    box(.012, .045, .008, ink, x, .886, .470, .003);
  }
  lettering("ROTORIFT", .63, .11, 0, .73, .374);
  lettering("RC / SIM", .31, .05, 0, .60, .375, "#73808e");
  for (let row = 0; row < 2; row++) for (let i = 0; i < 7; i++)
    cylinder(.008, .010, black, -.096 + i * .032, .54 - row * .028, .376, root, .008, 8);

  // Hinged T antenna and a carry handle visible behind the shoulder line.
  box(.78, .15, .13, rubber, 0, 1.15, -.35, .045);
  for (const side of [-1, 1]) box(.10, .30, .13, rubber, side * .35, 1.06, -.35, .035);
  cylinder(.095, .10, darkMetal, 0, 1.01, -.015);
  between([0, .98, -.015], [0, 1.62, -.025], .042, rubber);
  box(.91, .11, .10, rubber, 0, 1.67, -.025, .043).name = "Radio_T_antenna";
  box(.15, .018, .014, accent, 0, 1.58, .027, .006);
  box(.24, .062, .015, black, 0, .955, .18, .012);
  box(.14, .023, .016, metal, 0, .956, .19, .009);

  const sticks = [], rings = [], arrows = [];
  const gimbalCenters = [[-.75, .29, .413], [.75, .29, .413]];
  for (const [index, center] of gimbalCenters.entries()) {
    const [x, y, z] = center;
    cylinder(.465, .05, black, x, y, z - .047);
    const lip = ring(.445, .023, darkMetal.clone(), x, y, z); rings.push(lip);
    ring(.476, .015, shell, x, y, z - .012);
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + i * Math.PI / 2;
      screw(x + Math.cos(angle) * .383, y + Math.sin(angle) * .383, z + .001, root, .016);
    }
    for (const side of [-1, 1]) {
      box(.052, .011, .009, ink, x + side * .405, y, z + .012, .004);
      box(.011, .052, .009, ink, x, y + side * .405, z + .012, .004);
    }

    const pivot = new THREE.Group(); pivot.position.set(x, y, z + .012); pivot.name = index ? "Right_gimbal" : "Left_gimbal"; root.add(pivot);
    // Open yoke, hinge bearings and a barrel around the ball-jointed shaft.
    for (const side of [-1, 1]) {
      box(.057, .34, .075, darkMetal, side * .28, 0, -.008, .016, pivot);
      box(.53, .042, .075, metal, 0, side * .17, -.008, .012, pivot);
      const bearing = cylinder(.044, .05, metal, side * .32, 0, -.018, pivot);
      bearing.rotation.y = Math.PI / 2;
    }
    const barrel = cylinder(.083, .43, black, 0, 0, -.020, pivot);
    barrel.rotation.y = Math.PI / 2;
    mesh(new THREE.SphereGeometry(.067, 12, 8), metal, 0, 0, .036, pivot);
    cylinder(.028, .23, metal, 0, 0, .16, pivot, .037);
    for (const z of [.094, .117, .140]) ring(.030, .005, darkMetal, 0, 0, z, pivot);
    cylinder(.069, .074, darkMetal, 0, 0, .305, pivot, .057, 12);
    ring(.063, .009, accent, 0, 0, .282, pivot);
    cylinder(.059, .012, metal, 0, 0, .35, pivot, .062, 12);
    cylinder(.026, .008, black, 0, 0, .361, pivot, .026, 12);
    sticks.push(pivot);

    const directions = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(dx, dy, 0), new THREE.Vector3(x + dx * .49, y + dy * .49, z + .03), .15, 0xff6648, .065, .06);
      root.add(arrow); directions.push(arrow);
    }
    arrows.push(directions);

    // Actual horizontal and vertical trim controls below and beside each gimbal.
    box(.26, .067, .019, black, x, -.27, .381, .017);
    box(.071, .034, .028, darkMetal, x, -.27, .407, .010);
    box(.067, .22, .020, black, x < 0 ? -.19 : .19, .10, .381, .017);
    box(.034, .07, .028, darkMetal, x < 0 ? -.19 : .19, .10, .407, .010);
  }

  // Power key and a proper neck-strap eye, seated in the front housing.
  box(.31, .14, .032, rubber, 0, .40, .383, .035);
  const power = mesh(new THREE.TorusGeometry(.032, .005, 6, 20, Math.PI * 1.65), ink, 0, .40, .404);
  power.rotation.z = Math.PI * .675;
  box(.007, .034, .008, ink, 0, .421, .406, .003);
  box(.11, .064, .02, accent, 0, .284, .389, .021);
  cylinder(.052, .07, darkMetal, 0, -.12, .403);
  const strap = ring(.045, .015, metal, 0, -.12, .456); strap.rotation.y = Math.PI / 2;

  // Screen surround and conventional menu keys / knurled navigation roller.
  box(1.15, .65, .048, black, 0, -.84, .382, .035).name = "LCD_bezel";
  box(1.02, .53, .012, darkMetal, 0, -.84, .412, .015);
  const display = createCanvas(); display.width = 512; display.height = 256;
  const ctx = display.getContext("2d"); ctx.fillStyle = "#b7cfc7"; ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#29433e"; ctx.fillRect(0, 0, 512, 43); ctx.fillStyle = "#c8ddd5";
  ctx.font = "bold 22px monospace"; ctx.fillText("ROTORIFT", 18, 29); ctx.fillText("USB SIM", 367, 29);
  ctx.fillStyle = "#29433e"; ctx.font = "bold 48px monospace"; ctx.fillText("MODE 2", 24, 107);
  ctx.font = "23px monospace"; ctx.fillText("STICK GUIDE", 26, 151);
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = "#49635a"; ctx.strokeRect(27, 176 + i * 16, 458, 9); ctx.fillRect(29, 178 + i * 16, [175, 82, 240, 125][i], 5);
  }
  const screen = new THREE.CanvasTexture(display); screen.colorSpace = THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(.96, .47), new THREE.MeshBasicMaterial({ map: screen, toneMapped: false }), 0, -.84, .422);
  for (const [i, label] of ["SYS", "RTN", "PAGE", "TELE"].entries()) {
    box(.27, .082, .033, rubber, -.91, -.59 - i * .14, .388, .028);
    lettering(label, .19, .041, -.91, -.59 - i * .14, .409);
  }
  box(.24, .12, .025, rubber, .92, -.52, .385, .025);
  lettering("MDL", .17, .042, .92, -.52, .403);
  mesh(new THREE.CylinderGeometry(.072, .072, .31, 24), darkMetal, .93, -.86, .424);
  for (let i = 0; i < 10; i++) {
    const ridge = cylinder(.079, .011, rubber, .93, -.999 + i * .03, .424);
    ridge.rotation.x = 0;
  }
  for (let i = 0; i < 6; i++) box(.075, .031, .022, ink, -.29 + i * .116, -.40, .390, .014);
  root.rotation.set(-.06, -.09, 0);
  return { root, sticks, rings, arrows, gimbalCenters };
}
