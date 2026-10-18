// Metre-scale structural dimensions shared by rendering, physics and launch.
// Coordinates: Y up, negative Z forward. The T15 defaults preserve its handling.
export const TRAINER_WING_SHIFT = -0.025;
export const TRAINER_GEAR = Object.freeze([
  [-0.21, -0.22, 0.08],
  [0.21, -0.22, 0.08],
  [0, -0.22, -0.38],
]);
export const SCOUT_GEAR = Object.freeze([
  [-0.1, -0.09, 0.018],
  [0.1, -0.09, 0.018],
  [0, -0.09, -0.155],
]);
const AIRFRAMES = {
  "rift-t15": {
    nose: { half: [0.04, 0.04, 0.08], p: [0, 0.015, -0.49] },
    wing: {
      half: [0.75, 0.018, 0.112],
      p: [0, 0.115, -0.02 + TRAINER_WING_SHIFT],
    },
    tail: { half: [0.25, 0.012, 0.075], p: [0, 0.045, 0.46] },
    gear: TRAINER_GEAR,
    wheelRadius: 0.06,
    groundClearance: 0.285,
  },
  "rift-s75": {
    nose: { half: [0.027, 0.028, 0.055], p: [0, 0, -0.15] },
    wing: { half: [0.375, 0.021, 0.065], p: [0, 0.075, -0.03] },
    tail: { half: [0.135, 0.007, 0.05], p: [0, 0.017, 0.285] },
    extra: [
      { half: [0.009, 0.009, 0.08], p: [0, -0.002, 0.18] },
      { half: [0.014, 0.025, 0.03], p: [0, 0.108, 0.105] },
      { half: [0.004, 0.048, 0.033], p: [0, 0.065, 0.275] },
    ],
    gear: SCOUT_GEAR,
    wheelRadius: 0.025,
    groundClearance: 0.12,
  },
};
export function aircraftAirframe(config) {
  const frame = AIRFRAMES[config.id];
  if (!frame) throw new Error("Missing airframe dimensions: " + config.id);
  return frame;
}
