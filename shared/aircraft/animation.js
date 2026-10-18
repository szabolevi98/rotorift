import { isFixedWing } from "./capabilities.js";

export function validAirplaneAnimation(value) {
  return (
    !!value &&
    value.kind === "fixedWing" &&
    Number.isFinite(value.engine) &&
    value.engine >= 0 &&
    value.engine <= 1 &&
    !!value.surfaces &&
    ["pitch", "roll", "yaw"].every(
      (axis) =>
        Number.isFinite(value.surfaces[axis]) &&
        Math.abs(value.surfaces[axis]) <= 1,
    )
  );
}
export const stoppedAirplaneAnimation = () => ({
  kind: "fixedWing",
  engine: 0,
  surfaces: { pitch: 0, roll: 0, yaw: 0 },
});
export function airplaneAnimation(config, value, active) {
  if (!isFixedWing(config) || !active || !validAirplaneAnimation(value))
    return stoppedAirplaneAnimation();
  return {
    kind: "fixedWing",
    engine: value.engine,
    surfaces: { ...value.surfaces },
  };
}
