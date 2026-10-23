import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { loadCatalog } from '../server/catalog.js';
import { buildGym } from '../web/game/gym.js';
import { PrebakedCollisions } from '../web/game/prebaked-collisions.js';
import { COLLISION_ASSETS } from '../shared/world/collision-assets.js';
import { decodeCollisionData } from '../shared/world/collision-data.js';
import { makeGuideClearance } from '../web/game/route-guide-planner.js';
import { gateFrameParts } from '../web/game/race-course.js';
import { gateBasis, advanceLap, newLap } from '../shared/race/gates.js';
import { supportsMap } from '../shared/aircraft/capabilities.js';
import { aircraftLaunch } from '../shared/aircraft/launch.js';
import { DronePhysics } from '../shared/physics/drone.js';
import { hoverThrottle } from '../shared/physics/propulsion.js';
await RAPIER.init();
const catalog=await loadCatalog(),map=catalog.maps.find(m=>m.id==='gym');

test('indoor catalog recommends whoops and has distinct easy and apparatus routes',()=>{
  assert.equal(map.droneClass,'micro');assert.equal(map.kind,'gym');
  assert.deepEqual(map.routes.map(r=>r.details.difficulty),['easy','medium']);
  assert.deepEqual(map.routes.map(r=>r.gates.length),[9,16]);
  assert.ok(supportsMap(catalog.drones[0],map));assert.equal(supportsMap(catalog.airplanes[0],map),false);
});

for(const prepared of [false,true])test(`${prepared?'baked':'source'} gym: closed shell, open apparatus, clear launch slots and complete race lines`,async()=>{
  const world=new RAPIER.World({x:0,y:0,z:0}),scene=new THREE.Scene();let environment;
  if(prepared){
    const asset=COLLISION_ASSETS.gym,raw=gunzipSync(await readFile(new URL('../web'+asset.url,import.meta.url)));
    environment=new PrebakedCollisions(RAPIER,world,map,decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'gym'));
    assert.ok(asset.bytes<25000);
  }else{
    environment=buildGym(scene,world,RAPIER,map);
    assert.ok(environment.root.userData.landmarks.length>=18);
    assert.ok(environment.root.userData.batches<40);
  }
  try{
    world.colliders.forEach(c=>c.setEnabled(true));world.step();
    const ray=(p,d,n)=>world.castRay(new RAPIER.Ray(new THREE.Vector3(...p),new THREE.Vector3(...d)),n,true);
    for(const dir of [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0],[0,-1,0]])
      assert.ok(ray([0,4,0],dir,24),'all six hall surfaces must collide');
    assert.equal(ray([-5,.8,8.1],[0,0,-1],2.2),null,'foam arch is open');
    assert.ok(ray([-4.05,.8,8.1],[0,0,-1],2.2),'arch pillar is solid');
    assert.equal(ray([5,.85,-6.5],[0,0,1],5),null,'parallel bar corridor is open');
    assert.equal(ray([6.85,2.5,7],[0,0,1],2),null,'training hoop centre is open');
    assert.ok(ray([7.35,2.5,7],[0,0,1],2),'training hoop rim collides');
    const clear=makeGuideClearance(world,RAPIER,.18);
    for(let slot=0;slot<8;slot++){
      const p=aircraftLaunch(catalog.drones[0],map,{slot}).p;
      assert.ok(makeGuideClearance(world,RAPIER,.1)(p,p),'all eight multiplayer launch slots fit inside the hall');
    }
    for(const route of map.routes){
      for(const points of route.guide)for(let i=1;i<points.length;i++)assert.ok(clear(points[i-1],points[i]),route.name+': whoop clearance');
      const rails=[];
      for(const g of route.gates){
        const {right,up}=gateBasis(g.n),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
          new THREE.Vector3(...right),new THREE.Vector3(...up),new THREE.Vector3(...g.n)));
        assert.equal(world.castShape(new THREE.Vector3(...g.p),q,{x:0,y:0,z:0},
          new RAPIER.Cuboid(g.width/2+.025,g.height/2+.025,.03),0,0,true),null,'whole gate frame clears apparatus');
        for(const [size,local]of gateFrameParts(g)){
          const p=new THREE.Vector3(...local).applyQuaternion(q).add(new THREE.Vector3(...g.p));
          rails.push(world.createCollider(RAPIER.ColliderDesc.cuboid(...size.map(v=>v/2)).setTranslation(p.x,p.y,p.z).setRotation(q)));
        }
      }
      world.step();const railClear=makeGuideClearance(world,RAPIER,.12),lap=newLap();let time=0;
      const first=route.gates[0];advanceLap(lap,first.p.map((v,i)=>v-first.n[i]),first.p,0,time+=100,route.gates);
      for(const points of route.guide)for(let i=1;i<points.length;i++){
        assert.ok(railClear(points[i-1],points[i]),route.name+': equipment and gate rails clear the line');
        advanceLap(lap,points[i-1],points[i],time,time+=100,route.gates);
      }
      assert.equal(lap.completed,1,route.name+': following the guide completes a lap');
      for(const c of rails)world.removeCollider(c,true);world.step();
    }
  }finally{environment.dispose();assert.equal(world.colliders.len(),0);world.free();}
});

for(const id of ['rift-65','rift-75'])test(`${id}: physically clears the gym hoop and parallel bars without prop damage`,()=>{
  const config=catalog.drones.find(d=>d.id===id);
  for(const [start,speed,seconds]of [[[6.85,2.5,6.8],1,2.4],[[5,.85,-6.3],1,4.6]]){
    const world=new RAPIER.World({x:0,y:-9.81,z:0}),environment=buildGym(new THREE.Scene(),world,RAPIER,map);
    const drone=new DronePhysics(RAPIER,world,config,start,{simulation:{propDamage:true}});drone.armed=true;
    try{
      for(let i=0;i<seconds*240;i++){
        const pose=drone.pose;environment.update(pose.p);drone.body.setLinvel({x:0,y:0,z:speed},true);
        drone.step({throttle:hoverThrottle(config),roll:0,pitch:0,yaw:0},1/240);
      }
      assert.ok(drone.pose.p[2]>start[2]+speed*seconds-.15);
      assert.ok(Math.abs(drone.pose.p[1]-start[1])<.1);
      assert.equal(drone.crashed,false);assert.ok(drone.effects.propellers.blades.every(b=>b.every(v=>v===0)));
    }finally{drone.dispose();environment.dispose();world.free();}
  }
});
