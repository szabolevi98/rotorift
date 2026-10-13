import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile}from'node:fs/promises';
import{gunzipSync}from'node:zlib';
import * as THREE from 'three';import RAPIER from '@dimforge/rapier3d-compat';
import{loadCatalog}from'../server/catalog.js';
import{buildPlayground,playgroundHeight,PLAYGROUND_POIS}from'../web/game/playground.js';
import{DronePhysics}from'../shared/physics/drone.js';
import{hoverThrottle}from'../shared/physics/propulsion.js';
import{COLLISION_ASSETS}from'../shared/world/collision-assets.js';
import{decodeCollisionData}from'../shared/world/collision-data.js';
import{PrebakedCollisions}from'../web/game/prebaked-collisions.js';
await RAPIER.init();const {maps,drones}=await loadCatalog(),map=maps.find(m=>m.id==='jatszoter');
const neutral={roll:0,pitch:0,yaw:0,throttle:0};
test('playground is compact, batched, bounded and has clear real crawl-through openings',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0}),scene=new THREE.Scene(),environment=buildPlayground(scene,world,RAPIER,map);
 try{
  assert.equal(map.size,84);assert.ok(environment.root.userData.landmarks.length>=12);assert.ok(environment.root.userData.batches<35);
  environment.update([-5,.7,13]);world.step();
  const ray=(p,d,length)=>world.castRay(new RAPIER.Ray({x:p[0],y:p[1],z:p[2]},{x:d[0],y:d[1],z:d[2]}),length,true);
  assert.equal(ray([-5,.68,10.9],[0,0,1],4.2),null,'timber tunnel centre must be open');
  assert.notEqual(ray([-5,1.28,10.9],[0,0,1],4.2),null,'tunnel timber walls must collide');
  environment.update([-3.4,.65,-3]);world.step();assert.equal(ray([-3.4,.65,-5],[0,0,1],4),null,'fort ground-level arch is open');
  environment.update([14,1,-7]);world.step();assert.equal(ray([14.6,1.9,-11.2],[0,0,1],8.4),null,'cube climber has a clear longitudinal flight corridor');
  environment.update([0,.2,300]);world.step();assert.notEqual(ray([0,10,300],[0,-1,0],20),null,'bare ground continues outside the fence');
  assert.equal(playgroundHeight(0,34),.05);assert.equal(playgroundHeight(300,300),0);
  assert.ok(Object.values(PLAYGROUND_POIS).every(p=>Math.abs(p[0])<30&&Math.abs(p[2])<30));
 }finally{environment.dispose();assert.equal(world.colliders.len(),0);world.free();}
});
for(const prepared of [false,true])test(`${prepared?'prepared':'source'} cube climber: square cells open on all three axes, steel tubes collide`,async()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0});let environment;
 if(prepared){const asset=COLLISION_ASSETS[map.id],raw=gunzipSync(await readFile(new URL('../web'+asset.url,import.meta.url)));environment=new PrebakedCollisions(RAPIER,world,map,decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),map.id));}
 else environment=buildPlayground(new THREE.Scene(),world,RAPIER,map);
 try{
  environment.update([14,1.9,-7]);world.step();
  const ray=(p,d,length)=>world.castRay(new RAPIER.Ray({x:p[0],y:p[1],z:p[2]},{x:d[0],y:d[1],z:d[2]}),length,true);
  assert.equal(ray([10.9,1.9,-8.8],[1,0,0],6.2),null,'crosswise squares must be empty');
  assert.equal(ray([14.6,1.9,-11.2],[0,0,1],8.4),null,'longitudinal squares must be empty');
  assert.equal(ray([14.6,.7,-7.6],[0,1,0],4),null,'roof cells must be open for vertical whoop flights');
  assert.notEqual(ray([13.6,.7,-7],[1,0,0],.8),null,'round vertical tube must collide');
  const top=ray([14,5,-7],[0,-1,0],2);assert.ok(top&&Math.abs(top.timeOfImpact-1.274)<.04,'upper horizontal tube must collide at 3.7 metres');
 }finally{environment.dispose();world.free();}
});
for(const id of ['rift-65','rift-75'])test(`${id}: flies through the prepared cube lattice without collisions or prop damage`,async()=>{
 const asset=COLLISION_ASSETS[map.id],raw=gunzipSync(await readFile(new URL('../web'+asset.url,import.meta.url))),records=decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),map.id);
 const world=new RAPIER.World({x:0,y:-9.81,z:0}),baked=new PrebakedCollisions(RAPIER,world,map,records),config=drones.find(c=>c.id===id);
 const drone=new DronePhysics(RAPIER,world,config,[14.6,1.9,-11.3],{updateSceneQueries:false,simulation:{propDamage:true}});drone.armed=true;
 try{
  for(let i=0;i<720;i++){drone.body.setLinvel({x:0,y:0,z:3},true);baked.update(drone.pose.p,drone.pose.v);drone.step({...neutral,throttle:hoverThrottle(config)});}
  assert.ok(drone.pose.p[2]>-2.5,'aircraft must emerge from the far end of the cage');
  assert.ok(Math.abs(drone.pose.p[0]-14.6)<.05);assert.ok(Math.abs(drone.pose.p[1]-1.9)<.1);
  assert.ok(drone.effects.propellers.blades.every(blades=>blades.every(v=>v===0)));
 }finally{drone.dispose();baked.dispose();world.free();}
});
test('prepared playground retains an open tunnel and low collision workload',async()=>{
 const asset=COLLISION_ASSETS[map.id],raw=gunzipSync(await readFile(new URL('../web'+asset.url,import.meta.url))),records=decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),map.id);
 const world=new RAPIER.World({x:0,y:-9.81,z:0}),baked=new PrebakedCollisions(RAPIER,world,map,records);
 // Analytic parts avoid expensive whoop CCD against merged triangle soups.
 // Keep activation local rather than requiring the old merged shape count.
 try{baked.update([-5,.7,13]);world.step();assert.equal(world.castRay(new RAPIER.Ray({x:-5,y:.68,z:11},{x:0,y:0,z:1}),4,true),null);assert.ok(baked.activeCount<200&&baked.activeCount<records.length/2);assert.ok(asset.bytes<100000);}
 finally{baked.dispose();assert.equal(world.colliders.len(),0);world.free();}
});
test('Rift 75 launches on the prepared ground, with collision geometry extending far beyond the fence',async()=>{
 const asset=COLLISION_ASSETS[map.id],raw=gunzipSync(await readFile(new URL('../web'+asset.url,import.meta.url))),records=decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),map.id);
 const world=new RAPIER.World({x:0,y:-9.81,z:0}),baked=new PrebakedCollisions(RAPIER,world,map,records),config=drones.find(c=>c.id==='rift-75');
 try{
  const drone=new DronePhysics(RAPIER,world,config,map.spawn,{updateSceneQueries:false});
  for(let i=0;i<240;i++){baked.update(drone.pose.p);drone.step(neutral);}
  assert.ok(drone.pose.p[1]>.05);drone.armed=true;
  for(let i=0;i<240;i++){baked.update(drone.pose.p);drone.step({...neutral,throttle:.30});}
  assert.ok(drone.pose.p[1]>.3);
  baked.update([50000,2,50000]);world.step();
  assert.notEqual(world.castRay(new RAPIER.Ray({x:50000,y:10,z:50000},{x:0,y:-1,z:0}),20,true),null);
 }finally{baked.dispose();world.free();}
});
for(const id of ['rift-65','rift-75'])test(`${id}: lands on the spawn path and lifts off at 30% without damage`,()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0}),environment=buildPlayground(new THREE.Scene(),world,RAPIER,map),config=drones.find(c=>c.id===id);
 try{
  const drone=new DronePhysics(RAPIER,world,config,map.spawn,{updateSceneQueries:false,simulation:{propDamage:true}});
  for(let i=0;i<240;i++){environment.update(drone.pose.p);drone.step(neutral);}
  assert.ok(drone.pose.p[1]>.05);drone.armed=true;
  for(let i=0;i<240;i++){environment.update(drone.pose.p);drone.step({...neutral,throttle:.30});}
  assert.ok(drone.pose.p[1]>.3);assert.ok(drone.effects.propellers.blades.every(blades=>blades.every(v=>v===0)));
 }finally{environment.dispose();world.free();}
});
