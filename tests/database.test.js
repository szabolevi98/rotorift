import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { Database } from "../server/db/index.js";
import { loadCatalog } from "../server/catalog.js";
import {sanitizeGhost} from '../shared/race/ghost.js';
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
  const replay={version:1,sampleRate:20,frames:[[0,0,1,0,0,0,0,1],[11345,3,1,0,0,0,0,1]]};
  assert.equal(records.entries[0].hasGhost,0,'legacy laps retain their times without invented replay data');
  assert.equal(await reopened.saveLap(token,map,drone,'acro',11345,undefined,replay),true);
  const ghostEntry=(await reopened.leaderboard(map,drone,'acro')).entries[0];
  assert.equal(ghostEntry.hasGhost,1);assert.ok(ghostEntry.ghostId);assert.notEqual(ghostEntry.ghostId,token,'public ghost IDs must not expose the profile authentication token');
  assert.deepEqual((await reopened.ghost(map,drone,'acro',undefined,ghostEntry.ghostId)).replay,sanitizeGhost(replay));
  assert.equal(await reopened.ghost(map,drone,'angle',undefined,ghostEntry.ghostId),null);
  assert.equal(await reopened.ghost({...map,routeId:'race_2'},drone,'acro',undefined,ghostEntry.ghostId),null);
  assert.equal(await reopened.ghost(map,{...drone,configHash:'old'},'acro',undefined,ghostEntry.ghostId),null);
  assert.equal(await reopened.ghost(map,drone,'acro',{wind:'strong'},ghostEntry.ghostId),null);
  const slower={...replay,frames:[replay.frames[0],[13000,5,1,0,0,0,0,1]]};
  await reopened.saveLap(token,map,drone,'acro',13000,undefined,slower);
  assert.equal((await reopened.leaderboard(map,drone,'acro')).entries[0].ghostId,ghostEntry.ghostId,'slower laps never replace the selected personal-best ghost');
  const [slowerRows]=await reopened.pool.execute('SELECT ghost_data FROM laps WHERE duration_ms=13000');assert.equal(slowerRows[0].ghost_data,null);
  const otherRoute = { ...map, routeId: "race_2" };
  assert.equal(await reopened.saveLap(token, otherRoute, drone, "acro", 1000), true);
  assert.equal((await reopened.leaderboard(map,drone,"acro")).entries[0].ms,11345,"different race files must not share records");
  assert.equal((await reopened.leaderboard(otherRoute,drone,"acro")).entries[0].ms,1000);
  const windy = {battery:true,propDamage:true,ghost:false,wind:"strong"};
  assert.equal(await reopened.saveLap(token,map,drone,"acro",9000,windy),true);
  assert.equal((await reopened.leaderboard(map,drone,"acro")).entries[0].ms,11345,"wind/effect laps do not replace the normal category");
  assert.equal((await reopened.leaderboard(map,drone,"acro",windy)).entries[0].ms,9000);
  assert.equal((await reopened.leaderboard(map,drone,"acro",{...windy,wind:"light"})).entries.length,0);
  const publicIds=[];
  for(let i=0;i<11;i++){
    const rival=await reopened.profile(null,'Top 10 test '+i),ms=2000+i*1000;
    await reopened.saveLap(rival,map,drone,'horizon',ms,undefined,{...replay,frames:[replay.frames[0],[ms,3,1,0,0,0,0,1]]});
  }
  const top=await reopened.leaderboard(map,drone,'horizon');assert.equal(top.entries.length,11);
  assert.ok(await reopened.ghost(map,drone,'horizon',undefined,top.entries[9].ghostId));
  assert.equal(await reopened.ghost(map,drone,'horizon',undefined,top.entries[10].ghostId),null,'global selector is restricted to the actual top 10');
  const stable=top.entries[0],stableReplay={...replay,frames:[replay.frames[0],[1900,4,1,0,0,0,0,1]]};
  const [stablePlayer]=await reopened.pool.execute('SELECT player_id FROM laps WHERE id=?',[stable.recordId]);
  await reopened.saveLap(stablePlayer[0].player_id,map,drone,'horizon',1900,undefined,stableReplay);
  const updated=(await reopened.leaderboard(map,drone,'horizon')).entries[0];assert.equal(updated.ghostId,stable.ghostId);assert.notEqual(updated.recordId,stable.recordId);
  assert.equal((await reopened.ghost(map,drone,'horizon',undefined,stable.ghostId)).ms,1900,'selected pilot follows their improved record like Racing');
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
  await reopened.saveLap(token,map,drone,'angle',9000);
  const combined=await reopened.leaderboard(map,drone,'all');
  assert.equal(combined.entries.find(e=>e.ghostId===ghostEntry.ghostId).mode,'angle');
  assert.equal(combined.entries.find(e=>e.ghostId===ghostEntry.ghostId).ms,9000);
  assert.equal((await reopened.leaderboard(map,drone,'acro')).entries.find(e=>e.ghostId===ghostEntry.ghostId).ms,11345);
});
