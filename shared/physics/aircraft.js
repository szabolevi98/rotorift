import { DronePhysics } from "./drone.js";
import { FixedWingPhysics } from "./fixed-wing.js";
import { isFixedWing } from "../aircraft/capabilities.js";
export {
  isFixedWing,
  aircraftModes,
  aircraftCapabilities,
} from "../aircraft/capabilities.js";
export function createAircraftPhysics(RAPIER, world, config, spawn, options) {
  return new (isFixedWing(config) ? FixedWingPhysics : DronePhysics)(
    RAPIER,
    world,
    config,
    spawn,
    options,
  );
}
