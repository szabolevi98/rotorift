import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import {loadCatalog} from '../server/catalog.js';
import {findGuidePath} from '../shared/race/guide.js';
import {validateRoute,resolveRoute} from '../shared/race/routes.js';
import {RouteDraft} from '../shared/race/editor.js';
import {COLLISION_ASSETS} from '../shared/world/collision-assets.js';
import {decodeCollisionData} from '../shared/world/collision-data.js';
import {PrebakedCollisions} from '../web/game/prebaked-collisions.js';
import {makeGuideClearance} from '../web/game/route-guide-planner.js';
import {createNeonGate,createRaceGuide,gateFrameParts} from '../web/game/race-course.js';
import {gateBasis,gateCrossing,newLap,advanceLap} from '../shared/race/gates.js';
import {buildEnvironment} from '../web/game/environment.js';
import {withoutRaceRoute} from '../shared/race/map-modes.js';
import {CONSTRUCTION_HANGAR,constructionHeight} from '../shared/world/construction-layout.js';
import {buildConstruction} from '../web/game/construction.js';
await RAPIER.init();
const catalog=await loadCatalog();

test('Skyline starts face gate one with the final gate safely behind the launch position',()=>{
  const map=catalog.maps.find(m=>m.id==='skyline');
  for(const route of map.routes){
    const first=route.gates[0],last=route.gates.at(-1);
    const forward=p=>p.reduce((sum,v,i)=>sum+(v-route.spawn[i])*first.n[i],0);
    assert.ok(forward(first.p)>0,`${route.id}: first gate ahead of spawn`);
    assert.ok(forward(last.p)<=-10,`${route.id}: final gate at least ten metres behind spawn`);
    const launch=[route.spawn[0],first.p[1],route.spawn[2]];
    const pastFirst=first.p.map((v,i)=>v+first.n[i]);
    assert.notEqual(gateCrossing(launch,pastFirst,first),null);
    assert.equal(gateCrossing(launch,pastFirst,last),null,`${route.id}: launch never crosses the final gate`);
  }
});

test('scenery-only previews on every map never retain the default guide behind any selected route',()=>{
  for(const map of catalog.maps)for(const scenery of [withoutRaceRoute(map),{...map,gates:[]}]){
    const scene=new THREE.Scene(),world=new RAPIER.World({x:0,y:0,z:0});
    const environment=buildEnvironment(scene,world,RAPIER,scenery);
    try{
      const background=environment.root.getObjectByName('Neon_racing_line');
      assert.equal(background.children.length,0,`${map.id}: no inherited line without race gates`);
      for(const route of map.routes){
        const selected=createRaceGuide(route.guide);scene.add(selected);
        assert.equal(selected.children.length,route.gates.length,`${map.id}/${route.id}: only the selected guide`);
        assert.equal(background.children.length,0);
        scene.remove(selected);selected.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
      }
    }finally{environment.dispose();world.free();}
  }
});

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
        let length=0;
        const lap=newLap();let clock=0;
        const start=route.gates[0],before=start.p.map((v,i)=>v-start.n[i]*2);
        advanceLap(lap,before,start.p,clock,clock+=100,route.gates);
        assert.equal(lap.next,1,`${map.id}/${route.id}: start must trigger`);
        for(const points of route.guide)for(let i=1;i<points.length;i++){
          length+=Math.hypot(...points[i].map((v,j)=>v-points[i-1][j]));
          advanceLap(lap,points[i-1],points[i],clock,clock+=100,route.gates);
        }
        assert.equal(lap.completed,1,`${map.id}/${route.id}: following the saved line must complete a lap`);
        if(map.kind!=='playground'){
          assert.ok(length>1250,`${map.id}/${route.id}: full-length course`);
          assert.ok(route.gates.length>=20);
          for(const [i,g]of route.gates.entries()){
            const {right,up}=gateBasis(g.n),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...right),new THREE.Vector3(...up),new THREE.Vector3(...g.n)));
            const hit=world.castShape({x:g.p[0]-g.n[0]*2,y:g.p[1]-g.n[1]*2,z:g.p[2]-g.n[2]*2},q,
              {x:g.n[0]*4,y:g.n[1]*4,z:g.n[2]*4},new RAPIER.Cuboid(g.width/2+.07,g.height/2+.07,.07),0,1,true);
            assert.ok(!hit,`${map.id}/${route.id} gate ${i+1}: entire frame and approach must clear scenery`);
            assert.notEqual(gateCrossing(g.p.map((v,j)=>v-g.n[j]),g.p.map((v,j)=>v+g.n[j]),g),null);
          }
        }
        for(const [leg,points]of route.guide.entries())for(let i=1;i<points.length;i++)assert.ok(clear(points[i-1],points[i]),`${map.id} leg ${leg+1}, segment ${i}`);
      }
    }finally{collision.dispose();world.free();}
  }
});
test('construction dive courses descend the open shafts and horizontal gate meshes match their crossing plane',()=>{
  const map=catalog.maps.find(m=>m.id==='betonudvar');
  for(const route of map.routes.slice(1)){
    const dives=route.gates.filter(g=>g.n[1]<-.99);assert.ok(dives.length>=3);
    for(const gate of dives){
      const group=createNeonGate(gate,0);
      const forward=new THREE.Vector3(0,0,1).applyQuaternion(group.quaternion);
      assert.ok(forward.distanceTo(new THREE.Vector3(...gate.n))<1e-6);
      assert.ok(Math.abs(gateCrossing(gate.p.map((v,i)=>v+(i===1?3:0)),gate.p.map((v,i)=>v-(i===1?3:0)),gate)-.5)<1e-9);
      group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
    }
  }
});

