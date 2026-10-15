import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import RAPIER from '@dimforge/rapier3d-compat';
import {loadCatalog} from '../server/catalog.js';
import {COLLISION_ASSETS} from '../shared/world/collision-assets.js';
import {decodeCollisionData} from '../shared/world/collision-data.js';
import {validateRoute} from '../shared/race/routes.js';
import {PrebakedCollisions} from '../web/game/prebaked-collisions.js';
import {generateRaceGuide} from '../web/game/route-guide-planner.js';

await RAPIER.init();
for(const map of (await loadCatalog()).maps){
  if(!map.routes.length)continue;
  const world=new RAPIER.World({x:0,y:0,z:0}),asset=COLLISION_ASSETS[map.id];
  const raw=gunzipSync(await readFile(new URL('../web'+asset.url,import.meta.url)));
  const collisions=new PrebakedCollisions(RAPIER,world,map,decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),map.id));
  try{
    for(const route of map.routes){
      const start=performance.now(),guide=generateRaceGuide(world,RAPIER,map,route.gates);
      const changed=JSON.stringify(guide)!==JSON.stringify(route.guide);
      const result=validateRoute({...route,guide,version:route.version+(changed?1:0)},map);
      await writeFile(new URL(`../data/maps/${map.id}/${route.id}.json`,import.meta.url),JSON.stringify(result,null,2)+'\n');
      console.log(`${map.id}/${route.id}: ${guide.reduce((n,p)=>n+p.length,0)} points, ${Math.round(performance.now()-start)} ms`);
    }
  }finally{collisions.dispose();world.free();}
}
