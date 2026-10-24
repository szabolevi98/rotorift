import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { attachRooms } from "../server/net/rooms.js";
import { loadCatalog } from "../server/catalog.js";
import { serveStatic } from "../server/static.js";
import { DRONE_COLORS } from "../shared/visual/drone-colors.js";
import { DEFAULT_SIMULATION, simulationKey } from "../shared/simulation/options.js";
import { aircraftSimulation } from "../shared/aircraft/capabilities.js";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function fixture(t, mapOverrides = {}, roomOptions = {}) {
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
  attachRooms(server, catalog, db, roomOptions);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const sockets = [];
  t.after(async () => {
    for (const ws of sockets) ws.terminate();
    await new Promise((resolve) => server.close(resolve));
  });
  async function client(name, color, hello = {}) {
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
    send("hello", { name, color, ...hello });
    const welcome = await next((m) => m.type === "welcome");
    let seq = 0;
    return {
      ws,
      send,
      next,
      id: welcome.id,
      welcome,
      state: async (p, extra = {}) => {
        await delay(30);
        const at = Date.now();
        send("state", {
          seq: seq++,
          t: at,
          p,
          v: [0, 0, 0],
          q: { x: 0, y: 0, z: 0, w: 1 },
          configHash: catalog.drones.find((d) => d.id === "rift-x5").configHash,
          mode: "angle",
          ...extra,
        });
        return at;
      },
    };
  }
  return { client, catalog, db };
}

test('spectators join a full eight-pilot race without a slot, readiness, collisions or result entries; reconnect and leave work',async t=>{
 const {client,db}=await fixture(t,{}, {countdownMs:5}),host=await client('Host','coral',{protocol:7});
 host.send('create',{mapId:'test-route',droneId:'rift-x5',mode:'angle',kind:'race'});
 const created=(await host.next(m=>m.type==='room')).room,pilots=[host];
 for(let i=1;i<8;i++){const p=await client('Pilot '+i,undefined,{protocol:7});p.send('join',{code:created.code});await p.next(m=>m.type==='room'&&m.room.players.length===i+1);pilots.push(p);}
 const watcher=await client('Observer',undefined,{protocol:7});watcher.send('spectate',{code:created.code});
 let watched=(await watcher.next(m=>m.type==='room'&&m.room.spectators.length===1)).room;
 assert.equal(watched.players.length,8);assert.equal(watched.spectators[0].id,watcher.id);assert.ok(watched.players.every(p=>p.id!==watcher.id));
 for(const p of pilots)p.send('ready',{ready:true});
 await host.next(m=>m.type==='room'&&m.room.players.every(p=>p.ready));host.send('start');
 watched=(await watcher.next(m=>m.type==='room'&&m.room.phase==='flying')).room;
 watcher.send('reset');watcher.send('finish');watcher.send('rules',{simulation:{airmode:false}});
 await watcher.state([0,1,0],{runId:watched.runId,rotorSpeeds:[1,1,1,1]});
 const unchanged=(await watcher.next(m=>m.type==='room'&&m.room.phase==='flying')).room;
 assert.equal(unchanged.simulation.airmode,true);assert.equal(unchanged.players.length,8);assert.equal(db.laps.length,0);
 const resume=watcher.welcome.resume;watcher.ws.terminate();
 await host.next(m=>m.type==='room'&&m.room.spectators.some(p=>!p.connected));
 const restored=await client('Observer',undefined,{protocol:7,resume});assert.equal(restored.welcome.resumed,true);
 watched=(await restored.next(m=>m.type==='room')).room;assert.equal(watched.spectators[0].id,watcher.id);
 host.send('finish');const finished=(await restored.next(m=>m.type==='room'&&m.room.phase==='finished')).room;
 assert.equal(finished.results.length,8);assert.ok(finished.results.every(p=>p.id!==watcher.id));
 restored.send('leave');await restored.next(m=>m.type==='left');
});

test('a flying host can switch to spectator, relinquishes control and receives the other pilot camera',async t=>{
 const {client}=await fixture(t,{}, {countdownMs:5}),host=await client('Host',undefined,{protocol:7}),guest=await client('Pilot',undefined,{protocol:7});
 host.send('create',{mapId:'test-route',droneId:'rift-x5',mode:'acro',kind:'free'});
 const created=(await host.next(m=>m.type==='room')).room;guest.send('join',{code:created.code});await guest.next(m=>m.type==='room');
 host.send('ready',{ready:true});guest.send('ready',{ready:true});await host.next(m=>m.type==='room'&&m.room.players.every(p=>p.ready));host.send('start');
 await host.next(m=>m.type==='room'&&m.room.phase==='flying');host.send('spectate',{code:created.code});
 const watched=(await host.next(m=>m.type==='room'&&m.room.spectators.length===1)).room;
 assert.equal(watched.players.length,1);assert.equal(watched.host,guest.id);assert.equal(watched.spectators[0].id,host.id);
 await guest.state([0,1,-.5],{mode:'acro',runId:watched.runId,camera:{angle:34,fov:110}});
 const camera=(await host.next(m=>m.type==='room'&&m.room.players[0].camera?.angle===34)).room.players[0].camera;
 assert.deepEqual(camera,{angle:34,fov:110});
 await guest.state([.1,1,-.5],{mode:'acro',runId:watched.runId,camera:{angle:NaN,fov:300}});
 guest.send('list');const after=(await host.next(m=>m.type==='room'&&m.room.players[0].camera?.angle===34)).room;
 assert.deepEqual(after.players[0].camera,camera);
});

test('spectators are released when the last pilot leaves, and legacy clients cannot join Air Mode-off rooms',async t=>{
 const {client}=await fixture(t),host=await client('New host',undefined,{protocol:7}),watcher=await client('Viewer',undefined,{protocol:7}),old=await client('Old client',undefined,{protocol:6});
 host.send('create',{mapId:'test-route',droneId:'rift-x5',mode:'acro',kind:'free',simulation:{airmode:false}});
 const created=(await host.next(m=>m.type==='room')).room;assert.equal(created.simulationKey,'00014');
 old.send('join',{code:created.code});assert.equal((await old.next(m=>m.type==='error')).code,'clientTooOld');
 watcher.send('spectate',{code:created.code});await watcher.next(m=>m.type==='room'&&m.room.spectators.length===1);
 host.send('leave');await host.next(m=>m.type==='left');await watcher.next(m=>m.type==='left');
 watcher.send('spectate',{code:created.code});assert.equal((await watcher.next(m=>m.type==='error')).code,'roomMissing');
});

