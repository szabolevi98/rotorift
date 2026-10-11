import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { attachRooms } from "../server/net/rooms.js";
import { loadCatalog } from "../server/catalog.js";
import { serveStatic } from "../server/static.js";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function fixture(t, mapOverrides = {}) {
  const catalog = await loadCatalog();
  catalog.maps = [
    {
      id: "test-route",
      routeVersion: 1,
      spawn: [0, 1, -0.5],
      gates: [
        { p: [0, 1, 0], n: [0, 0, 1], width: 2, height: 2 },
        { p: [0, 1, 2], n: [0, 0, -1], width: 2, height: 2 },
      ],
      ...mapOverrides,
    },
  ];
  const db = {
    available: true,
    laps: [],
    results: [],
    profile: async (token) => token || randomUUID(),
    saveLap: async function (...lap) {
      this.laps.push(lap);
      return true;
    },
    saveResult: async function (r) {
      this.results.push(
        [...r.players.values()].map((p) => ({
          finished: p.finished,
          finishMs: p.finishMs,
        })),
      );
      return true;
    },
  };
  const server = http.createServer();
  attachRooms(server, catalog, db);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const sockets = [];
  t.after(async () => {
    for (const ws of sockets) ws.terminate();
    await new Promise((resolve) => server.close(resolve));
  });
  async function client(name) {
    const ws = new WebSocket("ws://127.0.0.1:" + server.address().port + "/ws");
    sockets.push(ws);
    const messages = [];
    ws.on("message", (raw) => messages.push(JSON.parse(raw)));
    await once(ws, "open");
    const send = (type, data = {}) =>
      ws.send(JSON.stringify({ type, ...data }));
    async function next(predicate, timeout = 5000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        const i = messages.findIndex(predicate);
        if (i >= 0) return messages.splice(i, 1)[0];
        await delay(10);
      }
      throw Error(
        "Message timed out: " + messages.slice(-3).map((m) => m.type),
      );
    }
    send("hello", { name });
    const welcome = await next((m) => m.type === "welcome");
    let seq = 0;
    return {
      send,
      next,
      id: welcome.id,
      state: async (p, extra = {}) => {
        await delay(30);
        send("state", {
          seq: seq++,
          t: Date.now(),
          p,
          v: [0, 0, 0],
          q: { x: 0, y: 0, z: 0, w: 1 },
          configHash: catalog.drones.find((d) => d.id === "rift-x5").configHash,
          mode: "angle",
          ...extra,
        });
      },
    };
  }
  return { client, catalog, db };
}
test("two pilots share a room, host starts a race and both finish three verified laps", async (t) => {
  const { client, db } = await fixture(t),
    a = await client("Pilot A"),
    b = await client("Pilot B");
  a.send("create", {
    mapId: "test-route",
    droneId: "rift-x5",
    mode: "angle",
    kind: "race",
  });
  const created = await a.next((m) => m.type === "room");
  const code = created.room.code;
  b.send("join", { code });
  await b.next((m) => m.type === "room" && m.room.players.length === 2);
  await a.next((m) => m.type === "room" && m.room.players.length === 2);
  b.send("rename", { name: "Renamed pilot" });
  assert.equal(
    (
      await a.next(
        (m) =>
          m.type === "room" &&
          m.room.players.some((p) => p.name === "Renamed pilot"),
      )
    ).room.players.length,
    2,
  );
  a.send("start");
  assert.equal((await a.next((m) => m.type === "error")).code, "notReady");
  a.send("ready", { ready: true });
  b.send("ready", { ready: true });
  await a.next(
    (m) => m.type === "room" && m.room.players.every((p) => p.ready),
  );
  a.send("start");
  const start = await a.next(
    (m) => m.type === "room" && m.room.phase === "countdown",
  );
  assert.ok(start.room.startsAt > Date.now() + 2500);
  await a.next((m) => m.type === "room" && m.room.phase === "flying");
  async function finish(p) {
    await p.state([0, 1, -0.5]);
    await p.state([0, 1, 0.5]);
    for (let lap = 0; lap < 3; lap++) {
      for (const z of [2.5, 1.5, -0.5, 0.5]) await p.state([0, 1, z]);
      const result = await p.next((m) => m.type === "lap");
      assert.equal(result.valid, true);
      assert.equal(result.saved, true);
      assert.ok(result.ms > 0);
    }
  }
  await Promise.all([finish(a), finish(b)]);
  const end = await a.next(
    (m) => m.type === "room" && m.room.phase === "finished",
  );
  assert.ok(
    end.room.players.every(
      (p) => p.finished && p.lap.completed === 3 && p.finishMs > 0,
    ),
  );
  assert.equal(db.laps.length, 6);
  assert.equal(db.results.length, 1);
});
test("online validation rejects replay and config changes, invalidates interruption, and recovers from long packet gaps", async (t) => {
  const { client, db } = await fixture(t),
    p = await client("Validation pilot");
  p.send("create", {
    mapId: "test-route",
    droneId: "rift-x5",
    mode: "angle",
    kind: "hotlap",
  });
  await p.next((m) => m.type === "room");
  p.send("start");
  await p.next((m) => m.type === "room" && m.room.phase === "flying");
  await p.state([0, 1, -0.5]);
  await p.state([0, 1, 0.5]);
  await p.next(
    (m) => m.type === "room" && m.room.players[0].lap.startedAt !== null,
  );
  await p.state([0, 1, 1], { seq: 0 });
  const replay = await p.next(
    (m) => m.type === "room" && m.room.phase === "flying",
  );
  assert.ok(replay.room.players[0].p[2] !== 1);
  await p.state([0, 1, 1], { configHash: "incorrect" });
  await p.next((m) => m.type === "room" && m.room.players[0].lap.invalid);
  for (const z of [2.5, 1.5, -0.5, 0.5]) await p.state([0, 1, z]);
  const invalid = await p.next((m) => m.type === "lap");
  assert.equal(invalid.valid, false);
  assert.equal(db.laps.length, 0);
  await p.state([0, 1, 1], { interrupted: true });
  await p.next((m) => m.type === "room" && m.room.players[0].lap.invalid);
  await delay(2100);
  await p.state([0, 1, 1.2]);
  await p.next((m) => m.type === "room" && m.room.players[0].p[2] === 1.2);
  await p.state([0, 1, 1.4]);
  await p.next((m) => m.type === "room" && m.room.players[0].p[2] === 1.4);
  p.send("reset");
  const reset = await p.next((m) => m.type === "reset");
  assert.deepEqual(reset.pose.p, [0, 1, -0.5]);
  assert.equal(db.laps.length, 0);
});
test("online park boundary permits outside flight and returns an expired pilot to launch", async (t) => {
  const { client } = await fixture(t, { size: 40, boundary: { returnAfterSeconds: 0.25 } });
  const p = await client("Exploring pilot");
  p.send("create", { mapId: "test-route", droneId: "rift-x5", mode: "angle", kind: "free" });
  await p.next((m) => m.type === "room");
  p.send("ready", { ready: true });
  await p.next((m) => m.type === "room" && m.room.players[0].ready);
  p.send("start");
  await p.next((m) => m.type === "room" && m.room.phase === "flying");
  await p.state([25, 8, 0]);
  const outside = await p.next((m) => m.type === "room" && m.room.players[0].boundary?.outside);
  assert.equal(outside.room.players[0].p[0], 25);
  await p.state([25, 8, 0], { interrupted: true });
  await delay(350);
  await p.state([25, 8, 0], { interrupted: true });
  const paused = await p.next((m) => m.type === "room" && m.room.players[0].boundary?.outside && m.room.players[0].boundary.remainingSeconds > 0);
  assert.equal(paused.room.players[0].p[0], 25);
  await p.state([25, 8, 0]);
  await delay(300);
  await p.state([25, 8, 0]);
  const reset = await p.next((m) => m.type === "reset");
  assert.equal(reset.reason, "boundary");
  assert.deepEqual(reset.pose.p, [0, 1, -0.5]);
});

