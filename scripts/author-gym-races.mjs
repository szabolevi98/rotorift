// Deliberately authored indoor lines; collision-checked against the actual hall.
import { mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { loadCatalog } from '../server/catalog.js';
import { buildGym } from '../web/game/gym.js';
import { validateRoute } from '../shared/race/routes.js';
import { gateBasis } from '../shared/race/gates.js';
import { gateFrameParts } from '../web/game/race-course.js';
import { generateRaceGuide, makeGuideClearance } from '../web/game/route-guide-planner.js';

const N=[0,0,-1],S=[0,0,1],E=[1,0,0],W=[-1,0,0];
const gate=(x,y,z,n,w=1.5,h=1.2)=>({p:[x,y,z],n,width:w,height:h});
const routes=[{
  id:'race_1',name:'Warm-up Circuit',version:1,aircraftKinds:['quadrotor'],spawn:[0,.15,16.5],
  details:{difficulty:'easy',recommendedDrones:['rift-65','rift-75'],description:{
    en:'A relaxed indoor loop with roomy gates around the court. Learn the hall before exploring the equipment.',
    hu:'Kényelmes beltéri kör tágas kapukkal a pálya körül. Ismerd meg a termet, mielőtt a tornaszerek közé repülsz.',
    de:'Eine entspannte Hallenrunde mit großzügigen Toren um das Spielfeld. Lerne die Halle kennen, bevor du die Geräte erkundest.',
    fr:'Un tour intérieur tranquille avec de grandes portes autour du terrain. Découvrez la salle avant de voler entre les agrès.',
    es:'Una vuelta interior relajada con puertas amplias alrededor de la cancha. Conoce el gimnasio antes de explorar los aparatos.'}},
  gates:[gate(0,1.3,10,N,2,1.6),gate(0,1.5,1,N,2,1.6),gate(-1,1.6,-8,N,2,1.6),
    gate(0,1.8,-15,N,2,1.6),gate(7,1.8,-15,E,2,1.6),gate(8,1.8,-7,S,2,1.6),
    gate(8,1.6,3,S,2,1.6),gate(5,1.5,11,S,2,1.6),gate(0,1.3,14,W,2,1.6)],
},{
  id:'race_2',name:'Apparatus Run',version:1,aircraftKinds:['quadrotor'],spawn:[0,.15,16.5],
  details:{difficulty:'medium',recommendedDrones:['rift-65','rift-75'],description:{
    en:'Thread the foam arch, circle the vault, pass between the parallel bars and fly through a suspended training hoop. A varied whoop line with room to turn.',
    hu:'Repülj át a szivacskapu alatt, kerüld meg az ugrószekrényt, bújj át a korlát között és egy függesztett karikán. Változatos whoop kör, elférő fordulókkal.',
    de:'Durch den Schaumstoffbogen, um den Sprungkasten, zwischen die Barrenholme und durch einen hängenden Trainingsreifen. Eine abwechslungsreiche Whoop-Runde mit Platz zum Wenden.',
    fr:'Passez sous l’arche en mousse, contournez le plinth, traversez les barres parallèles et un cerceau suspendu. Un parcours whoop varié avec de la place pour tourner.',
    es:'Pasa bajo el arco de espuma, rodea el plinto, atraviesa las paralelas y un aro suspendido. Una ruta whoop variada con espacio para girar.'}},
  gates:[gate(0,1.2,12,N),gate(-5,.85,9.7,N,1.3,1.1),gate(-5,.77,7,N,1.3,1.05),
    gate(-5,1.2,4.8,N),gate(-2.5,1.8,0,N),gate(-5,1.5,-5.8,N),
    gate(-8.5,1.3,-10,N),gate(-4,1.5,-14,E),gate(2.5,1.6,-12,E),
    gate(5,.85,-7,S,.94,1),gate(5,.85,-4,S,.94,1),gate(5,.85,-1,S,.94,1),
    gate(8,2.5,4,S),gate(6.85,2.5,8,S,.6,.6),gate(8,1.4,11,S),gate(2,1.2,14,W)],
}];

await RAPIER.init();
const map=(await loadCatalog()).maps.find(m=>m.id==='gym');
const folder=new URL('../data/maps/gym/',import.meta.url);await mkdir(folder,{recursive:true});
for(const input of routes){
  const world=new RAPIER.World({x:0,y:0,z:0}),environment=buildGym(new THREE.Scene(),world,RAPIER,map);
  try{
    world.colliders.forEach(c=>c.setEnabled(true));world.step();
    for(const [i,g]of input.gates.entries()){
      const {right,up}=gateBasis(g.n),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...right),new THREE.Vector3(...up),new THREE.Vector3(...g.n)));
      const p=new THREE.Vector3(...g.p).addScaledVector(new THREE.Vector3(...g.n),-.12);
      const hit=world.castShape(p,q,new THREE.Vector3(...g.n).multiplyScalar(.24),
        new RAPIER.Cuboid(g.width/2+.025,g.height/2+.025,.025),0,1,true);
      if(hit)throw Error(`${input.name}: gate ${i+1} intersects the room or apparatus.`);
    }
    input.guide=generateRaceGuide(world,RAPIER,map,input.gates);
    for(const g of input.gates){
      const {right,up}=gateBasis(g.n),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...right),new THREE.Vector3(...up),new THREE.Vector3(...g.n)));
      for(const [size,local]of gateFrameParts(g)){
        const p=new THREE.Vector3(...local).applyQuaternion(q).add(new THREE.Vector3(...g.p));
        world.createCollider(RAPIER.ColliderDesc.cuboid(...size.map(v=>v/2)).setTranslation(p.x,p.y,p.z).setRotation(q));
      }
    }
    world.step();const clear=makeGuideClearance(world,RAPIER,.09);
    for(const [leg,points]of input.guide.entries())for(let i=1;i<points.length;i++)
      if(!clear(points[i-1],points[i]))throw Error(`${input.name}: guide leg ${leg+1} hits scenery or a gate.`);
    const route=validateRoute(input,map);
    await writeFile(new URL(route.id+'.json',folder),JSON.stringify(route,null,2)+'\n');
    console.log(`${route.name}: ${route.gates.length} gates, clear frames and guide.`);
  }finally{environment.dispose();world.free();}
}
