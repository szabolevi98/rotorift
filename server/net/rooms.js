import { WebSocketServer } from "ws";
import { randomUUID, randomBytes } from "node:crypto";
import { newLap, advanceLap } from "../../shared/race/gates.js";
import { length, sub } from "../../shared/physics/math.js";
import { MapBoundary } from "../../shared/world/boundary.js";
import { canRace } from "../../shared/race/map-modes.js";
import { normalizeDroneColor, validDroneColor } from "../../shared/visual/drone-colors.js";
import { DEFAULT_SIMULATION, FLIGHT_MODES, normalizeSimulation, validSimulation, simulationKey } from "../../shared/simulation/options.js";
const MODES = FLIGHT_MODES;
export function attachRooms(server, catalog, db) {
  const rooms = new Map(),
    clients = new Set();
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 8192 });
  const send = (p, type, data = {}) => {
    if (p.ws.readyState === 1) p.ws.send(JSON.stringify({ type, ...data }));
  };
  const snapshot = (r) => ({
    code: r.code,
    kind: r.kind,
    phase: r.phase,
    mapId: r.map.id,
    droneId: r.drone.id,
    mode: r.mode,
    simulation: r.simulation,
    simulationKey: simulationKey(r.simulation),
    startsAt: r.startsAt,
    laps: r.laps,
    host: r.host,
    players: [...r.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      mode: p.mode,
      resetId: p.resetId,
      ready: p.ready,
      p: p.pose?.p,
      q: p.pose?.q,
      lap: p.lap,
      finished: p.finished,
      finishMs: p.finishMs,
      boundary: p.boundary ? { outside: p.boundary.outside, remainingSeconds: p.boundary.remainingSeconds } : null,
    })),
  });
  const broadcast = (r) => {
    const data = snapshot(r);
    for (const p of r.players.values())
      send(p, "room", { room: data, now: Date.now() });
  };
  const leave = (p) => {
    const r = p.room;
    if (!r) return;
    p.room = null;
    r.players.delete(p.id);
    if (!r.players.size) {
      rooms.delete(r.code);
      return;
    }
    if (r.host === p.id) r.host = r.players.keys().next().value;
    broadcast(r);
  };
  const reset = (p, r) => {
    p.resetId = (p.resetId ?? 0) + 1;
    p.boundary = new MapBoundary(r.map);
    p.boundaryAt = null;
    p.boundaryPaused = false;
    p.lap = newLap();
    p.finished = false;
    p.finishMs = null;
    p.seq = -1;
    p.at = null;
    const slot = [...r.players.keys()].indexOf(p.id);
    p.pose = {
      p: [
        r.map.spawn[0] + slot * 0.6,
        r.map.spawn[1],
        r.map.spawn[2] + Math.floor(slot / 4),
      ],
      q: { x: 0, y: 0, z: 0, w: 1 },
    };
  };
  const list = () =>
    [...rooms.values()]
      .filter((r) => r.public && r.phase === "lobby")
      .map((r) => ({
        code: r.code,
        mapId: r.map.id,
        droneId: r.drone.id,
        kind: r.kind,
        players: r.players.size,
        mode: r.mode,
      }));
  wss.on("connection", (ws) => {
    const p = {
      id: randomUUID(),
      ws,
      room: null,
      name: "Pilot",
      color: "coral",
      resetId: 0,
      token: null,
      ready: false,
      lap: newLap(),
      seq: -1,
      alive: true,
      messages: 0,
      windowAt: Date.now(),
    };
    clients.add(p);
    ws.on("pong", () => (p.alive = true));
    ws.on("message", async (raw) => {
      try {
        if (Date.now() - p.windowAt >= 1000) {
          p.windowAt = Date.now();
          p.messages = 0;
        }
        if (++p.messages > 120) return;
        const m = JSON.parse(raw.toString());
        if (!m || typeof m.type !== "string") return;
        if (m.type === "hello") {
          if (p.token || p.connecting) return;
          p.connecting = true;
          try {
            const name =
              String(m.name || "Pilot")
                .trim()
                .slice(0, 32) || "Pilot";
            p.name = name;
            p.color = normalizeDroneColor(m.color);
            p.token = await db.profile(m.token, name);
            send(p, "welcome", {
              id: p.id,
              token: p.token,
              now: Date.now(),
              database: db.available,
            });
          } finally {
            p.connecting = false;
          }
          return;
        }
        if (m.type === "ping") {
          send(p, "pong", { echo: m.at, now: Date.now() });
          return;
        }
        if (!p.token) {
          send(p, "error", { code: "connectFirst" });
          return;
        }
        if (m.type === "rename") {
          p.name =
            String(m.name || "Pilot")
              .trim()
              .slice(0, 32) || "Pilot";
          await db.profile(p.token, p.name);
          if (p.room) broadcast(p.room);
          return;
        }
        if (m.type === "appearance") {
          if (!validDroneColor(m.color)) { send(p, "error", { code: "invalidColor" }); return; }
          p.color = m.color;
          if (p.room) broadcast(p.room);
          return;
        }
        if (m.type === "list") {
          send(p, "rooms", { rooms: list() });
          return;
        }
        if (m.type === "leave") {
          leave(p);
          send(p, "left");
          return;
        }
        if (m.type === "create") {
          if (m.simulation !== undefined && !validSimulation(m.simulation)) { send(p, "error", { code: "invalidSimulation" }); return; }
          if (rooms.size >= 100) {
            send(p, "error", { code: "roomFull" });
            return;
          }
          const map = catalog.maps.find((v) => v.id === m.mapId),
            drone = catalog.drones.find((v) => v.id === m.droneId);
          if (
            !map ||
            !drone ||
            !MODES.includes(m.mode) ||
            !["free", "race", "hotlap"].includes(m.kind)
          )
            return;
          if (m.kind !== "free" && !canRace(map)) {
            send(p, "error", { code: "raceUnavailable" });
            return;
          }
          leave(p);
          const code = randomBytes(3).toString("hex").toUpperCase();
          const r = {
            code,
            kind: m.kind,
            map,
            drone,
            mode: m.mode,
            simulation: normalizeSimulation(m.simulation),
            laps: 3,
            public: m.public !== false && m.kind !== "hotlap",
            phase: "lobby",
            host: p.id,
            players: new Map(),
            raceId: randomUUID(),
          };
          rooms.set(code, r);
          r.players.set(p.id, p);
          p.mode = r.mode;
          p.room = r;
          p.ready = m.kind === "hotlap";
          reset(p, r);
          broadcast(r);
          return;
        }
        if (m.type === "join") {
          const r = rooms.get(String(m.code || "").toUpperCase());
          if (!r) {
            send(p, "error", { code: "roomMissing" });
            return;
          }
          if (
            r.phase !== "lobby" ||
            r.players.size >= (r.kind === "hotlap" ? 1 : 8)
          ) {
            send(p, "error", { code: "roomFull" });
            return;
          }
          if ([...r.players.values()].some((v) => v.token === p.token)) {
            send(p, "error", { code: "alreadyJoined" });
            return;
          }
          leave(p);
          r.players.set(p.id, p);
          p.mode = r.mode;
          p.room = r;
          p.ready = false;
          reset(p, r);
          broadcast(r);
          return;
        }
        const r = p.room;
        if (!r) return;
        if (m.type === "rules") {
          if (r.host !== p.id) { send(p, "error", { code: "hostOnly" }); return; }
          if (r.phase !== "lobby") { send(p, "error", { code: "rulesLocked" }); return; }
          if (!validSimulation(m.simulation)) { send(p, "error", { code: "invalidSimulation" }); return; }
          r.simulation = normalizeSimulation(m.simulation);
          for (const player of r.players.values()) player.ready = false;
          broadcast(r); return;
        }
        if (m.type === "mode" && FLIGHT_MODES.includes(m.mode) && r.phase === "flying" && !p.finished) {
          if (p.mode !== m.mode) { p.mode = m.mode; p.lap.invalid = true; p.lap.bestMs = p.lap.lastMs = null; }
          broadcast(r); return;
        }
        if (m.type === "ready" && r.phase === "lobby") {
          p.ready = !!m.ready;
          broadcast(r);
          return;
        }
        if (m.type === "start" && r.host === p.id && r.phase === "lobby") {
          if (![...r.players.values()].every((v) => v.ready)) {
            send(p, "error", { code: "notReady" });
            return;
          }
          r.startsAt = Date.now() + 3000;
          r.phase = "countdown";
          for (const v of r.players.values()) reset(v, r);
          broadcast(r);
          return;
        }
        if (m.type === "reset" && r.phase === "flying") {
          reset(p, r);
          send(p, "reset", { pose: p.pose });
          broadcast(r);
          return;
        }
        if (m.type !== "state" || r.phase !== "flying" || p.finished) return;
        if (
          !Number.isSafeInteger(m.seq) ||
          m.seq <= p.seq ||
          !Number.isFinite(m.t)
        )
          return;
        const now = Date.now();
        if (m.t < now - 2000 || m.t > now + 250) return;
        if (
          !Array.isArray(m.p) ||
          !Array.isArray(m.v) ||
          m.p.length !== 3 ||
          m.v.length !== 3 ||
          ![...m.p, ...m.v].every(Number.isFinite) ||
          !m.q ||
          !["x", "y", "z", "w"].every((k) => Number.isFinite(m.q[k]))
        )
          return;
        const qlen = Math.hypot(m.q.x, m.q.y, m.q.z, m.q.w);
        if (
          Math.abs(qlen - 1) > 0.05 ||
          length(m.p) > Math.max(500, (r.map.size ?? 0) + (r.map.boundary?.returnAfterSeconds ?? 0) * r.drone.maxSpeedMps * 1.5) ||
          length(m.v) > r.drone.maxSpeedMps * 1.5
        ) {
          p.lap.invalid = true;
          return;
        }
        const previous = p.pose?.p,
          dt = p.at === null ? null : (m.t - p.at) / 1000;
        if (dt !== null && dt <= 0) return;
        const travel = previous ? length(sub(m.p, previous)) : 0;
        const validTravel =
          dt !== null && dt <= 2 && travel <= r.drone.maxSpeedMps * dt + 1.0;
        if (dt !== null && !validTravel) p.lap.invalid = true;
        if (m.configHash !== r.drone.configHash || m.mode !== p.mode ||
            (m.simulationKey ?? simulationKey(DEFAULT_SIMULATION)) !== simulationKey(r.simulation)) {
          p.lap.invalid = true;
          return;
        }
        if (m.interrupted) p.lap.invalid = true;
        const boundaryDt = p.boundaryAt === null ? 0 : Math.max(0, (now - p.boundaryAt) / 1000);
        p.boundaryAt = now;
        const activeBoundaryDt = m.interrupted || p.boundaryPaused ? 0 : boundaryDt;
        p.boundaryPaused = !!m.interrupted;
        if (p.boundary?.update(m.p, activeBoundaryDt)) {
          reset(p, r);
          send(p, "reset", { pose: p.pose, reason: "boundary" });
          broadcast(r);
          return;
        }
        let events = [];
        if (validTravel && r.kind !== "free")
          events = advanceLap(p.lap, previous, m.p, p.at, m.t, r.map.gates);
        p.pose = { p: m.p, q: m.q };
        p.at = m.t;
        p.seq = m.seq;
        for (const e of events)
          if (e.kind === "lap") {
            if (r.kind === "race" && p.lap.completed >= r.laps) {
              p.finished = true;
              p.finishMs = e.at - r.startsAt;
            }
            const saved = e.valid
              ? await db.saveLap(p.token, r.map, r.drone, p.mode, e.ms, r.simulation)
              : false;
            send(p, "lap", { ...e, saved });
          }
        if (
          r.kind === "race" &&
          [...r.players.values()].every((v) => v.finished)
        ) {
          r.phase = "finished";
          await db.saveResult(r);
          broadcast(r);
        }
      } catch {
        send(p, "error", { code: "requestFailed" });
      }
    });
    ws.on("close", () => {
      leave(p);
      clients.delete(p);
    });
    ws.on("error", () => {});
  });
  const timer = setInterval(() => {
    for (const r of rooms.values()) {
      if (r.phase === "countdown" && Date.now() >= r.startsAt)
        r.phase = "flying";
      broadcast(r);
    }
  }, 50);
  const heartbeat = setInterval(() => {
    for (const p of clients) {
      if (!p.alive) {
        p.ws.terminate();
        continue;
      }
      p.alive = false;
      p.ws.ping();
    }
  }, 15000);
  server.once("close", () => {
    clearInterval(timer);
    clearInterval(heartbeat);
    wss.close();
  });
  return { list, stats: () => ({ rooms: rooms.size, players: clients.size }) };
}
