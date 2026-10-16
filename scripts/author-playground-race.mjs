// Rebuild the technical micro course without touching Pocket Circuit or custom races.
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {loadCatalog} from '../server/catalog.js';
import {COLLISION_ASSETS} from '../shared/world/collision-assets.js';
import {decodeCollisionData} from '../shared/world/collision-data.js';
import {PrebakedCollisions} from '../web/game/prebaked-collisions.js';
import {generateRaceGuide,makeGuideClearance} from '../web/game/route-guide-planner.js';
import {gateFrameParts} from '../web/game/race-course.js';
import {gateBasis} from '../shared/race/gates.js';
import {validateRoute} from '../shared/race/routes.js';
import {routeMetrics} from '../shared/race/route-info.js';

const N=[0,0,-1],S=[0,0,1],E=[1,0,0],W=[-1,0,0],DOWN=[0,-1,0];
const gate=(x,y,z,n,width=1.8,height=1.4)=>({p:[x,y,z],n,width,height});
const cell=(x,y,z,n)=>gate(x,y,z,n,.86,.86);
const hut=z=>gate(15+Math.sin(.12)*z,1.55,16+Math.cos(.12)*z,[Math.sin(.12),0,Math.cos(.12)],1.4,.9);
const input={id:'race_2',name:'Pocket Gauntlet',version:1,spawn:[0,.15,34],
  details:{difficulty:'hard',recommendedDrones:['rift-65','rift-75'],description:{
    en:'Thread the timber tunnel, swing frame, fort arch, climbing-cage cells and playhouse. A technical micro-drone lap with a dive through a roof cell.',
    hu:'Repülj át a faalagúton, a hintán, a vár boltívén, a mászóka kockáin és a játszóházon. Technikás micro kör, a mászóka tetején átvezető dive-val.',
    de:'Fliege durch Holztunnel, Schaukelrahmen, Burgtorbogen, Kletterwürfel und Spielhaus. Eine technische Micro-Runde mit einem Dive durch ein Dachfeld.',
    fr:'Traversez le tunnel en bois, la balançoire, l’arche du fort, les cases de la cage et la maisonnette. Un tour technique en micro-drone avec un plongeon par le toit de la cage.',
    es:'Atraviesa el túnel de madera, el columpio, el arco del fuerte, las celdas de la estructura y la casita. Un circuito técnico para microdrones con un descenso por el techo de la estructura.'}},
  gates:[
    gate(0,1.2,24,N,2,1.4),gate(-5,.68,16.8,N,1.2,.9),
    gate(-5,.68,14.4,N,.6,.6),gate(-5,.68,11.6,N,.6,.6),
    gate(-11,1.5,1,N),gate(-15,1.5,-3,N,1.6,1.3),
    gate(-15,1.5,-7,N,1.6,1.3),gate(-15,1.5,-11,N,1.6,1.3),
    gate(-9,1.8,-13,E),gate(-3.4,.62,-4.15,S,.9,.62),
    gate(0,.85,-3,E,1.1,.9),gate(3.4,1.05,-3,E,1.3,1.3),
    gate(9,1.9,-8.8,E,1.6,1.2),cell(11.6,1.9,-8.8,E),cell(16.4,1.9,-8.8,E),
    gate(20,2.8,-8.8,E,1.6,1.2),gate(20,3.8,-13.5,W),
    cell(14.6,1.9,-10.6,S),cell(14.6,1.9,-3.4,S),
    gate(20,4,1,E),cell(12.2,3.7,-7.6,DOWN),cell(11.6,1.9,-7.6,W),
    gate(9,1.8,1,S),gate(15,1.55,9,S,1.6,1.1),hut(-2),hut(2),
    gate(15.5,1.6,22,S),gate(8,1.6,28,W),gate(0,1.2,28,N),
  ]};

await RAPIER.init();
const map=(await loadCatalog()).maps.find(m=>m.id==='jatszoter');
const raw=gunzipSync(await readFile(new URL('../web'+COLLISION_ASSETS[map.id].url,import.meta.url)));
const world=new RAPIER.World({x:0,y:0,z:0});
const collisions=new PrebakedCollisions(RAPIER,world,map,decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),map.id));
try{
  world.colliders.forEach(c=>c.setEnabled(true));world.step();
  for(const [i,g]of input.gates.entries()){
    const {right,up}=gateBasis(g.n),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...right),new THREE.Vector3(...up),new THREE.Vector3(...g.n)));
    const halfDepth=.04,lead=Math.min(.3,g.width*.3);
    const hit=world.castShape({x:g.p[0]-g.n[0]*lead,y:g.p[1]-g.n[1]*lead,z:g.p[2]-g.n[2]*lead},q,
      {x:g.n[0]*lead*2,y:g.n[1]*lead*2,z:g.n[2]*lead*2},new RAPIER.Cuboid(g.width/2+.035,g.height/2+.035,halfDepth),0,1,true);
    if(hit)throw Error(`Gate ${i+1} frame or approach intersects equipment at ${g.p}.`);
  }
  input.guide=generateRaceGuide(world,RAPIER,map,input.gates);
  // Also check the physical race rails, including other gates on the cage.
  for(const g of input.gates){
    const {right,up}=gateBasis(g.n),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...right),new THREE.Vector3(...up),new THREE.Vector3(...g.n)));
    for(const [size,local]of gateFrameParts(g)){
      const p=new THREE.Vector3(...local).applyQuaternion(q).add(new THREE.Vector3(...g.p));
      world.createCollider(RAPIER.ColliderDesc.cuboid(...size.map(v=>v/2)).setTranslation(p.x,p.y,p.z).setRotation(q));
    }
  }
  world.step();const clear=makeGuideClearance(world,RAPIER,.12);
  for(const [leg,points]of input.guide.entries())for(let i=1;i<points.length;i++){
    if(!clear(points[i-1],points[i]))throw Error(`Guide ${leg+1} segment ${i} hits equipment or a gate frame.`);
  }
  const route=validateRoute(input,map),file=new URL('../data/maps/jatszoter/race_2.json',import.meta.url);
  let previous;try{previous=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(previous){
    const geometry=r=>JSON.stringify({name:r.name,spawn:r.spawn,gates:r.gates,guide:r.guide});
    route.version=geometry(route)===geometry(previous)?previous.version:previous.version+1;
  }
  await writeFile(file,JSON.stringify(route,null,2)+'\n');
  console.log(JSON.stringify({name:route.name,version:route.version,...routeMetrics(route)}));
}finally{collisions.dispose();world.free();}
