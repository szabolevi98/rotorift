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