test("unfinished maps reject race and hotlap rooms while allowing online free flight", async (t) => {
  const { client } = await fixture(t, { racingEnabled: false, gates: [] });
  const p = await client("Free-flight pilot");
  for (const kind of ["race", "hotlap"]) {
    p.send("create", { mapId: "test-route", droneId: "rift-x5", mode: "angle", kind });
    const error = await p.next((m) => m.type === "error");
    assert.equal(error.code, "raceUnavailable");
  }
  p.send("create", { mapId: "test-route", droneId: "rift-x5", mode: "angle", kind: "free" });
  const room = await p.next((m) => m.type === "room");
  assert.equal(room.room.kind, "free");
});

test("static routes serve bundled runtime and do not expose workspace configuration", async (t) => {
  const server = http.createServer(async (req, res) => {
    if (!(await serveStatic(req, res, new URL(req.url, "http://localhost"))))
      res.writeHead(404).end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = "http://127.0.0.1:" + server.address().port;
  for (const url of [
    "/",
    "/shared/physics/drone.js",
    "/vendor/rapier/rapier.es.js",
    "/vendor/three/build/three.module.js",
    "/lang/hu.json",
  ]) {
    const response = await fetch(base + url);
    assert.equal(response.status, 200);
    await response.arrayBuffer();
  }
  for (const url of ["/.env", "/server/index.js", "/shared/%2e%2e%2f.env"]) {
    const response = await fetch(base + url);
    assert.ok([403, 404].includes(response.status));
    await response.text();
  }
});
