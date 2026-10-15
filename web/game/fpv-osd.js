import { rotate, inverse, clamp } from "../../shared/physics/math.js";

// Sparse dotted FPV reticle. Fixed side rails frame the moving gravity line;
// body attitude stays independent of yaw, camera tilt and FOV.
export function horizonReferencePath() {
  const sidebars = [-1, 1].flatMap(side => Array.from({length:13}, (_, i) => {
    const x=90 + side * 64, y=81 + (i - 6) * 10;
    return `M${x - .4} ${y}h.8`;
  }));
  return [...sidebars, "M29 79.5l1.5 1.5-1.5 1.5M151 79.5l-1.5 1.5 1.5 1.5M88.5 81a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0"].join("");
}
export function horizonSegments(quaternion) {
  const up = rotate([0, 1, 0], inverse(quaternion));
  const roll = clamp(Math.atan2(-up[0], up[1]) * 180 / Math.PI, -40, 40);
  const pitch = clamp(Math.asin(clamp(up[2], -1, 1)) * 180 / Math.PI, -20, 20);
  return Array.from({ length: 9 }, (_, index) => {
    const column = index - 4;
    const y = 81 + Math.round((-pitch * 2.5 - roll * column * 0.3125) / 2) * 2;
    // Extreme pitch/bank can move a character outside the display. Omit it
    // instead of flattening the ends of the horizon against the frame.
    return { x: 90 + column * 12, y, visible: y >= 1 && y <= 161 };
  });
}

export class FpvOsd {
  constructor(horizon) {
    this.horizon = horizon;
    this.settings = { horizon: false };
    this.outlines = [];
    this.bars = Array.from({ length: 9 }, () => {
      const path = horizon.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
      const outline = path.cloneNode();
      horizon.querySelector(".horizon-bars-outline").append(outline); this.outlines.push(outline);
      horizon.querySelector(".horizon-bars").append(path); return path;
    });
    for (const reference of horizon.querySelectorAll(".horizon-reference, .horizon-reference-outline"))
      reference.setAttribute("d", horizonReferencePath());
  }
  setSettings(settings) {
    this.settings = { horizon: settings.horizon === true };
  }
  update(active, quaternion) {
    const horizon = active && this.settings.horizon && !!quaternion;
    this.horizon.classList.toggle("hidden", !horizon);
    if (!horizon) return;
    horizonSegments(quaternion).forEach(({ x, y, visible }, i) => {
      const path = `M${x - 1} ${y}h2`;
      for (const bar of [this.outlines[i], this.bars[i]]) {
        bar.classList.toggle("hidden", !visible);
        if (bar.getAttribute("d") !== path) bar.setAttribute("d", path);
      }
    });
  }
}
