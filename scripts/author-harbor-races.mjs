import { mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { loadCatalog } from '../server/catalog.js';
import { buildHarbor } from '../web/game/harbor.js';
import { validateRoute } from '../shared/race/routes.js';
import { gateBasis, newLap, advanceLap } from '../shared/race/gates.js';
import { gateFrameParts } from '../web/game/race-course.js';
import { generateRaceGuide, makeGuideClearance } from '../web/game/route-guide-planner.js';
import { routeMetrics } from '../shared/race/route-info.js';
import { findWaterImpact } from '../shared/world/water-hazards.js';

const round=v=>Math.round(v*1000)/1000,N=[0,0,-1],S=[0,0,1],E=[1,0,0],W=[-1,0,0];
const gate=(x,y,z,n,w=8,h=6)=>({p:[x,y,z],n,width:w,height:h});
function roundedLoop(x0,x1,z0,z1,r,height) {
  const segments=[];
  const line=(a,b)=>segments.push({length:Math.hypot(b[0]-a[0],b[1]-a[1]),at:t=>a.map((v,i)=>v+(b[i]-v)*t)});
  const arc=(x,z,a)=>segments.push({length:r*Math.PI/2,at:t=>[x+Math.cos(a+t*Math.PI/2)*r,z+Math.sin(a+t*Math.PI/2)*r]});
  line([x0,z1-r],[x0,z0+r]);arc(x0+r,z0+r,Math.PI);
  line([x0+r,z0],[x1-r,z0]);arc(x1-r,z0+r,Math.PI*1.5);
  line([x1,z0+r],[x1,z1-r]);arc(x1-r,z1-r,0);
  line([x1-r,z1],[x0+r,z1]);arc(x0+r,z1-r,Math.PI/2);
  const total=segments.reduce((s,p)=>s+p.length,0);
  return t=>{
    const phase=((t%1)+1)%1;let distance=phase*total;
    for(const segment of segments){if(distance<=segment.length){const [x,z]=segment.at(distance/segment.length);return[x,height(phase),z];}distance-=segment.length;}
    throw Error('Loop parameter overflow');
  };
}
function circuit(id,name,count,point,{plane=false,difficulty='easy',description}) {
  const gates=Array.from({length:count},(_,i)=>{
    const t=i/count,p=point(t),a=point(t-.0001),b=point(t+.0001),delta=b.map((v,j)=>v-a[j]),length=Math.hypot(...delta);
    return {p:p.map(round),n:delta.map(v=>v/length),width:plane?22:8,height:plane?16:6};
  });
  const guide=gates.map((g,i)=>[g.p,...Array.from({length:15},(_,j)=>point((i+(j+1)/16)/count).map(round)),gates[(i+1)%count].p]);
  const spawn=plane?gates[0].p.map((v,i)=>round(v-gates[0].n[i]*30)):[-280,3.15,305];
  return {id,name,version:1,aircraftKinds:[plane?'fixedWing':'quadrotor'],spawn,gates,guide,
    details:{difficulty,recommendedDrones:plane?['rift-a40','rift-s75','rift-t15']:['rift-x35','rift-x5','rift-r5'],description}};
}
const descriptions={
  race_1:{en:'A flowing waterfront lap around the container terminal, ship and piers. Wide gates and open turns make a first harbor flight comfortable.',
    hu:'Lendületes parti kör a konténerterminál, a hajó és a mólók körül. Tágas kapuk és nyitott fordulók az első kikötői repüléshez.',
    de:'Eine flüssige Hafenrunde um Terminal, Schiff und Anleger mit breiten Toren und offenen Kurven für den ersten Flug.',
    fr:'Un tour fluide autour du terminal, du navire et des quais, avec de grandes portes et des virages ouverts pour découvrir le port.',
    es:'Una vuelta fluida alrededor de la terminal, el barco y los muelles, con puertas amplias y curvas abiertas para conocer el puerto.'},
  race_2:{en:'Thread a real open container, cross the transit warehouse, fly through a gantry portal and skim above the ship cargo before returning along the waterfront.',
    hu:'Repülj át egy nyitott konténeren, a raktárcsarnokon és a daru kapuzatán, majd a hajó rakománya fölött térj vissza a part mentén.',
    de:'Durch einen offenen Container, die Lagerhalle und das Kranportal, dann knapp über die Schiffsladung und entlang der Kaikante zurück.',
    fr:'Traversez un conteneur ouvert, le hangar et le portique de la grue, puis survolez la cargaison avant de revenir le long du quai.',
    es:'Atraviesa un contenedor abierto, el almacén y el pórtico de una grúa; pasa sobre la carga del barco y regresa junto al muelle.'},
  wing_1:{en:'A wide sightseeing circuit above the cranes and harbor, with gentle bends and generous gates for every airplane.',
    hu:'Tágas panorámakör a daruk és a kikötő felett, nyugodt fordulókkal és széles kapukkal mindhárom repülőhöz.',
    de:'Eine weite Panoramarunde über Kränen und Hafen mit sanften Kurven und großen Toren für alle Flugzeuge.',
    fr:'Un grand circuit panoramique au-dessus des grues et du port, avec des courbes douces et de larges portes pour tous les avions.',
    es:'Un circuito panorámico sobre las grúas y el puerto, con curvas suaves y puertas amplias para todos los aviones.'},
  wing_2:{en:'A lower circuit along the terminal service corridor and over the harbor basin. Follow broad continuous turns between the warehouses, container yard and ship.',
    hu:'Alacsonyabb kör a terminál szervizfolyosója és a kikötőmedence felett. Széles, folyamatos fordulók a raktárak, a konténerudvar és a hajó között.',
    de:'Eine niedrigere Runde am Servicekorridor und über dem Hafenbecken mit weiten, stetigen Kurven zwischen Lagerhallen, Containerhof und Schiff.',
    fr:'Un circuit plus bas le long de la voie de service et du bassin, avec de larges virages continus entre hangars, conteneurs et navire.',
    es:'Un circuito más bajo por la vía de servicio y la dársena, con curvas amplias y continuas entre almacenes, contenedores y barco.'},
};
const routes=[
  circuit('race_1','Waterfront Flow',24,roundedLoop(-230,260,-280,270,60,t=>11+3*Math.sin(t*Math.PI*2)),{description:descriptions.race_1}),
  {id:'race_2',name:'Terminal Run',version:1,aircraftKinds:['quadrotor'],spawn:[-280,3.15,305],
    details:{difficulty:'hard',recommendedDrones:['rift-x35','rift-x5','rift-r5'],description:descriptions.race_2},
    gates:[gate(-225,7,265,N),gate(-185,7,245,E),gate(-120,4.4,243,N,1.8,1.6),gate(-120,4.4,227,N,1.8,1.6),
      gate(-140,18,190,N),gate(-235,12,125,W),gate(-300,8,103,N),gate(-300,8,65,N),gate(-300,8,-23,N),
      gate(-230,18,-80,N),gate(-230,18,-280,N),gate(-130,18,-280,E),gate(30,16,-260,E),
      gate(30,18,-105,S),gate(30,18,-70,S),gate(110,24,-40,E),gate(205,20,-40,E),
      gate(265,12,20,S),gate(265,10,160,S),gate(270,12,280,S),gate(165,15,310,W),gate(-50,12,310,W),gate(-210,8,310,W)]},
  circuit('wing_1','Harbor Air Circuit',20,roundedLoop(-320,320,-300,300,95,()=>110),{plane:true,description:descriptions.wing_1}),
  circuit('wing_2','Quayside Low Run',24,roundedLoop(-220,285,-270,260,80,t=>25+6*Math.cos(t*Math.PI*2)),{plane:true,difficulty:'medium',description:descriptions.wing_2}),
];

await RAPIER.init();
const catalog=await loadCatalog(),map=catalog.maps.find(m=>m.id==='harbor');
const folder=new URL('../data/maps/harbor/',import.meta.url);await mkdir(folder,{recursive:true});
for(const input of routes){
  const world=new RAPIER.World({x:0,y:0,z:0}),environment=buildHarbor(new THREE.Scene(),world,RAPIER,map),rails=[];
  try{
    world.colliders.forEach(c=>c.setEnabled(true));world.step();
    for(const [i,g]of input.gates.entries()){
      const {right,up}=gateBasis(g.n),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...right),new THREE.Vector3(...up),new THREE.Vector3(...g.n)));
      const p=new THREE.Vector3(...g.p).addScaledVector(new THREE.Vector3(...g.n),-2);
      const hit=world.castShape(p,q,new THREE.Vector3(...g.n).multiplyScalar(4),
        new RAPIER.Cuboid(g.width/2+.07,g.height/2+.07,.07),0,1,true);
      if(hit)throw Error(`${input.name}: frame/approach of gate ${i+1} at ${g.p} intersects scenery.`);
    }
    input.guide??=generateRaceGuide(world,RAPIER,map,input.gates);
    const aircraft=input.aircraftKinds.includes('fixedWing')?catalog.airplanes.find(c=>c.id==='rift-t15'):catalog.drones.find(c=>c.id==='rift-x5');
    const clear=makeGuideClearance(world,RAPIER,input.aircraftKinds.includes('fixedWing')?1.25:.45);
    for(const [leg,points]of input.guide.entries())for(let i=1;i<points.length;i++){
      if(!clear(points[i-1],points[i]))throw Error(`${input.name}: scenery blocks guide ${leg+1}/${i}.`);
      if(findWaterImpact(map,aircraft,{p:points[i-1]},{p:points[i]}))throw Error(`${input.name}: guide touches water.`);
    }
    for(const g of input.gates){
      const {right,up}=gateBasis(g.n),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...right),new THREE.Vector3(...up),new THREE.Vector3(...g.n)));
      for(const [size,local]of gateFrameParts(g)){
        const p=new THREE.Vector3(...local).applyQuaternion(q).add(new THREE.Vector3(...g.p));
        rails.push(world.createCollider(RAPIER.ColliderDesc.cuboid(...size.map(v=>v/2)).setTranslation(p.x,p.y,p.z).setRotation(q)));
      }
    }
    world.step();const lap=newLap();let time=0;
    const first=input.gates[0];advanceLap(lap,first.p.map((v,i)=>v-first.n[i]),first.p,0,time+=100,input.gates);
    for(const [leg,points]of input.guide.entries())for(let i=1;i<points.length;i++){
      if(!clear(points[i-1],points[i]))throw Error(`${input.name}: guide ${leg+1}/${i} hits a gate rail.`);
      advanceLap(lap,points[i-1],points[i],time,time+=100,input.gates);
    }
    if(lap.completed!==1)throw Error(`${input.name}: saved guide does not complete an ordered lap.`);
    const route=validateRoute(input,map);await writeFile(new URL(route.id+'.json',folder),JSON.stringify(route,null,2)+'\n');
    console.log(JSON.stringify({name:route.name,...routeMetrics(route)}));
  }finally{for(const c of rails)world.removeCollider(c,false);environment.dispose();world.free();}
}
