import * as THREE from "three";
import { ColliderRegions } from "../../shared/world/collider-regions.js";
export const PLAYGROUND_VIEW_DISTANCE=12000;
export const PLAYGROUND_POIS={fort:[0,0,-3],swings:[-15,0,-7],bars:[14,0,-7],sandbox:[-15,0,14],hut:[15,0,16],tunnel:[-5,0,13]};
export function playgroundHeight(x=0,z=0){
 if((Math.abs(Math.abs(x)-30)<=1.5&&Math.abs(z)<=31.5)||(Math.abs(Math.abs(z)-30)<=1.5&&Math.abs(x)<=31.5)||(Math.abs(x)<=1.5&&z>=31.5&&z<=42))return .05;
 for(const [px,pz,w,d]of [[0,-3,17,16],[-15,-7,10,10],[14,-7,7,12],[9,13,6,5]])if(Math.abs(x-px)<=w/2&&Math.abs(z-pz)<=d/2)return .07;
 if(Math.abs(x+15)<=3.25&&Math.abs(z-14)<=2.6)return .18;
 return 0;
}
export function buildPlayground(scene,world,RAPIER,map){
 const root=new THREE.Group();root.name='Pocket_Park_playground';scene.add(root);
 const palette={grass:0x80a15d,paving:0xd0c8b5,rubber:0x63928c,coral:0xdd7050,blue:0x477eab,yellow:0xe0bb50,wood:0xb99468,darkWood:0x766345,steel:0x687b84,sand:0xd9c896,leaf:0x62905b,leafLight:0x8ca765,trunk:0x826847,black:0x35474d};
 const materials=Object.fromEntries(Object.entries(palette).map(([name,color])=>[name,new THREE.MeshStandardMaterial({color,roughness:name==='steel'?.6:.88,metalness:name==='steel'?.3:0})]));
 const geometries={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(.5,.5,1,12),cone:new THREE.ConeGeometry(.5,1,12),sphere:new THREE.IcosahedronGeometry(.5,1)};
 const batches=new Map(),colliders=[],regions=new ColliderRegions(),landmarks=[];let anchor=new THREE.Matrix4();
 function part(kind,size,p,color,solid=true,rotation=[0,0,0]){
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),matrix=anchor.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...p),q,new THREE.Vector3(...size))),key=kind+':'+color;
  if(!batches.has(key))batches.set(key,{kind,color,matrices:[]});batches.get(key).matrices.push(matrix);
  if(!solid||!world)return;
  const pos=new THREE.Vector3(),rot=new THREE.Quaternion(),scale=new THREE.Vector3();matrix.decompose(pos,rot,scale);
  const desc=kind==='box'?RAPIER.ColliderDesc.cuboid(scale.x/2,scale.y/2,scale.z/2):kind==='sphere'?RAPIER.ColliderDesc.ball(scale.x/2):kind==='cone'?RAPIER.ColliderDesc.cone(scale.y/2,scale.x/2):RAPIER.ColliderDesc.cylinder(scale.y/2,scale.x/2);
  const collider=world.createCollider(desc.setTranslation(pos.x,pos.y,pos.z).setRotation(rot).setFriction(.8));colliders.push(collider);
  const bounds=new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5)).applyMatrix4(matrix);regions.add(collider,bounds.min.toArray(),bounds.max.toArray());
 }
 const box=(size,p,color,solid=true,rotation)=>part('box',size,p,color,solid,rotation);
 const cylinder=(diameter,h,p,color,solid=true,rotation)=>part('cylinder',[diameter,h,diameter],p,color,solid,rotation);
 const ball=(diameter,p,color,solid=false)=>part('sphere',[diameter,diameter,diameter],p,color,solid);
 function beam(a,b,width,color,solid=true,depth=width){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),bv.clone().sub(av).normalize()),e=new THREE.Euler().setFromQuaternion(q);box([width,av.distanceTo(bv),depth],av.add(bv).multiplyScalar(.5).toArray(),color,solid,[e.x,e.y,e.z]);}
 function model(name,p,angle,build){const previous=anchor;anchor=anchor.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle),new THREE.Vector3(1,1,1)));landmarks.push({name,position:p});try{build();}finally{anchor=previous;}}
 // The same solid bare ground continues past the fence and to the horizon.
 box([262144,.2,262144],[0,-.1,0],'grass');
 for(const x of [-30,30])box([3,.05,63],[x,.025,0],'paving');
 for(const z of [-30,30])box([57,.05,3],[0,.025,z],'paving');
 box([3,.05,10],[0,.025,37],'paving');
 // Four distinct safety surfaces. None lies on the perimeter footpath.
 for(const [x,z,w,d,color]of [[0,-3,17,16,'rubber'],[-15,-7,10,10,'coral'],[14,-7,7,12,'blue'],[9,13,6,5,'rubber']])box([w,.07,d],[x,.035,z],color);
 model('Twin_tower_climbing_fort',PLAYGROUND_POIS.fort,0,()=>{
  for(const [x,y,z,color]of [[-3.4,1.4,0,'coral'],[3.4,2.25,0,'blue']]){
   for(const dx of [-1.1,1.1])for(const dz of [-1.1,1.1])cylinder(.16,y+1.65,[x+dx,(y+1.65)/2,z+dz],'wood');
   box([2.35,.14,2.35],[x,y,z],'wood');
   for(const dz of [-1.1,1.1]){
    box([2.2,.09,.10],[x,y+.86,z+dz],'darkWood');
    for(const dx of [-.8,-.4,0,.4,.8])box([.055,.74,.055],[x+dx,y+.44,z+dz],'wood');
   }
   part('cone',[3.8,.95,3.8],[x,y+1.925,z],color);
   for(const dx of [-1.1,1.1])beam([x+dx,y-.1,1.1],[x+dx,.1,3.5],.10,'steel');
   for(let i=0;i<7;i++)beam([x-1.1,y*(1-i/7),1.1+2.4*i/7],[x+1.1,y*(1-i/7),1.1+2.4*i/7],.09,'wood');
  }
  // A sloped slatted bridge links the towers, with uninterrupted openings below.
  for(let i=0;i<15;i++){const t=i/14,x=-2.2+t*4.4,y=1.4+t*.85;box([.28,.07,1.05],[x,y,0],'wood');}
  for(const z of [-.55,.55]){beam([-2.2,1.4,z],[2.2,2.25,z],.07,'steel');beam([-2.2,2.3,z],[2.2,3.15,z],.06,'steel');for(let i=0;i<7;i++){const t=i/6;beam([-2.2+t*4.4,1.4+t*.85,z],[-2.2+t*4.4,2.3+t*.85,z],.025,'steel');}}
  // Open slide chute, not a solid ramp or an invisible box around the tower.
  const points=[[3.4,2.25,-1.15],[3.4,2.17,-1.7],[3.4,1.8,-2.7],[3.4,.6,-4.4],[3.4,.22,-5.3],[3.4,.20,-6.2]];
  for(let i=0;i<points.length-1;i++){
   beam(points[i],points[i+1],.86,'yellow',true,.07);
   for(const side of [-1,1])beam([points[i][0]+side*.45,points[i][1]+.08,points[i][2]],[points[i+1][0]+side*.45,points[i+1][1]+.08,points[i+1][2]],.06,'yellow',true,.18);
  }
  // Crawl-through wall with a clear central aperture at ground level.
  for(const x of [-.9,.9])box([.6,.95,.1],[-3.4+x,.55,-1.15],'coral');box([2.3,.24,.1],[-3.4,1.13,-1.15],'coral');
 });
 model('Double_swing_A_frame',PLAYGROUND_POIS.swings,0,()=>{
  for(const x of [-3.3,3.3])for(const z of [-1.5,1.5])beam([x,0,z],[x,2.8,0],.15,'wood');beam([-3.5,2.8,0],[3.5,2.8,0],.15,'steel');
  for(const x of [-1.7,1.7]){for(const dx of [-.45,.45])beam([x+dx,2.8,0],[x+dx,.55,.2],.024,'steel');box([1,.09,.42],[x,.53,.2],'black');}
 });
 model('Monkey_bar_flight_lane',PLAYGROUND_POIS.bars,0,()=>{
  for(const z of [-4,-2,0,2,4])for(const x of [-.85,.85])cylinder(.09,1.65,[x,.825,z],'steel');
  for(const x of [-.85,.85])beam([x,1.65,-4.1],[x,1.65,4.1],.07,'yellow');for(let i=0;i<=13;i++)beam([-.85,1.65,-4+i*8/13],[.85,1.65,-4+i*8/13],.065,'blue');
  for(const z of [-4,4])for(let y=.3;y<1.5;y+=.3)beam([-.85,y,z],[.85,y,z],.055,'steel');
 });
 model('Sandbox_and_shade',PLAYGROUND_POIS.sandbox,0,()=>{
  box([6.5,.18,5.2],[0,.09,0],'sand');for(const x of [-3.4,3.4])box([.22,.30,5.65],[x,.15,0],'wood');for(const z of [-2.7,2.7])box([7,.30,.22],[0,.15,z],'wood');
  cylinder(.12,2.6,[0,1.3,0],'steel');part('cone',[5,1.05,5],[0,2.55,0],'yellow');
  cylinder(.32,.28,[-1.5,.31,.7],'blue',false);box([.7,.03,.3],[1,.21,-.4],'coral',false,[0,.4,0]);
 });
 model('Open_playhouse_and_picnic_table',PLAYGROUND_POIS.hut,.12,()=>{
  for(const x of [-2,2])for(const z of [-2,2])cylinder(.16,2.3,[x,1.15,z],'wood');
  for(const x of [-2,2])box([.13,.7,3.9],[x,.42,0],'blue');box([3.9,.7,.13],[0,.42,-2],'coral');
  for(const x of [-2,2])beam([x,2.28,-2],[x,2.28,2],.1,'wood');part('cone',[6,1.5,6],[0,2.95,0],'blue');
  box([2,.10,1],[0,.77,0],'wood');for(const x of [-.75,.75])beam([x,0,-.4],[x,.75,.2],.08,'steel');
  for(const z of [-.9,.9]){box([2,.1,.35],[0,.43,z],'wood');for(const x of [-.7,.7])box([.08,.4,.08],[x,.2,z],'steel');}
 });
 model('Log_crawl_tunnel',PLAYGROUND_POIS.tunnel,0,()=>{
  for(let i=0;i<16;i++){const a=(i+.5)*Math.PI/8;box([.24,.08,2.8],[Math.cos(a)*.58,.68+Math.sin(a)*.58,0],'wood',true,[0,0,a+Math.PI/2]);}
 });
 model('Seesaw_and_spring_riders',[9,0,13],0,()=>{
  part('cone',[.85,.60,.85],[0,.3,0],'coral');box([4,.14,.45],[0,.70,0],'wood',true,[0,0,.12]);
  for(const x of [-1.65,1.65]){box([.55,.10,.50],[x,.70+x*.12,0],'blue');beam([x,.8+x*.12,0],[x,1.1+x*.12,0],.04,'steel');}
  for(const [x,z,color]of [[-2.4,2.8,'coral'],[2.2,2.5,'yellow']]){cylinder(.16,.55,[x,.275,z],'steel');ball(.65,[x,.68,z],color,true);ball(.37,[x,.94,z-.3],color);box([.3,.1,.2],[x,.9,z-.51],'blue',false);box([.42,.08,.37],[x,.88,z+.1],'black');}
 });
 function bench(x,z,angle){model('Bench',[x,0,z],angle,()=>{for(const sx of [-.65,.65]){box([.09,.43,.46],[sx,.215,0],'steel');box([.08,.85,.08],[sx,.425,-.24],'steel');}for(let i=0;i<3;i++)box([1.7,.055,.13],[0,.45,-.16+i*.15],'wood');for(let i=0;i<3;i++)box([1.7,.13,.06],[0,.64+i*.14,-.25],'wood');});}
 bench(-25,7,Math.PI/2);bench(25,8,-Math.PI/2);bench(-8,26,0);bench(8,26,0);bench(-24,-23,0);bench(24,-23,0);
 for(const [x,z]of [[-24,10],[24,11],[-11,26]]){cylinder(.55,.85,[x,.425,z],'steel');cylinder(.62,.06,[x,.87,z],'black',false);}
 // Deliberate perimeter planting, clear paths and no objects outside the fence.
 for(const [index,[x,z]]of [[-36,-32],[-36,-13],[-36,8],[-35,29],[-22,36],[22,36],[36,26],[36,7],[36,-14],[34,-33],[17,-36],[-17,-36]].entries()){
  cylinder(.3,3.8,[x,1.9,z],'trunk');beam([x,2.8,z],[x+.8,4.1,z+.5],.12,'trunk');
  for(const [dx,y,dz,r]of [[0,4.5,0,3.7],[.9,4.25,.55,2.6],[-.75,4.1,-.55,2.5]])ball(r,[x+dx,y,z+dz],index%2?'leaf':'leafLight',true);
 }
 for(const [x,z]of [[-23,23],[24,23],[-24,-18],[24,-20],[-9,-18],[9,-18]])for(let i=0;i<3;i++)ball(.9,[x+i*.7,.43,z],'leaf',true);
 // Picket boundary with a south entrance wide enough for pilots to leave.
 const posts=new Set();
 for(const side of [-1,1])for(let p=-42;p<42;p+=3){
  for(const axis of [0,1]){const x=axis?p:side*42,z=axis?side*42:p,key=x+':'+z;
   if(!(axis&&side===1&&Math.abs(p)<2)&&!posts.has(key)){box([.085,1.1,.085],[x,.55,z],'darkWood');posts.add(key);}
   if(axis&&side===1&&Math.abs(p+1.5)<3)continue;
   for(const y of [.38,.92])box(axis?[3,.07,.06]:[.06,.07,3],axis?[p+1.5,y,z]:[x,y,p+1.5],'wood');}
 }
 // Two entrance bollards and a simple information board, off the flight line.
 for(const x of [-2.1,2.1])cylinder(.12,.75,[x,.375,40.2],'blue');box([2,.85,.08],[-5,1.2,35],'blue');for(const x of [-5.7,-4.3])box([.08,1.65,.08],[x,.825,35],'wood');
 let instances=0;
 for(const {kind,color,matrices}of batches.values()){
  const object=new THREE.InstancedMesh(geometries[kind],materials[color],matrices.length);object.name='Playground_'+kind+'_'+color;matrices.forEach((matrix,i)=>object.setMatrixAt(i,matrix));object.castShadow=!['grass','paving','rubber'].includes(color);object.receiveShadow=true;object.computeBoundingBox();object.computeBoundingSphere();root.add(object);instances+=matrices.length;
 }
 root.userData={landmarks,instances,batches:batches.size,colliders:colliders.length};
 const update=(p,v)=>{regions.update(p,v);root.userData.activeColliders=regions.activeCount;};update(map.spawn);
 return {root,heightAt:playgroundHeight,update,dispose(){for(const c of colliders)if(c.isValid())world.removeCollider(c,false);for(const o of root.children)o.dispose?.();for(const g of Object.values(geometries))g.dispose();for(const m of Object.values(materials))m.dispose();regions.clear();scene.remove(root);}};
}