test('Skyline supports shared freestyle rooms with its own district spawn and stable map ID',async t=>{
  const skyline=(await loadCatalog()).maps.find(m=>m.id==='skyline');
  const {client}=await fixture(t,skyline),host=await client('City host'),guest=await client('City guest');
  host.send('create',{mapId:'skyline',droneId:'rift-x35',mode:'acro',kind:'free'});
  const room=(await host.next(m=>m.type==='room')).room;
  assert.equal(room.mapId,'skyline');assert.equal(room.kind,'free');assert.deepEqual(room.players[0].p,skyline.spawn);
  guest.send('join',{code:room.code});
  const joined=(await guest.next(m=>m.type==='room'&&m.room.players.length===2)).room;
  assert.equal(joined.mapId,'skyline');
  const guestSpawn=joined.players.find(p=>p.id===guest.id).p;
  assert.deepEqual(guestSpawn.slice(1),skyline.spawn.slice(1));
  assert.ok(guestSpawn[0]>skyline.spawn[0]&&guestSpawn[0]<skyline.spawn[0]+5,'pilots get separate slots on the same clear avenue');
});

test('server sends interpolated checkpoint deltas against the best valid lap, retains them across reset, and omits split history from snapshots',async t=>{
  const {client}=await fixture(t),p=await client('Delta pilot');
  p.send('create',{mapId:'test-route',droneId:'rift-x5',mode:'angle',kind:'hotlap'});
  await p.next(m=>m.type==='room');p.send('start');await p.next(m=>m.type==='room'&&m.room.phase==='flying');
  const a=await p.state([0,1,-.5]),b=await p.state([0,1,.5]);
  const c=await p.state([0,1,2.5]),d=await p.state([0,1,1.5]);
  const first=(await p.next(m=>m.type==='room'&&m.room.players[0].lap.lastSplit?.at>=c)).room.players[0].lap;
  assert.equal(first.startedAt,(a+b)/2);assert.equal(first.lastSplit.ms,(c+d-a-b)/2);
  assert.equal(first.lastSplit.referenceMs,null);
  assert.equal('splits' in first,false);assert.equal('bestSplits' in first,false);
  await p.state([0,1,-.5]);await p.state([0,1,.5]);
  const completed=await p.next(m=>m.type==='lap');assert.equal(completed.valid,true);
  const e=await p.state([0,1,2.5]);await p.state([0,1,1.5]);
  const second=(await p.next(m=>m.type==='room'&&m.room.players[0].lap.lastSplit?.at>=e)).room.players[0].lap;
  assert.equal(second.lastSplit.referenceMs,first.lastSplit.ms);assert.equal(second.bestMs,completed.ms);
  p.send('reset');await p.next(m=>m.type==='reset');
  const reset=(await p.next(m=>m.type==='room'&&m.room.players[0].resetId>=3)).room.players[0].lap;
  assert.equal(reset.bestMs,completed.ms);assert.equal(reset.lastSplit,null);
  p.send('mode',{mode:'acro'});
  const changed=(await p.next(m=>m.type==='room'&&m.room.players[0].mode==='acro')).room.players[0].lap;
  assert.equal(changed.bestMs,null);assert.equal(changed.lastSplit,null);
});

test("X35 multiplayer rooms pin the new aircraft and accept its own config hash and motor speeds",async t=>{
  const {client,catalog}=await fixture(t),host=await client('X35 host'),guest=await client('X35 guest');
  const config=catalog.drones.find(d=>d.id==='rift-x35');
  host.send('create',{mapId:'test-route',droneId:config.id,mode:'angle',kind:'free'});
  const created=(await host.next(m=>m.type==='room')).room;assert.equal(created.droneId,'rift-x35');
  guest.send('join',{code:created.code});const joined=(await guest.next(m=>m.type==='room'&&m.room.players.length===2)).room;assert.equal(joined.droneId,'rift-x35');
  host.send('ready',{ready:true});guest.send('ready',{ready:true});await host.next(m=>m.type==='room'&&m.room.players.every(p=>p.ready));
  host.send('start');await guest.next(m=>m.type==='room'&&m.room.phase==='flying');
  const rotorSpeeds=[.3,.4,.5,.6];await guest.state([.6,1,-.5],{configHash:config.configHash,rotorSpeeds});
  const received=await host.next(m=>m.type==='room'&&m.room.players.find(p=>p.id===guest.id)?.rotorSpeeds?.[0]===.3);
  assert.deepEqual(received.room.players.find(p=>p.id===guest.id).rotorSpeeds,rotorSpeeds);
});

test("a room pins the selected race file, gate order and start position for every pilot", async t => {
  const gates=[{p:[12,2,4],n:[0,0,-1],width:5,height:4},{p:[20,2,4],n:[1,0,0],width:5,height:4}];
  const routes=[{id:"race_1",name:"First race",version:1,spawn:[0,1,-.5],gates},
      {id:"race_2",name:"Second race",version:3,spawn:[12,1,8],gates:[...gates].reverse(),guide:[[gates[1].p,[20,4,8],gates[0].p],[gates[0].p,gates[1].p]]}];
  const {client,catalog}=await fixture(t,{routeId:"race_1",routes});
  const host=await client("Route host"),guest=await client("Route guest");
  host.send("create",{mapId:"test-route",routeId:"race_2",droneId:"rift-x5",mode:"angle",kind:"race"});
  const created=(await host.next(m=>m.type==="room")).room;
  assert.equal(created.routeId,"race_2");assert.equal(created.route.version,3);
  assert.deepEqual(created.route.gates,routes[1].gates);assert.deepEqual(created.players[0].p,[12,1,8]);
  assert.equal(catalog.maps[0].routeId,"race_1","room selection must not mutate the map catalog");
  guest.send("join",{code:created.code});
  const joined=(await guest.next(m=>m.type==="room")).room;
    assert.deepEqual(created.route.guide,routes[1].guide,'all pilots receive the same saved guide');
  assert.deepEqual(joined.route,created.route);assert.equal(joined.players.length,2);
  catalog.maps[0]={...catalog.maps[0],routes:[{...routes[1],version:99,gates:[]}]};
  host.send("ready",{ready:true});
  const pinned=(await host.next(m=>m.type==="room"&&m.room.players.length===2&&m.room.players[0].ready)).room;
  assert.equal(pinned.route.version,3);assert.deepEqual(pinned.route.gates,routes[1].gates);
});
test("freestyle rooms need no race route and use the base map spawn for all pilots", async t => {
  const { client, catalog } = await fixture(t, {
    baseSpawn: [30, 1, 40], routeId: "race_1", routeName: "Old course",
    routes: [{ id: "race_1", name: "Old course", version: 1, spawn: [0, 1, -.5], gates: [] }],
  });
  const original = structuredClone(catalog.maps[0]);
  const host = await client("Freestyle host"), guest = await client("Freestyle guest");
  host.send("create", { mapId: "test-route", routeId: "", droneId: "rift-x5", mode: "acro", kind: "free" });
  const created = (await host.next(m => m.type === "room")).room;
  assert.equal(created.route, null);
  assert.equal(created.routeId, null);
  assert.deepEqual(created.players[0].p, [30, 1, 40]);
  guest.send("join", { code: created.code });
  const joined = (await guest.next(m => m.type === "room")).room;
  assert.equal(joined.route, null);
  assert.deepEqual(joined.players[1].p, [30.6, 1, 40], "guest uses the next launch slot at the base spawn");
  assert.deepEqual(catalog.maps[0], original, "race geometry and records stay in the catalog");
});

