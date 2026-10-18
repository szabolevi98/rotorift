// Authored landmark-to-landmark courses. This rebuilds the shipped race JSON;
// user-created race files remain separate. Run after rebuilding map collisions.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {parkSurfaceHeight} from '../shared/world/park-layout.js';
import {CONSTRUCTION_BUILDINGS,constructionHeight,constructionSurfaceHeight,floorOpening} from '../shared/world/construction-layout.js';
import {COLLISION_ASSETS} from '../shared/world/collision-assets.js';
import {decodeCollisionData} from '../shared/world/collision-data.js';
import {PrebakedCollisions} from '../web/game/prebaked-collisions.js';
import {generateRaceGuide,makeGuideClearance} from '../web/game/route-guide-planner.js';
import {gateBasis} from '../shared/race/gates.js';
import {validateRoute} from '../shared/race/routes.js';

const N=[0,0,-1],S=[0,0,1],E=[1,0,0],W=[-1,0,0],DOWN=[0,-1,0];
const A=(x,y,z,width=7,height=4,n,adjust=false)=>({p:[x,y,z],width,height,n,adjust});
const P=(x,z,above=7,width=8,height=4.8,n,adjust=true)=>({...A(x,parkSurfaceHeight(x,z)+above,z,width,height,n,adjust),terrain:parkSurfaceHeight});
const C=(x,z,above=7,width=7,height=4,n,adjust=true)=>({...A(x,constructionSurfaceHeight(x,z)+above,z,width,height,n,adjust),terrain:constructionSurfaceHeight});
const B=(id,x,y,z,width=5,height=2.4,n)=>{const b=CONSTRUCTION_BUILDINGS.find(b=>b.id===id);return A(b.x+x,constructionHeight(b.x,b.z)+y,b.z+z,width,height,n);};
const D=(id,y,width=4)=>{const b=CONSTRUCTION_BUILDINGS.find(b=>b.id===id),[x,z]=floorOpening(b);return A(x-1,constructionHeight(b.x,b.z)+y,z,width,width,DOWN);};
const T=(x,y,z,width=7,height=4,n)=>A(x,y,z,width,height,n);

