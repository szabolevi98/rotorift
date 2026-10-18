import { aircraftAirframe } from "./airframe.js";
import { isFixedWing } from "./capabilities.js";
import { parkSurfaceHeight } from "../world/park-layout.js";

export const groundLaunchAvailable = (config, map) =>
  !isFixedWing(config) || map?.kind === "park";
export function aircraftLaunch(config, map, { method = "air", slot = 0 } = {}) {
  if (!isFixedWing(config))
    return {
      p: [
        map.spawn[0] + slot * 0.6,
        map.spawn[1],
        map.spawn[2] + Math.floor(slot / 4),
      ],
      q: { x: 0, y: 0, z: 0, w: 1 },
      v: [0, 0, 0],
    };
  if (method === "ground" && map.kind === "park" && !map.gates?.length) {
    const x = slot % 2 === 0 ? -1 : 1,
      z = 300 + Math.floor(slot / 2) * 4;
    return {
      p: [
        x,
        parkSurfaceHeight(x, z) +
          0.065 +
          aircraftAirframe(config).groundClearance,
        z,
      ],
      q: { x: 0, y: 0, z: 0, w: 1 },
      v: [0, 0, 0],
      method: "ground",
    };
  }
  const gate = map.gates?.[0],
    n = gate?.n ?? [0, 0, -1],
    yaw = Math.atan2(-n[0], -n[2]);
  const p = gate
    ? [...map.spawn]
    : [0, config.launch.altitudeM, Math.min(map.size * 0.35, 240)];
  // A 1.5 m wing needs wider launch slots than a quadcopter.
  p[0] += Math.cos(yaw) * (slot % 4) * 3;
  p[2] -= Math.sin(yaw) * (slot % 4) * 3;
  p[0] += Math.sin(yaw) * Math.floor(slot / 4) * 4;
  p[2] += Math.cos(yaw) * Math.floor(slot / 4) * 4;
  return {
    p,
    q: { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) },
    v: [
      -Math.sin(yaw) * config.launch.speedMps,
      0,
      -Math.cos(yaw) * config.launch.speedMps,
    ],
    method: "air",
  };
}
