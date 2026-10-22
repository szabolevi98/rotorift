import {PARK_LAKES,lakeDistance} from './park-layout.js';
import {CITY_PLAZA} from './city-layout.js';
import {aircraftAirframe} from '../aircraft/airframe.js';
import {rotate,inverse} from '../physics/math.js';

// The renderers and water checks use the same jet centerlines and radii.
export const PARK_FOUNTAIN_JETS=(()=>{
  const lake=PARK_LAKES.find(l=>l.fountain);
  return Array.from({length:13},(_,i)=>{
    const a=i/12*Math.PI*2,r=i===12?.3:6,h=i===12?10:6.5;
    return {radius:i===12?.075:.045,points:Array.from({length:33},(_,j)=>{
      const u=j/32;return[lake.x+Math.cos(a)*r*u,lake.waterY+.2+4*h*u*(1-u),lake.z+Math.sin(a)*r*u];
    })};
  });
})();
export const CITY_FOUNTAIN_JETS=[-8,0,8].flatMap(x=>[
  {radius:.15,points:[[CITY_PLAZA.x+x,.58,CITY_PLAZA.z],[CITY_PLAZA.x+x,4.08,CITY_PLAZA.z]]},
  {radius:.4,points:[[CITY_PLAZA.x+x,4.08,CITY_PLAZA.z],[CITY_PLAZA.x+x,4.08,CITY_PLAZA.z]]},
]);
const waterVolumes={
  park:PARK_LAKES.map(l=>({y:l.waterY,x:l.x,z:l.z,rx:l.rx*1.12,rz:l.rz*1.12,inside:(x,z)=>lakeDistance(l,x,z)<=1.08})),
  city:[{y:.61,x:CITY_PLAZA.x,z:CITY_PLAZA.z,rx:15,rz:9,inside:(x,z)=>Math.abs(x-CITY_PLAZA.x)<=15&&Math.abs(z-CITY_PLAZA.z)<=9}],
};
const jetSegments=Object.fromEntries([['park',PARK_FOUNTAIN_JETS],['city',CITY_FOUNTAIN_JETS]].map(([kind,jets])=>[
  kind,jets.flatMap(j=>j.points.slice(1).map((p,i)=>({a:j.points[i],b:p,r:j.radius,
    lo:p.map((v,k)=>Math.min(v,j.points[i][k])-j.radius),hi:p.map((v,k)=>Math.max(v,j.points[i][k])+j.radius)}))),
]));
function overlaps(a,b,r,lo,hi) {return a.every((v,i)=>Math.min(v,b[i])-r<=hi[i]&&Math.max(v,b[i])+r>=lo[i]);}
const cached=new WeakMap(),identity={x:0,y:0,z:0,w:1};
function boxes(config) {
  if(cached.has(config))return cached.get(config);
  const parts=[{p:[0,0,0],half:config.bodyHalfExtentsM}];
  if(config.kind==='fixedWing') {
    const frame=aircraftAirframe(config);
    parts.push(frame.nose,frame.wing,frame.tail,frame.fin,...(frame.extra??[]));
    frame.gear.forEach((p,i)=>{const r=frame.wheelRadii?.[i]??frame.wheelRadius;parts.push({p,half:[r,r,r]});});
  } else for(const m of config.motors) {
    const r=config.propDiameterM/2;
    parts.push({p:m.positionM,half:[r,.012,r]});
  }
  const probes=parts.flatMap(({p,half})=>[
    p,...[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>p.map((v,i)=>v+half[i]*[x,y,z][i])))),
  ]);
  const result={parts,probes,radius:Math.max(...parts.map(b=>Math.hypot(...b.p)+Math.hypot(...b.half)))};
  cached.set(config,result);return result;
}
const worldPoint=(point,pose)=>rotate(point,pose.q??identity).map((v,i)=>v+pose.p[i]);
function wetSegment(a,b,level,inside) {
  if(Math.min(a[1],b[1])>level)return false;
  let from=0,to=1;
  if(a[1]>level)from=(a[1]-level)/(a[1]-b[1]);
  else if(b[1]>level)to=(level-a[1])/(b[1]-a[1]);
  const steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])*(to-from)));
  for(let i=0;i<=steps;i++) {
    const t=from+(to-from)*i/steps;
    if(inside(a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t))return true;
  }
  return false;
}
function segmentBox(a,b,half) {
  let from=0,to=1;
  for(let i=0;i<3;i++) {
    const d=b[i]-a[i];
    if(Math.abs(d)<1e-10){if(Math.abs(a[i])>half[i])return false;continue;}
    const x=(-half[i]-a[i])/d,y=(half[i]-a[i])/d;
    from=Math.max(from,Math.min(x,y));to=Math.min(to,Math.max(x,y));
    if(from>to)return false;
  }
  return true;
}
export function findWaterImpact(map,config,previous,current) {
  if(!['park','city'].includes(map.kind))return null;
  const {parts,probes,radius}=boxes(config),a=previous??current,b=current;
  const waters=waterVolumes[map.kind].filter(w=>Math.min(a.p[1],b.p[1])-radius<=w.y&&
    overlaps(a.p,b.p,radius,[w.x-w.rx,-Infinity,w.z-w.rz],[w.x+w.rx,w.y,w.z+w.rz]));
  if(waters.length)for(const probe of probes) {
    const p=worldPoint(probe,a),q=worldPoint(probe,b);
    for(const water of waters)if(wetSegment(p,q,water.y,water.inside))return 'water';
  }
  const center=map.kind==='park'?PARK_LAKES.find(l=>l.fountain):CITY_PLAZA;
  const reach=map.kind==='park'?7:10;
  if(Math.min(a.p[1],b.p[1])-radius>11||Math.max(a.p[1],b.p[1])+radius<0)return null;
  // Swept world AABB before inspecting individual jets.
  if(Math.min(a.p[0],b.p[0])-radius>center.x+reach||Math.max(a.p[0],b.p[0])+radius<center.x-reach||
     Math.min(a.p[2],b.p[2])-radius>center.z+reach||Math.max(a.p[2],b.p[2])+radius<center.z-reach)return null;
  const qinv=inverse(b.q??identity),mid=a.p.map((v,i)=>(v+b.p[i])/2);
  const delta=rotate(b.p.map((v,i)=>v-a.p[i]),qinv).map(v=>Math.abs(v)/2);
  const local=p=>rotate(p.map((v,i)=>v-mid[i]),qinv);
  for(const segment of jetSegments[map.kind]) {
    if(!overlaps(a.p,b.p,radius,segment.lo,segment.hi))continue;
    const p=local(segment.a),q=local(segment.b);
    for(const part of parts)if(segmentBox(p.map((v,i)=>v-part.p[i]),q.map((v,i)=>v-part.p[i]),
      part.half.map((v,i)=>v+segment.r+delta[i])))return 'fountain';
  }
  return null;
}
export function stopWaterDamagedAircraft(physics,reason) {
  physics.armed=false;physics.crashed=true;physics.crashReason=reason;
  physics.turtleMode=false;physics.motorThrust.fill(0);
}