const courses={
  liget:[
    {name:'Grove Grand Tour',spawn:[0,.15,60],gates:[
      A(0,3,38,7,4,N),A(0,2.1,10,6,2.8,N),A(0,2.1,-20,6,2.8,N),
      P(-62,-62),P(-115,-92,9),P(-175,-105,8),P(-245,-95,8),P(-294,-150,10),
      P(-250,-238,12),P(-150,-270,10),P(-55,-258,9),P(40,-245,10),
      P(130,-200,13),P(210,-155,13),P(254,-65,12),P(245,35,12),P(268,118,11),
      P(242,208,11),P(155,242,9),P(72,294,8),P(-24,288,9),P(-128,255,10),
      P(-211,215,12),P(-245,137,11),P(-174,78,9),P(-97,75,9),P(-42,100,6),P(0,83,5,8,4,N),
    ]},
    {name:'Twin Lakes Flow',spawn:[0,.15,60],gates:[
      A(0,3,38,7,4,N),P(45,30,6),P(110,85,8),P(156,126,7),P(213,134,7),
      A(203.5,1.35,160,5.5,1.5,S),A(203.5,1.35,175,5.5,1.5,S),A(203.5,1.35,190,5.5,1.5,S),
      P(220,225,8),P(155,250,9),P(60,260,8),P(-20,220,8),P(-120,220,10),P(-235,190,12),
      P(-290,100,10),P(-300,-15,10),P(-290,-95,9),A(-260,6,-162,8,4),
      A(-220,5,-195,8,4),A(-160,5,-175,8,4),P(-132,-130,5,7,3,E),
      P(-100,-130,4,6,2.6,E),A(-78,4.55,-129,3.5,2.2,E),
      A(-78,4.55,-120,3.5,2.2,S),P(-55,-70,5),P(-55,20,6),P(-25,90,6),P(0,84,5,8,4,N),
    ]},
    {name:'Pavilion Peaks',spawn:[0,.15,60],gates:[
      A(0,3,38,7,4,N),A(0,2.1,9,6,2.8,N),A(0,2.1,-22,6,2.8,N),P(45,-65,7),
      P(104,-77,7),P(149,-76,2.3,4.5,2.6,E,false),P(188,-76,2.3,4.5,2.6,E,false),
      P(225,-84,9),P(230,-165,16),P(140,-225,18),P(30,-210,20),P(-80,-240,18),
      P(-190,-245,18),P(-250,-172,19),P(-250,-38,20),P(-260,84,19),P(-220,170,18),
      P(-145,175,16),P(-70,122,13),A(0,6.2,25,7,2.4,N),A(0,6.2,0,7,2.4,N),
      A(0,6.2,-24,7,2.4,N),A(-38,15,-34,7,5),A(-38,13,27,6,6,DOWN),
      P(-25,70,5),P(0,83,5,8,4,N),
    ]},
  ],
  betonudvar:[
    {name:'Concrete Marathon',spawn:[0,.2,255],gates:[
      C(0,230,4,8,5,N),C(0,170,5,8,5,N),C(-30,130,7),
      B('south-frame',28,2,0,5,2.4,W),B('south-frame',0,2,0,5,2.4,W),B('south-frame',-28,2,0,5,2.4,W),
      C(-110,44,6),A(-136,constructionHeight(-136,-20)+4,16,9,5,N),
      A(-136,constructionHeight(-136,-20)+4,-20,9,5,N),A(-136,constructionHeight(-136,-20)+4,-52,9,5,N),
      C(-132,-98,10),B('parking-frame',-6.75,2,28,5.5,2.4,N),B('parking-frame',-6.75,2,-3,5.5,2.4,N),
      B('parking-frame',-6.75,2,-28,5.5,2.4,N),C(-185,-165,10),C(-145,-223,11),C(-62,-280,12),
      C(25,-230,12),A(113,constructionHeight(135,-185)+5,-185,6,4,E),
      A(152,constructionHeight(135,-185)+5,-185,6,4,E),C(211,-150,12),C(211,-55,12),
      B('east-frame',-30,6.6,0,5,2.4,E),B('east-frame',-6,6.6,0,5,2.4,E),B('east-frame',30,6.6,0,5,2.4,E),
      C(210,115,10),C(180,215,11),C(85,275,10),C(0,275,4,8,5,N),
    ]},
    {name:'Tower A Dive',spawn:[0,.2,255],gates:[
      C(0,230,4,8,5,N),C(0,155,8),C(-18,65,15),C(-22,-25,32),
      C(-35,-90,58),D('tower-a',54,5),D('tower-a',31,4.5),
      D('tower-a',13,4),D('tower-a',3.4,3),B('tower-a',-7,2,-20,4.5,2.4,N),B('tower-a',-7,2,-29,5,2.4,N),
      C(-110,-112,10),C(-145,-155,17),C(-45,-178,18),
      B('tower-b',-6.75,15.5,-26,5,2.4,S),B('tower-b',-6.75,15.5,0,5,2.4,S),B('tower-b',-6.75,15.5,26,5,2.4,S),
      C(80,-8,20),C(110,90,16),C(110,180,12),C(65,265,9),C(0,275,4,8,5,N),
    ]},
    {name:'Cranes & Twin Shafts',spawn:[0,.2,255],gates:[
      C(0,230,4,8,5,N),C(-25,165,12),C(-125,153,40),C(-165,85,42),C(-155,-10,60),
      C(-125,-95,85),C(-40,-130,83),C(65,-150,75),
      B('tower-b',-7.75,49,-1,6,5,S),D('tower-b',42,5),D('tower-b',24,4.5),D('tower-b',3.5,3),
      B('tower-b',-7.75,2,-23,4.8,2.4,N),C(40,-170,16),C(-35,-145,28),
      B('tower-a',-7,58,-14,6,5,S),D('tower-a',52,5),D('tower-a',29,4.5),D('tower-a',3.4,3),
      B('tower-a',-7,2,-26,4.8,2.4,N),C(-125,-100,14,7,4,W),C(-136,-82,9,8,5,S,false),
      A(-136,constructionHeight(-136,-20)+5,-55,8,5,S),A(-136,constructionHeight(-136,-20)+5,-15,8,5,S),
      A(-136,constructionHeight(-136,-20)+5,17,8,5,S),C(-115,76,20),C(-50,135,25),C(20,205,14),C(0,275,4,8,5,N),
    ]},
  ],
  skyline:[
    {name:'Canyon Express',spawn:[60,.15,250],gates:[
      T(60,4,220,8,5,N),T(60,5,125),T(60,5,60),T(150,5,60),T(180,5,60),
      T(180,6,-50),T(180,5,-150),T(180,5,-180),T(60,5,-180),T(60,6,-245),
      T(0,7,-282),T(-60,6,-245),T(-60,5,-180),T(-175,5,-180),T(-180,6,-80),T(-180,6,-60),
      T(-240,7,-60),T(-240,8,-25,6,4,S),T(-240,8,25,6,4,S),T(-240,7,60),
      T(-180,6,60),T(-180,6,145),T(-180,5,180),T(-70,5,180),T(-60,6,180),
      T(-60,6,250),T(0,7,282),T(60,5,282),T(60,4,265,8,5,N),
    ]},
    {name:'Garage to Skywalk',spawn:[60,.15,250],gates:[
      T(60,4,220,8,5,N),T(60,5,180),T(-45,8.2,180),T(-144,8.2,165,5.5,2.2,N),
      T(-144,8.2,140,5.5,2.2,N),T(-144,8.2,105,5.5,2.2,N),T(-144,8.2,75,5.5,2.2,N),
      T(-100,18,60),T(-60,20,60),T(-60,40,0),T(-60,49.8,-60),T(0,49.8,-60),
      T(0,51.1,-14,8,5,S),T(0,51.1,0,8,5,S),T(0,51.1,16,8,5,S),
      T(0,35,60),T(60,25,60),T(120,28,60),T(120,35,120,6,4,S),T(120,45,165,6,4,S),
      T(180,25,180),T(180,12,260),T(120,8,282),T(60,5,282),T(60,4,265,8,5,N),
    ]},
    {name:'Rooftop Descent',spawn:[60,.15,250],gates:[
      T(60,5,220,8,5,N),T(60,22,145),T(60,65,60),T(120,90,60),T(120,125,0,7,5,N),
      T(120,165,-60),T(120,185,-120,7,5,N),T(60,185,-180),T(0,185,-180),T(-60,160,-180),
      T(-120,110,-180),T(-120,105,-120,6,5,S),T(-120,100,-60),T(-180,95,-60),
      T(-180,80,60),T(-120,65,60),T(-144,44,110,6,6,DOWN),T(-144,30,110,5.5,5.5,DOWN),
      T(-144,27,144,6,3,S),T(-180,18,180),T(-180,12,240),T(-60,9,282),T(60,5,282),T(60,5,265,8,5,N),
    ]},
  ],
};

