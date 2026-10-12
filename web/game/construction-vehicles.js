import { CONSTRUCTION_VEHICLES, constructionSurfaceHeight } from "../../shared/world/construction-layout.js";

export function buildConstructionVehicles(parts) {
  const { box, cylinder, beam, part, model } = parts;
  function wheel(x, y, z, diameter = 1.4, width = 0.5) {
    cylinder(diameter, width, [x, y, z], "rubber", true, [0, 0, Math.PI / 2]);
    const outside = x + Math.sign(x) * (width / 2 + 0.012);
    cylinder(diameter * 0.52, 0.03, [outside, y, z], "steel", false, [0, 0, Math.PI / 2]);
    cylinder(diameter * 0.21, 0.05, [outside + Math.sign(x) * 0.025, y, z], "ochre", false, [0, 0, Math.PI / 2]);
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      cylinder(0.055, 0.045, [outside + Math.sign(x) * 0.04, y + Math.cos(a) * diameter * 0.19, z + Math.sin(a) * diameter * 0.19], "white", false, [0, 0, Math.PI / 2]);
    }
  }
  function tracks(length = 5.5) {
    for (const x of [-1.45, 1.45]) {
      box([0.85, 0.75, length - 1.1], [x, 0.65, 0], "rubber");
      for (const z of [-length / 2 + 0.55, length / 2 - 0.55]) wheel(x, 0.65, z, 1.2, 0.87);
      for (let z = -length / 2 + 0.8; z < length / 2 - 0.5; z += 0.32) {
        box([0.95, 0.09, 0.25], [x, 0.22, z], "steel", false);
        box([0.95, 0.09, 0.25], [x, 1.08, z], "steel", false);
      }
      for (let z = -1.5; z <= 1.5; z += 0.75) wheel(x, 0.6, z, 0.55, 0.88);
    }
  }
  function cab(x, y, z, width = 2.3, height = 2.2, depth = 2.4, color = "ochre") {
    box([width, 0.3, depth], [x, y + height / 2 - 0.15, z], color);
    box([width, height * 0.45, depth], [x, y - height * 0.275, z], color);
    // Glass panels sit between four structural posts, not over a solid body.
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      box([0.12, height * 0.55, 0.12], [x + sx * (width / 2 - 0.06), y + height * 0.225, z + sz * (depth / 2 - 0.06)], color);
    box([width - 0.28, height * 0.45, 0.045], [x, y + height * 0.2, z - depth / 2 + 0.07], "glass");
    for (const sx of [-1, 1]) box([0.045, height * 0.45, depth - 0.3], [x + sx * (width / 2 - 0.07), y + height * 0.2, z], "glass");
    box([width - 0.28, height * 0.4, 0.045], [x, y + height * 0.2, z + depth / 2 - 0.07], "glass");
    box([0.75, 0.3, 0.8], [x, y - 0.3, z], "rubber", false);
    cylinder(0.15, 0.24, [x, y + height / 2 + 0.12, z], "orange", false);
  }
  function lorry(flatbed = false, tipper = false, mixer = false) {
    const rear = flatbed ? 6.5 : 4.3, front = -4.8;
    box([2.1, 0.5, rear - front + 1.8], [0, 1.05, (rear + front) / 2], "steel");
    cab(0, 2.35, front, 2.5, 2.6, 2.7, mixer ? "white" : "blue");
    box([2.8, 0.25, 0.35], [0, 0.95, front - 1.55], "white");
    box([1.6, 0.6, 0.08], [0, 1.5, front - 1.4], "rubber", false);
    for (const x of [-0.96, 0.96]) box([0.45, 0.2, 0.06], [x, 1.45, front - 1.43], "white", false);
    for (const x of [-1.25, 1.25]) {
      wheel(x, 0.75, front - 0.25, 1.5);
      for (const z of [0.9, 2.4, rear - 0.4]) wheel(x, 0.75, z, 1.5);
      box([0.45, 0.2, 1.5], [x, 1.65, front - 0.25], "blue", false);
      cylinder(0.12, 2.6, [x + Math.sign(x) * 0.05, 2.5, front + 1.3], "steel", false);
      box([0.38, 0.24, 2], [x, 0.85, front + 1.1], "steel");
    }
    if (mixer) {
      cylinder(2.7, 4.5, [0, 2.8, 0.5], "white", true, [1.25, 0, 0]);
      for (const z of [-1.2, 0.2, 1.6]) cylinder(2.74, 0.16, [0, 2.8 + z * 0.32, 0.5 + z], "red", false, [1.25, 0, 0]);
      part("cone", [2.7, 1.2, 2.7], [0, 3.4, 3], "white", false, [Math.PI / 2, 0, 0]);
      box([0.65, 0.2, 2.4], [0, 1.7, 4.1], "steel", true, [0.3, 0, 0]);
    } else if (tipper) {
      model("raised-tipper-bed", [0, 1.3, rear], [0.45, 0, 0], () => {
        // Local tilt is applied to all bed panels and the lift ram connects underneath.
        box([2.65, 0.2, 7], [0, 0.1, -3], "red");
        for (const x of [-1.3, 1.3]) box([0.15, 1.2, 7], [x, 0.8, -3], "red");
        for (const z of [-6.4, 0.4]) box([2.65, 1.2, 0.18], [0, 0.8, z], "red");
      });
      beam([0, 1.4, 0], [0, 3, 0.7], 0.18, "steel");
    } else if (flatbed) {
      box([2.8, 0.3, 10.5], [0, 1.45, 2], "red");
      for (const x of [-0.95, 0.95]) box([0.65, 0.12, 2.4], [x, 0.85, 8.2], "steel", true, [-0.4, 0, 0]);
      for (let z = -1; z <= 5; z += 2) box([2.4, 0.4, 1.5], [0, 1.8, z], "concreteDark");
    } else {
      box([2.7, 0.3, 8], [0, 1.4, 1.8], "wood");
      for (const x of [-1.33, 1.33]) box([0.15, 1.1, 8], [x, 2.1, 1.8], "blue");
      box([2.7, 1.1, 0.15], [0, 2.1, 5.75], "blue");
      for (let z = -1.4; z < 5; z += 1.1) for (const x of [-1.2, 1.2]) box([0.18, 1.2, 0.16], [x, 2.1, z], "steel", false);
      for (const z of [0, 2.4]) box([2.15, 1.15, 1.8], [0, 2.1, z], "brick");
    }
  }
  function excavator() {
    tracks(6.2); cylinder(2.7, 0.32, [0, 1.35, 0], "steel");
    box([3.5, 0.8, 3.5], [0, 1.9, 0], "ochre");
    cab(-0.85, 3.05, -0.45, 1.55, 2.2, 2.3);
    box([2.9, 1.2, 1.65], [0, 2.5, 1.6], "ochre");
    for (let x = -0.8; x < 0.9; x += 0.2) box([0.08, 0.65, 0.02], [x, 2.6, 2.435], "rubber", false);
    const a = [0.65, 2.5, -0.8], b = [0.65, 6.7, -4.1], c = [0.65, 2, -7.5];
    beam(a, b, 0.8, "ochre", true, 0.55); beam(b, c, 0.58, "ochre", true, 0.48);
    beam([0.65, 3, -1.7], [0.65, 5.8, -3.7], 0.2, "steel");
    beam([0.65, 6.3, -4.3], [0.65, 3.3, -6.5], 0.17, "steel");
    box([2.4, 0.2, 1.3], [0.65, 1.2, -8], "steel", true, [0.45, 0, 0]);
    for (const x of [-0.52, 1.82]) box([0.18, 1, 1.3], [x, 1.65, -8], "ochre", true, [0.45, 0, 0]);
    box([2.4, 1, 0.18], [0.65, 1.7, -7.55], "ochre");
    for (let x = -0.4; x < 1.9; x += 0.45) box([0.18, 0.18, 0.65], [x, 0.92, -8.7], "steel", false, [0.45, 0, 0]);
  }
  function bulldozer() {
    tracks(5.2); box([2.8, 0.65, 3.8], [0, 1.7, 0], "ochre");
    cab(0, 2.9, 0.45, 2, 2.1, 2.3); box([2, 1, 1.8], [0, 2.1, -1.7], "ochre");
    for (const x of [-1.2, 1.2]) beam([x, 1.4, 0], [x, 0.8, -3.5], 0.24, "steel");
    box([4.2, 1.35, 0.25], [0, 0.95, -3.5], "ochre", true, [-0.18, 0, 0]);
    box([4.35, 0.18, 0.3], [0, 0.25, -3.6], "steel");
    cylinder(0.15, 1.3, [0.65, 3.1, -1.7], "steel", false);
  }
  function loader() {
    for (const x of [-1.5, 1.5]) for (const z of [-1.7, 1.7]) wheel(x, 1.05, z, 2.1, 0.8);
    box([2.8, 0.8, 5], [0, 1.5, 0], "ochre"); cab(0, 3.1, 0.8, 2.1, 2.5, 2.5);
    for (const x of [-0.8, 0.8]) {
      beam([x, 1.7, -1.2], [x, 3.8, -4], 0.3, "ochre");
      beam([x, 1.5, -1.5], [x, 3.1, -3.4], 0.16, "steel");
    }
    box([3.5, 0.22, 1.5], [0, 3.6, -4.5], "steel");
    box([3.5, 1.5, 0.18], [0, 4.2, -3.9], "ochre");
    for (const x of [-1.7, 1.7]) box([0.16, 1.3, 1.5], [x, 4.1, -4.5], "ochre");
  }
  function dumper() {
    for (const x of [-1.7, 1.7]) for (const z of [-2.2, 0.6, 2.7]) wheel(x, 1.15, z, 2.3, 0.75);
    box([2.6, 0.65, 6.4], [0, 1.55, 0.3], "steel"); cab(0, 3, -2.25, 2.5, 2.4, 2.3);
    box([3.4, 0.25, 4.5], [0, 2.15, 1.6], "ochre");
    for (const x of [-1.7, 1.7]) box([0.2, 1.3, 4.5], [x, 2.85, 1.6], "ochre");
    for (const z of [-0.65, 3.85]) box([3.4, 1.3, 0.2], [0, 2.85, z], "ochre");
    part("cone", [2.7, 1, 3.7], [0, 2.8, 1.6], "earth", false);
  }
  for (const vehicle of CONSTRUCTION_VEHICLES) model(vehicle.id, [vehicle.x, constructionSurfaceHeight(vehicle.x, vehicle.z), vehicle.z], vehicle.angle, () => {
    if (vehicle.type === "excavator") excavator();
    else if (vehicle.type === "bulldozer") bulldozer();
    else if (vehicle.type === "loader") loader();
    else if (vehicle.type === "dumper") dumper();
    else lorry(vehicle.flatbed, vehicle.type === "tipper", vehicle.type === "mixer");
  });
}