test("multiplayer admits eight pilot colors, rejects a ninth pilot and frees a slot on leave", async t => {
  const { client } = await fixture(t);
  const colors = Object.keys(DRONE_COLORS);
  assert.equal(colors.length, 8);
  const pilots = [];
  for (const color of colors) pilots.push(await client(`${color} pilot`, color));
  const host = pilots[0];
  host.send("create", { mapId: "test-route", droneId: "rift-x5", mode: "acro", kind: "free" });
  const { room } = await host.next(m => m.type === "room");
  for (const [index, pilot] of pilots.slice(1).entries()) {
    pilot.send("join", { code: room.code });
    await pilot.next(m => m.type === "room" && m.room.players.length === index + 2);
  }
  const full = await host.next(m => m.type === "room" && m.room.players.length === 8);
  assert.deepEqual(full.room.players.map(p => p.color), colors);
  const ninth = await client("Ninth pilot", "blue");
  ninth.send("join", { code: room.code });
  assert.equal((await ninth.next(m => m.type === "error")).code, "roomFull");
  pilots[7].send("leave");
  await host.next(m => m.type === "room" && m.room.players.length === 7);
  ninth.send("join", { code: room.code });
  const refilled = await ninth.next(m => m.type === "room" && m.room.players.length === 8);
  assert.ok(refilled.room.players.some(p => p.id === ninth.id && p.color === colors[7]));
  assert.equal(new Set(refilled.room.players.map(p=>p.color)).size,8);
});

test("only the host changes common simulation rules, clears readiness and transfers ownership on leave", async t => {
  const {client}=await fixture(t),a=await client("Host"),b=await client("Guest");
  a.send("create",{mapId:"test-route",droneId:"rift-x5",mode:"angle",kind:"free"});
  const created=await a.next(m=>m.type==="room");
  assert.deepEqual(created.room.simulation,DEFAULT_SIMULATION);
  b.send("join",{code:created.room.code});await b.next(m=>m.type==="room"&&m.room.players.length===2);
  a.send("ready",{ready:true});b.send("ready",{ready:true});await a.next(m=>m.type==="room"&&m.room.players.every(p=>p.ready));
  b.send("rules",{simulation:{battery:true,wind:"strong"}});
  assert.equal((await b.next(m=>m.type==="error")).code,"hostOnly");
  a.send("rules",{simulation:{wind:"tornado"}});
  assert.equal((await a.next(m=>m.type==="error")).code,"invalidSimulation");
  const options={...DEFAULT_SIMULATION,battery:true,propDamage:true,propwash:true,ghost:false,wind:"medium"};
  a.send("rules",{simulation:options});
  const changed=await b.next(m=>m.type==="room"&&m.room.simulation.wind==="medium");
  assert.deepEqual(changed.room.simulation,options);assert.ok(changed.room.players.every(p=>!p.ready));
  const c=await client("Late guest");c.send("join",{code:created.room.code});
  assert.deepEqual((await c.next(m=>m.type==="room")).room.simulation,options);
  a.send("leave");await b.next(m=>m.type==="room"&&m.room.host===b.id);
  b.send("rules",{simulation:{wind:"light"}});
  const transferred=await c.next(m=>m.type==="room"&&m.room.simulation.wind==="light");
  assert.equal(transferred.room.host,b.id);
});

test("in-game modes are personal, room rules lock at start and mismatched private settings cannot submit poses", async t => {
  const {client}=await fixture(t),a=await client("Host"),b=await client("Guest");
  const options={battery:true,ghost:false,wind:"strong"};
  a.send("create",{mapId:"test-route",droneId:"rift-x5",mode:"angle",kind:"free",simulation:options});
  const created=await a.next(m=>m.type==="room");b.send("join",{code:created.room.code});
  await b.next(m=>m.type==="room"&&m.room.players.length===2);
  a.send("ready",{ready:true});b.send("ready",{ready:true});await a.next(m=>m.type==="room"&&m.room.players.every(p=>p.ready));
  a.send("start");await a.next(m=>m.type==="room"&&m.room.phase==="flying");
  a.send("rules",{simulation:{wind:"calm"}});assert.equal((await a.next(m=>m.type==="error")).code,"rulesLocked");
  b.send("mode",{mode:"horizon"});
  const changed=await a.next(m=>m.type==="room"&&m.room.players.find(p=>p.id===b.id)?.mode==="horizon");
  assert.equal(changed.room.players.find(p=>p.id===a.id).mode,"angle");
  assert.ok(changed.room.players.find(p=>p.id===b.id).lap.invalid);
  await b.state([0.7,1,-0.5],{mode:"horizon",simulationKey:simulationKey(options)});
  await a.next(m=>m.type==="room"&&m.room.players.find(p=>p.id===b.id)?.p[0]===0.7);
  const rejectedAt = Date.now();
  await b.state([0.8,1,-0.5],{mode:"horizon",simulationKey:simulationKey(DEFAULT_SIMULATION)});
  const ignored=await a.next(m=>m.type==="room"&&m.now>=rejectedAt+35&&m.room.players.find(p=>p.id===b.id)?.lap.invalid);
  assert.equal(ignored.room.players.find(p=>p.id===b.id).p[0],0.7);
  b.send("reset");const reset=await b.next(m=>m.type==="reset");assert.ok(reset.pose);
  assert.equal((await a.next(m=>m.type==="room"&&m.room.players.find(p=>p.id===b.id)?.resetId>changed.room.players.find(p=>p.id===b.id).resetId)).room.players.find(p=>p.id===b.id).mode,"horizon");
});