const selectedMap=process.argv[2];
if(selectedMap&&!Object.hasOwn(courses,selectedMap))throw Error(`Unknown authored map: ${selectedMap}`);
await RAPIER.init();
for(const [id,designs]of Object.entries(courses)){
  if(selectedMap&&id!==selectedMap)continue;
  const map=JSON.parse(await readFile(new URL(`../data/maps/${id}.json`,import.meta.url)));
  const world=new RAPIER.World({x:0,y:0,z:0}),raw=gunzipSync(await readFile(new URL('../web'+COLLISION_ASSETS[id].url,import.meta.url)));
  const collisions=new PrebakedCollisions(RAPIER,world,map,decodeCollisionData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),id));
  world.colliders.forEach(c=>c.setEnabled(true));world.step();
  const clearLine=makeGuideClearance(world,RAPIER,.55);
  const clearGate=g=>{
    const {right,up}=gateBasis(g.n),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...right),new THREE.Vector3(...up),new THREE.Vector3(...g.n)));
    return clearLine(g.p.map((v,i)=>v-g.n[i]*2.1),g.p)&&clearLine(g.p,g.p.map((v,i)=>v+g.n[i]*2.1))&&!world.castShape({x:g.p[0]-g.n[0]*2.1,y:g.p[1]-g.n[1]*2.1,z:g.p[2]-g.n[2]*2.1},q,
      {x:g.n[0]*4.2,y:g.n[1]*4.2,z:g.n[2]*4.2},new RAPIER.Cuboid(g.width/2+.08,g.height/2+.08,.08),0,1,true);
  };
  try{
    await mkdir(new URL(`../data/maps/${id}/`,import.meta.url),{recursive:true});
    for(const [index,design]of designs.entries()){
      const gates=design.gates.map((g,i,all)=>{
        if(g.n)return {...g};
        const a=all[(i+all.length-1)%all.length].p,b=all[(i+1)%all.length].p,dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);
        return {...g,n:[dx/length,0,dz/length]};
      });
      for(const [i,g]of gates.entries()){
        if(clearGate(g))continue;
        let found=false;
        if(g.adjust){
          const original=[...g.p],above=g.terrain?original[1]-g.terrain(original[0],original[2]):original[1];
          for(const rise of [0,2,4,7]){for(const [dx,dz]of [[0,0],[3,0],[-3,0],[0,3],[0,-3],[6,0],[-6,0],[0,6],[0,-6],[9,0],[-9,0],[0,9],[0,-9]]){
            g.p=[original[0]+dx,(g.terrain?g.terrain(original[0]+dx,original[2]+dz):0)+above+rise,original[2]+dz];
            if(clearGate(g)){found=true;break;}
          }if(found)break;}
          if(found)console.log(`${id}/${index+1} gate ${i+1}: adjusted ${original.map(v=>v.toFixed(1))} → ${g.p.map(v=>v.toFixed(1))}`);
        }
        if(!found)throw Error(`${id}/${index+1} gate ${i+1} intersects scenery at ${g.p}.`);
      }
      const input={id:`race_${index+1}`,name:design.name,version:1,spawn:design.spawn,
        gates:gates.map(({p,n,width,height})=>({p:p.map(v=>+v.toFixed(3)),n,width,height}))};
      console.log(`Planning ${id}/${input.id}: ${input.gates.length} gates (${input.name})`);
      input.guide=generateRaceGuide(world,RAPIER,map,input.gates);
      const route=validateRoute(input,map),file=new URL(`../data/maps/${id}/${input.id}.json`,import.meta.url);
      let previous;try{previous=JSON.parse(await readFile(file));}catch(error){if(error.code!=='ENOENT')throw error;}
      if(previous){
        if(previous.details) route.details=validateRoute({...route,details:previous.details},map).details;
        const same=r=>JSON.stringify({name:r.name,spawn:r.spawn,gates:r.gates,guide:r.guide});route.version=same(previous)===same(route)?previous.version:Math.max(route.version,previous.version+1);
      }
      await writeFile(file,JSON.stringify(route,null,2)+'\n');
      const length=route.guide.reduce((sum,leg)=>sum+leg.slice(1).reduce((s,p,i)=>s+Math.hypot(...p.map((v,j)=>v-leg[i][j])),0),0);
      console.log(`${id}/${route.id}: ${Math.round(length)} m, ${route.gates.length} gates, ${Math.min(...route.gates.map(g=>g.p[1])).toFixed(1)}–${Math.max(...route.gates.map(g=>g.p[1])).toFixed(1)} m altitude`);
    }
  }finally{collisions.dispose();world.free();}
}
