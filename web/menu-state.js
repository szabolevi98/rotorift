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
export const activeMenuTab = (panel, roomKind) => ["lobby", "results"].includes(panel) ? roomKind === "hotlap" ? "fly" : "multiplayer" : panel;
export function flightSimulationActive(playing, paused, room, pilotId) {
  if (!playing) return false;
  if (!room) return !paused;
  return room.phase === "flying" && !room.players.find(p=>p.id===pilotId)?.finished;
}
