import test from 'node:test';import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {loadCatalog} from '../server/catalog.js';
import {findWaterImpact,stopWaterDamagedAircraft,PARK_FOUNTAIN_JETS} from '../shared/world/water-hazards.js';
import {PARK_LAKES,PARK_BRIDGE} from '../shared/world/park-layout.js';
import {CITY_PLAZA} from '../shared/world/city-layout.js';
import {createAircraftPhysics} from '../shared/physics/aircraft.js';
const catalog=await loadCatalog(),park=catalog.maps.find(m=>m.kind==='park'),city=catalog.maps.find(m=>m.kind==='city');
const drone=catalog.drones.find(d=>d.id==='rift-x5'),plane=catalog.airplanes.find(d=>d.id==='rift-t15');
const pose=p=>({p,q:{x:0,y:0,z:0,w:1}});
test('both irregular lakes stop drones and planes, while shoreline, bridges and overflight remain clear',()=>{
 for(const lake of PARK_LAKES)for(const config of [drone,plane]) {
  const x=lake.x+15,z=lake.z;
  assert.equal(findWaterImpact(park,config,pose([x,2,z]),pose([x,lake.waterY,z])),'water');
  assert.equal(findWaterImpact(park,config,pose([x,4,z]),pose([x+3,4,z])),null);
  assert.equal(findWaterImpact(park,config,pose([lake.x+lake.rx*1.3,0,z]),pose([lake.x+lake.rx*1.3,0,z])),null);
 }
 assert.equal(findWaterImpact(park,plane,pose([PARK_BRIDGE.x,PARK_BRIDGE.deckY+.3,PARK_BRIDGE.z]),pose([PARK_BRIDGE.x+1,PARK_BRIDGE.deckY+.3,PARK_BRIDGE.z])),null);
});
test('individual curved jets shut down aircraft at speed, but the gaps and air above them remain flyable',()=>{
 const jet=PARK_FOUNTAIN_JETS[0],p=jet.points[12];
 assert.equal(findWaterImpact(park,drone,pose([p[0],p[1],p[2]-.8]),pose([p[0],p[1],p[2]+.8])),'fountain');
 const lake=PARK_LAKES[0];
 assert.equal(findWaterImpact(park,drone,pose([lake.x+2,9,lake.z]),pose([lake.x+2.1,9,lake.z])),null);
 assert.equal(findWaterImpact(park,drone,pose([lake.x+2,2,lake.z+2]),pose([lake.x+2.1,2,lake.z+2])),null);
 // A banked wingtip can get wet while the fuselage remains above the surface.
 const q={x:0,y:0,z:Math.sin(Math.PI/4),w:Math.cos(Math.PI/4)};
 assert.equal(findWaterImpact(park,plane,{p:[lake.x+15,.8,lake.z],q},{p:[lake.x+15,.8,lake.z],q}),'water');
});
test('Skyline basin and jets are hazardous, surrounding pavement is safe',()=>{
 const x=CITY_PLAZA.x,z=CITY_PLAZA.z;
 assert.equal(findWaterImpact(city,drone,pose([x+4,2,z+4]),pose([x+4,.61,z+4])),'water');
 assert.equal(findWaterImpact(city,drone,pose([x,2,z-1]),pose([x,2,z+1])),'fountain');
 assert.equal(findWaterImpact(city,drone,pose([x+20,.2,z]),pose([x+20,.2,z])),null);
});
test('water failure is independent of optional damage effects, disables turtle and clears fully on reset',async()=>{
 await RAPIER.init();
 for(const config of [drone,plane]) {
  const world=new RAPIER.World({x:0,y:0,z:0}),p=createAircraftPhysics(RAPIER,world,config,[0,10,0],{simulation:{propDamage:false}});
  try {
   p.armed=true;p.turtleMode=true;p.motorThrust.fill(1);stopWaterDamagedAircraft(p,'water');
   assert.equal(p.armed,false);assert.equal(p.crashed,true);assert.equal(p.turtleMode,false);
   assert.ok(p.motorThrust.every(v=>v===0));assert.equal(p.crashReason,'water');
   p.reset([0,10,0]);assert.equal(p.crashed,false);assert.equal(p.crashReason,null);
  }finally{p.dispose();world.free();}
 }
});
test('all existing lake and city race guides stay clear of the water hazards',()=>{
 for(const map of [park,city])for(const route of map.routes) {
  const config=route.aircraftKinds?.includes('fixedWing')?plane:drone;
  for(const leg of route.guide??[])for(let i=1;i<leg.length;i++)
   assert.equal(findWaterImpact(map,config,pose(leg[i-1]),pose(leg[i])),null,`${map.id}/${route.id}`);
 }
});
