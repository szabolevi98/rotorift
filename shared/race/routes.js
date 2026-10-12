import { validateMap } from "../physics/config.js";

export const validRouteId = id => typeof id === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(id);

export function validateRoute(route, map) {
  if (!route || !validRouteId(route.id) || typeof route.name !== "string" || !route.name.trim() || route.name.length > 80 ||
      !Number.isInteger(route.version) || route.version < 1 || !Array.isArray(route.gates) || route.gates.length < 2 || route.gates.length > 128)
    throw Error("A race needs an ID, a name, a positive version and 2–128 gates.");
  validateMap({ ...map, spawn: route.spawn ?? map.spawn, routeId: route.id, routeVersion: route.version, gates: route.gates, racingEnabled: true });
  for (const gate of route.gates)
    if (Math.abs(gate.p[0]) > map.size / 2 || Math.abs(gate.p[2]) > map.size / 2 || gate.p[1] < -20 || gate.p[1] > 200 || gate.width > 30 || gate.height > 30)
      throw Error("Gates must be inside the map, with dimensions up to 30 metres.");
  const spawn = route.spawn ?? map.spawn;
  if (Math.abs(spawn[0]) > map.size / 2 || Math.abs(spawn[2]) > map.size / 2 || spawn[1] < -20 || spawn[1] > 200)
    throw Error("The start position must be inside the map.");
  return {
    id: route.id, name: route.name.trim(), version: route.version, spawn: [...spawn],
    gates: route.gates.map(g => ({ p: [...g.p], n: [...g.n], width: g.width, height: g.height })),
  };
}

export function resolveRoute(map, id = map?.routeId) {
  if (!map) return null;
  if (!map.routes?.length) return !id || id === map.routeId ? map : null;
  const route = map.routes.find(r => r.id === id);
  if (!route) return null;
  return { ...map, baseSpawn: map.baseSpawn ?? map.spawn, routeId: route.id, routeVersion: route.version, routeName: route.name,
    spawn: [...route.spawn], gates: route.gates, racingEnabled: true };
}
