export const FLIGHT_MODES = Object.freeze(["acro", "angle", "horizon"]);
export const WIND_LEVELS = Object.freeze(["calm", "light", "medium", "strong"]);
export const DEFAULT_SIMULATION = Object.freeze({ battery: false, propDamage: false, propwash: false, ghost: true, wind: "calm" });
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
  return ["battery", "propDamage", "propwash", "ghost"].map(key => Number(options[key])).join("") + WIND_LEVELS.indexOf(options.wind);
}