test('Pavilion Peaks has one dive gate followed by open recovery space for larger aircraft',()=>{
  const route=catalog.maps.find(m=>m.id==='liget').routes.find(r=>r.id==='race_3');
  assert.equal(route.gates.length,26);
  const dives=route.gates.filter(g=>g.n[1]<-.99);
  assert.equal(dives.length,1,'no second low dive gate forcing a last-second recovery');
  assert.deepEqual(route.gates[23].p,[-38,13,27]);
  assert.ok(route.gates[23].n[1]<-.99);
  const exit=route.gates[24];
  assert.ok(Math.hypot(exit.p[0]+38,exit.p[2]-27)>40,'room to pull out before the next gate');
  assert.ok(Math.abs(exit.n[1])<.01,'the next gate is an upright recovery gate');
  assert.ok(route.guide[23].filter(p=>Math.hypot(p[0]+38,p[2]-27)<2).every(p=>p[1]>10.5),'the guide turns out higher instead of dropping to the old low gate');
});

test('Cranes & Twin Shafts approaches the hangar through its open end instead of an abrupt side turn',()=>{
  const map=catalog.maps.find(m=>m.id==='betonudvar'),route=map.routes.find(r=>r.id==='race_3');
  const approach=route.gates[21],entry=route.gates[22],inside=route.gates[23],h=CONSTRUCTION_HANGAR;
  assert.deepEqual(approach.n,[0,0,1]);
  assert.equal(approach.p[0],h.x,'line up with the doorway before descending');
  assert.ok(entry.p[2]-approach.p[2]>=25,'room to line up before entering');
  const direction=new THREE.Vector3(...entry.p).sub(new THREE.Vector3(...approach.p)).normalize();
  assert.ok(direction.dot(new THREE.Vector3(...approach.n))>Math.cos(Math.PI/6),'less than thirty degrees of approach offset');
  assert.equal(entry.p[0],h.x);assert.equal(inside.p[0],h.x);
  assert.ok(entry.p[2]<h.z-h.depth/2&&inside.p[2]>h.z-h.depth/2,'cross the central end doorway');
  const scene=new THREE.Scene(),environment=buildConstruction(scene,null,null,map);
  scene.updateMatrixWorld(true);
  try{
    const a=new THREE.Vector3(...entry.p),b=new THREE.Vector3(...inside.p),delta=b.clone().sub(a);
    for(const dx of [-.45,0,.45])for(const dy of [-.45,0,.45]){
      const ray=new THREE.Raycaster(a.clone().add(new THREE.Vector3(dx,dy,0)),delta.clone().normalize(),0,delta.length());
      assert.equal(ray.intersectObjects(scene.children,true).length,0,'rendered cladding must leave the whole flight corridor open');
    }
    assert.ok(entry.p[1]-constructionHeight(h.x,h.z)>3,'adequate floor clearance');
  }finally{environment.dispose();}
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
