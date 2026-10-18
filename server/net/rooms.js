import {findAircraft} from '../../shared/catalog/aircraft.js';
import {isFixedWing,aircraftModes,aircraftSimulation,supportsMap,routeSupportsAircraft} from '../../shared/aircraft/capabilities.js';
import {aircraftLaunch,groundLaunchAvailable} from '../../shared/aircraft/launch.js';
import {validAirplaneAnimation,airplaneAnimation,stoppedAirplaneAnimation} from '../../shared/aircraft/animation.js';
import { WebSocketServer } from "ws";
import { randomUUID, randomBytes } from "node:crypto";
import { buildResults } from "../../shared/race/results.js";
import { newLap, advanceLap, clearLapReference } from "../../shared/race/gates.js";
import { length, sub } from "../../shared/physics/math.js";
import { MapBoundary } from "../../shared/world/boundary.js";
import { canRace, withoutRaceRoute } from "../../shared/race/map-modes.js";
import { resolveRoute } from "../../shared/race/routes.js";
import { DRONE_COLORS, normalizeDroneColor, validDroneColor } from "../../shared/visual/drone-colors.js";
import { DEFAULT_SIMULATION, normalizeSimulation, validSimulation, simulationKey } from "../../shared/simulation/options.js";
import { freshPropellers, validPropellers } from "../../shared/physics/propellers.js";
import { STOPPED_ROTORS, validRotorSpeeds } from "../../shared/visual/rotor-motion.js";
import { LapGhostRecorder } from '../../shared/race/ghost.js';
const publicLap = ({ splits, bestSplits, ...lap }) => lap;
export function attachRooms(server, catalog, db, { reconnectMs = 60000, countdownMs = 3000 } = {}) {
  const rooms = new Map(),
    clients = new Set();
  const resumable = new Map();
  const forgetResume = p => { resumable.delete(p.resume); resumable.delete(p.previousResume); };
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 8192 });
  const send = (p, type, data = {}) => {
    if (p.ws.readyState === 1) p.ws.send(JSON.stringify({ type, ...data }));
  };
  const snapshot = (r) => ({
    code: r.code,
    kind: r.kind,
    phase: r.phase,
    runId: r.raceId,
    results: r.results ?? buildResults(r.participants?.values() ?? [], r.kind),
    mapId: r.map.id,
    routeId: r.map.routeId,
    route: r.kind === "free" ? null : { id: r.map.routeId, name: r.map.routeName ?? r.map.routeId, version: r.map.routeVersion, spawn: r.map.spawn, gates: r.map.gates, guide:r.map.guide,aircraftKinds:r.map.aircraftKinds },
    droneId: r.drone.id,
    aircraftKind:isFixedWing(r.drone)?"fixedWing":"quadrotor",
    launchMethod:r.launchMethod,
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
      connected: p.connected,
      reconnectUntil: p.reconnectUntil ?? null,
      p: p.pose?.p,
      q: p.pose?.q,
      v:p.pose?.v,
      ...(isFixedWing(r.drone)?{animation:airplaneAnimation(r.drone,p.animation,r.phase==='flying'&&p.connected&&!p.finished&&Date.now()-p.rotorsAt<600)}:{
        propellers:p.propellers??freshPropellers(),
        rotorSpeeds:r.phase==='flying'&&p.connected&&!p.finished&&Date.now()-p.rotorsAt<600?p.rotorSpeeds:STOPPED_ROTORS,
        turtleMode:r.phase==='flying'&&p.connected&&!p.finished&&Date.now()-p.rotorsAt<600&&p.turtleMode===true,
      }),
      lap: publicLap(p.lap),
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
  const finish = (r) => {
    if (r.phase !== "flying" || r.kind === "free") return;
    r.phase = "finished";
    for (const p of r.participants.values()) if (!p.finished) { p.abandoned = true; p.lap.invalid = true; }
    r.results = buildResults(r.participants.values(), r.kind, true);
    // Capture this run before awaiting the database: a restart must not change
    // its ID, roster or payload, and only one handler can claim completion.
    const completed = { ...r, players: new Map([...r.participants].map(([id,p]) => [id, { ...p, lap: { ...p.lap } }])), results: r.results };
    void Promise.resolve().then(() => db.saveResult(completed)).catch(() => {});
    broadcast(r);
  };
  const maybeFinish = (r) => {
    if (r.kind === "race" && r.phase === "flying" && r.participants.size &&
        [...r.participants.values()].every(p => p.finished || p.abandoned)) finish(r);
  };
  const transferHost = r => {
    if (r.players.get(r.host)?.connected) return;
    const next = [...r.players.values()].find(p => p.connected);
    if (next) r.host = next.id;
  };
  const leave = (p) => {
    const r = p.room;
    if (!r) return;
    p.room = null;
    p.reconnectUntil = null;
    if (!p.finished) { p.abandoned = true; p.lap.invalid = true; }
    if (r.participants.has(p.id)) r.participants.set(p.id, { ...p, lap: { ...p.lap }, room: null, ws: null });
    r.players.delete(p.id);
    if (!r.players.size) {
      maybeFinish(r);
      rooms.delete(r.code);
      return;
    }
    if (r.host === p.id) r.host = [...r.players.values()].find(v => v.connected)?.id ?? r.players.keys().next().value;
    maybeFinish(r);
    broadcast(r);
  };
  const reset = (p, r, keepBest = false) => {
    if(isFixedWing(r.drone)){p.animation=stoppedAirplaneAnimation();delete p.propellers;delete p.rotorSpeeds;delete p.turtleMode;}
    else {p.propellers = freshPropellers();p.rotorSpeeds = STOPPED_ROTORS;p.turtleMode = false;}
    p.rotorsAt = null;
    p.resetId = (p.resetId ?? 0) + 1;
    p.boundary = new MapBoundary(r.map);
    p.boundaryAt = null;
    p.boundaryPaused = false;
    p.lap = newLap(keepBest ? p.lap : null);
    p.ghostRecorder=new LapGhostRecorder();
    p.ghostBestMs=null;
    p.finished = false;
    p.abandoned = false;
    p.finishMs = null;
    p.seq = -1;
    p.at = null;
    const slot = [...r.players.keys()].indexOf(p.id);
    p.pose = aircraftLaunch(r.drone,r.map,{slot,method:r.launchMethod});
  };
  const list = () =>
    [...rooms.values()]
      .filter((r) => r.public && r.phase === "lobby")
      .map((r) => ({
        code: r.code,
        mapId: r.map.id,
        routeId: r.map.routeId,
        routeName: r.map.routeName,
        droneId: r.drone.id,
        kind: r.kind,
        players: r.players.size,
        mode: r.mode,
      }));
  wss.on("connection", (ws) => {
    let p = {
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
      connected: true,
      messages: 0,
      windowAt: Date.now(),
    };
    clients.add(p);
    ws.on("pong", () => { if (p.ws === ws) p.alive = true; });
    const handleMessage = async (raw) => {
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
            const previous = typeof m.resume === "string" ? resumable.get(m.resume) : null;
            const canResume = previous?.room && (previous.connected || previous.reconnectUntil > Date.now())
              && (!previous.connected || m.resume === previous.resume);
            if (canResume && isFixedWing(previous.room.drone) && m.protocol !== 3) {
              send(p, "error", { code: "clientTooOld" }); return;
            }
            if (canResume) {
              clients.delete(p);
              const oldSocket = previous.ws;
              p = previous; p.ws = ws; p.connected = true; p.alive = true; p.reconnectUntil = null;
              p.messages = 0; p.windowAt = Date.now(); p.protocol = [2,3].includes(m.protocol) ? m.protocol : 1;
              // A duplicated tab must not keep taking over the recovered socket.
              // Retain the presented key only while disconnected, in case the
              // new welcome packet itself is lost during an unstable connection.
              forgetResume(p); p.previousResume = m.resume; p.resume = randomBytes(24).toString("hex");
              resumable.set(p.previousResume, p); resumable.set(p.resume, p);
              clients.add(p);
              if (oldSocket !== ws) oldSocket.terminate();
              const r = p.room;
              if (!p.finished && r.phase !== "finished") {
                const progress = { completed: p.lap.completed, bestMs: p.lap.bestMs, lastMs: p.lap.lastMs, bestSplits: p.lap.bestSplits };
                reset(p, r);
                Object.assign(p.lap, progress);
                if (r.phase === "lobby") p.ready = false;
              }
              send(p, "welcome", { id: p.id, token: p.token, resume: p.resume, resumed: true, now: Date.now(), database: db.available });
              transferHost(r); broadcast(r); return;
            }
            const name =
              String(m.name || "Pilot")
                .trim()
                .slice(0, 32) || "Pilot";
            p.name = name;
            p.color = normalizeDroneColor(m.color);
            p.token = await db.profile(m.token, name);
            if (ws.readyState !== 1) return;
            p.protocol = [2,3].includes(m.protocol) ? m.protocol : 1;
            p.resume = randomBytes(24).toString("hex");
            resumable.set(p.resume, p);
            send(p, "welcome", {
              id: p.id,
              token: p.token,
              now: Date.now(),
              database: db.available,
              resume: p.resume,
              resumeRejected: !!m.resume,
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
          if(p.room && [...p.room.players.values()].some(other=>other!==p&&other.color===m.color)) {send(p,"error",{code:"colorTaken"});return;}
          p.color = m.color;
          if (p.room) broadcast(p.room);
          return;
        }
        if (m.type === "list") {
          send(p, "rooms", { rooms: list().filter(room => p.protocol >= 3 || !isFixedWing(findAircraft(catalog, room.droneId))) });
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
          const baseMap = catalog.maps.find((v) => v.id === m.mapId);
          const map = m.kind === "free" ? withoutRaceRoute(baseMap) : resolveRoute(baseMap, m.routeId),
            drone = findAircraft(catalog,m.droneId);
          if (
            !map ||
            !drone ||
            !aircraftModes(drone).includes(m.mode) ||
            !["free", "race", "hotlap"].includes(m.kind)
          )
            return;
          if(isFixedWing(drone)&&p.protocol<3){send(p,'error',{code:'clientTooOld'});return;}
          if(!supportsMap(drone,map)||m.kind!=='free'&&!routeSupportsAircraft(map,drone)){send(p,'error',{code:'incompatibleRoute'});return;}
          if(m.launchMethod!==undefined&&!['air','ground'].includes(m.launchMethod)){send(p,'error',{code:'invalidLaunch'});return;}
          if(m.launchMethod==='ground'&&isFixedWing(drone)&&(m.kind!=='free'||!groundLaunchAvailable(drone,map))){send(p,'error',{code:'invalidLaunch'});return;}
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
            simulation: aircraftSimulation(drone,m.simulation),
            launchMethod:isFixedWing(drone)&&m.kind==='free'?m.launchMethod??'air':'air',
            laps: 3,
            public: m.public !== false && m.kind !== "hotlap",
            phase: "lobby",
            host: p.id,
            players: new Map(),
            participants: new Map(),
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
          if(isFixedWing(r.drone)&&p.protocol<3){send(p,'error',{code:'clientTooOld'});return;}
          leave(p);
          if([...r.players.values()].some(other=>other.color===p.color))p.color=Object.keys(DRONE_COLORS).find(color=>![...r.players.values()].some(other=>other.color===color));
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
          r.simulation = aircraftSimulation(r.drone,m.simulation);
          for (const player of r.players.values()) player.ready = false;
          broadcast(r); return;
        }
        if (m.type === "mode" && aircraftModes(r.drone).includes(m.mode) && r.phase === "flying" && !p.finished) {
          if (p.mode !== m.mode) { p.mode = m.mode; p.lap.invalid = true; clearLapReference(p.lap);p.ghostBestMs=null;p.ghostRecorder?.clear(); }
          broadcast(r); return;
        }
        if (m.type === "ready" && r.phase === "lobby") {
          p.ready = !!m.ready;
          broadcast(r);
          return;
        }
        if (m.type === "start" && r.host === p.id && r.phase === "lobby") {
          if (![...r.players.values()].every((v) => v.ready && v.connected)) {
            send(p, "error", { code: "notReady" });
            return;
          }
          r.raceId = randomUUID(); r.results = null;
          r.participants = new Map(r.players);
          r.startsAt = Date.now() + countdownMs;
          r.phase = "countdown";
          for (const v of r.players.values()) reset(v, r);
          broadcast(r);
          return;
        }
        if (m.type === "finish" || m.type === "restart") {
          if (r.host !== p.id) { send(p, "error", { code: "hostOnly" }); return; }
          if (m.type === "finish") {
            if (r.kind === "hotlap" && r.phase === "flying")
              for (const player of r.participants.values()) player.finished = player.lap.bestMs !== null;
            finish(r); return;
          }
          if (r.phase === "lobby") return; // A repeated restart is already satisfied.
          if (r.phase !== "finished" && !(r.kind === "free" && r.phase === "flying")) {
            send(p, "error", { code: "finishFirst" }); return;
          }
          r.phase = "lobby"; r.startsAt = null; r.raceId = randomUUID(); r.results = null; r.participants = new Map();
          for (const player of r.players.values()) { player.ready = false; player.mode = r.mode; reset(player, r); }
          broadcast(r); return;
        }
        if (m.type === "reset" && r.phase === "flying") {
          reset(p, r, true);
          send(p, "reset", { pose: p.pose });
          broadcast(r);
          return;
        }
        if (m.type !== "state" || r.phase !== "flying" || p.finished) return;
        if ((p.protocol >= 2 || m.runId !== undefined) && m.runId !== r.raceId) return;
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
        if(isFixedWing(r.drone)){
          if(!validAirplaneAnimation(m.animation)||m.propellers!==undefined||m.rotorSpeeds!==undefined||m.turtleMode!==undefined)return;
        }
        if(m.propellers !== undefined && !validPropellers(m.propellers)) return;
        if(m.rotorSpeeds !== undefined && !validRotorSpeeds(m.rotorSpeeds)) return;
        if(m.turtleMode !== undefined && typeof m.turtleMode !== 'boolean')return;
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
        if(m.interrupted||!validTravel)p.ghostRecorder?.clear();
        const boundaryDt = p.boundaryAt === null ? 0 : Math.max(0, (now - p.boundaryAt) / 1000);
        p.boundaryAt = now;
        const activeBoundaryDt = m.interrupted || p.boundaryPaused ? 0 : boundaryDt;
        p.boundaryPaused = !!m.interrupted;
        if (p.boundary?.update(m.p, activeBoundaryDt)) {
          reset(p, r, true);
          send(p, "reset", { pose: p.pose, reason: "boundary" });
          broadcast(r);
          return;
        }
        let events = [];
        if (validTravel && r.kind !== "free")
          events = advanceLap(p.lap, previous, m.p, p.at, m.t, r.map.gates);
        const ghostLaps=validTravel&&r.kind!=='free'?p.ghostRecorder.segment(p.pose,{p:m.p,q:m.q},p.at,m.t,events):[];
        if(isFixedWing(r.drone))p.animation=airplaneAnimation(r.drone,m.animation,!m.interrupted);
        else {
          p.propellers=r.simulation.propDamage&&validPropellers(m.propellers)?m.propellers.map(blades=>[...blades]):freshPropellers();
          p.rotorSpeeds=m.interrupted||m.rotorSpeeds===undefined?STOPPED_ROTORS:[...m.rotorSpeeds];
          p.turtleMode=!m.interrupted&&m.turtleMode===true;
        }
        p.rotorsAt = now;
        p.pose = { p: m.p, q: m.q, v:m.v };
        p.at = m.t;
        p.seq = m.seq;
        const runId = r.raceId;
        for (const e of events)
          if (e.kind === "lap") {
            if (r.kind === "race" && p.lap.completed >= r.laps) {
              p.finished = true;
              p.finishMs = e.at - r.startsAt;
            }
            const replay=ghostLaps.find(l=>l.event===e)?.replay??null;
            const personalReplay=replay&&(p.ghostBestMs===null||e.ms<=p.ghostBestMs)?replay:null;
            if(e.valid)p.ghostBestMs=Math.min(p.ghostBestMs??Infinity,e.ms);
            const saved = e.valid
              ? await db.saveLap(p.token, r.map, r.drone, p.mode, e.ms, r.simulation,replay)
              : false;
            if (r.raceId === runId) send(p, "lap", { ...e, saved, runId, replay:personalReplay });
          }
        if (r.raceId === runId) maybeFinish(r);
      } catch {
        send(p, "error", { code: "requestFailed" });
      }
    };
    let queue = Promise.resolve(), pending = 0;
    ws.on("message", raw => {
      if (++pending > 64) { ws.close(1008, "Too many pending messages"); pending--; return; }
      queue = queue.then(() => p.ws === ws && ws.readyState === 1 ? handleMessage(raw) : undefined)
        .catch(() => {}).finally(() => pending--);
    });
    ws.on("close", () => {
      if (p.ws !== ws) return;
      clients.delete(p);
      p.connected = false;
      if (p.room) {
        p.ready = false; p.reconnectUntil = Date.now() + reconnectMs;
        if (!p.finished) p.lap.invalid = true;
        transferHost(p.room); broadcast(p.room);
      } else forgetResume(p);
    });
    ws.on("error", () => {});
  });
  const timer = setInterval(() => {
    for (const p of new Set(resumable.values())) if (!p.connected && p.reconnectUntil && p.reconnectUntil <= Date.now()) {
      leave(p); forgetResume(p);
    }
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