test("multiplayer replicates validated pilot colors and reset epochs without changing aircraft physics", async t => {
  const {client,catalog}=await fixture(t),a=await client("Teal pilot","teal"),b=await client("Violet pilot","violet");
  const hash=catalog.drones.find(d=>d.id==="rift-x5").configHash;
  a.send("create",{mapId:"test-route",droneId:"rift-x5",mode:"angle",kind:"free"});
  const created=await a.next(m=>m.type==="room");b.send("join",{code:created.room.code});
  const joined=await a.next(m=>m.type==="room"&&m.room.players.length===2);
  assert.equal(joined.room.players.find(p=>p.id===a.id).color,"teal");
  assert.equal(joined.room.players.find(p=>p.id===b.id).color,"violet");
  b.send("appearance",{color:"yellow"});
  const changed=await a.next(m=>m.type==="room"&&m.room.players.find(p=>p.id===b.id)?.color==="yellow");
  const epoch=changed.room.players.find(p=>p.id===b.id).resetId;
  b.send("appearance",{color:"#00ff00"});assert.equal((await b.next(m=>m.type==="error")).code,"invalidColor");
  b.send("appearance",{color:"__proto__"});assert.equal((await b.next(m=>m.type==="error")).code,"invalidColor");
  a.send("ready",{ready:true});b.send("ready",{ready:true});
  await a.next(m=>m.type==="room"&&m.room.players.every(p=>p.ready));a.send("start");
  const flying=await a.next(m=>m.type==="room"&&m.room.phase==="flying");
  assert.equal(flying.room.players.find(p=>p.id===b.id).color,"yellow");
  assert.ok(flying.room.players.find(p=>p.id===b.id).resetId>epoch);
  b.send("appearance",{color:"coral"});
  await a.next(m=>m.type==="room"&&m.room.players.find(p=>p.id===b.id)?.color==="coral");
  const before=flying.room.players.find(p=>p.id===b.id).resetId;b.send("reset");
  const reset=await a.next(m=>m.type==="room"&&m.room.players.find(p=>p.id===b.id)?.resetId>before);
  assert.equal(reset.room.players.find(p=>p.id===b.id).color,"coral");assert.equal(catalog.drones.find(d=>d.id==="rift-x5").configHash,hash);
  const c=await client("Legacy pilot","invalid");c.send("join",{code:created.room.code});
  // A flying room cannot be joined, but the already connected legacy/default
  // color remains usable when creating another lobby.
  c.send("create",{mapId:"test-route",droneId:"rift-x5",mode:"angle",kind:"free"});
  const legacy=await c.next(m=>m.type==="room");assert.equal(legacy.room.players[0].color,"coral");
});
test("multiplayer shares four discrete propeller states, rejects malformed blades and reset repairs them",async t=>{
  const {client}=await fixture(t),host=await client('Prop host'),guest=await client('Prop guest'),options={propDamage:true};
  host.send('create',{mapId:'test-route',droneId:'rift-x5',mode:'angle',kind:'free',simulation:options});
  const room=(await host.next(m=>m.type==='room')).room;guest.send('join',{code:room.code});
  await host.next(m=>m.type==='room'&&m.room.players.length===2);
  host.send('ready',{ready:true});guest.send('ready',{ready:true});await host.next(m=>m.type==='room'&&m.room.players.every(p=>p.ready));
  host.send('start');await guest.next(m=>m.type==='room'&&m.room.phase==='flying');
  const propellers=[[3,3,3],[1,0,0],[0,2,0],[0,0,0]];
  await guest.state([.6,1,-.5],{simulationKey:simulationKey(options),propellers});
  const damaged=await host.next(m=>m.type==='room'&&m.room.players.find(p=>p.id===guest.id)?.propellers?.[0]?.[0]===3);
  assert.deepEqual(damaged.room.players.find(p=>p.id===guest.id).propellers,propellers);
  const invalidAt=Date.now();await guest.state([.7,1,-.5],{simulationKey:simulationKey(options),propellers:[[99,0,0],[0,0,0],[0,0,0],[0,0,0]]});
  const ignored=await host.next(m=>m.type==='room'&&m.now>invalidAt+40);
  assert.deepEqual(ignored.room.players.find(p=>p.id===guest.id).propellers,propellers);
  guest.send('reset');
  const repaired=await host.next(m=>m.type==='room'&&m.room.players.find(p=>p.id===guest.id)?.resetId>damaged.room.players.find(p=>p.id===guest.id).resetId);
  assert.deepEqual(repaired.room.players.find(p=>p.id===guest.id).propellers,Array.from({length:4},()=>[0,0,0]));
});
test("remote rotor speeds reach the other pilot and stop for pause, stale state, legacy state, reset and disconnect",async t=>{
  const {client}=await fixture(t),host=await client('Rotor host'),guest=await client('Rotor guest');
  const stopped=[0,0,0,0],speeds=[.25,.5,.75,1];
  const pilot=m=>m.room?.players.find(p=>p.id===guest.id);
  host.send('create',{mapId:'test-route',droneId:'rift-x5',mode:'angle',kind:'free'});
  const created=(await host.next(m=>m.type==='room')).room;
  assert.deepEqual(created.players[0].rotorSpeeds,stopped);
  assert.equal(created.players[0].turtleMode,false);
  guest.send('join',{code:created.code});await host.next(m=>m.type==='room'&&m.room.players.length===2);
  host.send('ready',{ready:true});guest.send('ready',{ready:true});await host.next(m=>m.type==='room'&&m.room.players.every(p=>p.ready));
  host.send('start');await guest.next(m=>m.type==='room'&&m.room.phase==='flying');
  const receiveAt=async (x,speed)=>host.next(m=>pilot(m)?.p[0]===x&&pilot(m)?.rotorSpeeds?.every((v,i)=>v===speed[i]));
  await guest.state([.6,1,-.5],{rotorSpeeds:speeds,turtleMode:true});
  assert.equal(pilot(await receiveAt(.6,speeds)).turtleMode,true);
  const malformedAt=Date.now();await guest.state([.65,1,-.5],{rotorSpeeds:speeds,turtleMode:'true'});
  const malformed=await host.next(m=>m.type==='room'&&m.now>malformedAt+50);
  assert.equal(pilot(malformed).p[0],.6,'non-boolean turtle state rejects the whole update');
  const badAt=Date.now();await guest.state([.7,1,-.5],{rotorSpeeds:[0,2,0,0]});
  const rejected=await host.next(m=>m.type==='room'&&m.now>badAt+50);
  assert.equal(pilot(rejected).p[0],.6,'invalid motor data must reject the entire state');
  await guest.state([.8,1,-.5],{rotorSpeeds:stopped});await receiveAt(.8,stopped);
  await guest.state([.9,1,-.5],{rotorSpeeds:speeds,interrupted:true,turtleMode:true});
  assert.equal(pilot(await receiveAt(.9,stopped)).turtleMode,false);
  await guest.state([1,1,-.5],{rotorSpeeds:speeds});await receiveAt(1,speeds);
  await guest.state([1.1,1,-.5]);await receiveAt(1.1,stopped);
  await guest.state([1.2,1,-.5],{rotorSpeeds:speeds,turtleMode:true});
  const moving=await receiveAt(1.2,speeds);
  const stale=await host.next(m=>m.type==='room'&&m.now>moving.now+650);
  assert.deepEqual(pilot(stale).rotorSpeeds,stopped,'missing motor updates cannot leave a parked drone spinning');
  assert.equal(pilot(stale).turtleMode,false);
  await guest.state([1.3,1,-.5],{rotorSpeeds:speeds,turtleMode:true});const fresh=await receiveAt(1.3,speeds);
  guest.send('reset');const reset=await host.next(m=>pilot(m)?.resetId>pilot(fresh).resetId);
  assert.deepEqual(pilot(reset).rotorSpeeds,stopped);
  assert.equal(pilot(reset).turtleMode,false);
  await guest.state([.6,1,-.5],{rotorSpeeds:speeds});await receiveAt(.6,speeds);
  guest.ws.close();const gone=await host.next(m=>pilot(m)?.connected===false);
  assert.deepEqual(pilot(gone).rotorSpeeds,stopped);
});

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
      if(lap===0)assert.ok(result.replay?.frames.length>=2,'first verified lap must provide the pilot with its server-recorded ghost');
      if(result.replay){assert.equal(result.replay.frames[0][0],0);assert.ok(Math.abs(result.replay.frames.at(-1)[0]-result.ms)<=2);}
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
  assert.equal(invalid.replay,null,'interrupted laps cannot produce ghosts');
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

