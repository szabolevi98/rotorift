import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { attachRooms } from '../server/net/rooms.js';
import { loadCatalog } from '../server/catalog.js';

const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(t, options={}) {
  const catalog=await loadCatalog();
  catalog.maps=[{id:'lifecycle',size:100,routeVersion:1,spawn:[0,1,-.5],gates:[
    {p:[0,1,0],n:[0,0,1],width:2,height:2},{p:[0,1,2],n:[0,0,-1],width:2,height:2},
  ]}];
  const db={available:true,laps:[],results:[],profile:async token=>token||randomUUID(),
    async saveLap(...args){this.laps.push(args);return true;},
    async saveResult(room){await delay(80);this.results.push({id:room.raceId,rows:room.results,players:[...room.players.values()].map(p=>({finished:p.finished,completed:p.lap.completed}))});return true;},
  };
  const server=http.createServer(),api=attachRooms(server,catalog,db,{countdownMs:20,reconnectMs:2000,...options});
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const sockets=[];
  t.after(async()=>{for(const ws of sockets)ws.terminate();await new Promise(resolve=>server.close(resolve));});
  async function client(name, auth={}) {
    const ws=new WebSocket('ws://127.0.0.1:'+server.address().port+'/ws');sockets.push(ws);
    const messages=[];let room,seq=0;
    ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='room')room=m.room;messages.push(m);});
    await once(ws,'open');
    const send=(type,data={})=>ws.send(JSON.stringify({type,...data}));
    async function next(predicate,timeout=2500){const until=Date.now()+timeout;while(Date.now()<until){const i=messages.findIndex(predicate);if(i>=0)return messages.splice(i,1)[0];await delay(5);}throw Error('Expected lifecycle message did not arrive');}
    send('hello',{name,protocol:2,...auth}); const welcome=await next(m=>m.type==='welcome');
    return {ws,send,next,welcome,id:welcome.id,get room(){return room;},
      async state(p,extra={}){await delay(30);send('state',{seq:seq++,t:Date.now(),p,v:[0,0,0],q:{x:0,y:0,z:0,w:1},mode:'angle',configHash:catalog.drones.find(d=>d.id==='rift-x5').configHash,runId:room.runId,...extra});},
      async drop(){ws.terminate();await once(ws,'close');},
    };
  }
  async function create(p,kind='race'){p.send('create',{mapId:'lifecycle',droneId:'rift-x5',mode:'angle',kind,public:false});return(await p.next(m=>m.type==='room')).room;}
  async function start(...pilots){const runId=pilots[0].room.runId,at=Date.now();for(const p of pilots)p.send('ready',{ready:true});await pilots[0].next(m=>m.type==='room'&&m.room.phase==='lobby'&&m.room.runId===runId&&m.room.players.every(p=>p.ready));pilots[0].send('start');await pilots[0].next(m=>m.type==='room'&&m.room.phase==='flying'&&m.room.startsAt>=at);}
  async function laps(p,count){await p.state([0,1,-.5]);await p.state([0,1,.5]);for(let i=0;i<count;i++){for(const z of [2.5,1.5,-.5,.5])await p.state([0,1,z]);assert.equal((await p.next(m=>m.type==='lap')).valid,true);}}
  return {client,create,start,laps,db,api};
}

