import * as THREE from "three";
import { CONSTRUCTION_BUILDINGS, CONSTRUCTION_CRANES, floorOpening, constructionHeight } from "../../shared/world/construction-layout.js";

export function buildConcreteFrames(parts) {
  const { model, box, cylinder, beam } = parts;
  for (const building of CONSTRUCTION_BUILDINGS) {
    const b = building, dx = b.width / b.nx, dz = b.depth / b.nz;
    model(b.id, [b.x, constructionHeight(b.x, b.z), b.z], 0, () => {
      box([b.width + 3, 0.24, b.depth + 3], [0, 0.12, 0], "concreteDark");
      // Open bays, with a continuous shaft through the slabs for vertical dives.
      for (let level = 0; level < b.levels; level++) {
        const base = level * b.storey, top = base + b.storey;
        for (let ix = 0; ix <= b.nx; ix++) for (let iz = 0; iz <= b.nz; iz++) {
          const x = -b.width / 2 + ix * dx, z = -b.depth / 2 + iz * dz;
          box([0.7, b.storey - 0.32, 0.7], [x, base + (b.storey - 0.32) / 2, z], "concrete");
          // Formwork ties and bases are visual detail, not larger hitboxes.
          box([0.86, 0.14, 0.86], [x, base + 0.07, z], "concreteDark", false);
          if (level === b.levels - 1 && (ix === 0 || iz === b.nz)) {
            box([0.7, 1.5, 0.7], [x, top + 0.75, z], "concrete");
            for (const sx of [-1, 1]) for (const sz of [-1, 1])
              cylinder(0.035, 2.4, [x + sx * 0.22, top + 1.2, z + sz * 0.22], "rebar", false);
          }
        }
        for (let ix = 0; ix < b.nx; ix++) for (let iz = 0; iz < b.nz; iz++) {
          if (ix === 1 && iz === 1) continue;
          if (level === b.levels - 1 && ix === b.nx - 1 && iz >= b.nz - 2) continue;
          box([dx, 0.32, dz], [-b.width / 2 + (ix + 0.5) * dx, top - 0.16, -b.depth / 2 + (iz + 0.5) * dz], "concrete");
        }
        for (let ix = 0; ix <= b.nx; ix++)
          box([0.5, 0.52, b.depth], [-b.width / 2 + ix * dx, top - 0.54, 0], "concreteDark");
        for (let iz = 0; iz <= b.nz; iz++)
          box([b.width, 0.52, 0.5], [0, top - 0.54, -b.depth / 2 + iz * dz], "concreteDark");
        // A narrow temporary stair occupies one side of the large open shaft.
        const [wx, wz] = floorOpening(b), sx = wx - b.x + dx / 2 - 1.8, sz = wz - b.z;
        for (let step = 0; step < 16; step++) {
          const y = base + (step + 1) * b.storey / 16;
          box([2.2, 0.12, 0.52], [sx, y - 0.06, sz - 4 + step * 0.5], "steel");
        }
        box([2.2, 0.16, dz / 2 - 3.5], [sx, top - 0.08, sz + (3.5 + dz / 2) / 2], "steel");
        beam([sx - 1, base + 0.1, sz - 4.2], [sx - 1, top, sz + 4], 0.14, "steel");
        beam([sx + 1, base + 0.1, sz - 4.2], [sx + 1, top, sz + 4], 0.14, "steel");
        // A few unfinished infill panels; most of the facade stays open.
        if (level < 2 && b.id !== "parking-frame") {
          box([dx - 1, 1.8, 0.28], [-b.width / 2 + dx / 2, base + 0.9, -b.depth / 2], "brick");
          for (let row = 1; row <= 7; row++) box([dx - 1, 0.025, 0.3], [-b.width / 2 + dx / 2, base + row * 0.23, -b.depth / 2], "concreteDark", false);
        }
      }
      if (b.id === "tower-a" || b.id === "south-frame") {
        // Temporary scaffold covers one unfinished facade, leaving its bays open.
        const z = b.depth / 2 + 2.5, span = Math.min(28, b.width);
        for (let x = -span / 2; x <= span / 2; x += 3.5) {
          for (const dz of [-0.7, 0.7]) cylinder(0.075, 13.8, [x, 6.9, z + dz], "steel");
        }
        for (const y of [2.1, 4.4, 6.7, 9, 11.3]) {
          box([span, 0.08, 1.4], [0, y, z], "wood");
          for (const dz of [-0.7, 0.7]) box([span, 0.07, 0.07], [0, y + 1, z + dz], "steel");
          beam([-span / 2, y, z + 0.7], [-span / 2 + 3.5, y + 2.3, z + 0.7], 0.055, "steel", false);
        }
      }
      if (b.id === "parking-frame") {
        // External precast ramp; keep its underside open instead of a solid wedge.
        const length = 27, angle = -Math.atan(b.storey / length);
        box([6, 0.34, Math.hypot(length, b.storey)], [b.width / 2 + 5, b.storey / 2, 9], "concrete", true, [angle, 0, 0]);
        for (const z of [0, 18]) {
          const height = b.storey * (z - (9 - length / 2)) / length;
          box([0.65, height, 0.65], [b.width / 2 + 5, height / 2, z], "concrete");
        }
        box([8, 0.34, 5], [b.width / 2 + 2, b.storey - 0.17, b.depth / 2], "concrete");
      }
    });
  }
  // A different silhouette: the warehouse has steel portals and no roof/walls.
  model("open-steel-warehouse", [135, constructionHeight(135, -185), -185], 0, () => {
    box([70, 0.22, 44], [0, 0.11, 0], "concreteDark");
    for (let x = -33; x <= 33; x += 11) {
      for (const z of [-19, 19]) {
        box([1.8, 0.7, 1.8], [x, 0.35, z], "concrete");
        box([0.32, 12, 0.42], [x, 6, z], "steel");
      }
      beam([x, 12, -19], [x, 16, 0], 0.35, "steel", true, 0.5);
      beam([x, 16, 0], [x, 12, 19], 0.35, "steel", true, 0.5);
      beam([x, 11.5, -19], [x, 11.5, 19], 0.18, "steel");
      for (let z = -19; z < 19; z += 6.3) beam([x, 11.5, z], [x, 16 - Math.abs(z + 3.15) * 4 / 19, z + 3.15], 0.1, "steel", false);
    }
    for (const z of [-19, -10, 0, 10, 19])
      box([66, 0.15, 0.18], [0, 16 - Math.abs(z) * 4 / 19, z], "steel");
    beam([-33, 1, -19], [-22, 12, -19], 0.12, "steel");
    beam([-22, 1, -19], [-33, 12, -19], 0.12, "steel");
  });
}

