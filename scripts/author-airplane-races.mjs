import { readFile, writeFile } from "node:fs/promises";
import { validateRoute } from "../shared/race/routes.js";
import { gunzipSync } from "node:zlib";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { COLLISION_ASSETS } from "../shared/world/collision-assets.js";
import { decodeCollisionData } from "../shared/world/collision-data.js";
import { PrebakedCollisions } from "../web/game/prebaked-collisions.js";
import { makeGuideClearance } from "../web/game/route-guide-planner.js";
import { gateBasis } from "../shared/race/gates.js";
import { routeMetrics } from "../shared/race/route-info.js";

const selectedMap=process.argv[2];
if(selectedMap&&!['liget','betonudvar','skyline'].includes(selectedMap))throw Error('Unknown airplane circuit map: '+selectedMap);

const map = JSON.parse(
  await readFile(new URL("../data/maps/liget.json", import.meta.url)),
);
const round = (n) => Math.round(n * 1000) / 1000;
const descriptions = {
  wing_1: {
    en: "A broad aerial circuit above Grove, with roomy gates and gentle turns for the Aero 150.",
    hu: "Tágas légi kör a Liget felett, széles kapukkal és nyugodt fordulókkal az Aero 150 számára.",
    de: "Eine weite Luftrunde über Grove mit großen Toren und sanften Kurven für die Aero 150.",
    fr: "Un grand circuit aérien au-dessus du parc, avec de larges portes et des virages doux pour l’Aero 150.",
    es: "Un circuito aéreo amplio sobre Grove, con puertas grandes y curvas suaves para el Aero 150.",
  },
  wing_2: {
    en: "A rising and falling figure eight above the lakes. Cross the centre at different heights and keep room for each turn.",
    hu: "Emelkedő és süllyedő nyolcas a tavak fölött. A középső keresztezést eltérő magasságban repüld, és hagyj helyet a fordulóknak.",
    de: "Eine steigende und sinkende Acht über den Seen mit versetzten Kreuzungshöhen und weiten Kurven.",
    fr: "Un huit montant et descendant au-dessus des lacs, avec des croisements à des hauteurs différentes.",
    es: "Un ocho con ascensos y descensos sobre los lagos y cruces centrales a distintas alturas.",
  },
};
for (const [id, name, count, point, difficulty] of [
  [
    "wing_1",
    "Grove Air Circuit",
    16,
    (t) => [230 * Math.sin(t), 52, 220 * Math.cos(t)],
    "easy",
  ],
  [
    "wing_2",
    "Lakeside Figure Eight",
    24,
    (t) => [240 * Math.sin(t), 60 + 22 * Math.cos(t), 135 * Math.sin(2 * t)],
    "medium",
  ],
]) {
  if(selectedMap&&selectedMap!=='liget')continue;
  const gates = Array.from({ length: count }, (_, i) => {
    const t = (i / count) * Math.PI * 2,
      p = point(t),
      a = point(t - 0.001),
      b = point(t + 0.001),
      d = b.map((v, j) => v - a[j]),
      length = Math.hypot(...d);
    return {
      p: p.map(round),
      n: d.map((v) => v / length),
      width: 18,
      height: 14,
    };
  });
  const guide = gates.map((gate, i) => [
    gate.p,
    ...[1, 2, 3].map((j) =>
      point(((i + j / 4) / count) * Math.PI * 2).map(round),
    ),
    gates[(i + 1) % count].p,
  ]);
  const route = validateRoute(
    {
      id,
      name,
      version: 1,
      aircraftKinds: ["fixedWing"],
      spawn: gates[0].p.map((v, i) => round(v - gates[0].n[i] * 30)),
      gates,
      guide,
      details: {
        difficulty,
        recommendedDrones: ["rift-t15"],
        description: descriptions[id],
      },
    },
    map,
  );
  await writeFile(
    new URL("../data/maps/liget/" + id + ".json", import.meta.url),
    JSON.stringify(route, null, 2) + "\n",
  );
}

