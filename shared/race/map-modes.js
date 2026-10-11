export const canRace = (map) => map?.racingEnabled !== false && (map?.gates?.length ?? 0) >= 2;
export const isTimedSession = (session) => ["time", "online-race", "online-hotlap"].includes(session);
