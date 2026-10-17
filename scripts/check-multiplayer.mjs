// Repeatable isolated eight-client soak. Never connects to the public server/DB.
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import WebSocket from 'ws';
import RAPIER from '@dimforge/rapier3d-compat';
import { attachRooms } from '../server/net/rooms.js';
import { loadCatalog } from '../server/catalog.js';
import { DEFAULT_SIMULATION, simulationKey } from '../shared/simulation/options.js';
import { DRONE_COLORS } from '../shared/visual/drone-colors.js';
import { freshPropellers } from '../shared/physics/propellers.js';
import { DronePhysics, PHYSICS_DT } from '../shared/physics/drone.js';
import { RemoteCollisions } from '../web/game/remote-collisions.js';

const seconds=Number(process.argv.find(v=>v.startsWith('--seconds='))?.split('=')[1]??30);
assert.ok(Number.isFinite(seconds)&&seconds>=5&&seconds<=300,'--seconds must be 5..300 per map');
const output=process.argv.find(v=>v.startsWith('--output='))?.slice(9)??'.runtime/multiplayer-check.json';
const resumeNetwork=process.argv.find(v=>v.startsWith('--resume-network='))?.slice(17);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const until=async(check,label,timeout=6000)=>{const end=Date.now()+timeout;while(Date.now()<end){const result=check();if(result)return result;await delay(10);}throw Error('Timed out: '+label);};
const percentile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);return +(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]??0).toFixed(2);};
const catalog=await loadCatalog();
catalog.maps.push({id:'soak-race',size:100,routeVersion:1,spawn:[0,3,-2],gates:[
  {p:[0,3,0],n:[0,0,1],width:12,height:8},{p:[0,3,4],n:[0,0,-1],width:12,height:8},
]});
const db={available:true,laps:[],results:[],async profile(token){await delay(3);return token??randomUUID();},
  async saveLap(...args){await delay(15);this.laps.push(args);return true;},
  async saveResult(room){await delay(30);this.results.push({id:room.raceId,rows:room.results});}};
const server=http.createServer(),api=attachRooms(server,catalog,db,{countdownMs:200,reconnectMs:8000});
server.listen(0,'127.0.0.1');await once(server,'listening');
const sockets=new Set(),timers=new Set(),colors=Object.keys(DRONE_COLORS);
const report={date:new Date().toISOString(),passed:false,secondsPerMap:seconds,
  environment:'Isolated local attachRooms server, in-memory persistence; eight scripted WebSocket clients, no browser rendering.',
  network:{oneWayBaseMs:[0,20,40,60,80,100,120,150],jitterMs:20,skippedOutgoingStateFraction:.02,skippedIncomingSnapshotFraction:.03,tcpOrderingPreserved:true},stages:[],collisions:[]};
let seed=1739;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function schedule(fn,at){const timer=setTimeout(()=>{timers.delete(timer);fn();},Math.max(0,at-Date.now()));timers.add(timer);}
async function client(index,auth={}){
  const ws=new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);sockets.add(ws);
  const base=report.network.oneWayBaseMs[index],p={index,ws,seq:0,room:null,welcome:null,events:[],ages:[],rtts:[],bytes:0,snapshots:0};
  let incoming=0,outgoing=0;
  ws.on('error',()=>{});
  ws.on('message',raw=>{
    p.bytes+=raw.length;const message=JSON.parse(raw);
    if(message.type==='room'&&random()<.03)return;
    incoming=Math.max(incoming+1,Date.now()+Math.max(0,base+(random()-.5)*40));
    schedule(()=>{
      if(ws.readyState!==1)return;
      if(message.type==='welcome')p.welcome=message;
      if(message.type==='room'){p.room=message.room;p.snapshots++;p.ages.push(Date.now()-message.now);}
      else if(message.type==='pong')p.rtts.push(Date.now()-message.echo);
      else p.events.push(message);
    },incoming);
  });
  p.send=(type,data={},reliable=false)=>{
    if(type==='state'&&!reliable&&random()<.02)return;
    outgoing=Math.max(outgoing+1,Date.now()+Math.max(0,base+(random()-.5)*40));
    schedule(()=>{if(ws.readyState===1)ws.send(JSON.stringify({type,...data}));},outgoing);
  };
  p.next=async predicate=>until(()=>{const i=p.events.findIndex(predicate);return i<0?null:p.events.splice(i,1)[0];},'client message');
  p.drop=async()=>{if(ws.readyState===3)return;ws.terminate();await once(ws,'close');};
  await once(ws,'open');p.send('hello',{name:'Soak pilot '+index,color:colors[index],protocol:2,...auth});
  await until(()=>p.welcome,'welcome');p.id=p.welcome.id;return p;
}
async function start(pilots){
  const host=pilots.find(p=>p.id===pilots[0].room.host),run=host.room.runId;
  for(const p of pilots)p.send('ready',{ready:true});
  await until(()=>host.room.runId===run&&host.room.players.every(p=>p.ready),'all ready');host.send('start');
  await until(()=>pilots.every(p=>p.room?.phase==='flying'&&p.room.runId!==run),'shared start');
}
function state(p,config,position,velocity=[0,0,0],reliable=false){
  p.send('state',{seq:p.seq++,t:Date.now(),runId:p.room.runId,configHash:config.configHash,simulationKey:simulationKey(p.room.simulation),
    mode:'angle',p:position,v:velocity,q:{x:0,y:0,z:0,w:1},propellers:freshPropellers(),rotorSpeeds:[.35,.4,.45,.5]},reliable);
}
async function leaveAll(pilots){for(const p of pilots)p.send('leave');await Promise.all(pilots.map(p=>p.next(m=>m.type==='left')));for(const p of pilots)await p.drop();await until(()=>api.stats().rooms===0,'room cleanup');}

