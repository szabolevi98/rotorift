import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {PilotPositionPicker} from '../web/game/pilot-position.js';
import {buildCity} from '../web/game/city.js';
import {buildPark} from '../web/game/park.js';
import {parkSurfaceHeight,PARK_LAKES,lakeDistance} from '../shared/world/park-layout.js';
import {citySurfaceHeight} from '../shared/world/city-layout.js';
import {COLLISION_ASSETS} from '../shared/world/collision-assets.js';
import {decodeCollisionData} from '../shared/world/collision-data.js';
import {PrebakedCollisions} from '../web/game/prebaked-collisions.js';
await RAPIER.init();

test('pilot uses the roof below the airplane even while its collision region is disabled',()=>{
  const world=new RAPIER.World({x:0,y:0,z:0});
  try{
    const roof=world.createCollider(RAPIER.ColliderDesc.cuboid(10,5,10).setTranslation(0,5,0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(10,5,10).setTranslation(40,5,0));
    world.step();roof.setEnabled(false);
    const picker=new PilotPositionPicker(RAPIER,world,{kind:'construction'},()=>0);
    const flags=[];world.colliders.forEach(c=>flags.push(c.isEnabled()));
    const point=picker.find([0,90,0]);
    assert.ok(Math.abs(point.y-11.7)<.001);assert.equal(point.x,0);assert.equal(point.z,0);
    const after=[];world.colliders.forEach(c=>after.push(c.isEnabled()));assert.deepEqual(after,flags);
    assert.equal(picker.find([40,90,0]).x,40,'a fresh switch selects the new location');
  }finally{world.free();}
});

test('roof edges, small props and posts cannot leave the pilot floating or inside an obstacle',()=>{
  const world=new RAPIER.World({x:0,y:0,z:0});
  try{
    world.createCollider(RAPIER.ColliderDesc.cuboid(10,5,10).setTranslation(0,5,0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.5,.7,1.5).setTranslation(0,10.7,0));
    world.createCollider(RAPIER.ColliderDesc.cylinder(5,.3).setTranslation(30,5,0));
    world.step();
    const picker=new PilotPositionPicker(RAPIER,world,{kind:'construction'},()=>0);
    const roof=picker.find([0,50,0]);assert.ok(Math.abs(roof.y-11.7)<.001);assert.ok(Math.hypot(roof.x,roof.z)>=2);
    const edge=picker.find([9.9,50,0]);assert.ok(Math.abs(edge.y-11.7)<.001);assert.ok(Math.abs(edge.x)<=9.3&&Math.abs(edge.z)<=9.3);
    const post=picker.find([30,50,0]);assert.equal(post.y,1.7);assert.ok(Math.hypot(post.x-30,post.z)>.6);
  }finally{world.free();}
});

test('lake crossings find dry shore, while a real bridge deck over water is valid',()=>{
  const world=new RAPIER.World({x:0,y:0,z:0}),lake=PARK_LAKES[0];
  try{
    const picker=new PilotPositionPicker(RAPIER,world,{kind:'park'},parkSurfaceHeight);
    const shore=picker.find([lake.x,80,lake.z]);assert.ok(shore);assert.ok(lakeDistance(lake,shore.x,shore.z)>1.08);
    world.createCollider(RAPIER.ColliderDesc.cuboid(15,.2,3).setTranslation(lake.x,3,lake.z));world.step();
    const deck=new PilotPositionPicker(RAPIER,world,{kind:'park'},parkSurfaceHeight).find([lake.x,80,lake.z]);
    assert.ok(Math.abs(deck.y-4.9)<.001);assert.equal(deck.x,lake.x);
  }finally{world.free();}
});

for(const baked of [false,true])test(`${baked?'baked':'source'} Skyline supports street, podium terrace and skyscraper pilot positions`,async()=>{
  const map=JSON.parse(await readFile(new URL('../data/maps/skyline.json',import.meta.url))),world=new RAPIER.World({x:0,y:0,z:0});let city;
  if(baked){const raw=gunzipSync(await readFile(new URL('../web'+COLLISION_ASSETS.skyline.url,import.meta.url)));city=new PrebakedCollisions(RAPIER,world,map,decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'skyline'));}
  else city=buildCity(new THREE.Scene(),world,RAPIER,map);
  try{
    city.update([60,180,60]);world.step();
    const picker=new PilotPositionPicker(RAPIER,world,map,citySurfaceHeight);
    for(const [position,expected]of [[[60,100,60],1.7],[[30,50,-120],14.58],[[10,230,-120],218.88]]){
      const point=picker.find(position);assert.ok(point);assert.ok(Math.abs(point.y-expected)<.01,`${position}: ${point.toArray()}`);
    }
    const fountain=picker.find([0,80,120]);assert.ok(fountain);assert.ok(Math.abs(fountain.x)>=15.4||Math.abs(fountain.z-120)>=9.4);
  }finally{city.dispose();world.free();}
});

test('Grove retains scenery at the pilot while physics and aircraft scenery keep following the airplane',async()=>{
  const map=JSON.parse(await readFile(new URL('../data/maps/liget.json',import.meta.url))),scene=new THREE.Scene(),world=new RAPIER.World({x:0,y:0,z:0}),park=buildPark(scene,world,RAPIER,map);
  try{
    const observer=[0,1.7,0];park.update([1000,60,0],[15,0,0],observer);
    assert.equal(park.chunkCount,58);assert.equal(park.physicsChunkCount,9);
    const distant=park.root.getObjectByName('park-distant-terrain').geometry;
    park.update([1400,60,0],[15,0,0],observer);
    assert.equal(park.chunkCount,58);assert.equal(park.physicsChunkCount,9);
    assert.equal(park.root.getObjectByName('park-distant-terrain').geometry,distant,'stationary ground never gets rebuilt around a moving aircraft');
    park.update([1400,60,0]);assert.equal(park.chunkCount,49);
  }finally{park.dispose();world.free();}
});
