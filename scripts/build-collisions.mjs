import { buildCircuit } from "../web/game/circuit.js";
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildPark } from "../web/game/park.js";
import { buildConstruction } from "../web/game/construction.js";
import { buildPlayground } from "../web/game/playground.js";
import { buildGym } from "../web/game/gym.js";
import { buildCity } from "../web/game/city.js";
import { encodeCollisionData } from "../shared/world/collision-data.js";

export async function collisionSourceHash() {
  const hash = createHash("sha256");
  hash.update(await readFile(new URL(import.meta.url)));
  for(const id of ["liget","betonudvar","jatszoter","skyline","apex","gym"])hash.update(await readFile(new URL(`../data/maps/${id}.json`,import.meta.url)));
  for (const folder of ["../shared/world/", "../web/game/"]) {
    const dir = new URL(folder, import.meta.url);
    for (const name of (await readdir(dir)).sort()) {
      if (name === "circuit-traffic.js") continue;
      if (!/^(park|construction|playground|city|circuit|gym|tree-models|surface-geometry|map-surfaces)/.test(name) || !name.endsWith(".js")) continue;
      hash.update(name); hash.update(await readFile(new URL(name, dir)));
    }
  }
  return hash.digest("hex");
}

// Preserve the terrain triangles, but store complete regular grids as native
// heightfields. CCD can query nearby grid cells instead of scanning a mesh BVH
// whose AABB includes metres of empty air above the local ground.
export function meshToHeightfield(record){
  if(record.kind!=='mesh'||record.indices.length<96)return record;
  const xs=[...new Set(Array.from(record.vertices).filter((_,i)=>i%3===0))].sort((a,b)=>a-b);
  const zs=[...new Set(Array.from(record.vertices).filter((_,i)=>i%3===2))].sort((a,b)=>a-b);
  const nx=xs.length,nz=zs.length;
  if(nx<2||nz<2||nx>129||nz>129||record.indices.length!==(nx-1)*(nz-1)*6)return record;
  const regular=axis=>axis.every((v,i)=>!i||Math.abs(v-axis[0]-i*(axis[1]-axis[0]))<.0001);
  if(!regular(xs)||!regular(zs))return record;
  const xi=new Map(xs.map((v,i)=>[v,i])),zi=new Map(zs.map((v,i)=>[v,i])),heights=new Float32Array(nx*nz).fill(NaN),grid=[];
  for(let i=0;i<record.vertices.length;i+=3){
    const x=xi.get(record.vertices[i]),z=zi.get(record.vertices[i+2]),at=x*nz+z,y=record.vertices[i+1];
    if(Number.isFinite(heights[at])&&heights[at]!==y)return record;
    heights[at]=y;grid.push([x,z]);
  }
  if(!heights.every(Number.isFinite))return record;
  const triangles=new Set();
  for(let i=0;i<record.indices.length;i+=3){
    const p=Array.from(record.indices.subarray(i,i+3),index=>grid[index]);
    const x=Math.min(...p.map(v=>v[0])),z=Math.min(...p.map(v=>v[1]));
    if(p.some(v=>v[0]-x>1||v[1]-z>1))return record;
    const corners=p.map(v=>v[0]-x+2*(v[1]-z)).sort().join('');
    if(!['012','123'].includes(corners)||(p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0])>=0)return record;
    const key=[x,z,corners].join(':');if(triangles.has(key))return record;triangles.add(key);
  }
  return {kind:'heightfield',nrows:nz-1,ncols:nx-1,heights,
    scale:[xs.at(-1)-xs[0],1,zs.at(-1)-zs[0]],p:[(xs[0]+xs.at(-1))/2,0,(zs[0]+zs.at(-1))/2],
    min:record.min,max:record.max,friction:record.friction};
}

