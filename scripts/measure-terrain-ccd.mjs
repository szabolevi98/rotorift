// Reproduce the reported Rift 65 park hitch with identical terrain and CCD on.
// Only the terrain representation changes between the two benchmark worlds.
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import RAPIER from '@dimforge/rapier3d-compat';
import {DronePhysics} from '../shared/physics/drone.js';
import {hoverThrottle} from '../shared/physics/propulsion.js';
import {PrebakedCollisions} from '../web/game/prebaked-collisions.js';
import {decodeCollisionData} from '../shared/world/collision-data.js';
import {COLLISION_ASSETS} from '../shared/world/collision-assets.js';
await RAPIER.init();
const map=JSON.parse(await readFile(new URL('../data/maps/liget.json',import.meta.url)));
const config=JSON.parse(await readFile(new URL('../data/drones/rift-65.json',import.meta.url)));
const raw=gunzipSync(await readFile(new URL('../web'+COLLISION_ASSETS.liget.url,import.meta.url)));
const records=decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'liget');
function asMesh(r){
  if(r.kind!=='heightfield')return r;
  const vertices=[],indices=[],nx=r.ncols+1,nz=r.nrows+1;
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
    vertices.push(r.p[0]+(x/r.ncols-.5)*r.scale[0],r.p[1]+r.heights[x*nz+z]*r.scale[1],r.p[2]+(z/r.nrows-.5)*r.scale[2]);
    if(x<nx-1&&z<nz-1){const a=z*nx+x,b=a+1,c=a+nx,d=c+1;indices.push(a,c,b,b,c,d);}
  }
  return {kind:'mesh',vertices:new Float32Array(vertices),indices:new Uint32Array(indices),min:r.min,max:r.max,friction:r.friction};
}
const results=[];
for(const [representation,data]of [['mesh',records.map(asMesh)],['heightfield',records]]){
  const world=new RAPIER.World({x:0,y:-9.81,z:0}),collisions=new PrebakedCollisions(RAPIER,world,map,data);
  const drone=new DronePhysics(RAPIER,world,config,map.spawn,{updateSceneQueries:false});drone.armed=true;
  try{
    for(const y of [1,2,3.5255,3.8755,4.239,4.614]){
      const position=[43.698,y,22.115],velocity=[.3,3.5,7.5],samples=[];collisions.update(position,velocity);
      for(let i=0;i<90;i++){
        drone.body.setTranslation({x:position[0],y,z:position[2]},true);drone.body.setLinvel({x:velocity[0],y:velocity[1],z:velocity[2]},true);
        drone.body.setRotation({x:0,y:0,z:0,w:1},true);drone.body.setAngvel({x:0,y:0,z:0},true);
        const start=performance.now();drone.step({roll:0,pitch:0,yaw:0,throttle:hoverThrottle(config)});if(i>=15)samples.push(performance.now()-start);
      }
      samples.sort((a,b)=>a-b);
      const result={representation,position,activeColliders:collisions.activeCount,medianStepMs:+samples[37].toFixed(3),p95StepMs:+samples[71].toFixed(3)};
      results.push(result);console.log(JSON.stringify(result));
    }
  }finally{drone.dispose();collisions.dispose();world.free();}
}
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify({physicsHz:240,drone:config.id,ccd:true,controlledVelocity:[.3,3.5,7.5],results},null,2)+'\n');
