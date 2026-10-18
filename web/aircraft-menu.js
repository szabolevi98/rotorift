import {
  isFixedWing,
  aircraftRoutes,
} from "../shared/aircraft/capabilities.js";
import { resolveRoute } from "../shared/race/routes.js";
import { withoutRaceRoute } from "../shared/race/map-modes.js";

export const routePreferenceKey = (map, config) =>
  "selected-race-" + map.id + (isFixedWing(config) ? "-fixedWing" : "");
export function selectAircraftRoute(map, config, preferred) {
  const routes = aircraftRoutes(map, config);
  if (!routes.length) return withoutRaceRoute(map);
  return (
    resolveRoute(
      map,
      routes.find((route) => route.id === preferred)?.id ?? routes[0]?.id,
    ) ?? withoutRaceRoute(map)
  );
}