test('eight pilots receive unique colors, occupied colors are rejected and leaving frees a color',async t=>{
 const {client}=await fixture(t),pilots=[];
 for(let i=0;i<8;i++)pilots.push(await client('Color '+i,'coral'));
 const host=pilots[0];host.send('create',{mapId:'test-route',droneId:'rift-x5',mode:'acro',kind:'free'});
 const created=await host.next(m=>m.type==='room');
 for(let i=1;i<8;i++){pilots[i].send('join',{code:created.room.code});await host.next(m=>m.type==='room'&&m.room.players.length===i+1);}
 const snapshot=await host.next(m=>m.type==='room'&&m.room.players.length===8);
 assert.equal(new Set(snapshot.room.players.map(p=>p.color)).size,8);
 const guest=pilots[1];guest.send('appearance',{color:'coral'});assert.equal((await guest.next(m=>m.type==='error')).code,'colorTaken');
 host.send('leave');await guest.next(m=>m.type==='room'&&m.room.players.length===7);
 guest.send('appearance',{color:'coral'});await guest.next(m=>m.type==='room'&&m.room.players.find(p=>p.id===guest.id)?.color==='coral');
});

test('older clients must refresh for airplane rooms while quad multiplayer remains available',async t=>{
const {client}=await fixture(t),pilot=await client('Trainer pilot');
pilot.send('create',{mapId:'test-route',droneId:'rift-t15',mode:'manual',kind:'free'});
assert.equal((await pilot.next(m=>m.type==='error')).code,'clientTooOld');
pilot.send('create',{mapId:'test-route',droneId:'rift-x5',mode:'acro',kind:'free'});
assert.equal((await pilot.next(m=>m.type==='room')).room.droneId,'rift-x5');
});

test('eight trainer pilots synchronize typed animations, reconnect to their slot and restart with safe spacing',async t=>{
  const {client,catalog}=await fixture(t,{kind:'park',size:700,aircraftKinds:['fixedWing']},{countdownMs:20});
  const pilots=[];for(let i=0;i<8;i++)pilots.push(await client('Wing '+i,'coral',{protocol:3}));
  const host=pilots[0];host.send('create',{mapId:'test-route',droneId:'rift-t15',mode:'manual',kind:'free',launchMethod:'ground',simulation:{...DEFAULT_SIMULATION,propDamage:true,propwash:true,ghost:false}});
  const created=(await host.next(m=>m.type==='room')).room;
  assert.equal(created.aircraftKind,'fixedWing');assert.equal(created.simulation.propDamage,true);assert.equal(created.simulation.propwash,true);assert.equal(created.simulation.ghost,false);
  for(let i=1;i<8;i++){pilots[i].send('join',{code:created.code});await pilots[i].next(m=>m.type==='room'&&m.room.players.length===i+1);}
  const joined=(await pilots[7].next(m=>m.type==='room'&&m.room.players.length===8)).room;
  assert.equal(new Set(joined.players.map(p=>p.color)).size,8);
  for(let i=0;i<8;i++)for(let j=i+1;j<8;j++)assert.ok(Math.hypot(...joined.players[i].p.map((v,k)=>v-joined.players[j].p[k]))>1.5);
  for(const pilot of pilots)pilot.send('ready',{ready:true});
  await host.next(m=>m.type==='room'&&m.room.players.length===8&&m.room.players.every(p=>p.ready));host.send('start');
  const flying=(await host.next(m=>m.type==='room'&&m.room.phase==='flying')).room;
  const config=catalog.airplanes.find(c=>c.id==='rift-t15'),animation={kind:'fixedWing',engine:.6,surfaces:{pitch:-.3,roll:.2,yaw:.1},propeller:[2,3]},opts={runId:flying.runId,configHash:config.configHash,mode:'manual',simulationKey:simulationKey(flying.simulation),animation};
  for(let i=0;i<8;i++)await pilots[i].state(flying.players[i].p,opts);
  const active=(await host.next(m=>m.type==='room'&&m.room.players.every(p=>p.animation?.engine===.6))).room;
  for(const p of active.players){assert.deepEqual(p.animation,animation);for(const key of ['propellers','rotorSpeeds','turtleMode'])assert.equal(key in p,false);}
  await pilots[2].state([1,50,1],{...opts,animation:{...animation,propeller:[4,0]}});
  const rejected=(await host.next(m=>m.type==='room'&&m.room.players.every(p=>p.animation?.engine===.6))).room;
  assert.deepEqual(rejected.players.find(p=>p.id===pilots[2].id).animation.propeller,[2,3]);
  await pilots[2].state([1,50,1],{...opts,animation:{...animation,engine:9}});
  await pilots[2].state([2,50,1],{...opts,propellers:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]]});
  const old=pilots[2];old.ws.terminate();
  const stopped=(await host.next(m=>m.type==='room'&&m.room.players.find(p=>p.id===old.id)?.connected===false)).room.players.find(p=>p.id===old.id);
  assert.equal(stopped.animation.engine,0);
  assert.deepEqual(stopped.animation.propeller,[2,3],'disconnect stops the engine without repairing damage');
  const resumed=await client('Restored','blue',{protocol:3,resume:old.welcome.resume});
  assert.equal(resumed.id,old.id);assert.equal(resumed.welcome.resumed,true);
  const recovered=(await resumed.next(m=>m.type==='room')).room,own=recovered.players.find(p=>p.id===old.id);
  assert.equal(own.animation.engine,0);assert.equal(own.animation.propeller,undefined,'spawn reset repairs prop');assert.deepEqual(own.p,joined.players[2].p);assert.ok(own.resetId>joined.players[2].resetId);
  host.send('restart');const lobby=(await host.next(m=>m.type==='room'&&m.room.phase==='lobby'&&m.room.players.length===8&&m.room.players.find(p=>p.id===old.id)?.resetId>own.resetId&&m.room.runId!==flying.runId)).room;
  assert.equal(lobby.players.length,8);assert.ok(lobby.players.every(p=>p.animation.engine===0&&!p.ready));
});

