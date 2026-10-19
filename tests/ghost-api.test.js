import test from 'node:test';import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from '../server/index.js';
test('public ghost API accepts only a valid category/id, returns exact category metadata, and never exposes a pilot profile token',async t=>{
  const id='11111111-1111-4111-8111-111111111111',calls=[];
  const db={available:true,async init(){},leaderboard:async()=>({available:true,entries:[]}),
    async ghost(map,drone,mode,simulation,ghostId){calls.push({map,drone,mode,simulation});return ghostId===id?{ghostId:id,name:'API test',ms:1000,replay:{version:1,sampleRate:20,frames:[[0,0,1,0,0,0,0,1],[1000,2,1,0,0,0,0,1]]}}:null;}};
  const {server,catalog}=await createServer({database:db});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port,map=catalog.maps[0],drone=catalog.drones[0];
  const query=new URLSearchParams({map:map.id,route:map.routeId,drone:drone.id,mode:'acro',simulation:'00010',id});
  const response=await fetch(base+'/api/ghost?'+query);assert.equal(response.status,200);const ghost=await response.json();
  assert.ok(ghost.category.includes(drone.configHash));assert.equal(ghost.ghostId,id);assert.equal(ghost.player_id,undefined);assert.equal(ghost.token,undefined);
  assert.equal(calls[0].map.routeId,map.routeId);assert.equal(calls[0].drone.id,drone.id);
  for(const [key,value]of [['mode','bogus'],['simulation','55555'],['drone','unknown'],['id','secret'],['route','unknown']]){
    const invalid=new URLSearchParams(query);invalid.set(key,value);assert.equal((await fetch(base+'/api/ghost?'+invalid)).status,400);
  }
  query.set('id','22222222-2222-4222-8222-222222222222');assert.equal((await fetch(base+'/api/ghost?'+query)).status,404);
});

test('airplane records and public pose ghosts use Manual and compatible routes without changing quad categories',async t=>{
  const id='11111111-1111-4111-8111-111111111111',calls=[];
  const db={available:true,async init(){},async leaderboard(map,aircraft,mode){calls.push({map,aircraft,mode});return {available:true,entries:[]};},async ghost(map,aircraft,mode){calls.push({map,aircraft,mode});return {ghostId:id,name:'Wing',ms:1000,replay:{version:1,sampleRate:20,frames:[[0,0,52,0,0,0,0,1],[1000,15,52,0,0,0,0,1]]}};}};
  const {server}=await createServer({database:db});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port,query=new URLSearchParams({map:'liget',route:'wing_1',drone:'rift-t15',mode:'manual',simulation:'00010',id});
  assert.equal((await fetch(base+'/api/leaderboard?'+query)).status,200);
  query.set('mode','all');assert.equal((await fetch(base+'/api/leaderboard?'+query)).status,200);query.set('mode','manual');
  const ghost=await(await fetch(base+'/api/ghost?'+query)).json();assert.ok(ghost.category.includes('rift-t15:'));assert.ok(ghost.category.endsWith(':manual'));assert.equal(ghost.replay.frames.length,2);
  query.set('mode','stabilized');assert.equal((await fetch(base+'/api/leaderboard?'+query)).status,200);
  const assisted=await(await fetch(base+'/api/ghost?'+query)).json();assert.ok(assisted.category.endsWith(':stabilized'));assert.notEqual(assisted.category,ghost.category);
  query.set('mode','manual');
  assert.ok(calls.every(c=>c.map.routeId==='wing_1'&&c.aircraft.kind==='fixedWing'));
  const enabled=new URLSearchParams(query);enabled.set('simulation','01110');assert.equal((await fetch(base+'/api/ghost?'+enabled)).status,200,'airplane damage and slipstream are now supported categories');
  for(const [key,value]of [['route','race_1'],['mode','acro'],['drone','rift-x5'],['simulation','02110']]){const invalid=new URLSearchParams(query);invalid.set(key,value);assert.equal((await fetch(base+'/api/ghost?'+invalid)).status,400);}
});
