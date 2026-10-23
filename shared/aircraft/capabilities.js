import { normalizeSimulation } from "../simulation/options.js";

const QUAD = Object.freeze({
  kind: "quadrotor",
  modes: ["acro", "angle", "horizon"],
  racing: true,
  multiplayer: true,
  propDamage: true,
  propwash: true,
  turtle: true,
  hover: true,
  rateProfiles: true,
  launchModes: ["ground"],
  excludedMapKinds: [],
});
const AIRPLANE = Object.freeze({
  kind: "fixedWing",
  modes: ["manual", "stabilized"],
  racing: true,
  multiplayer: true,
  propDamage: true,
  propwash: true,
  turtle: false,
  hover: false,
  rateProfiles: false,
  launchModes: ["air", "ground"],
  excludedMapKinds: ["playground"],
});
export const isFixedWing = (config) => config?.kind === "fixedWing";
export const aircraftCapabilities = (config) =>
  isFixedWing(config) ? AIRPLANE : QUAD;
export const aircraftModes = (config) => aircraftCapabilities(config).modes;
export const supportsMap = (config, map) =>
  !!map && !aircraftCapabilities(config).excludedMapKinds.includes(map.kind);
export function aircraftSimulation(config, value) {
  const options = normalizeSimulation(value),
    capabilities = aircraftCapabilities(config);
  return {
    ...options,
    airmode: isFixedWing(config) ? true : options.airmode,
    propDamage: options.propDamage && capabilities.propDamage,
    propwash: options.propwash && capabilities.propwash,
  };
}
export const routeSupportsAircraft = (route, config) =>
  (route?.aircraftKinds ?? ["quadrotor"]).includes(
    aircraftCapabilities(config).kind,
  );
export const aircraftRoutes = (map, config) =>
  (map?.routes ?? []).filter((route) => routeSupportsAircraft(route, config));
