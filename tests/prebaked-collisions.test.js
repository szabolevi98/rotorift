import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import RAPIER from "@dimforge/rapier3d-compat";
import { decodeCollisionData, encodeCollisionData } from "../shared/world/collision-data.js";
import { COLLISION_ASSETS } from "../shared/world/collision-assets.js";
import { PrebakedCollisions } from "../web/game/prebaked-collisions.js";
import { collisionSourceHash } from "../scripts/build-collisions.mjs";
import { constructionHeight, floorOpening, CONSTRUCTION_BUILDINGS } from "../shared/world/construction-layout.js";
import { parkSurfaceHeight } from "../shared/world/park-layout.js";
import { DronePhysics } from "../shared/physics/drone.js";
import { hoverThrottle } from "../shared/physics/propulsion.js";
await RAPIER.init();
const load = async id => {
  const map=JSON.parse(await readFile(new URL(`../data/maps/${id}.json`,import.meta.url)));
  const raw=gunzipSync(await readFile(new URL(`../web${COLLISION_ASSETS[id].url}`,import.meta.url)));
  return {map,records:decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),id)};
};
test("collision assets match the procedural sources and map versions", async()=>{
  const hash=await collisionSourceHash();
  for(const id of ["liget","betonudvar"]){
    const {map,records}=await load(id), asset=COLLISION_ASSETS[id];
    assert.equal(asset.sourceHash,hash,"Regenerate using npm run collisions:build");
    assert.equal(asset.mapVersion,map.version);assert.equal(records.length,asset.records);
    assert.ok(asset.bytes<4*1024*1024);
  }
});
test("collision decoding rejects corrupt, mismatched and out-of-range geometry",()=>{
  const data=encodeCollisionData("test",[{kind:"mesh",min:[0,0,0],max:[1,0,1],friction:.9,
    vertices:new Float32Array([0,0,0,1,0,0,0,0,1]),indices:new Uint32Array([0,1,2])}]);
  assert.equal(decodeCollisionData(data.buffer,"test")[0].indices.length,3);
  assert.throws(()=>decodeCollisionData(data.buffer,"other"));
  assert.throws(()=>decodeCollisionData(data.buffer.slice(0,16),"test"));
  const corrupt=data.slice();corrupt[0]=0;assert.throws(()=>decodeCollisionData(corrupt.buffer,"test"));
  const invalid=encodeCollisionData("test",[{kind:"mesh",min:[0,0,0],max:[1,1,1],friction:.9,
    vertices:new Float32Array([0,0,0]),indices:new Uint32Array([0,4,0])}]);
  assert.throws(()=>decodeCollisionData(invalid.buffer,"test"));
});
test("baked construction retains clear roads, shafts, columns and hollow pipe openings",async()=>{
  const {map,records}=await load("betonudvar"),world=new RAPIER.World({x:0,y:-9.81,z:0});
  const baked=new PrebakedCollisions(RAPIER,world,map,records);
  try{
    // Inspect the entire prepared geometry separately from the locality policy.
    for(const collider of baked.colliders)collider.setEnabled(true);world.step();
    const ray=(p,d,length)=>world.castRay(new RAPIER.Ray({x:p[0],y:p[1],z:p[2]},{x:d[0],y:d[1],z:d[2]}),length,true);
    assert.equal(ray([0,1.8,255],[0,0,-1],535),null);
    for(const b of CONSTRUCTION_BUILDINGS){
      const [x,z]=floorOpening(b),base=constructionHeight(b.x,b.z),height=base+b.levels*b.storey;
      const shaft=ray([x,height+4,z],[0,-1,0],height+8);
      assert.ok(shaft&&Math.abs(shaft.timeOfImpact-(height+4-base-.24))<.05,b.id+": shaft floor");
      assert.equal(ray([x,base+2.2,b.z-b.depth/2-1],[0,0,1],b.depth+2),null,b.id+": first level opening");
      assert.ok(ray([b.x-b.width/2-3,base+2,b.z-b.depth/2],[1,0,0],4),b.id+": column");
    }
    const base=constructionHeight(164,193);
    assert.equal(ray([157,base+1.55,187],[0,0,1],12),null);
    assert.ok(ray([158.5,base+1.55,187],[0,0,1],12));
    assert.ok(ray([800,10,800],[0,-1,0],12));
  }finally{baked.dispose();assert.equal(world.colliders.len(),0);world.free();}
});
test("baked park retains its passage, road/terrain heights and physical ground beyond the baked area",async()=>{
  const {map,records}=await load("liget"),world=new RAPIER.World({x:0,y:-9.81,z:0});
  const baked=new PrebakedCollisions(RAPIER,world,map,records);
  try{
    for(const collider of baked.colliders)collider.setEnabled(true);world.step();
    assert.equal(world.castRay(new RAPIER.Ray({x:0,y:2,z:15},{x:0,y:0,z:-1}),30,true),null);
    for(const [x,z]of [[23.2,61.7],[89.1,23.3],[124,112],[2.3,5.8]]){
      const hit=world.castRay(new RAPIER.Ray({x,y:40,z},{x:0,y:-1,z:0}),50,true,undefined,undefined,undefined,undefined,
        collider=>Math.abs(collider.friction()-.9)<.001);
      assert.ok(hit&&Math.abs(40-hit.timeOfImpact-parkSurfaceHeight(x,z))<.14);
    }
    const x=640,z=640,y=parkSurfaceHeight(x,z);baked.update([x,y+2,z]);world.step();
    const outside=world.castRay(new RAPIER.Ray({x,y:y+5,z},{x:0,y:-1,z:0}),10,true);
    assert.ok(outside&&Math.abs(y+5-outside.timeOfImpact-y)<.001);
    assert.ok(baked.outerTerrain.size<=9);
  }finally{baked.dispose();assert.equal(world.colliders.len(),0);world.free();}
});
test("baked mesh columns stop a 60 m/s aircraft with local activation and CCD",async()=>{
  const {map,records}=await load("betonudvar"),world=new RAPIER.World({x:0,y:-9.81,z:0});
  const baked=new PrebakedCollisions(RAPIER,world,map,records), b=CONSTRUCTION_BUILDINGS[0];
  const columnX=b.x-b.width/2,z=b.z-b.depth/2,y=constructionHeight(b.x,b.z)+2;
  const config=JSON.parse(await readFile(new URL("../data/drones/rift-x5.json",import.meta.url)));
  const drone=new DronePhysics(RAPIER,world,config,[columnX-60,y,z],{updateSceneQueries:false});drone.armed=true;
  let maxX=-Infinity;
  try{
    for(let frame=0;frame<100;frame++){
      if(drone.pose.p[0]<columnX-1)drone.body.setLinvel({x:60,y:0,z:0},true);
      baked.update(drone.pose.p,drone.pose.v);
      for(let step=0;step<4;step++){drone.step({roll:0,pitch:0,yaw:0,throttle:hoverThrottle(config)});maxX=Math.max(maxX,drone.pose.p[0]);}
    }
    assert.ok(maxX>columnX-2&&maxX<columnX,`must reach but not pass the column: ${maxX}, column ${columnX}`);
  }finally{drone.dispose();baked.dispose();world.free();}
});
for(const id of ["liget","betonudvar"])test(`${id}: baked local physics lifts at spawn and collision workload stays bounded`,async()=>{
  const {map,records}=await load(id),world=new RAPIER.World({x:0,y:-9.81,z:0});
  const baked=new PrebakedCollisions(RAPIER,world,map,records);
  const config=JSON.parse(await readFile(new URL("../data/drones/rift-x5.json",import.meta.url)));
  const drone=new DronePhysics(RAPIER,world,config,map.spawn,{updateSceneQueries:false});
  try{
    for(let i=0;i<240;i++)drone.step({roll:0,pitch:0,yaw:0,throttle:0});
    const start=drone.pose.p[1];drone.armed=true;
    for(let i=0;i<480;i++){baked.update(drone.pose.p,drone.pose.v);drone.step({roll:0,pitch:0,yaw:0,throttle:.3});}
    assert.ok(drone.pose.p[1]>start+.8,"30% lifts without an invisible baked ceiling");
    baked.update(id==="liget"?[0,2,0]:[-68,constructionHeight(-68,-30)+2,-30]);
    assert.ok(baked.activeCount<40,`near a building: ${baked.activeCount} colliders`);
  }finally{drone.dispose();baked.dispose();world.free();}
});
