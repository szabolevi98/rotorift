import { WebSocketServer } from "ws";
import { randomUUID, randomBytes } from "node:crypto";
import { newLap, advanceLap } from "../../shared/race/gates.js";
import { length, sub } from "../../shared/physics/math.js";
const MODES = ["acro", "angle", "horizon"];
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
    startsAt: r.startsAt,
    laps: r.laps,
    host: r.host,
    players: [...r.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      p: p.pose?.p,
      q: p.pose?.q,
      lap: p.lap,
      finished: p.finished,
      finishMs: p.finishMs,
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
          leave(p);
          const code = randomBytes(3).toString("hex").toUpperCase();
          const r = {
            code,
            kind: m.kind,
            map,
            drone,
            mode: m.mode,
            laps: 3,
            public: m.public !== false && m.kind !== "hotlap",
            phase: "lobby",
            host: p.id,
            players: new Map(),
            raceId: randomUUID(),
          };
          rooms.set(code, r);
          r.players.set(p.id, p);
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
          p.room = r;
          p.ready = false;
          reset(p, r);
          broadcast(r);
          return;
        }
        const r = p.room;
        if (!r) return;
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
          length(m.p) > 500 ||
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
        if (m.configHash !== r.drone.configHash || m.mode !== r.mode) {
          p.lap.invalid = true;
          return;
        }
        if (m.interrupted) p.lap.invalid = true;
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
              ? await db.saveLap(p.token, r.map, r.drone, r.mode, e.ms)
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
