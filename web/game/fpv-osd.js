import { rotate, inverse, clamp } from "../../shared/physics/math.js";

// Body attitude, independent of yaw, camera tilt and FOV. Nine stepped bars
// with bounded pitch/roll travel evoke the familiar character-based FPV OSD.
export function horizonSegments(quaternion) {
  const up = rotate([0, 1, 0], inverse(quaternion));
  const roll = clamp(Math.atan2(-up[0], up[1]) * 180 / Math.PI, -40, 40);
  const pitch = clamp(Math.asin(clamp(up[2], -1, 1)) * 180 / Math.PI, -20, 20);
  return Array.from({ length: 9 }, (_, index) => {
    const column = index - 4;
    return { x: 100 + column * 18, y: 64 + Math.round((-pitch * 1.5 - roll * column * 0.1875) / 1.5) * 1.5 };
  });
}

export class FpvOsd {
  constructor(horizon, analog, canvas) {
    this.horizon = horizon; this.analog = analog; this.canvas = canvas;
    this.settings = { horizon: false, analog: false };
    this.bars = Array.from({ length: 9 }, () => {
      const path = horizon.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
      horizon.querySelector(".horizon-bars").append(path); return path;
    });
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
    horizonSegments(quaternion).forEach(({ x, y }, i) => {
      const path = `M${x - 6} ${y}h12`;
      if (this.bars[i].getAttribute("d") !== path) this.bars[i].setAttribute("d", path);
    });
  }
}