test('manual airplane hotlaps save a pose ghost and rejects incompatible drone categories',async t=>{
  const {client,catalog,db}=await fixture(t,{kind:'park',size:700,aircraftKinds:['fixedWing']},{countdownMs:20}),p=await client('Wing racer','coral',{protocol:3});
  p.send('create',{mapId:'test-route',droneId:'rift-x5',mode:'acro',kind:'hotlap'});assert.equal((await p.next(m=>m.type==='error')).code,'incompatibleRoute');
  p.send('create',{mapId:'test-route',droneId:'rift-t15',mode:'manual',kind:'hotlap'});await p.next(m=>m.type==='room');p.send('start');
  const room=(await p.next(m=>m.type==='room'&&m.room.phase==='flying')).room;
  const opts={runId:room.runId,configHash:catalog.airplanes.find(c=>c.id==='rift-t15').configHash,mode:'manual',simulationKey:simulationKey(room.simulation),animation:{kind:'fixedWing',engine:.4,surfaces:{pitch:0,roll:0,yaw:0}}};
  for(const point of [[0,1,-.5],[0,1,.5],[0,1,2.5],[0,1,1.5],[0,1,-.5],[0,1,.5]])await p.state(point,opts);
  const lap=await p.next(m=>m.type==='lap');assert.equal(lap.valid,true);assert.equal(lap.saved,true);assert.ok(lap.replay.frames.length>=3);
  assert.equal(db.laps[0][2].id,'rift-t15');assert.equal(db.laps[0][3],'manual');assert.ok(db.laps[0][6].frames.length>=3);
});


for(const aircraftId of ['rift-s75','rift-a40'])test(aircraftId+' stabilized hotlaps store their own mode and live switching invalidates the active lap',async t=>{
  const {client,catalog,db}=await fixture(t,{kind:'park',size:700,aircraftKinds:['fixedWing']},{countdownMs:20});
  const p=await client('Stabilized pilot','teal',{protocol:4});
  p.send('create',{mapId:'test-route',droneId:aircraftId,mode:'stabilized',kind:'hotlap'});
  const created=(await p.next(m=>m.type==='room')).room;assert.equal(created.mode,'stabilized');p.send('start');
  const room=(await p.next(m=>m.type==='room'&&m.room.phase==='flying')).room;
  const config=catalog.airplanes.find(c=>c.id===aircraftId);
  const opts={runId:room.runId,configHash:config.configHash,mode:'stabilized',simulationKey:simulationKey(room.simulation),animation:{kind:'fixedWing',engine:.4,surfaces:{pitch:.1,roll:-.1,yaw:0}}};
  for(const point of [[0,1,-.5],[0,1,.5],[0,1,2.5],[0,1,1.5],[0,1,-.5],[0,1,.5]]){await delay(35);await p.state(point,opts);}
  const lap=await p.next(m=>m.type==='lap');assert.equal(lap.valid,true);assert.equal(lap.saved,true);
  assert.equal(db.laps[0][2].id,aircraftId);assert.equal(db.laps[0][3],'stabilized');assert.ok(db.laps[0][6].frames.length>=3);
  p.send('mode',{mode:'manual'});
  const switched=(await p.next(m=>m.type==='room'&&m.room.players[0].mode==='manual')).room.players[0];assert.equal(switched.lap.invalid,true);
  p.send('mode',{mode:'stabilized'});await p.next(m=>m.type==='room'&&m.room.players[0].mode==='stabilized');
});

