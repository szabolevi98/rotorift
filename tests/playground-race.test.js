import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {loadCatalog} from '../server/catalog.js';
import {buildPlayground} from '../web/game/playground.js';
import {PrebakedCollisions} from '../web/game/prebaked-collisions.js';
import {COLLISION_ASSETS} from '../shared/world/collision-assets.js';
import {decodeCollisionData} from '../shared/world/collision-data.js';
import {makeGuideClearance} from '../web/game/route-guide-planner.js';
import {gateFrameParts} from '../web/game/race-course.js';
import {gateBasis} from '../shared/race/gates.js';

await RAPIER.init();
const map=(await loadCatalog()).maps.find(m=>m.id==='jatszoter'),route=map.routes.find(r=>r.id==='race_2');

test('Pocket Gauntlet supplements the easy course and actually enters five equipment types',()=>{
  assert.equal(map.routes[0].name,'Pocket Circuit');assert.equal(map.routes[0].version,3);
  assert.equal(route.details.difficulty,'hard');
  assert.deepEqual(route.details.recommendedDrones,['rift-65','rift-75']);
  assert.equal(route.gates.length,29);
  assert.deepEqual(route.gates[2].p,[-5,.68,14.4]);assert.deepEqual(route.gates[3].p,[-5,.68,11.6]);
  assert.deepEqual(route.gates[6].p,[-15,1.5,-7]);
  assert.deepEqual(route.gates[9].p,[-3.4,.62,-4.15]);
  assert.deepEqual(route.gates[13].p,[11.6,1.9,-8.8]);assert.deepEqual(route.gates[14].p,[16.4,1.9,-8.8]);
  assert.deepEqual(route.gates[17].p,[14.6,1.9,-10.6]);assert.deepEqual(route.gates[18].p,[14.6,1.9,-3.4]);
  assert.deepEqual(route.gates[20].n,[0,-1,0]);assert.equal(route.gates[20].p[1],3.7);
  assert.ok(route.gates[24].p[2]<16&&route.gates[25].p[2]>16,'pass through both sides of the playhouse');
  assert.equal(new Set(route.gates.map(g=>g.p.join(':'))).size,route.gates.length,'no overlapping duplicate gate meshes');
});

for(const prepared of [false,true])test(`${prepared?'prepared':'source'} technical playground: equipment openings and physical race rails leave a clear micro-drone route`,async()=>{
  const world=new RAPIER.World({x:0,y:0,z:0});let environment;
  if(prepared){
    const raw=gunzipSync(await readFile(new URL('../web'+COLLISION_ASSETS[map.id].url,import.meta.url)));
    environment=new PrebakedCollisions(RAPIER,world,map,decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),map.id));
  }else environment=buildPlayground(new THREE.Scene(),world,RAPIER,map);
  const rails=[];
  try{
    world.colliders.forEach(c=>c.setEnabled(true));world.step();
    const sceneryClear=makeGuideClearance(world,RAPIER,.18);
    for(const [leg,points]of route.guide.entries())for(let i=1;i<points.length;i++)
      assert.ok(sceneryClear(points[i-1],points[i]),`leg ${leg+1}: equipment clears a 36 cm diameter envelope`);
    for(const [index,g]of route.gates.entries()){
      const {right,up}=gateBasis(g.n),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...right),new THREE.Vector3(...up),new THREE.Vector3(...g.n)));
      const hit=world.castShape({x:g.p[0],y:g.p[1],z:g.p[2]},q,{x:0,y:0,z:0},new RAPIER.Cuboid(g.width/2+.035,g.height/2+.035,.04),0,0,true);
      assert.ok(!hit,`gate ${index+1}: the whole frame fits the equipment aperture`);
      for(const [size,local]of gateFrameParts(g)){
        const p=new THREE.Vector3(...local).applyQuaternion(q).add(new THREE.Vector3(...g.p));
        rails.push(world.createCollider(RAPIER.ColliderDesc.cuboid(...size.map(v=>v/2)).setTranslation(p.x,p.y,p.z).setRotation(q)));
      }
    }
    world.step();const clear=makeGuideClearance(world,RAPIER,.12);
    for(const [leg,points]of route.guide.entries())for(let i=1;i<points.length;i++)
      assert.ok(clear(points[i-1],points[i]),`leg ${leg+1}: no gate rail blocks the line, including other cage passes`);
  }finally{
    for(const rail of rails)world.removeCollider(rail,true);
    environment.dispose();world.free();
  }
});
