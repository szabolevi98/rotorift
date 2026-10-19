import { isFixedWing } from "./capabilities.js";
import { validAirplanePropeller } from "./propeller.js";

export function validAirplaneAnimation(value) {
  return (
    !!value &&
    value.kind === "fixedWing" &&
    Number.isFinite(value.engine) &&
    value.engine >= 0 &&
    value.engine <= 1 &&
    (value.propeller === undefined ||
      validAirplanePropeller(value.propeller)) &&
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
export function airplaneAnimation(config, value, active, damageEnabled = true) {
  if (!isFixedWing(config) || !validAirplaneAnimation(value))
    return stoppedAirplaneAnimation();
  return {
    ...(active
      ? {
          kind: "fixedWing",
          engine: value.engine,
          surfaces: { ...value.surfaces },
        }
      : stoppedAirplaneAnimation()),
    ...(damageEnabled && value.propeller
      ? { propeller: [...value.propeller] }
      : {}),
  };
}
