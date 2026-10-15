export const canRace = (map) => map?.racingEnabled !== false && (map?.gates?.length ?? 0) >= 2;
export const isTimedSession = (session) => ["time", "online-race", "online-hotlap"].includes(session);

// Free flight uses the map's own spawn and never instantiates race obstacles.
export const withoutRaceRoute = map => map ? {
  ...map, spawn: [...(map.baseSpawn ?? map.spawn)], gates: [], guide:undefined,
  routeId: null, routeName: null, routeVersion: null, racingEnabled: false,
} : null;
