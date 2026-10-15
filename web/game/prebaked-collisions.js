import { COLLISION_ASSETS } from "../../shared/world/collision-assets.js";
import { decodeCollisionData } from "../../shared/world/collision-data.js";
import { ColliderRegions } from "../../shared/world/collider-regions.js";
import { makeParkTerrain } from "./park.js";
import { paintLoading } from "../loading.js";
const downloads = new Map();

export class PrebakedCollisions {
  constructor(RAPIER, world, map, records) {
    this.RAPIER = RAPIER; this.world = world; this.map = map;
    this.regions = new ColliderRegions(); this.colliders = []; this.outerTerrain = new Map();
    try {
      for (const r of records) {
        let desc;
        if(r.kind==='heightfield')desc=RAPIER.ColliderDesc.heightfield(r.nrows,r.ncols,r.heights,{x:r.scale[0],y:r.scale[1],z:r.scale[2]},RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES).setTranslation(...r.p);
        else if (r.kind === "mesh") desc = RAPIER.ColliderDesc.trimesh(r.vertices, r.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES);
        else {
          desc = r.kind === "cuboid" ? RAPIER.ColliderDesc.cuboid(...r.halfExtents) : r.kind === "ball" ? RAPIER.ColliderDesc.ball(r.radius) : RAPIER.ColliderDesc[r.kind](r.halfHeight,r.radius);
          desc.setTranslation(...r.p).setRotation({x:r.q[0],y:r.q[1],z:r.q[2],w:r.q[3]});
        }
        const collider = world.createCollider(desc.setFriction(r.friction));
        this.colliders.push(collider); this.regions.add(collider,r.min,r.max);
      }
      this.update(map.spawn);
    } catch(error) { this.dispose(); throw error; }
  }
  update(position, velocity = [0,0,0]) {
    this.regions.update(position,velocity);
    if (this.map.kind !== "park") return;
    const end=position.map((v,i)=>v+velocity[i]*0.35), wanted=new Set();
    for(let cx=Math.floor((Math.min(position[0],end[0])-24)/128);cx<=Math.floor((Math.max(position[0],end[0])+24)/128);cx++) {
      for(let cz=Math.floor((Math.min(position[2],end[2])-24)/128);cz<=Math.floor((Math.max(position[2],end[2])+24)/128);cz++) {
        if(cx>=-4&&cx<4&&cz>=-4&&cz<4)continue;
        const key=`${cx}:${cz}`;wanted.add(key);
        if(this.outerTerrain.has(key))continue;
        const geometry=makeParkTerrain(cx,cz);
        const collider=this.world.createCollider(this.RAPIER.ColliderDesc.trimesh(geometry.attributes.position.array,new Uint32Array(geometry.index.array)).setFriction(.9));
        geometry.dispose();this.outerTerrain.set(key,collider);
      }
    }
    for(const [key,collider]of this.outerTerrain)if(!wanted.has(key)){this.world.removeCollider(collider,false);this.outerTerrain.delete(key);}
  }
  get activeCount() { return this.regions.activeCount + this.outerTerrain.size; }
  dispose() {
    for(const collider of [...this.colliders,...this.outerTerrain.values()])if(collider.isValid())this.world.removeCollider(collider,false);
    this.colliders.length=0;this.outerTerrain.clear();this.regions.clear();
  }
}

export async function loadPrebakedCollisions(RAPIER,world,map,isCurrent=()=>true,onProgress) {
  const asset = COLLISION_ASSETS[map.id];
  if(!asset || asset.mapVersion !== map.version || typeof DecompressionStream === "undefined")return null;
  try {
    onProgress?.({phase:"collisions",loaded:0,total:0});
    if(!downloads.has(asset.url))downloads.set(asset.url,(async()=>{
      const response=await fetch(asset.url);if(!response.ok)throw Error("Collision data download failed");
      const chunks=[],reader=response.body.getReader(),total=Number(response.headers.get("content-length"))||asset.bytes;let loaded=0;
      while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.length;if(isCurrent())onProgress?.({phase:"collisions",loaded,total});}
      const bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      const raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
      return decodeCollisionData(raw,map.id);
    })());
    const records=await downloads.get(asset.url);
    if(isCurrent()) { onProgress?.({phase:"collisionPrepare",loaded:0,total:0}); await paintLoading(); }
    return isCurrent() ? new PrebakedCollisions(RAPIER,world,map,records) : null;
  }catch(error){downloads.delete(asset.url);console.warn("Prebaked collision data unavailable; using procedural geometry:",error.message);return null;}
}
