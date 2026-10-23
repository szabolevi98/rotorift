export const FLIGHT_MODES = Object.freeze(["acro", "angle", "horizon"]);
export const WIND_LEVELS = Object.freeze(["calm", "light", "medium", "strong"]);
export const DEFAULT_SIMULATION = Object.freeze({ battery: false, propDamage: false, propwash: false, ghost: true, wind: "calm", airmode: true });
export function validSimulation(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every(key => Object.hasOwn(DEFAULT_SIMULATION, key) &&
      (key === "wind" ? WIND_LEVELS.includes(value[key]) : typeof value[key] === "boolean"));
}
export function normalizeSimulation(value) {
  return { ...DEFAULT_SIMULATION, ...(validSimulation(value) ? value : {}) };
}
export function simulationKey(value) {
  const options = normalizeSimulation(value);
  // Keep historical Air Mode-on categories byte-for-byte compatible, including
  // the CHAR(5) database column. Last digit 4–7 denotes Air Mode off + wind 0–3.
  return ["battery", "propDamage", "propwash", "ghost"].map(key => Number(options[key])).join("") + (WIND_LEVELS.indexOf(options.wind)+(options.airmode?0:4));
}
