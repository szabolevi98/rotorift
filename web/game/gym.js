import * as THREE from 'three';
import { ColliderRegions } from '../../shared/world/collider-regions.js';
import { GYM_POIS } from '../../shared/world/gym-layout.js';

// One floor texture contains both the wood and court markings. No overlapping
// coplanar paint meshes, and no added geometry for plank seams or grain.
function courtTexture() {
  const width = 768, height = 1024, bytes = new Uint8Array(width * height * 4);
  const line = (a,b,w=.045) => Math.abs(a-b)<w;
  for(let py=0;py<height;py++)for(let px=0;px<width;px++) {
    const x=(px+.5)/width*24-12,z=(py+.5)/height*40-20;
    const plank=Math.floor((x+12)/.18),joint=((z+20+(plank%3)*1.15)%3.45);
    const seam=((x+12)%.18)<.012||joint<.014;
    const grain=Math.sin(z*73+plank*11)*1.6+Math.sin(z*21+plank*4)*1.2;
    const variation=Math.sin(plank*12.98)*5+grain-(seam?18:0);
    let color=[178+variation,133+variation,82+variation];
    const court=(Math.abs(x)<=7.5&&Math.abs(z)<=14)&&
      (line(Math.abs(x),7.5)||line(Math.abs(z),14)||line(z,0)||line(Math.hypot(x,z),1.8));
    const key=[-1,1].some(s=>{
      const d=14-s*z;
      return d>=0&&d<=5.8&&(line(Math.abs(x),2.45)||line(d,5.8)&&Math.abs(x)<2.45)||
        Math.abs(z-s*8.2)<1.8&&line(Math.hypot(x,z-s*8.2),1.8);
    });
    const secondary=Math.abs(x)<=9&&Math.abs(z)<=17&&
      (line(Math.abs(x),9,.035)||line(Math.abs(z),17,.035));
    if(court||key)color=[238,226,192];else if(secondary)color=[62,111,114];
    const i=(py*width+px)*4;bytes.set([...color.map(Math.round),255],i);
  }
  const texture=new THREE.DataTexture(bytes,width,height,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=true;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  texture.anisotropy=4;texture.needsUpdate=true;texture.name='Gym_parquet_and_court';return texture;
}

export function buildGym(scene,world,RAPIER,map) {
  const root=new THREE.Group();root.name='Gymnasium';scene.add(root);
  const palette={wall:0xd0d3c9,lower:0x426b70,trim:0x315057,steel:0x65757c,
    ceiling:0xb1b7b4,wood:0xb68a55,woodDark:0x82613d,leather:0xb66b42,
    blue:0x376e94,coral:0xce6246,foam:0xdda949,mat:0x4a797e,
    black:0x283940,white:0xe0e1d5,rubber:0x34464a,rope:0xc6b891,ball:0xcc7441};
  const materials=Object.fromEntries(Object.entries(palette).map(([name,color])=>[name,
    new THREE.MeshStandardMaterial({color,roughness:name==='steel'?.48:.8,metalness:name==='steel'?.35:0})]));
  materials.window=new THREE.MeshStandardMaterial({color:0xadc8d3,emissive:0x8daebd,emissiveIntensity:.6,roughness:.36});
  materials.light=new THREE.MeshBasicMaterial({color:0xfff1d9,toneMapped:false});
  const geometries={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(.5,.5,1,16),
    sphere:new THREE.SphereGeometry(.5,16,10)};
  const batches=new Map(),colliders=[],regions=new ColliderRegions(),landmarks=[];
  let anchor=new THREE.Matrix4();
  function part(kind,size,p,color,solid=true,rotation=[0,0,0],visible=true) {
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    const matrix=anchor.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...p),q,new THREE.Vector3(...size)));
    if(visible){const key=kind+':'+color;if(!batches.has(key))batches.set(key,{kind,color,matrices:[]});batches.get(key).matrices.push(matrix);}
    if(!solid||!world)return;
    const pos=new THREE.Vector3(),rot=new THREE.Quaternion(),scale=new THREE.Vector3();matrix.decompose(pos,rot,scale);
    const desc=kind==='box'?RAPIER.ColliderDesc.cuboid(scale.x/2,scale.y/2,scale.z/2):
      kind==='sphere'?RAPIER.ColliderDesc.ball(scale.x/2):RAPIER.ColliderDesc.cylinder(scale.y/2,scale.x/2);
    const collider=world.createCollider(desc.setTranslation(pos.x,pos.y,pos.z).setRotation(rot).setFriction(.8));colliders.push(collider);
    const bounds=new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5)).applyMatrix4(matrix);
    regions.add(collider,bounds.min.toArray(),bounds.max.toArray());
  }
  const box=(s,p,c,solid=true,r)=>part('box',s,p,c,solid,r);
  const cylinder=(d,h,p,c,solid=true,r)=>part('cylinder',[d,h,d],p,c,solid,r);
  const ball=(d,p,c,solid=true)=>part('sphere',[d,d,d],p,c,solid);
  function pipe(a,b,d,c,solid=true) {
    const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b);
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),bv.clone().sub(av).normalize());
    const e=new THREE.Euler().setFromQuaternion(q);cylinder(d,av.distanceTo(bv),av.add(bv).multiplyScalar(.5).toArray(),c,solid,[e.x,e.y,e.z]);
  }
  function model(name,p,yaw,build) {
    const previous=anchor;anchor=anchor.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...p),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(1,1,1)));
    landmarks.push({name,position:[...p]});try{build();}finally{anchor=previous;}
  }
  function ring(p,r,t,color,vertical=true) {
    // The visible ring and its collision segments share the same open centre.
    const count=32;
    for(let i=0;i<count;i++){
      const a=i*Math.PI*2/count,b=(i+1)*Math.PI*2/count;
      const point=k=>vertical?[p[0]+Math.cos(k)*r,p[1]+Math.sin(k)*r,p[2]]:[p[0]+Math.cos(k)*r,p[1],p[2]+Math.sin(k)*r];
      pipe(point(a),point(b),t,color);
    }
  }
  // A closed hall: walls and ceiling remain solid in both live and baked worlds.
  part('box',[24.6,.3,40.6],[0,-.15,0],'wood',true,[0,0,0],false);
  for(const x of [-12.15,12.15])box([.3,9,40.6],[x,4.5,0],'wall');
  for(const z of [-20.15,20.15])box([24,9,.3],[0,4.5,z],'wall');
  box([24.6,.25,40.6],[0,9.125,0],'ceiling');
  for(const x of [-11.97,11.97]){box([.04,2.15,39.9],[x,1.075,0],'lower',false);box([.065,.16,39.9],[x,.08,0],'trim',false);}
  for(const z of [-19.97,19.97]){box([23.9,2.15,.04],[0,1.075,z],'lower',false);box([23.9,.16,.065],[0,.08,z],'trim',false);}
  const floorTexture=courtTexture(),floorGeometry=new THREE.PlaneGeometry(24,40);
  const floorMaterial=new THREE.MeshStandardMaterial({map:floorTexture,roughness:.63});
  const floor=new THREE.Mesh(floorGeometry,floorMaterial);floor.name='Gym_parquet';floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;root.add(floor);

  // High, inset clerestory windows; no large flight-blocking window slabs.
  for(const x of [-11.94,11.94])for(let z=-15;z<=15;z+=6) {
    box([.06,2.15,4.2],[x,5.5,z],'trim',false);
    box([.075,1.9,3.94],[x-Math.sign(x)*.035,5.5,z],'window',false);
    for(const dz of [-.65,.65])box([.09,1.92,.045],[x-Math.sign(x)*.08,5.5,z+dz],'white',false);
    box([.09,.045,3.98],[x-Math.sign(x)*.08,5.5,z],'white',false);
    box([.2,.09,4.35],[x-Math.sign(x)*.08,4.4,z],'white',false);
  }
  for(let z=-16;z<=16;z+=8) {
    pipe([-11.8,7.8,z],[11.8,7.8,z],.13,'steel');pipe([-11.8,8.7,z],[11.8,8.7,z],.1,'steel');
    for(let x=-11.8;x<11.7;x+=2.95)pipe([x,7.8,z],[x+1.475,8.7,z],.055,'steel');
    for(const x of [-6,6]){box([3.2,.14,.5],[x,7.55,z],'steel');box([3,.04,.36],[x,7.46,z],'light',false);}
  }
  // Four non-shadowed lamps supplement the diffuse indoor atmosphere. Count is
  // fixed, independent of equipment count, and all lights are disposed with root.
  for(const x of [-6,6])for(const z of [-10,10]){
    const light=new THREE.PointLight(0xffead0,26,27,2);light.position.set(x,6.8,z);root.add(light);
  }
  // One bounded overhead shadow map instead of the four outdoor sun cascades.
  const overhead=new THREE.DirectionalLight(0xfff0d8,1.15);
  overhead.position.set(-3,8.6,4);overhead.target.position.set(0,0,0);
  overhead.castShadow=true;overhead.shadow.mapSize.set(2048,2048);
  Object.assign(overhead.shadow.camera,{left:-24,right:24,top:25,bottom:-25,near:.1,far:45});
  overhead.shadow.bias=-.00015;overhead.shadow.normalBias=.012;
  root.add(overhead,overhead.target);

  // Border equipment leaves a generous central aisle and a separate launch bay.
  for(const z of [-12,-6,0,6])model('Wall_bars',[-11.65,0,z],0,()=>{
    for(const dz of [-1,1])box([.12,3.3,.1],[0,1.65,dz],'woodDark');
    for(let i=0;i<12;i++)pipe([.03,.3+i*.25,-1],[.03,.3+i*.25,1],.045,'wood');
    for(const y of [.35,2.9])for(const dz of [-1,1])box([.3,.08,.1],[-.08,y,dz],'steel',false);
  });
  model('Stacked_landing_mats',GYM_POIS.mats,0,()=>{
    for(let i=0;i<3;i++){box([3.8,.18,2.4],[0,.09+i*.19,0],i%2?'coral':'blue');
      for(const x of [-1.7,1.7])box([.3,.035,.07],[x,.13+i*.19,1.22],'black',false);}
    box([2.7,.08,1.6],[2.5,.04,2.5],'mat');
  });
  model('Vault_and_springboard',GYM_POIS.vault,0,()=>{
    for(let i=0;i<5;i++){
      const w=1.25-i*.09;box([w,.18,1.6],[0,.13+i*.18,0],'wood');
      box([w+.012,.024,1.61],[0,.05+i*.18,0],'woodDark',false);
      for(const z of [-.813,.813])box([.3,.055,.018],[0,.13+i*.18,z],'woodDark',false);
    }
    box([.96,.18,1.7],[0,1.04,0],'leather');
    box([.8,.07,1.3],[0,.14,2.1],'wood',true,[-.12,0,0]);
    for(const x of [-.3,.3])box([.1,.08,1.1],[x,.04,2.1],'rubber');
    box([2.8,.1,2.4],[0,.05,-2.8],'mat');
  });
  model('Parallel_bars',GYM_POIS.bars,0,()=>{
    for(const x of [-.65,.65]){
      pipe([x,1.65,-2],[x,1.65,2],.065,'wood');
      for(const z of [-1.45,1.45]){
        cylinder(.065,1.55,[x,.775,z],'steel');box([.68,.08,.35],[x,.04,z],'blue');
        cylinder(.095,.18,[x,1.24,z],'blue',false);
      }
    }
    box([2.65,.07,5.3],[0,.035,0],'mat');
  });
  model('Suspended_training_rings',GYM_POIS.rings,0,()=>{
    for(const x of [-.85,.85]){
      pipe([x,3,0],[x,7.7,0],.026,'rope');ring([x,2.5,0],.5,.045,'wood');
      box([.13,.15,.15],[x,7.72,0],'steel',false);
    }
    box([3,.08,2.6],[0,.04,0],'blue');
  });
  model('Foam_arch',GYM_POIS.arch,0,()=>{
    for(const x of [-.95,.95])box([.45,1.4,1],[x,.7,0],'blue');
    box([2.35,.42,1],[0,1.61,0],'coral');box([3.4,.06,3.1],[0,.03,0],'mat');
    // Short bench behind the arch; its legs and underside are genuinely open.
    bench(0,-4.4,0);
  });
  model('Slalom_cones',GYM_POIS.slalom,0,()=>{
    for(let i=0;i<4;i++){
      const x=i%2?1.1:-1.1,z=i*1.75-2.6;
      box([.42,.04,.42],[x,.02,z],'coral');
      // A tapered cone is a standalone shared geometry; analytic cylinder is
      // a conservative contact shell only for this low, non-race obstacle.
      const geometry=new THREE.ConeGeometry(.18,.55,16),mesh=new THREE.Mesh(geometry,materials.coral);
      mesh.position.set(x,.31,z);mesh.applyMatrix4(anchor);root.add(mesh);
      part('cylinder',[.3,.45,.3],[x,.245,z],'coral',true,[0,0,0],false);
      cylinder(.22,.06,[x,.3,z],'white',false);
    }
  });
  function bench(x,z,yaw) {model('Gym_bench',[x,0,z],yaw,()=>{
    box([.42,.1,3],[0,.65,0],'wood');
    for(const dz of [-1.05,1.05]){box([.32,.59,.085],[0,.295,dz],'steel');box([.72,.07,.24],[0,.035,dz],'rubber');}
    box([.05,.12,2.4],[0,.2,0],'woodDark');
  });}
  bench(-8,13,Math.PI/2);bench(7,14,Math.PI/2);
  model('Balance_beam',[5,0,-12.5],0,()=>{
    box([.16,.16,4.6],[0,.94,0],'leather');
    for(const z of [-1.5,1.5]){for(const x of [-.42,.42])pipe([x,.06,z],[0,.86,z],.065,'steel');box([1.1,.08,.32],[0,.04,z],'blue');}
  });
  model('Foam_steps_and_blocks',[-6,0,-16],0,()=>{
    for(let i=0;i<3;i++)box([1.6,.22*(i+1),.65],[0,.11*(i+1),i*.65],i%2?'foam':'coral');
    box([1,.75,1],[2.1,.375,.5],'blue');box([.8,.45,.8],[3.2,.225,1.8],'foam');
  });
  model('Retractable_bleachers',[10.4,0,-7.5],0,()=>{
    for(let i=0;i<3;i++){
      box([.65,.24*(i+1),8],[i*.5,.12*(i+1),0],'woodDark');
      box([.68,.07,8],[i*.5,.24*(i+1)+.035,0],'wood');
    }
    for(const z of [-4.15,4.15]){pipe([0,.05,z],[1,1.2,z],.05,'steel');pipe([1,.75,z],[1,1.5,z],.05,'steel');}
  });
  for(const side of [-1,1])model('Basketball_and_handball_end',[0,0,side*18.7],side<0?0:Math.PI,()=>{
    // Handball goal: open front, sides and net gaps instead of a solid box.
    for(const x of [-1.55,1.55])pipe([x,.04,0],[x,2.1,0],.085,'white');
    pipe([-1.55,2.1,0],[1.55,2.1,0],.085,'white');
    for(const x of [-1.55,1.55]){pipe([x,.04,0],[x,.04,-.8],.055,'steel');pipe([x,2.1,0],[x,.1,-.8],.035,'steel');}
    for(let x=-1.4;x<=1.5;x+=.2)pipe([x,.1,-.78],[x,1.85,-.78],.009,'rope');
    for(let y=.1;y<1.9;y+=.2)pipe([-1.55,y,-.78],[1.55,y,-.78],.009,'rope');
    pipe([0,4,-1.1],[0,3.4,.3],.1,'steel');box([1.8,1.05,.085],[0,3.6,.3],'white');
    box([.6,.42,.018],[0,3.41,.353],'coral',false);
    ring([0,3.07,.65],.235,.025,'coral',false);
    for(let i=0;i<10;i++){const a=i*Math.PI/5;pipe([Math.cos(a)*.23,3.05,.65+Math.sin(a)*.23],[Math.cos(a)*.14,2.65,.65+Math.sin(a)*.14],.009,'rope');}
  });
  // Doors, radiator housings, an equipment trolley and wall padding complete
  // the room without filling its flight paths with arbitrary clutter.
  for(const x of [-8.6,8.6]){
    box([2.1,2.4,.08],[x,1.2,19.9],'trim');
    for(const dx of [-.51,.51]){box([.94,2.2,.1],[x+dx,1.13,19.83],'woodDark');box([.55,.6,.12],[x+dx,1.68,19.77],'window',false);}
    box([.35,.045,.12],[x,.98,19.71],'steel',false);
  }
  for(const z of [-12,0,12])box([.26,.65,2.6],[11.78,.4,z],'white');
  model('Ball_trolley',[-9.7,0,17.8],0,()=>{
    for(const x of [-.5,.5])for(const z of [-.35,.35]){ball(.12,[x,.12,z],'rubber');pipe([x,.16,z],[x,.95,z],.03,'steel');}
    for(const y of [.3,.65,.95])for(const z of [-.35,.35])pipe([-.5,y,z],[.5,y,z],.025,'steel');
    box([1,.06,.7],[0,.25,0],'steel');
    for(const [x,y,z]of [[-.25,.42,-.15],[.1,.43,.15],[.25,.43,-.15],[-.15,.67,0]])ball(.24,[x,y,z],'ball');
  });
  box([2.8,1.25,.1],[7.7,4.2,-19.9],'black');
  // A readable clock/score graphic, without requiring a DOM during baking.
  for(const x of [6.9,7.5,8.1,8.7])for(const y of [3.94,4.2,4.46])box([.24,.035,.015],[x,y,-19.84],'foam',false);
  for(const x of [-9.9,9.9])for(let i=0;i<3;i++)box([1.4,.68,.1],[x,.4+i*.72,-19.87],i%2?'blue':'coral');

  let instances=0;
  for(const {kind,color,matrices}of batches.values()){
    const mesh=new THREE.InstancedMesh(geometries[kind],materials[color],matrices.length);
    mesh.name='Gym_'+kind+'_'+color;matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));
    mesh.receiveShadow=true;mesh.castShadow=!['window','light'].includes(color);
    mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);instances+=matrices.length;
  }
  root.userData={landmarks,instances,batches:batches.size,colliders:colliders.length,indoor:true};
  const update=(p,v)=>{regions.update(p,v);root.userData.activeColliders=regions.activeCount;};update(map.spawn);
  return {root,heightAt:()=>0,update,dispose(){
    for(const c of colliders)if(c.isValid())world.removeCollider(c,false);
    const disposed=new Set();root.traverse(o=>{o.dispose?.();if(o.geometry&&!disposed.has(o.geometry)){disposed.add(o.geometry);o.geometry.dispose();}});
    floorTexture.dispose();floorMaterial.dispose();for(const material of Object.values(materials))material.dispose();
    regions.clear();scene.remove(root);
  }};
}
