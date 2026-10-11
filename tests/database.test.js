import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { Database } from "../server/db/index.js";
import { loadCatalog } from "../server/catalog.js";
test("MariaDB persists profiles and category records across reconnects without duplicate race results", async (t) => {
  const name = "rotorift_test_" + Date.now() + "_" + process.pid,
    previous = process.env.DB_NAME;
  process.env.DB_NAME = name;
  const db = new Database();
  let reopened;
  t.after(async () => {
    await db.pool?.end();
    await reopened?.pool?.end();
    if (!/^rotorift_test_\d+_\d+$/.test(name))
      throw Error("Unsafe test database name");
    if (db.available) {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
      });
      try {
        await connection.query("DROP DATABASE `" + name + "`");
      } finally {
        await connection.end();
      }
    }
    if (previous === undefined) delete process.env.DB_NAME;
    else process.env.DB_NAME = previous;
  });
  await db.init();
  if (!db.available) {
    t.skip("MariaDB is not available on this machine");
    return;
  }
  const { drones, maps } = await loadCatalog(),
    drone = drones[0],
    map = maps[0],
    token = await db.profile(null, "Persistence pilot");
  assert.equal(await db.saveLap(token, map, drone, "acro", 12456), true);
  assert.equal(await db.saveLap(token, map, drone, "acro", 11345), true);
  reopened = new Database();
  await reopened.init();
  assert.equal(
    await reopened.profile(token, "Renamed persistence pilot"),
    token,
  );
  const records = await reopened.leaderboard(map, drone, "acro");
  assert.equal(records.entries.length, 1);
  assert.equal(records.entries[0].ms, 11345);
  assert.equal(records.entries[0].name, "Renamed persistence pilot");
  assert.equal(
    (await reopened.leaderboard(map, drone, "angle")).entries.length,
    0,
  );
  assert.equal(
    (
      await reopened.leaderboard(
        map,
        { ...drone, configHash: "changed-version" },
        "acro",
      )
    ).entries.length,
    0,
  );
  const room = {
    raceId: randomUUID(),
    map,
    players: new Map([
      [
        "pilot",
        {
          name: "Pilot",
          lap: { completed: 3, bestMs: 11345 },
          finished: true,
          finishMs: 44000,
        },
      ],
    ]),
  };
  await reopened.saveResult(room);
  await reopened.saveResult(room);
  const [rows] = await reopened.pool.query("SELECT payload FROM results");
  assert.equal(rows.length, 1);
  assert.equal(JSON.parse(rows[0].payload)[0].finishMs, 44000);
});