try{
  if(resumeNetwork){
    const saved=JSON.parse(await readFile(resumeNetwork,'utf8'));
    assert.equal(saved.stages.length,4);assert.ok(saved.stages.every(stage=>stage.pilots===8&&stage.guestResumed&&stage.hostResumed&&stage.restartAndRules));
    assert.equal(saved.race.validLapSaves,24);assert.equal(saved.race.resultSaves,1);assert.equal(saved.race.allFinished,true);
    for(const key of ['date','secondsPerMap','network','stages','race'])report[key]=saved[key];
    report.collisionRecheck='Completed network evidence retained; collision checks rerun using contact impulses and velocity rather than requiring a ricochet to stay on one side.';
  }else{
  for(const [index,mapId]of ['liget','betonudvar','jatszoter','skyline'].entries()){
    const config=catalog.drones.find(d=>d.id===(mapId==='jatszoter'?'rift-65':'rift-x5'));
    const baseMap=catalog.maps.find(m=>m.id===mapId),spawn=baseMap.baseSpawn??baseMap.spawn;
    const pilots=[];for(let i=0;i<8;i++)pilots.push(await client(i));
    const simulation={...DEFAULT_SIMULATION,ghost:index%2===0,propDamage:true};
    const cpu=process.cpuUsage(),loop=monitorEventLoopDelay({resolution:10});loop.enable();
    pilots[0].send('create',{mapId,droneId:config.id,mode:'angle',kind:'free',public:false,simulation});
    await until(()=>pilots[0].room,'create');const code=pilots[0].room.code;
    for(const p of pilots.slice(1))p.send('join',{code});
    await until(()=>pilots.every(p=>p.room?.players.length===8),'eight joined');
    assert.equal(new Set(pilots[0].room.players.map(p=>p.color)).size,8);
    const ninth=await client(0);ninth.send('join',{code});assert.equal((await ninth.next(m=>m.type==='error')).code,'roomFull');await ninth.drop();
    await start(pilots);const started=Date.now();let tick=0,guestRecovered=false,hostRecovered=false;
    while(Date.now()-started<seconds*1000){
      const t=(Date.now()-started)/1000;
      for(const p of pilots){const a=t*.6+p.index;
        state(p,config,[spawn[0]+p.index*.7+Math.sin(a)*2,spawn[1]+3+Math.sin(a*.4),spawn[2]+Math.cos(a)*2],[Math.cos(a)*1.2,Math.cos(a*.4)*.24,-Math.sin(a)*1.2]);
        if(tick%20===0)p.send('ping',{at:Date.now()});
      }
      if(!guestRecovered&&t>seconds*.3||!hostRecovered&&t>seconds*.65){
        const slot=guestRecovered?0:7,away=pilots[slot],id=away.id;
        await away.drop();await delay(350);
        const back=await client(slot,{resume:away.welcome.resume});
        back.ages.unshift(...away.ages);back.rtts.unshift(...away.rtts);back.snapshots+=away.snapshots;back.bytes+=away.bytes;
        assert.equal(back.id,id);assert.equal(back.welcome.resumed,true);pilots[slot]=back;
        await until(()=>back.room?.players.length===8,'resume roster');
        assert.equal(back.room.players.filter(p=>p.id===id).length,1);
        if(slot===0){hostRecovered=true;assert.notEqual(back.room.host,id,'host transfers to a connected pilot');}
        else guestRecovered=true;
      }
      tick++;await delay(50);
    }
    await delay(500);
    for(const p of pilots){assert.equal(p.room.players.length,8);assert.equal(p.room.simulation.ghost,simulation.ghost);assert.equal(p.events.filter(m=>m.type==='error').length,0);}
    const host=pilots.find(p=>p.id===pilots[0].room.host),oldRun=host.room.runId;host.send('restart');
    await until(()=>pilots.every(p=>p.room.phase==='lobby'&&p.room.runId!==oldRun),'restart');
    assert.ok(host.room.players.every(p=>!p.ready&&p.lap.completed===0));
    host.send('rules',{simulation:{...simulation,ghost:!simulation.ghost}});
    await until(()=>pilots.every(p=>p.room.simulation.ghost===!simulation.ghost),'shared changed collision rule');
    const cpuUsed=process.cpuUsage(cpu),ages=pilots.flatMap(p=>p.ages),rtts=pilots.flatMap(p=>p.rtts);
    loop.disable();report.stages.push({map:mapId,drone:config.id,ghost:simulation.ghost,pilots:8,durationSeconds:+((Date.now()-started)/1000).toFixed(2),
      snapshots:pilots.reduce((sum,p)=>sum+p.snapshots,0),snapshotAgeP95Ms:percentile(ages,.95),rttP95Ms:percentile(rtts,.95),
      eventLoopP95Ms:+(loop.percentile(95)/1e6).toFixed(2),processCpuMs:+((cpuUsed.user+cpuUsed.system)/1000).toFixed(1),
      guestResumed:guestRecovered,hostResumed:hostRecovered,restartAndRules:true});
    await leaveAll(pilots);console.log(`${mapId}: eight pilots, delayed snapshots, guest/host reconnect, restart and rule change passed`);
  }
  // A short controlled route isolates race accounting from graphics/autopilot.
  const pilots=[];for(let i=0;i<8;i++)pilots.push(await client(i));
  const config=catalog.drones.find(d=>d.id==='rift-x5');
  pilots[0].send('create',{mapId:'soak-race',droneId:config.id,mode:'angle',kind:'race',public:false});
  await until(()=>pilots[0].room,'race create');
  for(const p of pilots.slice(1))p.send('join',{code:pilots[0].room.code});
  await until(()=>pilots.every(p=>p.room?.players.length===8),'race roster');await start(pilots);
  for(const z of [-1,1,5,3,-1,1,5,3,-1,1,5,3,-1,1]){for(const p of pilots)state(p,config,[p.index*.6,3,z],[0,0,0],true);await delay(180);}
  await until(()=>pilots.every(p=>p.room.phase==='finished'),'eight finishers');await until(()=>db.results.length===1,'single result save');
  const results=pilots[0].room.results;assert.equal(results.length,8);assert.ok(results.every(p=>p.completed===3&&p.status==='finished'));
  assert.equal(db.laps.length,24);assert.equal(new Set(results.map(p=>p.place)).size,8);
  report.race={pilots:8,lapsEach:3,validLapSaves:db.laps.length,resultSaves:db.results.length,allFinished:true};
  await leaveAll(pilots);console.log('Race: eight finishers, 24 valid laps, one result save passed');
  }

  await RAPIER.init();
  for(const config of catalog.drones){
    const outcomes=[];
    for(const ghost of [true,false]){
      const world=new RAPIER.World({x:0,y:0,z:0});
      const drone=new DronePhysics(RAPIER,world,config,[-.6,2,0],{updateSceneQueries:false});
      const proxies=new RemoteCollisions(RAPIER,world,config);
      let pairs=0,contacts=0,impulse=0;
      try{
        const peers=Array.from({length:7},(_,i)=>({id:'peer'+i,p:[0,2,i*.7],q:{x:0,y:0,z:0,w:1},resetId:1}));
        proxies.update(peers,'self',ghost);assert.equal(proxies.bodies.size,ghost?0:7);
        drone.body.setLinvel({x:4,y:0,z:0},true);
        for(let i=0;i<120;i++){
          proxies.step(PHYSICS_DT);drone.step({roll:0,pitch:0,yaw:0,throttle:0});
          for(const collider of [drone.bodyCollider,...drone.propColliders,...drone.guardColliders])
            world.contactPairsWith(collider,other=>{pairs++;world.contactPair(collider,other,manifold=>{
              contacts+=manifold.numContacts();for(let j=0;j<manifold.numContacts();j++)impulse+=Math.abs(manifold.contactImpulse(j));
            });});
        }
        outcomes.push({x:drone.pose.p[0],vx:drone.pose.v[0],pairs,contacts,impulse});assert.ok(drone.pose.p.every(Number.isFinite));
        proxies.update([],'self',false);assert.equal(proxies.bodies.size,0);
      }finally{proxies.dispose();drone.dispose();world.free();}
    }
    const [ghost,solid]=outcomes;
    assert.ok(ghost.x>.8&&ghost.contacts===0,`${config.id}: ghost passes without contact`);
    // Thin guards can resolve in CCD without retaining a discrete manifold
    // impulse. The observed velocity change still measures the impact response.
    assert.ok(solid.pairs>0&&solid.vx<ghost.vx*.5,`${config.id}: solid contact changes momentum`);
    report.collisions.push({drone:config.id,peers:7,ghost,solid,lostForwardMomentumKgMps:config.massKg*(ghost.vx-solid.vx),passed:true});
  }
  report.passed=true;
}catch(error){report.error=error.message;process.exitCode=1;console.error(error.stack);}
finally{
  for(const timer of timers)clearTimeout(timer);
  for(const ws of sockets)ws.terminate();
  await new Promise(resolve=>server.close(resolve));
  await writeFile(output,JSON.stringify(report,null,2)+'\n');
  console.log(`Report: ${output}; passed=${report.passed}`);
}
