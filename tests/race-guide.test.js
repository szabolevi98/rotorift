import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import RAPIER from '@dimforge/rapier3d-compat';
import {loadCatalog} from '../server/catalog.js';
import {findGuidePath} from '../shared/race/guide.js';
import {validateRoute,resolveRoute} from '../shared/race/routes.js';
import {RouteDraft} from '../shared/race/editor.js';
import {COLLISION_ASSETS} from '../shared/world/collision-assets.js';
import {decodeCollisionData} from '../shared/world/collision-data.js';
import {PrebakedCollisions} from '../web/game/prebaked-collisions.js';
import {makeGuideClearance} from '../web/game/route-guide-planner.js';
import {createNeonGate,createRaceGuide,gateFrameParts} from '../web/game/race-course.js';
await RAPIER.init();
const catalog=await loadCatalog();

test('guide detours around a wall with aircraft clearance instead of cutting through it',()=>{
  const world=new RAPIER.World({x:0,y:0,z:0});
  try{
    world.createCollider(RAPIER.ColliderDesc.cuboid(4,3,2).setTranslation(0,2,10));world.step();
    const clear=makeGuideClearance(world,RAPIER,.45),start=[0,2,0],end=[0,2,20];
    assert.equal(clear(start,end),false);
    const path=findGuidePath(start,end,clear,{step:2,boundary:30});assert.ok(path.length>2);
    assert.deepEqual(path[0],start);assert.deepEqual(path.at(-1),end);
    for(let i=1;i<path.length;i++)assert.ok(clear(path[i-1],path[i]));
    assert.throws(()=>findGuidePath([0,2,10],end,clear,{maxVisited:100}),/No clear/);
  }finally{world.free();}
});

test('guide JSON is preserved across route resolution, invalidated by gate edits and restored by undo',()=>{
  const map=catalog.maps.find(m=>m.id==='liget'),route=map.routes[0];
  assert.deepEqual(resolveRoute(map,route.id).guide,route.guide);
  assert.deepEqual(validateRoute(JSON.parse(JSON.stringify(route)),map),route);
  const draft=new RouteDraft(map,route);draft.setGate(1,{p:[8,9,12]});assert.equal(draft.route.guide,undefined);
  draft.undo();assert.deepEqual(draft.route.guide,route.guide);
  const invalid=structuredClone(route);invalid.guide[0][0][0]+=1;assert.throws(()=>validateRoute(invalid,map),/endpoints/);
  invalid.guide[0][0][0]=Infinity;assert.throws(()=>validateRoute(invalid,map),/inside/);
});

test('saved demo neon guides clear baked scenery along every segment, including elevated gates',async()=>{
  for(const map of catalog.maps){
    if(!map.routes.length)continue;
    const world=new RAPIER.World({x:0,y:0,z:0}),raw=gunzipSync(await readFile(new URL('../web'+COLLISION_ASSETS[map.id].url,import.meta.url)));
    const collision=new PrebakedCollisions(RAPIER,world,map,decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),map.id));
    try{
      world.colliders.forEach(c=>c.setEnabled(true));world.step();
      const clear=makeGuideClearance(world,RAPIER,map.kind==='playground'?.18:.45);
      for(const route of map.routes){
        assert.equal(route.guide.length,route.gates.length);
        assert.ok(Math.max(...route.gates.map(g=>g.p[1]))-Math.min(...route.gates.map(g=>g.p[1]))>1);
        for(const [leg,points]of route.guide.entries())for(let i=1;i<points.length;i++)assert.ok(clear(points[i-1],points[i]),`${map.id} leg ${leg+1}, segment ${i}`);
      }
    }finally{collision.dispose();world.free();}
  }
});

test('floating neon gates have a closed collision frame and depth-tested luminous cores without lights',()=>{
  const gate={p:[0,10,0],n:[0,0,-1],width:6,height:4},group=createNeonGate(gate,0,{active:true});
  const parts=gateFrameParts(gate);assert.equal(parts.length,4);assert.equal(parts[3][1][1],-2);
  let meshes=0;group.traverse(o=>{assert.ok(!o.isLight);if(o.isMesh){meshes++;assert.equal(o.material.depthTest,true);assert.equal(o.castShadow,false);}});
  assert.ok(meshes>=3);assert.equal(group.position.y,10);
  const guide=createRaceGuide([[[0,2,0],[4,2,2],[0,2,4]],[[0,2,4],[0,2,0]]]);
  guide.userData.highlight(1);assert.equal(guide.children[0].children[0].material.color.getHex(),0xa7ff55);
  guide.userData.highlight(0);assert.equal(guide.children[1].children[0].material.color.getHex(),0xa7ff55);
  const world=new RAPIER.World({x:0,y:0,z:0});
  try{
    for(const [size,p]of parts)world.createCollider(RAPIER.ColliderDesc.cuboid(...size.map(v=>v/2)).setTranslation(p[0],p[1]+10,p[2]));world.step();
    assert.equal(world.castRay(new RAPIER.Ray({x:0,y:10,z:-2},{x:0,y:0,z:1}),4,true),null);
    assert.ok(world.castRay(new RAPIER.Ray({x:0,y:8,z:-2},{x:0,y:0,z:1}),4,true));
  }finally{world.free();}
  for(const root of [group,guide])root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});