export function buildTowerCranes(parts) {
  const { model, box, cylinder, beam, part } = parts;
  for (const crane of CONSTRUCTION_CRANES) model(crane.id, [crane.x, constructionHeight(crane.x, crane.z), crane.z], crane.angle, () => {
    const h = crane.height, color = crane.color;
    box([11, 1.6, 11], [0, 0.8, 0], "concrete");
    for (const x of [-1.5, 1.5]) for (const z of [-1.5, 1.5]) {
      box([0.25, h, 0.25], [x, h / 2 + 1, z], color);
      box([1.3, 0.3, 1.3], [x, 1.75, z], "steel");
    }
    for (let y = 1; y < h; y += 3) {
      for (const side of [-1.5, 1.5]) {
        beam([-1.5, y, side], [1.5, y + 3, side], 0.13, color);
        beam([side, y, -1.5], [side, y + 3, 1.5], 0.13, color);
        box([3.2, 0.16, 0.16], [0, y, side], color);
        box([0.16, 0.16, 3.2], [side, y, 0], color);
      }
      box([1.8, 0.1, 1.8], [0, y, 0], "steel", false);
    }
    // Interior ladder and resting platforms; the mast remains hollow.
    for (let y = 1.4; y < h; y += 0.55) box([0.5, 0.055, 0.06], [0, y, -1.1], "white", false);
    for (const x of [-0.3, 0.3]) box([0.045, h - 1, 0.045], [x, h / 2, -1.1], "steel", false);
    cylinder(4.1, 0.8, [0, h + 0.5, 0], "steel");
    box([5.5, 0.4, 5], [0, h + 1.1, 0], color);
    box([3, 2.5, 2.4], [2.8, h + 2.5, 1.6], "white");
    box([0.04, 1.6, 2], [4.32, h + 2.7, 1.6], "glass", false);
    box([2.55, 1.6, 0.04], [2.8, h + 2.7, 2.82], "glass", false);
    const start = -20, end = crane.boom;
    for (const z of [-1.2, 1.2]) {
      box([end - start, 0.22, 0.22], [(end + start) / 2, h + 1.7, z], color);
      box([end - start, 0.16, 0.16], [(end + start) / 2, h + 4.1, z], color);
    }
    for (let x = start; x < end; x += 5) {
      const next = Math.min(x + 5, end);
      for (const z of [-1.2, 1.2]) beam([x, h + 1.7, z], [next, h + 4.1, z], 0.12, color);
      box([0.14, 0.14, 2.4], [x, h + 1.7, 0], color);
      beam([x, h + 4.1, -1.2], [next, h + 4.1, 1.2], 0.09, color, false);
    }
    for (let i = 0; i < 4; i++) box([1.9, 3.2, 4.5], [-17 + i * 2, h + 0.1, 0], "concreteDark");
    beam([0, h + 4, 0], [0, h + 12, 0], 0.35, color);
    for (const x of [-18, end * 0.7]) beam([0, h + 12, 0], [x, h + 4.1, 0], 0.055, "steel", false);
    const hookX = end * 0.64, hookY = Math.max(13, h * 0.35);
    box([2.4, 0.9, 2.6], [hookX, h + 1, 0], "steel");
    for (const z of [-0.32, 0.32]) cylinder(0.045, h - hookY, [hookX, (h + hookY) / 2, z], "steel", false);
    box([0.85, 1.2, 0.8], [hookX, hookY, 0], "ochre");
    part("pipe", [0.7, 0.18, 0.7], [hookX, hookY - 0.85, 0], "steel", false, [Math.PI / 2, 0, 0]);
  });
}
