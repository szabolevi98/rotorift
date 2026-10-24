import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { loadCatalog } from "../server/catalog.js";
import { loadRoutes, saveRoute, localEditorRequest, readRouteBody } from "../server/routes.js";
import { resolveRoute, validateRoute } from "../shared/race/routes.js";
import { RouteDraft, normalFromYaw, normalFromAngles, yawFromNormal, tiltFromNormal } from "../shared/race/editor.js";
import { gateCrossing } from "../shared/race/gates.js";
import { buildPark } from "../web/game/park.js";
import { buildConstruction } from "../web/game/construction.js";
import { buildHarbor } from "../web/game/harbor.js";
import { buildGym } from "../web/game/gym.js";
import { buildPlayground } from "../web/game/playground.js";
import { buildCity } from "../web/game/city.js";
import { buildCircuit } from "../web/game/circuit.js";
const catalog = await loadCatalog();
await RAPIER.init();

test("race edits, order changes and undo/redo survive JSON without modifying the source", () => {
  const map=catalog.maps[0],original=structuredClone(map.routes[0]),draft=new RouteDraft(map,original);
  draft.setGate(1,{p:[8,9,12],n:normalFromYaw(90)});
  assert.equal(draft.route.version,original.version+1);assert.deepEqual(map.routes[0],original);
  assert.equal(draft.move(1,1),2);assert.deepEqual(draft.route.gates[2].p,[8,9,12]);
  draft.undo();assert.deepEqual(draft.route.gates[1].p,[8,9,12]);draft.undo();assert.deepEqual(draft.route,original);
  draft.redo();assert.deepEqual(draft.route.gates[1].p,[8,9,12]);
  assert.deepEqual(validateRoute(JSON.parse(JSON.stringify(draft.export())),map),draft.export());
  assert.throws(()=>draft.setGate(1,{width:0}));
});
test("editor preserves tilted and downward-facing gates through JSON and undo",()=>{
  const map=catalog.maps.find(m=>m.id==='betonudvar'),draft=new RouteDraft(map,map.routes[1]);
  for(const tilt of [-90,-45,35,90]){
    const n=normalFromAngles(40,tilt);draft.setGate(1,{n});
    assert.ok(Math.abs(tiltFromNormal(n)-tilt)<1e-6);
    if(Math.abs(tilt)<90)assert.ok(Math.abs(yawFromNormal(n)-40)<1e-6);
    assert.deepEqual(validateRoute(JSON.parse(JSON.stringify(draft.export())),map).gates[1].n,n);
    draft.undo();assert.deepEqual(draft.route,map.routes[1]);
  }
  assert.throws(()=>draft.setGate(1,{n:[0,0,0]}),/Invalid gate/);
  assert.throws(()=>draft.setGate(1,{n:[0,-2,0]}),/Invalid gate/);
});

test("race storage discovers multiple files, bumps changed versions and rejects invalid writes", async t => {
  const runtime=path.resolve(".runtime");await mkdir(runtime,{recursive:true});
  const folder=await mkdtemp(path.join(runtime,"routes-tests-")),root=pathToFileURL(folder+path.sep),map=catalog.maps[0];
  t.after(async()=>{if(!path.resolve(folder).startsWith(runtime+path.sep)||!path.basename(folder).startsWith("routes-tests-"))throw Error("Unsafe fixture cleanup");await rm(folder,{recursive:true,force:true});});
  const first=await saveRoute(map,map.routes[0],root);
  const metadataEdit=structuredClone(first);metadataEdit.details.description.en='An updated route description.';
  const updated=await saveRoute(map,metadataEdit,root);
  assert.equal(updated.version,first.version,'description edits must preserve records and ghosts');
  assert.deepEqual(updated.gates,first.gates);assert.deepEqual(updated.details,metadataEdit.details);
  const second=await saveRoute(map,{...first,id:"race_2",name:"Another race",gates:first.gates.slice(0,3),guide:undefined},root);
  const loaded=await loadRoutes(map,root),base={...map,routes:loaded};
  assert.equal(loaded.length,2);assert.equal(resolveRoute(base,"race_2").gates.length,3);assert.equal(resolveRoute(base,"missing"),null);
  assert.notDeepEqual(resolveRoute(base,"race_1").gates,resolveRoute(base,"race_2").gates);
  assert.equal((await saveRoute(map,second,root)).version,second.version);
  const edited=structuredClone(second);edited.gates[0].p[1]+=1;delete edited.guide;
  assert.equal((await saveRoute(map,edited,root)).version,second.version+1);
  await assert.rejects(()=>saveRoute(map,{...first,id:"../outside"},root));await assert.rejects(()=>saveRoute(map,{...first,gates:[]},root));
  assert.equal(JSON.parse(await readFile(new URL(`maps/${map.id}/race_1.json`,root),"utf8")).id,"race_1");
  await writeFile(new URL(`maps/${map.id}/wrong.json`,root),JSON.stringify(first));await assert.rejects(()=>loadRoutes(map,root));
});

test("project saving requires same-origin loopback and decodes split UTF-8", async () => {
  const req=(host,origin,peer="127.0.0.1")=>({headers:{host,origin},socket:{remoteAddress:peer}});
  assert.equal(localEditorRequest(req("localhost:3015","http://localhost:3015")),true);
  assert.equal(localEditorRequest(req("localhost:3015","https://other.example")),false);
  assert.equal(localEditorRequest(req("rotorift.example","http://rotorift.example")),false);
  assert.equal(localEditorRequest(req("localhost:3015","http://localhost:3015","192.168.1.2")),false);
  const bytes=Buffer.from(JSON.stringify({name:"Építkezés"}));
  assert.equal((await readRouteBody({async *[Symbol.asyncIterator](){for(const byte of bytes)yield Buffer.from([byte]);}})).name,"Építkezés");
  await assert.rejects(()=>readRouteBody({async *[Symbol.asyncIterator](){yield Buffer.alloc(256*1024+1);}}));
});

test("all demo races have clear gate apertures and the correct flying direction", () => {
  for(const map of catalog.maps) {
    const world=new RAPIER.World({x:0,y:-9.81,z:0}),scene=new THREE.Scene();
    const environment=(map.kind==="harbor"?buildHarbor:map.kind==="gym"?buildGym:map.kind==="circuit"?buildCircuit:map.kind==="city"?buildCity:map.kind==="playground"?buildPlayground:map.kind==="park"?buildPark:buildConstruction)(scene,world,RAPIER,{...map,gates:[],spawn:map.baseSpawn??map.spawn});
    try {
      for(let i=0;i<map.gates.length;i++) {
        const gate=map.gates[i];
        assert.ok(gateCrossing(gate.p.map((v,j)=>v-gate.n[j]*.5),gate.p.map((v,j)=>v+gate.n[j]*.5),gate)!==null,`${map.id}: gate ${i+1} must accept arrival`);
        environment.update(gate.p);world.step();const right=[-gate.n[2],0,gate.n[0]];
        for(const offset of [-gate.width*.35,0,gate.width*.35]) {
          const p=gate.p.map((v,j)=>v+right[j]*offset-gate.n[j]*1.5);
          const hit=world.castRay(new RAPIER.Ray({x:p[0],y:p[1],z:p[2]},{x:gate.n[0],y:0,z:gate.n[2]}),3,true);
          assert.equal(hit,null,`${map.id}: gate ${i+1} aperture must be clear`);
        }
      }
    }finally{environment.dispose();world.free();}
  }
});
