import { clamp } from "./math.js";
export const DEFAULT_RATE = { center: 70, max: 670, expo: 0 };
export const defaultRates = () =>
  Object.fromEntries(
    ["roll", "pitch", "yaw"].map((a) => [a, { ...DEFAULT_RATE }]),
  );
export function validRate(r) {
  return (
    r &&
    Number.isFinite(r.center) &&
    r.center >= 10 &&
    r.center <= 1000 &&
    Number.isFinite(r.max) &&
    r.max >= r.center &&
    r.max <= 1998 &&
    Number.isFinite(r.expo) &&
    r.expo >= 0 &&
    r.expo <= 1
  );
}
// Actual Rates: linear centre term plus the signed quadratic / sixth-power blend.
// Mathematical reference: Betaflight 4.5.2 rc.c, applyActualRates.
export function actualRate(stick, r = DEFAULT_RATE) {
  if (!validRate(r)) throw Error("Invalid rate");
  const x = clamp(stick, -1, 1),
    a = Math.abs(x);
  return (
    r.center * x + (r.max - r.center) * x * a * (1 - r.expo + r.expo * a ** 4)
  );
}
