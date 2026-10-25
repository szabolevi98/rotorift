import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { loadCatalog } from '../server/catalog.js';
import { buildHarbor } from '../web/game/harbor.js';
import { HARBOR, harborSurfaceHeight, harborWaterAt } from '../shared/world/harbor-layout.js';
import { findWaterImpact } from '../shared/world/water-hazards.js';
import { PrebakedCollisions } from '../web/game/prebaked-collisions.js';
import { COLLISION_ASSETS } from '../shared/world/collision-assets.js';
import { decodeCollisionData } from '../shared/world/collision-data.js';
import { aircraftLaunch } from '../shared/aircraft/launch.js';
import { PilotPositionPicker } from '../web/game/pilot-position.js';
import { DronePhysics } from '../shared/physics/drone.js';
import { hoverThrottle } from '../shared/physics/propulsion.js';
import { makeGuideClearance } from '../web/game/route-guide-planner.js';
import { gateBasis } from '../shared/race/gates.js';
await RAPIER.init();
const catalog=await loadCatalog(),map=catalog.maps.find(m=>m.id==='harbor');
const drone=catalog.drones.find(c=>c.id==='rift-x5'),plane=catalog.airplanes.find(c=>c.id==='rift-t15');
const pose=p=>({p,q:{x:0,y:0,z:0,w:1}});

test('both gantry cranes have connected side braces and supported mast feet',()=>{
  const environment=buildHarbor(new THREE.Scene(),null,null,map);
  try{
    const steel=environment.root.getObjectByName('Harbor_box_crane');
    const braces=environment.root.getObjectByName('Harbor_box_craneLight');
    const members=[];
    for(let i=0;i<steel.count;i++){
      const matrix=new THREE.Matrix4();steel.getMatrixAt(i,matrix);
      members.push({matrix,inverse:matrix.clone().invert(),size:new THREE.Vector3().setFromMatrixScale(matrix)});
    }
    const touches=(point,exclude)=>members.some(member=>{
      if(member===exclude)return false;
      const local=point.clone().applyMatrix4(member.inverse);
      return Math.max(Math.abs(local.x),Math.abs(local.y),Math.abs(local.z))<=.501;
    });
    let sideBraces=0,mastFeet=0;
    for(let i=0;i<braces.count;i++){
      const matrix=new THREE.Matrix4();braces.getMatrixAt(i,matrix);
      const center=new THREE.Vector3().setFromMatrixPosition(matrix);
      if(center.y<28||center.y>34)continue;
      for(const end of [-.5,.5])assert.ok(touches(new THREE.Vector3(0,end,0).applyMatrix4(matrix)),
        'side brace endpoints must intersect the leg or portal frame');
      sideBraces++;
    }
    for(const member of members){
      if(Math.abs(member.size.x-1.1)>.001)continue;
      const foot=new THREE.Vector3(0,-.5,0).applyMatrix4(member.matrix);
      assert.ok(touches(foot,member),'every mast foot needs a connected crossmember');
      mastFeet++;
    }
    assert.equal(sideBraces,8);assert.equal(mastFeet,8);
  }finally{environment.dispose();}
});

test('harbor water matches the quay, piers and breakwaters for drones and airplanes',()=>{
  for(const config of [drone,plane]){
    assert.equal(findWaterImpact(map,config,pose([300,5,0]),pose([300,0,0])),'water');
    assert.equal(findWaterImpact(map,config,pose([300,4,0]),pose([310,4,0])),null);
    assert.equal(findWaterImpact(map,config,pose([59,1,0]),pose([63,-1,0])),'water','swept shoreline crossing');
    for(const p of [[0,0,0],[150,0,-190],[150,0,80],[295,0,330]])
      assert.equal(findWaterImpact(map,config,pose(p),pose(p)),null,'no false water on solid quays');
    for(const route of map.routes.filter(r=>r.aircraftKinds.includes(config.kind==='fixedWing'?'fixedWing':'quadrotor')))
      for(const leg of route.guide)for(let i=1;i<leg.length;i++)
        assert.equal(findWaterImpact(map,config,pose(leg[i-1]),pose(leg[i])),null,route.name);
  }
  assert.equal(harborWaterAt(300,0),true);assert.equal(harborWaterAt(150,80),false);
  assert.equal(harborSurfaceHeight(300,0),-12);assert.equal(harborSurfaceHeight(165,-135),7.14);
});

