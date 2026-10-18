import { createTrainerModel } from "./fixed-wing-model.js";
import { createScoutModel } from "./scout-model.js";

const factories = {
  "rift-t15": createTrainerModel,
  "rift-s75": createScoutModel,
};
export function createAirplaneModel(config, options) {
  const factory = factories[config.id];
  if (!factory) throw new Error("Missing airplane model: " + config.id);
  return factory(options);
}
