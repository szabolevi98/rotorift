import { rotate, inverse, clamp } from "../../shared/physics/math.js";

// A 12×18 character grid: nine horizon columns and sidebars at ±7 columns,
// extending ±3 rows, as in the Betaflight OSD. Body attitude is independent
// of yaw, camera tilt and FOV. Vertical motion advances in two-pixel steps.
export function horizonReferencePath() {
  const sidebars = [-1, 1].flatMap(side => Array.from({length:7}, (_, i) => {
    const x=90 + side * 84, y=81 + (i - 3) * 18;
    // The AH decoration character has two short horizontal ticks, rather
    // than a solid vertical rail. The inward arrows mark the level row.
    return `M${x - 2} ${y - 5}h4M${x - 2} ${y + 5}h4`;
  }));
  return [...sidebars, "M16 77l4 4-4 4M164 77l-4 4 4 4M75 81h9M96 81h9M90 74v3M90 85v3M90 78l3 3-3 3-3-3z"].join("");
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
  constructor(horizon, analog, canvas) {
    this.horizon = horizon; this.analog = analog; this.canvas = canvas;
    this.settings = { horizon: false, analog: false };
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
    this.settings = { horizon: settings.horizon === true, analog: settings.analog === true };
  }
  update(active, quaternion) {
    const horizon = active && this.settings.horizon && !!quaternion;
    const analog = active && this.settings.analog;
    this.horizon.classList.toggle("hidden", !horizon);
    this.analog.classList.toggle("hidden", !analog);
    this.canvas.classList.toggle("analog-video", analog);
    if (!horizon) return;
    horizonSegments(quaternion).forEach(({ x, y, visible }, i) => {
      const path = `M${x - 5} ${y}h10`;
      for (const bar of [this.outlines[i], this.bars[i]]) {
        bar.classList.toggle("hidden", !visible);
        if (bar.getAttribute("d") !== path) bar.setAttribute("d", path);
      }
    });
  }
}
