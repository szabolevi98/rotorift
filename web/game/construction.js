import { createConstructionParts } from "./construction-parts.js";
import { buildConcreteFrames, buildTowerCranes } from "./construction-buildings.js";
import { buildConstructionVehicles } from "./construction-vehicles.js";
import { constructionHeight } from "../../shared/world/construction-layout.js";

import { buildConstructionTerrain, buildEarthworkDetails } from "./construction-terrain.js";

export const CONSTRUCTION_VIEW_DISTANCE = 12000;
export const CONSTRUCTION_FOG_DENSITY = 0.00085;

export function buildConstruction(scene, world, RAPIER, map) {
  const parts = createConstructionParts(scene, world, RAPIER);
  let modelDepth = 0;
  const grounded = position => [position[0], position[1] + (modelDepth ? 0 : constructionHeight(position[0], position[2])), position[2]];
  const box = (size, position, ...args) => parts.box(size, grounded(position), ...args);
  const cylinder = (diameter, length, position, ...args) => parts.cylinder(diameter, length, grounded(position), ...args);
  const { beam, part } = parts;
  const model = (name, position, angle, build) => parts.model(name, grounded(position), angle, () => {
    modelDepth++;
    try { build(); } finally { modelDepth--; }
  });
  buildConstructionTerrain(parts);
  buildEarthworkDetails(parts);
  buildConcreteFrames(parts); buildTowerCranes(parts); buildConstructionVehicles(parts);

  function container(name, position, color = "blue", angle = 0) {
    model(name, position, angle, () => {
      // Shipping container sides surround a usable open interior.
      box([2.6, 0.16, 6.2], [0, 0.16, 0], "steel");
      for (const x of [-1.3, 1.3]) box([0.1, 2.5, 6.2], [x, 1.45, 0], color);
      box([2.65, 0.12, 6.2], [0, 2.76, 0], color);
      box([2.6, 2.5, 0.1], [0, 1.45, -3.1], color);
      for (let z = -3; z <= 3; z += 0.27) for (const x of [-1.36, 1.36]) box([0.045, 2.45, 0.045], [x, 1.45, z], color, false);
      for (const x of [-1.35, 1.35]) box([0.1, 2.5, 1.25], [x, 1.45, 3.6], color, true, [0, x > 0 ? -0.65 : 0.65, 0]);
    });
  }
  for (const [x, z, color] of [[196, 166, "red"], [201, 166, "blue"], [196, 156, "white"], [204, 156, "blue"], [-231, -20, "red"], [-231, -30, "white"]])
    container("open-storage-container", [x, 0, z], color);
  container("stacked-container", [201, 2.83, 166], "white");
  // Precast drainage pipes form genuinely hollow low-level flight lines.
  model("precast-pipe-yard", [164, 0, 193], 0, () => {
    for (const x of [-7, -3, 1, 5]) part("pipe", [3.1, 7, 3.1], [x, 1.55, 0], "concrete", "mesh", [Math.PI / 2, 0, 0]);
    for (const x of [-5, -1, 3]) part("pipe", [3.1, 7, 3.1], [x, 4.2, 0], "concrete", "mesh", [Math.PI / 2, 0, 0]);
    for (const x of [-10, 9]) box([0.4, 0.8, 7], [x, 0.4, 0], "wood");
  });
  model("reinforcement-and-material-yard", [239, 0, 103], 0, () => {
    for (let i = 0; i < 4; i++) {
      for (const z of [-4, 4]) box([6, 0.25, 1.5], [0, 0.18 + i * 0.7, z], "wood");
      for (let x = -2.5; x <= 2.5; x += 0.4) cylinder(0.14, 12, [x, 0.55 + i * 0.7, 0], "rebar", false, [Math.PI / 2, 0, 0]);
    }
    for (const x of [-18, -10, 10, 18]) for (const z of [-8, 0, 8]) {
      box([3.1, 0.2, 3.1], [x, 0.1, z], "wood");
      box([2.8, 1.4, 2.8], [x, 0.9, z], "brick");
      for (let y = 0.5; y < 1.6; y += 0.23) box([2.83, 0.02, 2.83], [x, y, z], "concreteDark", false);
    }
  });
  // Dismantled formwork and aligned slab stacks, away from the working roads.
  for (const [x, z] of [[-17, -200], [-205, -195], [83, 85], [-128, 22]]) {
    model("precast-slab-stack", [x, 0, z], 0, () => {
      for (let level = 0; level < 5; level++) {
        for (const x of [-3, 3]) box([0.6, 0.22, 4], [x, level * 0.7 + 0.11, 0], "wood");
        box([10, 0.45, 4.5], [0, level * 0.7 + 0.45, 0], "concrete");
      }
    });
  }
  model("site-office-compound", [-173, 0, 244], 0, () => {
    for (const x of [-14, 0, 14]) {
      box([10, 0.2, 4], [x, 0.3, 0], "steel");
      box([10, 2.7, 4], [x, 1.75, 0], "white");
      box([10.3, 0.2, 4.3], [x, 3.2, 0], "blue");
      for (const wx of [-3, 0, 3]) box([1.8, 1.1, 0.045], [x + wx, 2, -2.03], "glass", false);
      box([1, 2.2, 0.08], [x + 3.5, 1.45, 2.04], "blue", false);
    }
    box([35, 0.18, 4], [0, 0.2, 6], "concrete");
    for (const x of [-19, 19]) box([0.2, 3.1, 0.2], [x, 1.75, 6], "steel");
    box([39, 0.16, 4.5], [0, 3.35, 6], "blue");
    for (const x of [-12, 0, 12]) box([2.5, 0.85, 1.2], [x, 0.8, 6], "wood");
  });
  model("workshop-and-fuel-station", [165, 0, 244], 0, () => {
    for (const x of [-17, 17]) for (const z of [-10, 10]) box([0.3, 7, 0.3], [x, 3.5, z], "steel");
    box([37, 0.22, 23], [0, 7.1, 0], "blue");
    for (const x of [-10, 0, 10]) box([2, 1.5, 3], [x, 0.8, 4], "steel");
    cylinder(3.2, 8, [-10, 2.4, -5], "white", true, [Math.PI / 2, 0, 0]);
    for (const z of [-7, -3]) box([3.2, 0.9, 0.8], [-10, 0.65, z], "steel");
    for (const x of [5, 8, 11]) cylinder(0.8, 1.2, [x, 0.6, -6], "red");
  });
  // Safety barriers surround excavation and service work; the access routes stay clear.
  function barrier(x, z, angle = 0) {
    model("site-barrier", [x, 0, z], angle, () => {
      box([3.4, 0.65, 0.7], [0, 0.325, 0], "concrete");
      box([2.8, 0.6, 0.3], [0, 0.95, 0], "white");
      for (const bx of [-0.9, 0, 0.9]) box([0.4, 0.57, 0.32], [bx, 0.95, 0], "orange", false, [0, 0, -0.25]);
    });
  }
  for (let x = -199; x < -154; x += 4.5) barrier(x, 76);
  for (let z = 82; z < 123; z += 4.5) barrier(-205, z, Math.PI / 2);
  for (let x = 65; x < 106; x += 4.5) barrier(x, 128);
  for (const z of [175, 200, 230]) for (const x of [-10.5, 10.5]) {
    part("cone", [0.65, 1, 0.65], [x, constructionHeight(x, z) + 0.5, z], "orange", false);
    box([0.75, 0.1, 0.75], [x, 0.05, z], "rubber", false);
  }
  // Tall temporary floodlight towers, with bases outside every working lane.
  for (const [x, z] of [[-24, 220], [24, -205], [110, 120], [-119, -140], [233, 201], [-225, 223]]) {
    box([2.4, 0.75, 2.2], [x, 0.375, z], "blue"); cylinder(0.18, 12, [x, 6.7, z], "steel");
    box([3, 0.1, 0.12], [x, 12.7, z], "steel");
    for (const dx of [-1, 1]) box([0.75, 0.5, 0.15], [x + dx, 12.6, z], "white", false, [-0.3, 0, 0]);
  }
  // Corrugated perimeter, permeable as a map marker; south gate is open.
  const limit = map.size / 2;
  for (let offset = -limit; offset < limit; offset += 4) {
    for (const side of [-1, 1]) {
      box([0.1, 2.4, 3.92], [side * limit, 1.2, offset + 2], "steel", false);
      cylinder(0.09, 2.65, [side * limit, 1.325, offset], "white", false);
      if (side === 1 && Math.abs(offset + 2) < 18) continue;
      box([3.92, 2.4, 0.1], [offset + 2, 1.2, side * limit], "steel", false);
      cylinder(0.09, 2.65, [offset, 1.325, side * limit], "white", false);
    }
  }
  // Gatehouse and open entry gantry, with a clear 18 m arrival corridor.
  box([5, 3, 4], [-24, 1.5, 278], "white"); box([3, 1.1, 0.045], [-24, 2, 275.97], "glass", false);
  for (const x of [-17, 17]) box([0.35, 6, 0.35], [x, 3, 278], "steel");
  box([34, 0.35, 0.4], [0, 6.1, 278], "ochre");
  const result = parts.finish();
  result.heightAt = constructionHeight;
  return result;
}