// A constant-radius street loop: bends receive as much guide detail as the
// straights, without a spline cutting across the surrounding city blocks.
function streetCircuit(w,h,r){
  const segments=[];
  const line=(a,b)=>{const length=Math.hypot(b[0]-a[0],b[1]-a[1]);segments.push({length,at:t=>a.map((v,i)=>v+(b[i]-v)*t)});};
  const arc=(x,z,a,b)=>segments.push({length:r*Math.abs(b-a),at:t=>[x+r*Math.cos(a+(b-a)*t),z+r*Math.sin(a+(b-a)*t)]});
  line([0,h],[w-r,h]);arc(w-r,h-r,Math.PI/2,0);line([w,h-r],[w,-h+r]);
  arc(w-r,-h+r,0,-Math.PI/2);line([w-r,-h],[-w+r,-h]);arc(-w+r,-h+r,-Math.PI/2,-Math.PI);
  line([-w,-h+r],[-w,h-r]);arc(-w+r,h-r,Math.PI,Math.PI/2);line([-w+r,h],[0,h]);
  const length=segments.reduce((n,s)=>n+s.length,0);
  return t=>{
    let d=((t%1+1)%1)*length;
    for(const s of segments){if(d<=s.length){const [x,z]=s.at(d/s.length);return [x,16+6*Math.sin(2*Math.PI*t)**2,z];}d-=s.length;}
    return [0,16,h];
  };
}
const yardCurve=new THREE.CatmullRomCurve3([
  [0,24,235],[0,20,145],[0,25,45],[0,32,-65],[0,36,-165],[-25,38,-235],
  [-105,34,-270],[-190,30,-250],[-245,25,-180],[-260,24,-80],[-260,22,30],
  [-250,22,140],[-205,25,225],[-125,27,270],[-45,27,275],
].map(p=>new THREE.Vector3(...p)),true,'centripetal');
yardCurve.arcLengthDivisions=2000;
const otherCourses={
  betonudvar:[
    {id:'wing_1',name:'Crane Air Circuit',count:18,difficulty:'easy',point:t=>[250*Math.sin(t*2*Math.PI),95,240*Math.cos(t*2*Math.PI)],description:{
      en:'A wide, level circuit above the construction site, with gentle turns and ample clearance over the cranes.',
      hu:'Tágas, egyenletes magasságú kör az építkezés felett, nyugodt fordulókkal és bő hellyel a daruk fölött.',
      de:'Ein weiter, ebener Rundkurs über der Baustelle mit sanften Kurven und viel Abstand zu den Kränen.',
      fr:'Un grand circuit à altitude constante au-dessus du chantier, avec des virages doux et de la marge au-dessus des grues.',
      es:'Un circuito amplio a altura constante sobre la obra, con curvas suaves y espacio de sobra sobre las grúas.',
    }},
    {id:'wing_2',name:'Tower Alley Run',count:26,difficulty:'medium',point:t=>yardCurve.getPointAt((t%1+1)%1).toArray(),description:{
      en:'Fly low along the central corridor between the unfinished towers, climb past the north podium and return around the western work yards.',
      hu:'Repülj alacsonyan a félkész tornyok közötti központi folyosón, emelkedj az északi épület mellett, majd térj vissza a nyugati munkaterületek körül.',
      de:'Fliege tief durch den Korridor zwischen den Rohbautürmen, steige am Nordbau und kehre über die westlichen Arbeitsbereiche zurück.',
      fr:'Volez bas dans le couloir entre les tours inachevées, montez près du bâtiment nord et revenez autour des zones de travaux à l’ouest.',
      es:'Vuela bajo por el corredor entre las torres en construcción, asciende junto al edificio norte y regresa por las zonas de trabajo del oeste.',
    }},
  ],
  skyline:[
    {id:'wing_1',name:'Skyline Air Circuit',count:18,difficulty:'easy',point:t=>[270*Math.sin(t*2*Math.PI),92,260*Math.cos(t*2*Math.PI)],description:{
      en:'A broad sightseeing circuit above the outer rooftops, with steady altitude and wide turns around the skyline.',
      hu:'Tágas panorámakör a külső háztetők felett, állandó magassággal és széles fordulókkal a város körül.',
      de:'Ein weiter Panoramakurs über den äußeren Dächern mit konstanter Höhe und breiten Kurven um die Skyline.',
      fr:'Un grand circuit panoramique au-dessus des toits extérieurs, à altitude constante et avec de larges virages autour de la ville.',
      es:'Un circuito panorámico sobre los tejados exteriores, con altura constante y curvas amplias alrededor de la ciudad.',
    }},
    {id:'wing_2',name:'Boulevard Low Run',count:26,difficulty:'medium',point:streetCircuit(180,180,55),description:{
      en:'Stay below the rooftops along four broad boulevards. Smooth street-corner arcs and gentle height changes link the city canyons.',
      hu:'Maradj a háztetők alatt a négy széles sugárúton. Sima ívű utcai fordulók és enyhe magasságváltások kötik össze a házak közötti folyosókat.',
      de:'Bleibe unter den Dächern auf vier breiten Boulevards. Runde Straßenkurven und sanfte Höhenwechsel verbinden die Häuserschluchten.',
      fr:'Restez sous les toits sur quatre grands boulevards. Des virages arrondis et de légers changements d’altitude relient les rues encaissées.',
      es:'Vuela bajo los tejados por cuatro grandes avenidas. Curvas redondeadas y suaves cambios de altura unen los cañones urbanos.',
    }},
  ],
};

