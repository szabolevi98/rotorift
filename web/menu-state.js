import { normalizeSimulation } from "../shared/simulation/options.js";

export function simulationView(context, preferences, room, pilotId) {
  const inRoom = context === "lobby" && !!room;
  return {
    options: normalizeSimulation(inRoom ? room.simulation : preferences),
    locked: inRoom && (room.host !== pilotId || room.phase !== "lobby"),
    ghost: context === "host" || (inRoom && room.kind !== "hotlap"),
    note: inRoom ? room.phase === "lobby" ? "simulation.hostHint" : "simulation.lockedHint"
      : context === "host" ? "simulation.hostSetupHint" : "simulation.hint",
  };
}
export const activeMenuTab = (panel, roomKind) => panel === "lobby" ? roomKind === "hotlap" ? "fly" : "multiplayer" : panel;