test('mixed free flight supports eight personal aircraft, typed states, late join, reconnect and restart', async t => {
  const {client,catalog}=await fixture(t,{kind:'park',size:700},{countdownMs:20});
  const configs=['rift-x5','rift-t15','rift-65','rift-r5','rift-c3','rift-x35','rift-s75','rift-a40'].map(id=>[...catalog.drones,...catalog.airplanes].find(c=>c.id===id));
  const pilots=[];
  for(let i=0;i<8;i++)pilots.push(await client('Mixed '+i,'coral',{protocol:4}));
  const host=pilots[0],old=await client('Old client','blue',{protocol:3});
  host.send('create',{mapId:'test-route',kind:'free',droneId:configs[0].id,mode:'acro',simulation:{...DEFAULT_SIMULATION,propDamage:true,propwash:true,ghost:false}});
  const created=(await host.next(m=>m.type==='room')).room;
  assert.equal(created.mixedAircraft,true);
  old.send('join',{code:created.code});assert.equal((await old.next(m=>m.type==='error')).code,'clientTooOld');
  old.send('list');assert.equal((await old.next(m=>m.type==='rooms')).rooms.length,0);
  // Leave the last pilot out until the shared flight has started.
  for(let i=1;i<7;i++){
    pilots[i].send('join',{code:created.code,droneId:configs[i].id,mode:configs[i].kind==='fixedWing'?'manual':'angle',launchMethod:i===1?'ground':'air'});
    await pilots[i].next(m=>m.type==='room'&&m.room.players.length===i+1);
  }
  pilots[2].send('aircraft',{droneId:'missing',mode:'acro'});assert.equal((await pilots[2].next(m=>m.type==='error')).code,'invalidAircraft');
  // Changing aircraft clears only this pilot's readiness, uses its own mode,
  // animation union and launch pose, then changes back to a tinywhoop.
  pilots[2].send('ready',{ready:true});
  await pilots[2].next(m=>m.type==='room'&&m.room.players.find(p=>p.id===pilots[2].id)?.ready);
  pilots[2].send('aircraft',{droneId:catalog.airplanes.find(c=>c.id==='rift-t15').id,mode:'manual',launchMethod:'air'});
  const changed=(await pilots[2].next(m=>m.type==='room'&&m.room.players.find(p=>p.id===pilots[2].id)?.droneId==='rift-t15')).room.players.find(p=>p.id===pilots[2].id);
  assert.equal(changed.ready,false);assert.equal(changed.p[1],65);assert.ok(changed.animation);assert.equal('propellers' in changed,false);
  pilots[2].send('aircraft',{droneId:configs[2].id,mode:'angle'});
  await pilots[2].next(m=>m.type==='room'&&m.room.players.find(p=>p.id===pilots[2].id)?.droneId===configs[2].id);
  for(const p of pilots.slice(0,7))p.send('ready',{ready:true});
  await host.next(m=>m.type==='room'&&m.room.players.length===7&&m.room.players.every(p=>p.ready));host.send('start');
  const first=(await host.next(m=>m.type==='room'&&m.room.phase==='flying')).room;
  pilots[7].send('list');assert.equal((await pilots[7].next(m=>m.type==='rooms')).rooms[0].mixedAircraft,true);
  pilots[7].send('join',{code:created.code,droneId:configs[7].id,mode:configs[7].kind==='fixedWing'?'manual':'angle'});
  const flying=(await pilots[7].next(m=>m.type==='room'&&m.room.players.length===8)).room;
  assert.equal(flying.phase,'flying');assert.equal(flying.runId,first.runId);
  assert.equal(new Set(flying.players.map(p=>p.color)).size,8);
  const animation={kind:'fixedWing',engine:.65,surfaces:{pitch:.2,roll:-.3,yaw:.1}};
  for(let i=0;i<8;i++){
    const own=flying.players.find(p=>p.id===pilots[i].id),c=configs[i];
    assert.equal(own.droneId,c.id);assert.equal(own.mode,i===0?'acro':c.kind==='fixedWing'?'manual':'angle');
    await pilots[i].state(own.p,{runId:flying.runId,mode:own.mode,configHash:c.configHash,simulationKey:simulationKey(aircraftSimulation(c,flying.simulation)),...(c.kind==='fixedWing'?{animation}:{rotorSpeeds:[.2,.3,.4,.5],propellers:[[1,0,0],[0,0,0],[0,0,0],[0,0,0]]})});
  }
  const active=(await host.next(m=>m.type==='room'&&m.room.players.every(p=>p.aircraftKind==='fixedWing'?p.animation?.engine===.65:p.rotorSpeeds?.[0]===.2))).room;
  for(const p of active.players){if(p.aircraftKind==='fixedWing'){assert.deepEqual(p.animation,animation);assert.equal('rotorSpeeds' in p,false);}else{assert.equal(p.propellers[0][0],1);assert.equal('animation' in p,false);}}
  const wing=active.players.find(p=>p.id===pilots[1].id),badPosition=[...wing.p];badPosition[1]+=.1;
  await pilots[1].state(badPosition,{runId:active.runId,mode:'manual',configHash:configs[0].configHash,simulationKey:simulationKey(aircraftSimulation(configs[1],active.simulation)),animation});
  const rejected=(await host.next(m=>m.type==='room'&&m.room.players.find(p=>p.id===wing.id)?.lap.invalid)).room.players.find(p=>p.id===wing.id);
  assert.deepEqual(rejected.p,wing.p,'the host aircraft hash cannot impersonate a plane');
  pilots[1].send('aircraft',{droneId:configs[0].id,mode:'acro'});assert.equal((await pilots[1].next(m=>m.type==='error')).code,'aircraftLocked');
  pilots[1].ws.terminate();await host.next(m=>m.type==='room'&&m.room.players.find(p=>p.id===wing.id)?.connected===false);
  const resumed=await client('Restored plane','blue',{protocol:4,resume:pilots[1].welcome.resume});
  assert.equal(resumed.id,wing.id);
  const recovered=(await resumed.next(m=>m.type==='room')).room.players.find(p=>p.id===wing.id);
  assert.equal(recovered.droneId,'rift-t15');assert.equal(recovered.mode,'manual');assert.equal(recovered.launchMethod,'ground');assert.deepEqual(recovered.p,wing.p);
  host.send('restart');
  const lobby=(await host.next(m=>m.type==='room'&&m.room.phase==='lobby'&&m.room.players.length===8&&m.room.runId!==active.runId&&m.room.players.find(p=>p.id===wing.id)?.resetId>recovered.resetId)).room;
  for(let i=0;i<8;i++){const p=lobby.players.find(p=>p.id===pilots[i].id);assert.equal(p.droneId,configs[i].id);assert.equal(p.mode,active.players.find(v=>v.id===p.id).mode);assert.equal(p.ready,false);}
});

test('a plane host preserves drone effects in mixed free flight and any aircraft can use Playground',async t=>{
  const {client}=await fixture(t,{kind:'playground',size:84},{countdownMs:20});
  const host=await client('Plane host','coral',{protocol:4}),guest=await client('Drone guest','yellow',{protocol:4});
  host.send('create',{mapId:'test-route',kind:'free',droneId:'rift-t15',mode:'manual',simulation:{...DEFAULT_SIMULATION,propDamage:true,propwash:true}});
  const room=(await host.next(m=>m.type==='room')).room;
  assert.equal(room.simulation.propDamage,true);assert.equal(room.simulation.propwash,true);
  guest.send('join',{code:room.code,droneId:'rift-65',mode:'horizon'});
  await guest.next(m=>m.type==='room'&&m.room.players.length===2);
  host.send('rules',{simulation:{...room.simulation,wind:'strong'}});
  const rules=(await guest.next(m=>m.type==='room'&&m.room.simulation.wind==='strong')).room;
  assert.equal(rules.simulation.propDamage,true);assert.equal(rules.simulation.propwash,true);
  host.send('aircraft',{droneId:'rift-t15',mode:'manual',launchMethod:'ground'});assert.equal((await host.next(m=>m.type==='error')).code,'invalidLaunch');
});

test('races still pin a common aircraft even when protocol-4 guests selected another model',async t=>{
  const {client}=await fixture(t,{}, {countdownMs:20});const host=await client('Race host','coral',{protocol:4}),guest=await client('Plane selection','yellow',{protocol:4});
  host.send('create',{mapId:'test-route',kind:'race',droneId:'rift-x5',mode:'acro'});const room=(await host.next(m=>m.type==='room')).room;
  assert.equal(room.mixedAircraft,false);
  guest.send('join',{code:room.code,droneId:'rift-t15',mode:'manual'});
  const own=(await guest.next(m=>m.type==='room'&&m.room.players.length===2)).room.players.find(p=>p.id===guest.id);
  assert.equal(own.droneId,'rift-x5');assert.equal(own.mode,'acro');
  guest.send('aircraft',{droneId:'rift-t15',mode:'manual'});assert.equal((await guest.next(m=>m.type==='error')).code,'aircraftLocked');
});

