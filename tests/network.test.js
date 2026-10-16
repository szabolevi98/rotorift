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
  async function client(name, color) {
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
    send("hello", { name, color });
    const welcome = await next((m) => m.type === "welcome");
    let seq = 0;
    return {
      ws,
      send,
      next,
      id: welcome.id,
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
  assert.ok(refilled.room.players.some(p => p.id === ninth.id && p.color === "blue"));
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
  const options={battery:true,propDamage:true,propwash:true,ghost:false,wind:"medium"};
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