test('authenticated reconnect retains one pilot and slot; profile identity alone cannot reclaim a reservation',async t=>{
  const {client,create,api}=await fixture(t),a=await client('Host'),b=await client('Guest');
  const room=await create(a,'free');b.send('join',{code:room.code});await b.next(m=>m.type==='room'&&m.room.players.length===2);
  a.send('ready',{ready:true});await b.next(m=>m.type==='room'&&m.room.players.find(p=>p.id===a.id)?.ready);
  await a.drop();
  const away=(await b.next(m=>m.type==='room'&&m.room.players.some(p=>p.connected===false))).room;
  assert.equal(away.host,b.id);assert.equal(away.players.length,2);assert.ok(away.players[0].reconnectUntil>Date.now());
  assert.ok(away.players.every(p=>!('resume' in p)&&!('token' in p)),'private recovery credentials are never broadcast');
  const wrong=await client('Wrong',{token:a.welcome.token,resume:'f'.repeat(48)});
  assert.equal(wrong.welcome.resumeRejected,true);assert.notEqual(wrong.id,a.id);
  wrong.send('join',{code:room.code});assert.equal((await wrong.next(m=>m.type==='error')).code,'alreadyJoined');
  const restored=await client('Host',{resume:a.welcome.resume});
  assert.equal(restored.welcome.resumed,true);assert.equal(restored.id,a.id);
  const back=(await restored.next(m=>m.type==='room')).room;
  assert.deepEqual(back.players.map(p=>p.id),[a.id,b.id]);assert.equal(back.players[0].ready,false);assert.equal(back.host,b.id);
  assert.notEqual(restored.welcome.resume,a.welcome.resume);
  const stale=await client('Stale tab',{resume:a.welcome.resume});assert.equal(stale.welcome.resumeRejected,true);
  await restored.drop();const retry=await client('Host',{resume:a.welcome.resume});assert.equal(retry.welcome.resumed,true,'an unacknowledged rotated credential can recover after another disconnect');
  assert.equal(api.stats().rooms,1);
});

test('reconnecting during a race preserves completed laps but restarts the interrupted lap without duplicate results',async t=>{
  const {client,create,start,laps,db}=await fixture(t),a=await client('Pilot');
  await create(a);await start(a);await laps(a,1);
  await a.state([0,1,2.5]);await a.state([0,1,1.5]);await a.drop();
  const back=await client('Pilot',{resume:a.welcome.resume});const r=(await back.next(m=>m.type==='room')).room;
  assert.equal(back.id,a.id);assert.equal(r.phase,'flying');assert.equal(r.players[0].lap.completed,1);
  assert.equal(r.players[0].lap.startedAt,null);assert.equal(r.players[0].lap.next,0);assert.deepEqual(r.players[0].p,[0,1,-.5]);
  await laps(back,2);const finished=(await back.next(m=>m.type==='room'&&m.room.phase==='finished')).room;
  assert.equal(finished.results[0].completed,3);assert.equal(finished.results[0].place,1);
  await delay(100);assert.equal(db.laps.length,3);assert.equal(db.results.length,1);
  await back.drop();const again=await client('Pilot',{resume:back.welcome.resume});
  assert.equal((await again.next(m=>m.type==='room')).room.phase,'finished');await delay(100);assert.equal(db.results.length,1);
});

test('expired reservations release capacity and retain departed pilots as DNF in final standings',async t=>{
  const {client,create,start,laps,db}=await fixture(t,{reconnectMs:80}),a=await client('Host'),b=await client('Dropout');
  const r=await create(a);b.send('join',{code:r.code});await b.next(m=>m.type==='room'&&m.room.players.length===2);await start(a,b);
  await b.drop();await a.next(m=>m.type==='room'&&m.room.players.length===1);await laps(a,3);
  const end=(await a.next(m=>m.type==='room'&&m.room.phase==='finished')).room;
  assert.deepEqual(end.results.map(p=>[p.id,p.status,p.place]),[[a.id,'finished',1],[b.id,'dnf',null]]);
  await delay(100);assert.equal(db.results[0].rows.length,2);
  const expired=await client('Dropout',{resume:b.welcome.resume});assert.equal(expired.welcome.resumeRejected,true);
});