test('Apex traffic shares one immutable epoch and seed across eight pilots, late join, reconnect and restart',async t=>{
 const {client}=await fixture(t,{id:'apex',kind:'circuit',size:800,spawn:[-175,.15,200],gates:[],racingEnabled:false},{countdownMs:20});
 const legacy=await client('Old circuit client','blue',{protocol:5});
 legacy.send('create',{mapId:'apex',droneId:'rift-x5',mode:'acro',kind:'free'});assert.equal((await legacy.next(m=>m.type==='error')).code,'clientTooOld');
 const pilots=[];for(let i=0;i<8;i++)pilots.push(await client('Circuit '+i,'coral',{protocol:6}));
 const host=pilots[0];host.send('create',{mapId:'apex',droneId:'rift-x5',mode:'acro',kind:'free'});
 const created=(await host.next(m=>m.type==='room')).room,traffic=created.traffic;
 assert.equal(traffic.version,2);assert.ok(Number.isFinite(traffic.epoch));assert.ok(Number.isInteger(traffic.seed));
 legacy.send('join',{code:created.code});assert.equal((await legacy.next(m=>m.type==='error')).code,'clientTooOld');
 legacy.send('list');assert.ok(!(await legacy.next(m=>m.type==='rooms')).rooms.some(r=>r.code===created.code));
 for(let i=1;i<8;i++){
  pilots[i].send('join',{code:created.code,droneId:i%2?'rift-a40':'rift-x5',mode:i%2?'manual':'acro'});
  const joined=(await pilots[i].next(m=>m.type==='room'&&m.room.players.length===i+1)).room;assert.deepEqual(joined.traffic,traffic);
 }
 for(const p of pilots)p.send('ready',{ready:true});
 await host.next(m=>m.type==='room'&&m.room.players.length===8&&m.room.players.every(p=>p.ready));host.send('start');
 const flying=(await host.next(m=>m.type==='room'&&m.room.phase==='flying')).room;assert.deepEqual(flying.traffic,traffic);
 pilots[7].send('leave');await host.next(m=>m.type==='room'&&m.room.players.length===7);
 const late=await client('Late circuit pilot','yellow',{protocol:6});late.send('join',{code:created.code,droneId:'rift-s75',mode:'manual'});
 assert.deepEqual((await late.next(m=>m.type==='room'&&m.room.phase==='flying')).room.traffic,traffic);
 pilots[1].ws.terminate();await host.next(m=>m.type==='room'&&m.room.players.find(p=>p.id===pilots[1].id)?.connected===false);
 const resumed=await client('Resumed circuit pilot','blue',{protocol:6,resume:pilots[1].welcome.resume});
 assert.equal(resumed.welcome.resumed,true);assert.deepEqual((await resumed.next(m=>m.type==='room')).room.traffic,traffic);
 host.send('restart');const restarted=(await host.next(m=>m.type==='room'&&m.room.phase==='lobby'&&m.room.runId!==flying.runId)).room;
 assert.deepEqual(restarted.traffic,traffic,'restarting a flight never teleports the traffic');
});

test('Harbor mixed flights require the shared map-capable protocol for pilots and spectators',async t=>{
 const {client}=await fixture(t,{id:'harbor',kind:'harbor',size:800,spawn:[-280,3.15,305],gates:[],routes:[],racingEnabled:false},{countdownMs:5});
 const legacy=await client('Cached harbor client','blue',{protocol:7});
 legacy.send('create',{mapId:'harbor',droneId:'rift-x5',mode:'acro',kind:'free'});
 assert.equal((await legacy.next(m=>m.type==='error')).code,'clientTooOld');
 const host=await client('Harbor quad','coral',{protocol:8}),wing=await client('Harbor airplane','yellow',{protocol:8});
 host.send('create',{mapId:'harbor',droneId:'rift-x5',mode:'acro',kind:'free'});
 const created=(await host.next(m=>m.type==='room')).room;
 assert.equal(created.mapId,'harbor');assert.equal(created.mixedAircraft,true);
 legacy.send('join',{code:created.code});assert.equal((await legacy.next(m=>m.type==='error')).code,'clientTooOld');
 legacy.send('spectate',{code:created.code});assert.equal((await legacy.next(m=>m.type==='error')).code,'clientTooOld');
 legacy.send('list');assert.ok(!(await legacy.next(m=>m.type==='rooms')).rooms.some(r=>r.code===created.code));
 wing.send('join',{code:created.code,droneId:'rift-a40',mode:'manual'});
 const joined=(await wing.next(m=>m.type==='room'&&m.room.players.length===2)).room;
 assert.equal(joined.players.find(p=>p.id===wing.id).droneId,'rift-a40');
 assert.equal(joined.players.find(p=>p.id===host.id).droneId,'rift-x5');
 host.send('ready',{ready:true});wing.send('ready',{ready:true});
 await host.next(m=>m.type==='room'&&m.room.players.length===2&&m.room.players.every(p=>p.ready));host.send('start');
 await wing.next(m=>m.type==='room'&&m.room.phase==='flying');
 const viewer=await client('Harbor spectator','green',{protocol:8});viewer.send('spectate',{code:created.code});
 const observed=(await viewer.next(m=>m.type==='room'&&m.room.spectators.length===1)).room;
 assert.equal(observed.mapId,'harbor');assert.equal(observed.players.length,2);assert.equal(observed.phase,'flying');
});

test('multiplayer water contact resets the pilot, stops the rotors and clears the current lap',async t=>{
 const map={id:'test-route',kind:'park',size:800,spawn:[-180,2,-130],baseSpawn:[-180,2,-130],routes:[]};
 const {client}=await fixture(t,map,{countdownMs:5}),host=await client('Water pilot');
 host.send('create',{mapId:map.id,droneId:'rift-x5',mode:'angle',kind:'free'});
 await host.next(m=>m.type==='room');host.send('ready',{ready:true});await host.next(m=>m.type==='room'&&m.room.players[0].ready);host.send('start');
 const room=(await host.next(m=>m.type==='room'&&m.room.phase==='flying')).room;
 await host.state([-180,.2,-130],{runId:room.runId,rotorSpeeds:[1,1,1,1],turtleMode:true});
 const reset=await host.next(m=>m.type==='reset'&&m.reason==='water');
 assert.deepEqual(reset.pose.p,map.spawn);
 const updated=(await host.next(m=>m.type==='room'&&m.room.players[0].resetId>room.players[0].resetId)).room.players[0];
 assert.deepEqual(updated.rotorSpeeds,[0,0,0,0]);assert.equal(updated.turtleMode,false);
 assert.equal(updated.lap.startedAt,null);assert.equal(updated.lap.next,0);
});