for(const prepared of [false,true])test(`${prepared?'prepared':'source'} harbor: open container, warehouse and crane portal; solid hull and safe pilots`,async()=>{
  const scene=new THREE.Scene(),world=new RAPIER.World({x:0,y:0,z:0});let environment;
  if(prepared){
    const raw=gunzipSync(await readFile(new URL('../web'+COLLISION_ASSETS.harbor.url,import.meta.url)));
    environment=new PrebakedCollisions(RAPIER,world,map,decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'harbor'));
  }else{
    environment=buildHarbor(scene,world,RAPIER,map);
    assert.ok(environment.root.userData.batches<55,'shared instance batches, not a draw call per container');
    assert.ok(environment.root.userData.colliders<3200,'cargo uses simple local contact shapes');
    assert.ok(environment.root.getObjectByName('Container_ship_closed_hull'));
    const outline=environment.root.getObjectByName('Landward_coastal_hills');
    assert.ok(outline.geometry.attributes.normal.getY(500)>.1,'hills have a visible upward-facing terrain surface');
    for(const name of ['Harbor_open_sea','Harbor_continuous_ground']){
      const surface=environment.root.getObjectByName(name),p=surface.geometry.attributes.position;
      const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
      for(let i=0;i<p.count;i+=3){
        a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);
        const minX=Math.min(a.x,b.x,c.x),maxX=Math.max(a.x,b.x,c.x),minZ=Math.min(a.z,b.z,c.z),maxZ=Math.max(a.z,b.z,c.z);
        if(name==='Harbor_open_sea')assert.ok(minX>=HARBOR.shoreX,'water never overlaps the land surface');
        if(maxX>=-1024&&minX<=1024&&maxZ>=-1024&&minZ<=1024)
          assert.ok(Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a))<182,'no giant clipping-prone triangle near the port');
      }
      for(const [x,z]of name==='Harbor_open_sea'?[[60.01,-410],[128,0],[256,410],[700,-700]]:[[-410,-410],[-256,128],[59.99,410],[-900,-700]]){
        const ray=new THREE.Raycaster(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0));
        assert.ok(ray.intersectObject(surface,false).length,'surface remains closed across grid and yard seams');
      }
    }
  }
  try{
    world.colliders.forEach(c=>c.setEnabled(true));world.step();
    const ray=(p,d,length)=>world.castRay(new RAPIER.Ray(new THREE.Vector3(...p),new THREE.Vector3(...d)),length,true);
    assert.equal(ray([-120,4.4,245],[0,0,-1],20),null,'open container is a real tunnel');
    assert.ok(ray([-118.82,4.4,245],[0,0,-1],20),'container side is solid');
    assert.equal(ray([-300,8,103],[0,0,-1],126),null,'warehouse entrance and opposite exit are open');
    assert.ok(ray([-265,8,103],[0,0,-1],126),'warehouse wall is solid');
    assert.ok(makeGuideClearance(world,RAPIER,2)([-245,5.2,-275],[-245,5.2,-185]),
      'cold store leaves the marked service lane beside it clear');
    assert.equal(ray([30,18,-112],[0,0,1],45),null,'crane portal is open');
    assert.ok(ray([44,10,-112],[0,0,1],45),'crane foot/leg collides');
    assert.ok(ray([200,3,-55],[-1,0,0],40),'ship hull has outward-facing solid sides');
    const deck=ray([165,20,-135],[0,-1,0],25);
    assert.ok(deck&&Math.abs(deck.timeOfImpact-12.86)<.02,'visible bow deck and collision deck agree');
    assert.equal(ray([300,1,0],[0,-1,0],2),null,'no invisible solid sea surface');
    const clear=makeGuideClearance(world,RAPIER,.2);
    for(let slot=0;slot<8;slot++){
      const p=aircraftLaunch(drone,map,{slot}).p;
      assert.ok(makeGuideClearance(world,RAPIER,.1)(p,p),'eight clear drone launch slots');
    }
    for(const config of catalog.airplanes){
      const p=aircraftLaunch(config,{...map,gates:[]}).p;assert.ok(clear(p,p),'free-flight airplane starts in clear air');
    }
    for(const route of map.routes){
      const routeClear=makeGuideClearance(world,RAPIER,route.aircraftKinds.includes('fixedWing')?1.25:.45);
      if(route.aircraftKinds.includes('fixedWing'))assert.ok(routeClear(route.spawn,route.gates[0].p),route.name+': launch approach stays open');
      for(const [leg,points]of route.guide.entries())for(let i=1;i<points.length;i++)
        assert.ok(routeClear(points[i-1],points[i]),`${route.name}: cargo must clear guide ${leg+1}/${i}`);
      for(const [i,g]of route.gates.entries()){
        const {right,up}=gateBasis(g.n),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
          new THREE.Vector3(...right),new THREE.Vector3(...up),new THREE.Vector3(...g.n)));
        const p=new THREE.Vector3(...g.p).addScaledVector(new THREE.Vector3(...g.n),-2);
        assert.equal(world.castShape(p,q,new THREE.Vector3(...g.n).multiplyScalar(4),
          new RAPIER.Cuboid(g.width/2+.07,g.height/2+.07,.07),0,1,true),null,`${route.name}: gate ${i+1} and approach stay open`);
      }
    }
    const picker=new PilotPositionPicker(RAPIER,world,map,harborSurfaceHeight);
    assert.equal(picker.surfaceAt(300,0,50),null,'pilot cannot stand on the ocean');
    assert.equal(picker.surfaceAt(165,-135,50),7.14,'pilot may stand on the bow deck');
    assert.ok(Math.abs(picker.surfaceAt(280,330,20)-3)<.001,'breakwater beside the lighthouse is usable footing');
  }finally{environment.dispose();assert.equal(world.colliders.len(),0);world.free();}
});

test('Rift X5 physically flies through the open freight container with intact propellers',()=>{
  const world=new RAPIER.World({x:0,y:-9.81,z:0}),environment=buildHarbor(new THREE.Scene(),world,RAPIER,map);
  const physics=new DronePhysics(RAPIER,world,drone,[-120,4.4,244],{simulation:{propDamage:true}});physics.armed=true;
  try{
    for(let i=0;i<6*240;i++){
      environment.update(physics.pose.p,physics.pose.v);physics.body.setLinvel({x:0,y:0,z:-3},true);
      physics.step({throttle:hoverThrottle(drone),roll:0,pitch:0,yaw:0});
    }
    assert.ok(physics.pose.p[2]<226.5);assert.ok(Math.abs(physics.pose.p[1]-4.4)<.1);
    assert.ok(physics.effects.propellers.blades.every(blades=>blades.every(v=>v===0)));
  }finally{physics.dispose();environment.dispose();world.free();}
});