test('only the host can close and restart a run; readiness, epochs and immutable saves survive repeated requests',async t=>{
  const {client,create,start,db}=await fixture(t),a=await client('Host'),b=await client('Guest');
  const r=await create(a);b.send('join',{code:r.code});await b.next(m=>m.type==='room'&&m.room.players.length===2);await start(a,b);
  const oldRun=a.room.runId;b.send('finish');assert.equal((await b.next(m=>m.type==='error')).code,'hostOnly');
  a.send('restart');assert.equal((await a.next(m=>m.type==='error')).code,'finishFirst');
  a.send('finish');a.send('finish');await a.next(m=>m.type==='room'&&m.room.phase==='finished');
  b.send('restart');assert.equal((await b.next(m=>m.type==='error')).code,'hostOnly');
  a.send('restart');a.send('restart');const lobby=(await a.next(m=>m.type==='room'&&m.room.phase==='lobby'&&m.room.startsAt===null&&m.room.runId!==oldRun)).room;
  assert.equal(lobby.code,r.code);assert.ok(lobby.players.every(p=>!p.ready&&p.lap.completed===0));
  assert.deepEqual(lobby.simulation,r.simulation);assert.equal(lobby.route.version,r.route.version);
  await start(a,b);await a.state([0,1,.5],{runId:oldRun});await delay(70);
  assert.equal(a.room.players[0].lap.startedAt,null,'packets from the previous run cannot affect a new run');
  a.send('finish');await a.next(m=>m.type==='room'&&m.room.phase==='finished');await delay(100);
  assert.equal(db.results.length,2);assert.notEqual(db.results[0].id,db.results[1].id);
  assert.ok(db.results.every(result=>result.rows.length===2&&result.rows.every(p=>p.status==='dnf')));
});

test('a free-flight room can restart and a sole disconnected pilot keeps the room until expiry',async t=>{
  const {client,create,start,api,db}=await fixture(t,{reconnectMs:100}),a=await client('Pilot');
  const created=await create(a,'free');await start(a);a.send('restart');
  const again=(await a.next(m=>m.type==='room'&&m.room.phase==='lobby'&&m.room.runId!==created.runId)).room;
  assert.equal(again.code,created.code);assert.equal(again.players[0].ready,false);assert.equal(db.results.length,0);
  await a.drop();assert.equal(api.stats().rooms,1);await delay(180);assert.equal(api.stats().rooms,0);
});

test('a reserved slot in a full eight-pilot room can be recovered but cannot admit a ninth pilot',async t=>{
  const {client,create}=await fixture(t),host=await client('Host'),r=await create(host,'free'),pilots=[host];
  for(let i=1;i<8;i++){const p=await client('Pilot '+i);pilots.push(p);p.send('join',{code:r.code});await p.next(m=>m.type==='room'&&m.room.players.length===i+1);}
  const away=pilots[7];await away.drop();await host.next(m=>m.type==='room'&&m.room.players.some(p=>p.id===away.id&&p.connected===false));
  const ninth=await client('Ninth');ninth.send('join',{code:r.code});assert.equal((await ninth.next(m=>m.type==='error')).code,'roomFull');
  const back=await client('Pilot 7',{resume:away.welcome.resume});const snapshot=(await back.next(m=>m.type==='room')).room;
  assert.equal(snapshot.players.length,8);assert.equal(snapshot.players.filter(p=>p.id===away.id).length,1);assert.equal(back.id,away.id);
});

test('verified hotlap runs close with best-lap standings and restart with fresh progress',async t=>{
  const {client,create,start,laps,db}=await fixture(t),p=await client('Hotlap');await create(p,'hotlap');await start(p);await laps(p,1);
  p.send('finish');const result=(await p.next(m=>m.type==='room'&&m.room.phase==='finished')).room;
  assert.equal(result.results[0].status,'finished');assert.equal(result.results[0].place,1);assert.ok(result.results[0].bestMs>0);
  p.send('restart');const lobby=(await p.next(m=>m.type==='room'&&m.room.phase==='lobby'&&m.room.startsAt===null)).room;
  assert.equal(lobby.players[0].ready,false);assert.equal(lobby.players[0].lap.bestMs,null);await delay(100);assert.equal(db.results.length,1);
});
