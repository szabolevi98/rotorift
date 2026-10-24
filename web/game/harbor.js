import * as THREE from 'three';
import { harborParts } from './harbor-parts.js';
import { buildHarborDetails } from './harbor-details.js';
import { HARBOR, HARBOR_SHIP_OUTLINE, harborSurfaceHeight } from '../../shared/world/harbor-layout.js';

function corrugation() {
  const w=64,h=64,data=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const stripe=x%8,n=(Math.sin(x*12.7+y*32.1)*43758.5)%1;
    const shade=(stripe<2?195:stripe<4?242:224)+n*3;
    const i=(y*w+x)*4;data.set([shade,shade,shade,255],i);
  }
  const t=new THREE.DataTexture(data,w,h);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}
function makeMaterials() {
  const colors={asphalt:0x565f61,concrete:0x919b99,edge:0xaab2ab,steel:0x485962,steelDark:0x283b47,
    crane:0xd99443,craneLight:0xd8b17a,red:0xb54e3e,blue:0x41677f,teal:0x477f7b,ochre:0xad8146,
    grey:0x8f9a99,green:0x677f64,white:0xd8ddd7,glass:0x345f71,rubber:0x273337,
    hull:0x203e50,hullRed:0x7e3e39,deck:0x748986,rope:0x7d8276,paint:0xe6c979,wood:0x9e8869,
    water:0x386e7c,grass:0x6f8168,rock:0x7a8583};
  const materials=Object.fromEntries(Object.entries(colors).map(([name,color])=>[name,new THREE.MeshStandardMaterial({
    color,roughness:['water','glass'].includes(name)?.32:.85,metalness:['steel','steelDark','glass','water'].includes(name)?.3:0})]));
  const texture=corrugation();
  for(const name of ['red','blue','teal','ochre','grey','green']){
    const material=materials[name];material.map=texture;material.roughness=.75;material.metalness=.15;
    // Whole ribs fit each differently sized face, including rotated instances.
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vHarborRibUv;')
        .replace('#include <begin_vertex>',`#include <begin_vertex>
          vec3 harborSize=vec3(1.0);
          #ifdef USE_INSTANCING
            harborSize=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
          #endif
          float horizontal=abs(normal.z)>.5?position.x:position.z;
          float span=abs(normal.z)>.5?harborSize.x:harborSize.z;
          vHarborRibUv=vec2((horizontal+.5)*max(1.0,floor(span/.28))/8.0,position.y+.5);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vHarborRibUv;')
        .replace('#include <map_fragment>','#ifdef USE_MAP\n diffuseColor*=texture2D(map,vHarborRibUv);\n#endif');
    };
    material.customProgramCacheKey=()=> 'harbor-corrugated-steel-v1';
  }
  materials.light=new THREE.MeshBasicMaterial({color:0xffe6ad,toneMapped:false});
  return materials;
}

export function buildHarbor(scene,world,RAPIER,map) {
  const root=new THREE.Group();root.name='Harbor_seaport';scene.add(root);
  const materials=makeMaterials(),parts=harborParts(root,world,RAPIER,materials);
  const {box,cylinder,beam,pipe,model,mesh,prism,part}=parts,Y=HARBOR.quayY;
  // Land and piers are separate closed solids. The ocean has no invisible floor
  // at its surface: water shutdown is handled by the shared hazard checks.
  part('box',[262144,15,262144],[-131012,Y-7.5,0],'asphalt',true,[0,0,0],false);
  box([470,15,820],[-175,Y-7.5,0],'asphalt',false);
  box([261674,15,262144],[-131247,Y-7.5,0],'grass',false);
  for(const side of [-1,1])box([470,15,130662],[-175,Y-7.5,side*65741],'grass',false);
  part('box',[262144,1,262144],[0,-12.5,0],'rock',true,[0,0,0],false);
  for(const r of [...HARBOR.piers,...HARBOR.breakwaters])box([r.width,15,r.depth],[r.x,Y-7.5,r.z],'concrete');
  const seaGeometry=new THREE.PlaneGeometry(262144,262144);seaGeometry.rotateX(-Math.PI/2);
  const sea=new THREE.Mesh(seaGeometry,materials.water);sea.name='Harbor_open_sea';sea.receiveShadow=true;root.add(sea);
  const waveTime={value:0};
  materials.water.onBeforeCompile=shader=>{
    shader.uniforms.harborTime=waveTime;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHarborSea;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvHarborSea=(modelMatrix*vec4(position,1.0)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float harborTime;\nvarying vec3 vHarborSea;')
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        float wave=sin(vHarborSea.x*.48+vHarborSea.z*.17+harborTime*.65);
        float ripple=sin(vHarborSea.z*1.1-vHarborSea.x*.21-harborTime*.8);
        float nearWaves=1.0-smoothstep(60.0,450.0,length(vHarborSea.xz-cameraPosition.xz));
        normal=normalize(normal+vec3(wave*.045,ripple*.03,0.0)*nearWaves);`);
  };
  materials.water.customProgramCacheKey=()=> 'harbor-ocean-ripples-v1';
  sea.onBeforeRender=()=>{waveTime.value=performance.now()/1000;};

  // Quay edges are face cladding above the water, not another top plane.
  box([.32,3,820],[60.16,1.5,0],'edge');
  for(let z=-380;z<=380;z+=20){
    box([.5,1.6,3],[60.45,1.1,z],'rubber');
    cylinder(.48,.65,[57,3.325,z],'steelDark');cylinder(.7,.12,[57,3.68,z],'steelDark');
  }
  for(const r of HARBOR.piers){
    for(const side of [-1,1]){
      box([r.width,.24,.5],[r.x,3.12,r.z+side*(r.depth/2-.3)],'edge');
      for(let x=75;x<=230;x+=20){box([2,1.5,.5],[x,1.2,r.z+side*(r.depth/2+.15)],'rubber');cylinder(.5,.6,[x,3.3,r.z+side*(r.depth/2-2)],'steelDark');}
    }
    for(let x=70;x<235;x+=8)box([4,.015,.14],[x,3.012,r.z],'paint',false);
  }
  // Yard markings and loading pads sit on distinct heights, not coplanar decals.
  for(const x of [-245,-215,-172,-112,-52,5])for(let z=-300;z<290;z+=12)box([.16,.012,6],[x,Y+.007,z],'paint',false);
  for(const x of [-190,-130,-70])box([31,.06,405],[x,Y+.03,-5],'concrete');
  for(const z of [-305,285])box([440,.015,.16],[-180,Y+.009,z],'paint',false);

  const containerColors=['red','blue','teal','ochre','grey','green'];
  function container(p,color,{open=false,yaw=0,name='Freight_container'}={}) {
    model(open?'Open_container_tunnel':name,p,yaw,()=>{
      if(open){
        for(const x of [-1.18,1.18])box([.12,2.6,12.2],[x,1.3,0],color);
        box([2.44,.12,12.2],[0,.06,0],color);box([2.44,.12,12.2],[0,2.54,0],color);
        // Folded doors are outside the opening at both ends.
        for(const end of [-1,1])for(const side of [-1,1]){
          box([1.13,2.43,.07],[side*1.65,1.34,end*6.35],color,true,[0,side*end*.55,0]);
          pipe([side*1.84,.4,end*6.62],[side*1.84,2.25,end*6.62],.035,'steel',false);
        }
      }else{
        box([2.44,2.6,12.2],[0,1.3,0],color);
        for(const x of [-.55,.55])pipe([x,.24,6.13],[x,2.36,6.13],.035,'steel',false);
        box([.035,2.48,.035],[0,1.3,6.13],'steelDark',false);
        box([.45,.6,.025],[-.72,1.7,6.13],'white',false);
        for(let i=0;i<3;i++)box([.28,.045,.028],[-.72,1.55+i*.13,6.15],'steelDark',false);
      }
      for(const x of [-1.15,1.15])for(const z of [-6.02,6.02])for(const y of [.12,2.48])box([.18,.18,.18],[x,y,z],'steelDark',false);
    });
  }
  for(const [row,x]of [-190,-130,-70].entries())for(let group=0;group<10;group++){
    const z=-190+group*39;
    for(let column=0;column<9;column++)for(let deep=0;deep<2;deep++){
      const levels=1+(row+group+column+deep)%4;
      for(let level=0;level<levels;level++)container([x+(column-4)*2.8,Y+.06+level*2.64,z+deep*13],containerColors[(row*3+group+column+level)%6]);
    }
  }
  container([-120,Y,235],'teal',{open:true});container([-85,Y,235],'ochre',{open:true});
  for(const [x,z,h,color]of [[-40,260,2,'blue'],[-45,-285,3,'red'],[-170,220,1,'grey']])for(let i=0;i<h;i++)container([x,Y+i*2.64,z],color);

  function gantry(x,z,index) {model('Ship_to_shore_gantry_'+index,[x,Y,z],0,()=>{
    // Four legs around a clear portal; braces stay on the side planes.
    for(const sx of [-14,14])for(const sz of [-18,18]){
      box([3,1.2,8],[sx,.6,sz],'steelDark');
      for(const dz of [-2.8,2.8])cylinder(1.2,1.1,[sx,.6,sz+dz],'rubber',true,[0,0,Math.PI/2]);
      beam([sx,1,sz],[sx*.72,39,sz],1.7,'crane');
    }
    for(const sx of [-10,10]){
      beam([sx,38,-19],[sx,38,19],1.8,'crane');
      beam([sx,18,-18],[sx,37,18],.6,'craneLight');beam([sx,18,18],[sx,37,-18],.6,'craneLight');
    }
    for(const sz of [-18,18])beam([-11,39,sz],[11,39,sz],1.8,'crane');
    for(const sz of [-5,5]){
      beam([-70,50,sz],[178,50,sz],1.2,'crane');beam([-70,58,sz],[178,58,sz],.8,'crane');
      for(let p=-70;p<178;p+=15.5){beam([p,50,sz],[p+7.75,58,sz],.28,'craneLight');beam([p+7.75,58,sz],[p+15.5,50,sz],.28,'craneLight');}
      beam([-8,40,sz],[0,76,sz],1.1,'crane');beam([8,40,sz],[0,76,sz],1.1,'crane');
      for(const p of [-65,90,168])pipe([0,75,sz],[p,58,sz],.11,'steelDark');
    }
    for(let p=-65;p<175;p+=20)beam([p,50,-5],[p,50,5],.45,'crane');
    box([18,7,14],[-48,48,0],'grey');box([6,4,5],[-15,46,8],'crane');
    box([4.8,2.4,.1],[-15,46.5,10.56],'glass',false);
    const trolley=index===1?132:100;
    box([7,1.3,13],[trolley,50,0],'steelDark');
    for(const sx of [-2,2])for(const sz of [-3,3])pipe([trolley+sx,49,sz],[trolley+sx,28,sz],.065,'rope');
    box([5,.7,10],[trolley,27.7,0],'crane');
    for(const sx of [-14,14])box([.18,.07,140],[sx,.04,0],'steel',false);
    cylinder(.5,.5,[0,76.5,0],'red',false);
  });}
  HARBOR.cranes.forEach((p,i)=>gantry(p.x,p.z,i+1));

  // A small pier crane has a different silhouette and open braced legs.
  model('Pier_portal_crane',[185,Y,80],0,()=>{
    for(const x of [-10,10])for(const z of [-12,12]){
      beam([x,0,z],[x*.6,26,z*.5],.85,'blue');box([2,.8,4],[x,.4,z],'steelDark');
    }
    box([16,2,16],[0,27,0],'blue');beam([0,28,0],[32,43,0],1.2,'blue');
    for(const z of [-1.8,1.8])pipe([30,42,z],[30,15,z],.06,'rope');
    box([5,.6,5],[30,14.7,0],'ochre');box([5,4,5],[-4,29,0],'grey');
    box([4,2,.1],[-4,29.5,2.56],'glass',false);
  });

  const hullOutline=HARBOR_SHIP_OUTLINE;
  model('Moored_container_ship',[HARBOR.ship.x,0,HARBOR.ship.z],0,()=>{
    prism(hullOutline,-3,9.9,'hull','Container_ship_closed_hull');
    prism(hullOutline,6.9,.24,'deck','Container_ship_solid_deck');
    for(const side of [-1,1]){
      box([.06,1.2,112],[side*17.04,1.1,12],'hullRed',false);
      for(let z=-44;z<68;z+=6){pipe([side*16.7,7.1,z],[side*16.7,8.35,z],.055,'white');}
      for(const y of [7.7,8.3])pipe([side*16.7,y,-44],[side*16.7,y,68],.055,'white');
    }
    // Bow rails follow the actual tapered hull; no rectangular box at the bow.
    for(let i=2;i<hullOutline.length-1;i++){
      const a=hullOutline[i],b=hullOutline[i+1];pipe([a[0],8.25,a[1]],[b[0],8.25,b[1]],.055,'white');
      pipe([a[0],7.12,a[1]],[a[0],8.25,a[1]],.055,'white');
    }
    for(let row=0;row<4;row++)for(let column=0;column<6;column++){
      const levels=2+(row+column)%2;
      for(let level=0;level<levels;level++)container([-10+column*4,7.14+level*2.64,-57+row*26],containerColors[(row+column+level+2)%6]);
    }
    box([23,10,17],[0,12.14,52],'white');box([28,5,11],[0,19.64,52],'white');
    for(const x of [-10,-5,0,5,10])box([3.8,1.9,.09],[x,20.1,46.43],'glass',false);
    for(const x of [-14.05,14.05])box([.09,1.9,8.8],[x,20.1,52],'glass',false);
    for(const side of [-1,1])for(let level=0;level<3;level++)for(const z of [48,52,56])
      box([.08,1.1,1.6],[side*11.55,9.2+level*2.6,z],'glass',false);
    box([30,.4,13],[0,22.34,52],'deck');
    for(const x of [-14.7,14.7]){pipe([x,22.5,46],[x,23.6,46],.055,'white');pipe([x,23.6,46],[x,23.6,58],.055,'white');}
    cylinder(.65,15,[0,29.9,52],'white');beam([-6,32,52],[6,32,52],.2,'white');
    box([7,.35,.6],[0,37.5,52],'white',false);cylinder(.6,.4,[0,38,52],'light',false);
    box([5.2,9,5.5],[7,25.5,59],'hullRed');box([5.4,.7,5.7],[7,30.35,59],'steelDark');
    for(const x of [-19,19]){
      part('sphere',[2.8,2.1,7],[x,12,52],'ochre');
      beam([x,13,49],[Math.sign(x)*11,17,49],.2,'white');beam([x,13,55],[Math.sign(x)*11,17,55],.2,'white');
    }
    for(const x of [-5,5]){cylinder(1.3,.8,[x,7.54,-71],'steelDark');box([3,.8,1.5],[x,7.54,-75],'steel');}
  });
  for(const [ship,pier]of [[[155,7.3,-133],[150,3.65,-162]],[[175,7.3,-133],[195,3.65,-162]],
    [[153,7.3,10],[155,3.65,52]],[[178,7.3,10],[200,3.65,52]]])pipe(ship,pier,.12,'rope');
  for(const z of [-290,20,270]){
    for(const dz of [-.4,.4])pipe([60.5,.25,z+dz],[60.5,4,z+dz],.05,'steel');
    for(let y=.4;y<3.8;y+=.35)pipe([60.5,y,z-.4],[60.5,y,z+.4],.04,'steel');
  }

  function warehouse(p,w,d,h,color,{open=false,name='Warehouse'}={}) {model(name,p,0,()=>{
    const wallH=h-4;
    for(const x of [-w/2,w/2]){
      box([.4,wallH,d],[x,wallH/2,0],color);
      for(let z=-d/2+7;z<d/2;z+=12)box([.46,2,5.8],[x,wallH-2.8,z],'glass',false);
    }
    for(const z of [-d/2,d/2]){
      if(open){
        const wing=(w-26)/2,openingH=Math.min(10,wallH-1);
        for(const x of [-1,1])box([wing,wallH,.4],[x*(13+wing/2),wallH/2,z],color);
        box([26,wallH-openingH,.4],[0,openingH+(wallH-openingH)/2,z],color);
        for(const x of [-13,13])box([.5,openingH,.55],[x,openingH/2,z],'steel');
      }else{
        box([w,wallH,.4],[0,wallH/2,z],color);
        if(z>0)for(const x of [-w*.32,0,w*.32]){box([18,8,.12],[x,4,z+.26],'steelDark');box([16,1.4,.14],[x,6,z+.34],'glass',false);}
      }
      prism([[-w/2,z-.2],[w/2,z-.2],[w/2,z+.2],[-w/2,z+.2]],wallH,.1,color,name+'_end_cap',false);
      // Gable triangle closes the facade above the roll-up door line.
      const triangle=new THREE.BufferGeometry();triangle.setAttribute('position',new THREE.Float32BufferAttribute([-w/2,wallH,z,0,h,z,w/2,wallH,z],3));
      triangle.setIndex(z>0?[0,2,1]:[0,1,2]);triangle.computeVertexNormals();mesh(triangle,color,name+'_gable',false);
    }
    const slope=Math.atan2(4,w/2),length=Math.hypot(w/2,4);
    for(const side of [-1,1])box([length,.35,d+2],[side*w/4,wallH+2,0],'steelDark',true,[0,0,-side*slope]);
    for(let z=-d/2+4;z<d/2;z+=16){
      for(const x of [-w/2+1,w/2-1])box([.35,wallH,.35],[x,wallH/2,z],'steel');
      beam([-w/2+1,wallH,z],[0,h-.4,z],.22,'steel');beam([0,h-.4,z],[w/2-1,wallH,z],.22,'steel');
    }
    for(const x of [-w*.3,w*.3])for(const z of [-d*.25,d*.25])box([4,1.2,5],[x,h-1.3,z],'grey');
  });}
  warehouse([-300,Y,40],70,110,22,'grey',{open:true,name:'Open_transit_warehouse'});
  warehouse([-285,Y,-230],100,50,17,'teal',{name:'Cold_storage_warehouse'});
  model('Harbor_office',[-295,Y,220],0,()=>{
    box([50,14,24],[0,7,0],'white');box([52,.6,26],[0,14.3,0],'steelDark');
    for(const z of [-12.1,12.1])for(const y of [4,8,12])for(let x=-21;x<=21;x+=7)box([4.6,1.8,.1],[x,y,z],'glass',false);
    box([7,4,.15],[0,2,12.14],'glass');box([18,.35,5],[0,4.2,14],'steel');
    for(const x of [-8,8])box([.16,4,.16],[x,2,16],'steel');
    box([10,2.2,6],[-12,15.7,0],'grey');
  });

  function tractor(p,color,yaw=0) {model('Terminal_tractor',p,yaw,()=>{
    box([2.5,.6,5],[0,.8,0],'steelDark');box([2.4,2.5,2.2],[0,2.2,-1.2],color);
    box([2.1,1.1,.08],[0,2.65,-2.34],'glass',false);box([2.5,.3,.2],[0,.9,-2.6],'steel');
    for(const x of [-1.25,1.25])for(const z of [-1.5,1.6]){cylinder(1.1,.45,[x,.55,z],'rubber',true,[0,0,Math.PI/2]);cylinder(.5,.47,[x,.55,z],'steel',false,[0,0,Math.PI/2]);}
    cylinder(.5,.14,[0,1.17,1.3],'steel');
  });}
  tractor([-252,Y,-180],'ochre',Math.PI);tractor([-25,Y,220],'white',.2);
  model('Reach_stacker',[-210,Y,200],.3,()=>{
    box([4.3,1.4,7],[0,1.4,0],'ochre');box([2.8,2.4,2.7],[-.6,3.3,1],'glass');
    for(const x of [-2.1,2.1])for(const z of [-2.2,2.4])cylinder(2.1,.7,[x,1.05,z],'rubber',true,[0,0,Math.PI/2]);
    beam([0,2.5,1],[0,10,-7],1.1,'steelDark');beam([0,6,-3],[0,12,-11],.75,'steel');
    box([8,.7,2.8],[0,11.7,-11],'ochre');
  });
  // Service court, timber crates and cable reels; keep the pilot bay clear.
  for(const [x,z]of [[-245,170],[-255,-120],[-20,-245]]){
    model('Cable_reels_and_crates',[x,Y,z],0,()=>{
      for(const dx of [-2,2]){cylinder(2.1,1.6,[dx,1.05,0],'wood',true,[Math.PI/2,0,0]);cylinder(1.3,1.8,[dx,1.05,0],'steelDark',false,[Math.PI/2,0,0]);}
      box([2.3,1.9,2.3],[0,.95,4],'wood');for(const y of [.2,1.6])box([2.36,.1,2.36],[0,y,4],'steel',false);
    });
  }
  for(const x of [-350,-235,-20])for(const z of [-290,-100,100,275]){
    cylinder(.25,17,[x,Y+8.5,z],'steel');beam([x,20,z],[x+4,20,z],.16,'steel');box([1.6,.2,.7],[x+4,19.85,z],'light',false);
  }

  model('Harbor_lighthouse',[HARBOR.lighthouse.x,Y,HARBOR.lighthouse.z],0,()=>{
    cylinder(12,1.2,[0,.6,0],'rock');
    cylinder(6.6,22,[0,12.2,0],'white');cylinder(6.64,4,[0,13,0],'hullRed',false);
    cylinder(8,.45,[0,23.45,0],'steelDark');
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6,x=Math.cos(a)*3.6,z=Math.sin(a)*3.6;
      pipe([x,23.6,z],[x,24.9,z],.07,'white');
      const b=a+Math.PI/6;pipe([x,24.9,z],[Math.cos(b)*3.6,24.9,Math.sin(b)*3.6],.06,'white');
    }
    cylinder(4.4,3.2,[0,25.3,0],'glass');
    for(let i=0;i<8;i++){const a=i*Math.PI/4;pipe([Math.cos(a)*2.25,23.7,Math.sin(a)*2.25],[Math.cos(a)*2.25,26.9,Math.sin(a)*2.25],.1,'white');}
    cylinder(1.1,1.2,[0,25.3,0],'light',false);part('cone',[6,2,6],[0,28,0],'hullRed');
    pipe([0,29,0],[0,32,0],.1,'steelDark');box([1.4,2.5,.1],[0,1.85,3.35],'steelDark',false);
  });
  // Granite armor along the seaward face; analytic stones do not fill the lanes.
  for(const r of HARBOR.breakwaters)for(let x=r.x-r.width/2+3;x<r.x+r.width/2;x+=6){
    part('sphere',[6,4,5],[x,.3,r.z+Math.sign(r.z)*10],'rock',true,[0,x*.1,.35]);
    for(const dz of [-6,6])box([.1,.06,4],[x,3.04,r.z+dz],'paint',false);
  }
  // Landward industrial fringe and layered low hills, never mountains at sea.
  for(let i=0;i<14;i++){
    const x=-460-(i%3)*65,z=-600+i*95,w=45+(i%3)*12,h=12+(i%4)*5;
    box([w,h,50],[x,Y+h/2,z],i%2?'grey':'steelDark',false);
    box([w+2,.7,52],[x,Y+h+.35,z],'steelDark',false);
  }
  const positions=[],indices=[],columns=36,rows=64;
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const x=-650-col*90,z=-6000+row*187.5,t=Math.min(1,col/5),rise=t*t*(3-2*t);
    const ridge=100+60*Math.sin(z*.0018+x*.002)+34*Math.sin(z*.0041-x*.003);
    positions.push(x,Y+rise*ridge,z);
    if(row<rows&&col<columns){const i=row*(columns+1)+col;indices.push(i,i+1,i+columns+1,i+1,i+columns+2,i+columns+1);}
  }
  const hills=new THREE.BufferGeometry();hills.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));hills.setIndex(indices);hills.computeVertexNormals();
  const hill=mesh(hills,'grass','Landward_coastal_hills',false);hill.castShadow=false;
  // A compact pilot shelter stands behind the launch mark, away from race lines.
  model('Pilots_shelter',[-300,Y,327],0,()=>{
    for(const x of [-6,6])for(const z of [-3,3])box([.18,4,.18],[x,2,z],'steel');
    box([14,.3,8],[0,4.1,0],'steelDark');box([9,.12,.7],[0,.65,1],'wood');
    for(const x of [-3,3])box([.14,.65,.5],[x,.325,1],'steel');
  });
  buildHarborDetails(parts,{container,tractor,warehouse});
  parts.finish();parts.update(map.spawn);
  return {root,heightAt:harborSurfaceHeight,update:(p,v)=>parts.update(p,v),dispose:()=>parts.dispose()};
}