await RAPIER.init();
for(const [mapId,designs]of Object.entries(otherCourses)){
  if(selectedMap&&selectedMap!==mapId)continue;
  const courseMap=JSON.parse(await readFile(new URL(`../data/maps/${mapId}.json`,import.meta.url),'utf8'));
  const world=new RAPIER.World({x:0,y:0,z:0}),raw=gunzipSync(await readFile(new URL('../web'+COLLISION_ASSETS[mapId].url,import.meta.url)));
  const collision=new PrebakedCollisions(RAPIER,world,courseMap,decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),mapId));
  try{
    world.colliders.forEach(c=>c.setEnabled(true));world.step();
    // A sphere wider than the Aero 150's banked airframe, not just a drone's
    // centre point. Preserve the smooth authored line instead of A* zigzags.
    const clear=makeGuideClearance(world,RAPIER,1.25);
    for(const design of designs){
      const {point,count}=design;
      const gates=Array.from({length:count},(_,i)=>{
        const t=i/count,a=point(t-.0001),b=point(t+.0001),d=b.map((v,j)=>v-a[j]),length=Math.hypot(...d);
        return {p:point(t).map(round),n:d.map(v=>v/length),width:18,height:14};
      });
      const guide=gates.map((g,i)=>[g.p,...Array.from({length:11},(_,j)=>point((i+(j+1)/12)/count).map(round)),gates[(i+1)%count].p]);
      const spawn=gates[0].p.map((v,i)=>round(v-gates[0].n[i]*30));
      const route=validateRoute({id:design.id,name:design.name,version:1,spawn,gates,guide,aircraftKinds:['fixedWing'],details:{difficulty:design.difficulty,recommendedDrones:['rift-s75','rift-t15'],description:design.description}},courseMap);
      if(!clear(spawn,gates[0].p))throw Error(`${mapId}/${design.id}: blocked launch`);
      for(const [i,g]of gates.entries()){
        const {right,up}=gateBasis(g.n),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...right),new THREE.Vector3(...up),new THREE.Vector3(...g.n)));
        const hit=world.castShape({x:g.p[0]-g.n[0]*4,y:g.p[1]-g.n[1]*4,z:g.p[2]-g.n[2]*4},q,{x:g.n[0]*8,y:g.n[1]*8,z:g.n[2]*8},new RAPIER.Cuboid(9.15,7.15,.15),0,1,true);
        if(hit)throw Error(`${mapId}/${design.id}: blocked gate ${i+1} at ${g.p}`);
        for(let j=1;j<guide[i].length;j++)if(!clear(guide[i][j-1],guide[i][j]))throw Error(`${mapId}/${design.id}: blocked guide ${i+1}.${j}`);
      }
      const file=new URL(`../data/maps/${mapId}/${route.id}.json`,import.meta.url);
      try{const previous=JSON.parse(await readFile(file,'utf8'));const content=r=>JSON.stringify({...r,version:0});route.version=previous.version+(content(previous)===content(route)?0:1);}catch(error){if(error.code!=='ENOENT')throw error;}
      await writeFile(file,JSON.stringify(route,null,2)+'\n');
      console.log(`${mapId}/${route.id}: ${gates.length} gates, ${Math.round(routeMetrics(route).lengthM)} m, 1.25 m aircraft clearance`);
    }
  }finally{collision.dispose();world.free();}
}
