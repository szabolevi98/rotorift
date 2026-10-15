import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {buildCity} from '../web/game/city.js';
import {CITY_BUILDINGS,citySurfaceHeight} from '../shared/world/city-layout.js';
import {COLLISION_ASSETS} from '../shared/world/collision-assets.js';
import {decodeCollisionData} from '../shared/world/collision-data.js';
import {PrebakedCollisions} from '../web/game/prebaked-collisions.js';
import {DronePhysics} from '../shared/physics/drone.js';
await RAPIER.init();
const map=JSON.parse(await readFile(new URL('../data/maps/skyline.json',import.meta.url)));

test('Skyline has street-aligned blocks, deliberate landmarks and a bounded low-poly render workload',()=>{
  const scene=new THREE.Scene(),city=buildCity(scene,null,RAPIER,map);
  try{
    assert.equal(map.size,600);assert.ok(CITY_BUILDINGS.length>=40);
    assert.ok(CITY_BUILDINGS.filter(b=>b.height>=120).length>=5);
    assert.equal(citySurfaceHeight(...[map.spawn[0],map.spawn[2]]),0);
    assert.equal(citySurfaceHeight(0,120),.18);
    assert.ok(city.root.userData.batches<60,'thousands of details share material/geometry instance batches');
    assert.ok(city.root.userData.landmarks.some(p=>p.name==='Five_level_open_parking_garage'));
    let triangles=0;city.root.traverse(o=>{if(o.isMesh)triangles+=((o.geometry.index?.count??o.geometry.attributes.position.count)/3)*(o.count??1);});
    assert.ok(triangles<400000,`district triangles: ${triangles}`);
    const facades=city.root.children.filter(o=>o.material?.map&&o.material.customProgramCacheKey?.()==='rotorift-city-facade-v1');
    assert.ok(facades.length>=3);assert.ok(facades.every(o=>!o.material.transparent&&!o.material.transmission));
  }finally{city.dispose();assert.equal(scene.children.length,0);}
});

for(const baked of [false,true])test(`${baked?'baked':'source'} Skyline: avenues, podium, skywalk and parking bays are open; floors and walls collide`,async()=>{
  const world=new RAPIER.World({x:0,y:-9.81,z:0});let city;
  if(baked){
    const raw=gunzipSync(await readFile(new URL('../web'+COLLISION_ASSETS.skyline.url,import.meta.url)));
    city=new PrebakedCollisions(RAPIER,world,map,decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'skyline'));
  }else city=buildCity(new THREE.Scene(),world,RAPIER,map);
  try{
    const enabled=new Map();world.colliders.forEach(c=>{enabled.set(c.handle,c.isEnabled());c.setEnabled(true);});world.step();
    const ray=(p,d,length)=>world.castRay(new RAPIER.Ray({x:p[0],y:p[1],z:p[2]},{x:d[0],y:d[1],z:d[2]}),length,true);
    assert.equal(ray([60,2,290],[0,0,-1],580),null,'main avenue');
    assert.equal(ray([-290,2,60],[1,0,0],580),null,'cross street');
    assert.equal(ray([0,5,-70],[0,0,-1],100),null,'tower podium');
    assert.equal(ray([0,49.8,-8],[0,0,1],16),null,'open sides of elevated skywalk');
    assert.equal(ray([-144,2.6,162],[0,0,-1],84),null,'ground-level garage bay');
    const skywalk=ray([0,50,0],[0,-1,0],4);assert.ok(skywalk&&Math.abs(50-skywalk.timeOfImpact-48.18)<.001);
    assert.ok(ray([70,20,-120],[1,0,0],30),'opaque tower facade must be solid');
    const ground=ray([800,4,800],[0,-1,0],6);assert.ok(ground&&Math.abs(4-ground.timeOfImpact)<.001);
    world.colliders.forEach(c=>c.setEnabled(enabled.get(c.handle)));
    city.update([0,49.8,0]);world.step();
    const active=[];world.colliders.forEach(c=>{if(c.isEnabled())active.push(c);});
    assert.ok(active.length<180,`local collider workload: ${active.length}`);
    assert.ok(active.every(c=>c.shape.type!==RAPIER.ShapeType.TriMesh),'city collision remains analytic near geometry');
  }finally{city.dispose();assert.equal(world.colliders.len(),0);world.free();}
});

test('X5 settles on the Skyline road and lifts without intersecting spawn scenery',async()=>{
  const world=new RAPIER.World({x:0,y:-9.81,z:0}),city=buildCity(new THREE.Scene(),world,RAPIER,map);
  const config=JSON.parse(await readFile(new URL('../data/drones/rift-x5.json',import.meta.url))),drone=new DronePhysics(RAPIER,world,config,map.spawn,{updateSceneQueries:false});
  try{
    for(let i=0;i<240;i++){city.update(drone.pose.p);drone.step({roll:0,pitch:0,yaw:0,throttle:0});}
    const ground=drone.pose.p[1];assert.ok(ground>0&&ground<.5);
    drone.armed=true;
    for(let i=0;i<480;i++){city.update(drone.pose.p);drone.step({roll:0,pitch:0,yaw:0,throttle:.3});}
    assert.ok(drone.pose.p[1]>ground+1);assert.ok(Math.hypot(drone.pose.p[0]-60,drone.pose.p[2]-250)<1);
  }finally{drone.dispose();city.dispose();world.free();}
});