export async function bakeCollisionRecords(map) {
  const descriptors = new Map(), live = new Map(); let nextId = 0;
  // Collect descriptors from the same procedural builders without constructing
  // WASM shapes. Rendering-only details never become collision geometry.
  const world = {
    createCollider(desc) {
      const shape = desc.shape;
      const hash = createHash("sha256").update(JSON.stringify({type:shape.type,p:desc.translation,q:desc.rotation,
        friction:desc.friction,radius:shape.radius,halfHeight:shape.halfHeight,halfExtents:shape.halfExtents}));
      if (shape.vertices) { hash.update(new Uint8Array(shape.vertices.buffer,shape.vertices.byteOffset,shape.vertices.byteLength)); hash.update(new Uint8Array(shape.indices.buffer,shape.indices.byteOffset,shape.indices.byteLength)); }
      const key = hash.digest("hex"); descriptors.set(key, desc);
      const handle = nextId++, collider = { handle, setEnabled() {}, isValid:()=>live.has(handle) };
      live.set(handle, collider); return collider;
    },
    getCollider:handle=>live.get(handle), removeCollider:collider=>live.delete(collider.handle),
  };
  const scene = new THREE.Scene();
  const environment = (map.kind === "gym" ? buildGym : map.kind === "circuit" ? buildCircuit : map.kind === "city" ? buildCity : map.kind === "playground" ? buildPlayground : map.kind === "park" ? buildPark : buildConstruction)(scene,world,RAPIER,map);
  if (map.kind === "park") for (const x of [-3,0,2]) for (const z of [-3,0,2]) environment.update([x*128+64,2,z*128+64]);
  const tiles = new Map(), primitives = [];
  for (const desc of descriptors.values()) {
    const shape = desc.shape, p = desc.translation, q = desc.rotation;
    if (shape.type !== RAPIER.ShapeType.TriMesh) {
      const kind = {[RAPIER.ShapeType.Cuboid]:"cuboid",[RAPIER.ShapeType.Ball]:"ball",[RAPIER.ShapeType.Cylinder]:"cylinder",[RAPIER.ShapeType.Cone]:"cone"}[shape.type];
      if (!kind) throw Error("Unsupported static collider " + shape.type);
      const r = shape.radius, h = shape.halfHeight ?? r, extents=shape.halfExtents;
      const half=extents?new THREE.Vector3(extents.x,extents.y,extents.z):new THREE.Vector3(r,h,r);
      const bounds = new THREE.Box3(half.clone().negate(),half.clone());
      bounds.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion(q.x,q.y,q.z,q.w),new THREE.Vector3(1,1,1)));
      // Keep analytic boxes analytic. Turning beams/floors into triangle soups
      // made CCD against the whoop's thin convex guards extremely expensive.
      primitives.push({kind,p:[p.x,p.y,p.z],q:[q.x,q.y,q.z,q.w],...(extents?{halfExtents:half.toArray()}:{radius:r,halfHeight:h}),
        min:bounds.min.toArray(),max:bounds.max.toArray(),friction:desc.friction}); continue;
    }
    const sourceVertices = shape.vertices, sourceIndices = shape.indices;
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion(q.x,q.y,q.z,q.w),new THREE.Vector3(1,1,1));
    const vertex = i => new THREE.Vector3(sourceVertices[i*3],sourceVertices[i*3+1],sourceVertices[i*3+2]).applyMatrix4(matrix);
    // The park's finite play area is baked once; bare terrain farther away is
    // generated from the same height function when the pilot leaves it.
    if (map.kind === "park" && shape.type === RAPIER.ShapeType.TriMesh) {
      const bounds = new THREE.Box3(); for(let i=0;i<sourceVertices.length/3;i++)bounds.expandByPoint(vertex(i));
      if(bounds.min.x < -512 || bounds.max.x > 512 || bounds.min.z < -512 || bounds.max.z > 512) continue;
    }
    for(let i=0;i<sourceIndices.length;i+=3) {
      const points=[vertex(sourceIndices[i]),vertex(sourceIndices[i+1]),vertex(sourceIndices[i+2])];
      const center=points.reduce((sum,v)=>sum.add(v),new THREE.Vector3()).multiplyScalar(1/3);
      const distance=Math.max(Math.abs(center.x),Math.abs(center.z));
      // Keep any custom playground surfaces in small local mesh cells.
      const tileSize=distance<=512?(map.kind==='playground'?4:32):128*2**Math.floor(Math.log2(distance/512));
      const key=[tileSize,Math.floor(center.x/tileSize),Math.floor(center.y/tileSize),Math.floor(center.z/tileSize),desc.friction].join(":");
      if(!tiles.has(key))tiles.set(key,{vertices:[],indices:[],lookup:new Map(),bounds:new THREE.Box3(),friction:desc.friction});
      const tile=tiles.get(key);
      for(const point of points) {
        point.set(Math.fround(point.x),Math.fround(point.y),Math.fround(point.z));
        const id=point.toArray().join(":"); let index=tile.lookup.get(id);
        if(index===undefined){index=tile.vertices.length/3;tile.lookup.set(id,index);tile.vertices.push(point.x,point.y,point.z);tile.bounds.expandByPoint(point);}
        tile.indices.push(index);
      }
    }
  }
  environment.dispose();
  return [...[...tiles.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,tile])=>({kind:"mesh",vertices:new Float32Array(tile.vertices),indices:new Uint32Array(tile.indices),
    min:tile.bounds.min.toArray(),max:tile.bounds.max.toArray(),friction:tile.friction})), ...primitives];
}

export async function buildCollisions() {
  const dir = new URL("../web/assets/collisions/",import.meta.url); await mkdir(dir,{recursive:true});
  const sourceHash = await collisionSourceHash(), manifest = {};
  for (const id of ["liget","betonudvar","jatszoter","skyline","apex","gym"]) {
    const map = JSON.parse(await readFile(new URL(`../data/maps/${id}.json`,import.meta.url)));
    const records = (await bakeCollisionRecords(map)).map(record=>meshToHeightfield(record)), bytes = encodeCollisionData(id,records), compressed = gzipSync(bytes,{level:9});
    const hash=createHash("sha256").update(compressed).digest("hex").slice(0,16), filename=`${id}-${hash}.rrc`;
    await writeFile(new URL(filename,dir),compressed);
    manifest[id]={url:`/assets/collisions/${filename}`,mapVersion:map.version,sourceHash,records:records.length,rawBytes:bytes.length,bytes:compressed.length};
    console.log(`${id}: ${records.length} colliders, ${compressed.length} bytes compressed (${bytes.length} raw)`);
  }
  await writeFile(new URL("../shared/world/collision-assets.js",import.meta.url),`// Generated by npm run collisions:build.\nexport const COLLISION_ASSETS = ${JSON.stringify(manifest,null,2)};\n`);
  const keep=new Set(Object.values(manifest).map(v=>v.url.split("/").at(-1)));
  for(const file of await readdir(dir))if(/^(liget|betonudvar|jatszoter|skyline|apex|gym)-[a-f0-9]{16}\.rrc$/.test(file)&&!keep.has(file))await unlink(new URL(file,dir));
  return manifest;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)await buildCollisions();
