import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {meshToHeightfield} from '../scripts/build-collisions.mjs';
import {encodeCollisionData,decodeCollisionData} from '../shared/world/collision-data.js';
import {COLLISION_ASSETS} from '../shared/world/collision-assets.js';
await RAPIER.init();
function mesh(){
  const vertices=[],indices=[];for(let z=0;z<=8;z++)for(let x=0;x<=16;x++){
    vertices.push(32+x*2,Math.sin(x*.3)*Math.cos(z*.4)+3,16+z*2);
    if(x<16&&z<8){const a=z*17+x,b=a+1,c=a+17,d=c+1;indices.push(a,c,b,b,c,d);}
  }
  return {kind:'mesh',vertices:new Float32Array(vertices),indices:new Uint32Array(indices),min:[32,2,16],max:[64,4,32],friction:.9};
}
test('complete rectangular grids retain column order, triangle diagonal, surface height and normals',()=>{
  const source=mesh(),converted=meshToHeightfield(source);assert.equal(converted.kind,'heightfield');
  assert.equal(converted.nrows,8);assert.equal(converted.ncols,16);
  const world=new RAPIER.World({x:0,y:-9.81,z:0});
  try{
    const original=world.createCollider(RAPIER.ColliderDesc.trimesh(source.vertices,source.indices));
    const next=world.createCollider(RAPIER.ColliderDesc.heightfield(converted.nrows,converted.ncols,converted.heights,
      {x:converted.scale[0],y:1,z:converted.scale[2]},RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES).setTranslation(...converted.p));
    world.step();
    for(let i=0;i<600;i++){
      const ray=new RAPIER.Ray({x:32.01+(i*13.731)%31.98,y:10,z:16.01+(i*7.923)%15.98},{x:0,y:-1,z:0});
      const a=original.castRayAndGetNormal(ray,20,true),b=next.castRayAndGetNormal(ray,20,true);
      assert.ok(a&&b);assert.ok(Math.abs(a.timeOfImpact-b.timeOfImpact)<.00002);
      assert.ok(a.normal.y>.5&&b.normal.y>.5);
    }
  }finally{world.free();}
});
test('holes, duplicate faces, multiple elevations and reversed triangle diagonals remain exact triangle meshes',()=>{
  const original=mesh();
  const missing={...original,indices:original.indices.slice(0,-3)};assert.equal(meshToHeightfield(missing),missing);
  const duplicate=structuredClone(original);duplicate.indices.set(duplicate.indices.slice(0,3),3);assert.equal(meshToHeightfield(duplicate),duplicate);
  const otherDiagonal=structuredClone(original);otherDiagonal.indices.set([0,17,18,0,18,1],0);assert.equal(meshToHeightfield(otherDiagonal),otherDiagonal);
  const stacked=structuredClone(original);stacked.vertices=new Float32Array([...original.vertices,32,20,16]);assert.equal(meshToHeightfield(stacked),stacked);
});
test('binary terrain records round-trip and reject invalid sizes, ranges and non-finite heights',()=>{
  const record=meshToHeightfield(mesh()),data=encodeCollisionData('terrain',[record]),decoded=decodeCollisionData(data.buffer,'terrain')[0];
  assert.deepEqual(decoded.heights,record.heights);assert.deepEqual(decoded.scale,[32,1,16]);
  for(const bad of [{...record,nrows:400},{...record,scale:[32,-1,16]},{...record,heights:new Float32Array(2)},
    {...record,heights:record.heights.map((v,i)=>i? v:NaN)}])assert.throws(()=>decodeCollisionData(encodeCollisionData('terrain',[bad]).buffer,'terrain'));
});
test('reported park hotspot uses native heightfields without increasing the collider count',async()=>{
  const raw=gunzipSync(await readFile(new URL('../web'+COLLISION_ASSETS.liget.url,import.meta.url)));
  const records=decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'liget');
  assert.equal(records.length,3927);
  const terrain=records.find(r=>r.kind==='heightfield'&&r.min[0]===32&&r.min[2]===0);
  assert.ok(terrain);assert.deepEqual(terrain.scale,[32,1,32]);assert.equal(terrain.heights.length,289);
  assert.ok(records.filter(r=>r.kind==='heightfield').length>500);
});
