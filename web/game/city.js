import * as THREE from 'three';
import { createConstructionParts } from './construction-parts.js';
import { makeCityGroundGeometry } from './city-ground.js';
import { CITY_SIZE,CITY_STREETS,CITY_BLOCK_CENTERS,CITY_BUILDINGS,CITY_HERO,CITY_GARAGE,CITY_PLAZA,CITY_SKYWALK,citySurfaceHeight } from '../../shared/world/city-layout.js';

export const CITY_VIEW_DISTANCE = 12000;

// A repeating, opaque facade tile. No glass transmission, separate window
// meshes or coplanar decals; mipmaps keep distant window rows stable.
function facadeTexture(brick) {
  const size=64,bytes=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const window=x>10&&x<51&&y>12&&y<53,frame=window&&(x<14||x>47||y<16||y>49||x===31||x===32);
    let c=window?(frame?[51,61,65]:[89+x*.6+y*.3,112+x*.5+y*.3,126+x*.4+y*.4]):brick?[159,143,128]:[193,198,196];
    if(brick&&!window&&(y%8===0||(x+(Math.floor(y/8)%2)*12)%24===0))c=[116,111,105];
    const i=(y*size+x)*4;bytes.set([...c.map(v=>Math.round(v)),255],i);
  }
  const texture=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}
function facade(color,brick=false) {
  const material=new THREE.MeshStandardMaterial({color,roughness:brick?.9:.48,metalness:brick?0:.25,map:facadeTexture(brick)});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCityPosition;\nvarying vec3 vCityNormal;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vec4 cityPosition=vec4(transformed,1.0);vec3 cityNormal=normal;
        #ifdef USE_INSTANCING
          cityPosition=instanceMatrix*cityPosition;cityNormal=mat3(instanceMatrix)*cityNormal;
        #endif
        vCityPosition=(modelMatrix*cityPosition).xyz;vCityNormal=normalize(mat3(modelMatrix)*cityNormal);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCityPosition;\nvarying vec3 vCityNormal;')
      .replace('#include <map_fragment>',`#ifdef USE_MAP
        if(abs(vCityNormal.y)<0.5){vec2 cityUv=abs(vCityNormal.z)>0.5?vCityPosition.xy:vCityPosition.zy;
          diffuseColor*=texture2D(map,cityUv/vec2(3.8,3.6));}
        #endif`);
  };
  material.customProgramCacheKey=()=> 'rotorift-city-facade-v1';return material;
}

export function buildCity(scene,world,RAPIER,map) {
  // The whole compact district shares a few low-poly instance batches. The
  // physics still activates individual shapes only near the aircraft.
  const p=createConstructionParts(scene,world,RAPIER,{batchSize:Infinity}),{box,cylinder,beam,model,part}=p;
  p.root.name='Skyline_city_district';
  for(const [name,color]of Object.entries({asphalt:0x434b50,sidewalk:0xb1b2aa,roof:0x636d72,curb:0xd1d0c4,
    darkGlass:0x314d5c,cream:0xddd3b4,taxi:0xe7b341,leaf:0x68815a,trunk:0x786552,water:0x5f9aaf,signal:0x91bba6,grass:0x80a15d}))
    p.palette[name]=new THREE.MeshStandardMaterial({color,roughness:name==='darkGlass'?.36:.86,metalness:name==='darkGlass'?.25:0});
  p.palette.blueTower=facade(0x8daab7);p.palette.silverTower=facade(0xb8c2c3);
  p.palette.brick=facade(0xa5806b,true);p.palette.limestone=facade(0xd2c5aa,true);
  // Keep the cheap infinite collider; draw disjoint asphalt/grass surfaces.
  box([262144,.2,262144],[0,-.1,0],'asphalt',true,undefined,false);
  p.ground(makeCityGroundGeometry(),'asphalt',false).name='Skyline_asphalt_ground';
  p.ground(makeCityGroundGeometry(true),'grass',false).name='Skyline_outside_grass';
  for(const x of CITY_BLOCK_CENTERS)for(const z of CITY_BLOCK_CENTERS)box([96,.18,96],[x,.09,z],'sidewalk');

  function rail(a,b,y,color='steel'){
    beam([a[0],y+1.1,a[1]],[b[0],y+1.1,b[1]],.08,color);
    const distance=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(distance/4));
    for(let i=0;i<=n;i++){const t=i/n;box([.08,1.1,.08],[a[0]+(b[0]-a[0])*t,y+.55,a[1]+(b[1]-a[1])*t],color);}
  }
  function parapet(w,d,y){
    for(const x of [-w/2,w/2])box([.35,.75,d],[x,y+.375,0],'roof');
    for(const z of [-d/2,d/2])box([w-.35,.75,.35],[0,y+.375,z],'roof');
  }
  function tank(x,y,z){
    model('Rooftop_water_tank',[x,y,z],0,()=>{
      for(const dx of [-1.7,1.7])for(const dz of [-1.7,1.7]){
        box([.17,3,.17],[dx,1.5,dz],'steel');beam([dx,.1,dz],[-dx,2.9,dz],.10,'steel');
      }
      cylinder(5,4.5,[0,5.2,0],'wood');
      for(const yy of [3.3,5.2,7.1])cylinder(5.08,.10,[0,yy,0],'steel',false);
      part('cone',[5.6,1.3,5.6],[0,8.1,0],'roof',false);
      for(const dx of [-.34,.34])box([.07,8,.07],[2.8,4,dx],'steel');
      for(let yy=.4;yy<8;yy+=.4)box([.07,.05,.68],[2.8,yy,0],'steel',false);
    });
  }
  function equipment(w,d,y,hasTank){
    for(const [x,z]of [[-w*.27,-d*.26],[w*.26,-d*.2]]){
      box([5,1.4,3],[x,y+.7,z],'roof');box([4.7,.08,2.7],[x,y+1.44,z],'steel',false);
      for(const dx of [-1.1,1.1])cylinder(1.4,.08,[x+dx,y+1.52,z],'darkGlass',false);
    }
    box([5,3.4,7],[w*.24,y+1.7,d*.26],'concrete');box([5.3,.18,7.3],[w*.24,y+3.49,d*.26],'roof');
    if(hasTank)tank(-w*.24,y,d*.23);
  }
  function escape(b){
    model('Connected_fire_escape',[b.width/2,0,b.depth*.1],0,()=>{
      const levels=Math.min(9,Math.floor((b.height-3)/3.6));
      for(let level=1;level<=levels;level++){
        const y=level*3.6;
        box([2.2,.16,7],[1.1,y,0],'steel');rail([2.15,-3.45],[2.15,3.45],y);
        rail([0,-3.45],[2.15,-3.45],y);rail([0,3.45],[2.15,3.45],y);
        if(level<levels){
          const from=[.8,y,2.8],to=[.8,y+3.6,-2.8];
          for(let i=0;i<12;i++){const t=i/11;box([1,.13,.48],[.8,y+3.6*t,2.8-5.6*t],'steel');}
          for(const x of [.25,1.35])beam([x,y+1,2.8],[x,y+4.6,-2.8],.07,'steel');
          beam(from,to,.09,'steel');
        }
      }
      for(const z of [-.4,.4])box([.07,3.6,.07],[1,1.8,z],'steel');
      for(let y=.3;y<3.6;y+=.3)box([.07,.05,.8],[1,y,0],'steel',false);
    });
  }
  for(const b of CITY_BUILDINGS)model(b.id,[b.x,.18,b.z],0,()=>{
    const stepped=b.height>90,shoulder=stepped?b.height*.74:b.height;
    box([b.width,shoulder,b.depth],[0,shoulder/2,0],b.style);
    if(stepped){
      box([b.width-8,b.height-shoulder,b.depth-12],[0,(shoulder+b.height)/2,0],b.style);
      parapet(b.width,b.depth,shoulder);equipment(b.width-8,b.depth-12,b.height,b.tank);
      parapet(b.width-8,b.depth-12,b.height);
    }else{parapet(b.width,b.depth,b.height);equipment(b.width,b.depth,b.height,b.tank);}
    // Storefronts are opaque insets, kept off the public sidewalk's flight line.
    for(const side of [-1,1]){
      for(const x of [-10,0,10])box([7,2.8,.08],[x,1.75,side*(b.depth/2+.06)],'darkGlass',false);
      box([b.width+1,.18,2],[0,3.8,side*(b.depth/2+1)],(b.id.length%2)?'ochre':'red');
    }
    if(b.fireEscape)escape(b);
  });
  model('Crown_tower_open_podium',[CITY_HERO.x,.18,CITY_HERO.z],0,()=>{
    for(const x of [-34,-12,12,34])for(const z of [-27,27])box([1.3,12,1.3],[x,6,z],'concrete');
    box([80,.7,72],[0,12.35,0],'cream');
    for(const [w,d,bottom,top]of [[48,46,12.7,157],[38,36,157,195],[24,26,195,217]]){
      box([w,top-bottom,d],[0,(top+bottom)/2,0],'silverTower');parapet(w,d,top);
    }
    box([8,5,8],[0,219.5,0],'roof');cylinder(.55,22,[0,233,0],'steel');
    for(const yy of [226,232,238])box([4,.14,.14],[0,yy,0],'white',false);
    for(const x of [-32,32])box([2.4,1.5,14],[x,.75,0],'concrete');
  });
  model('Open_skywalk',[CITY_SKYWALK.x,CITY_SKYWALK.y,CITY_SKYWALK.z],0,()=>{
    box([14.4,.36,6],[0,0,0],'steel');box([14.4,.18,6],[0,3.5,0],'cream');
    for(const x of [-6.7,6.7])for(const z of [-2.8,2.8])box([.18,3.5,.18],[x,1.75,z],'steel');
    // Open long sides allow a high-level transverse flight line.
    for(const z of [-2.85,2.85])for(const x of [-6.2,6.2])box([1,.9,.1],[x,.65,z],'steel');
  });
  model('Five_level_open_parking_garage',[CITY_GARAGE.x,.18,CITY_GARAGE.z],0,()=>{
    for(let level=0;level<CITY_GARAGE.levels;level++){
      const y=level*CITY_GARAGE.floorHeight;
      box([60,.3,68],[-10,y+.15,0],'concrete');
      for(const z of [-30,30])box([22,.3,8],[31,y+.15,z],'concrete');
      if(level<CITY_GARAGE.levels-1){
        for(const x of [-37,-10,16,40])for(const z of [-30,0,30])box([.85,5.2,.85],[x,y+2.9,z],'concrete');
        const startZ=level%2?-26:26,endZ=-startZ;
        beam([31,y+.3,startZ],[31,y+5.8,endZ],7,'concrete',true,.22);
        for(const side of [-1,1])beam([31+side*3.5,y+1,startZ],[31+side*3.5,y+6.5,endZ],.14,'ochre');
      }
      for(const z of [-33.8,33.8])for(const x of [-28,2])box([20,.9,.16],[x,y+.75,z],'concrete');
      for(const x of [-38,18])box([.16,.9,56],[x,y+.75,0],'concrete');
      for(const z of [-22,-11,0,11,22])box([10,.016,.12],[-23,y+.31,z],'white',false);
    }
    for(const x of [-30,-12,6])box([6,.15,1.5],[x,22.4,-25],'blue');
  });
  model('Civic_square_and_fountain',[CITY_PLAZA.x,.18,CITY_PLAZA.z],0,()=>{
    box([32,.4,20],[0,.2,0],'concrete');box([30,.02,18],[0,.42,0],'water',false);
    for(const x of [-15.7,15.7])box([.6,.75,20],[x,.375,0],'cream');
    for(const z of [-9.7,9.7])box([30.8,.75,.6],[0,.375,z],'cream');
    for(const x of [-8,0,8]){cylinder(.3,3.5,[x,2.15,0],'white',false);part('sphere',[.8,.7,.8],[x,3.9,0],'white',false);}
    for(const x of [-35,35])for(const z of [-30,-10,12,32]){
      box([5,.7,5],[x,.35,z],'concrete');cylinder(.38,5,[x,3.2,z],'trunk');
      part('sphere',[6,7,6],[x,7,z],'leaf',false);
    }
    for(const x of [-22,22])for(const z of [-23,23]){
      box([4,.18,1],[x,.7,z],'wood');box([4,.9,.15],[x,1.18,z+.5],'wood');
      for(const dx of [-1.4,1.4])box([.16,.6,.8],[x+dx,.3,z],'steel');
    }
    for(const x of [-27,27])for(const z of [-39,39])box([.24,4.6,.24],[x,2.3,z],'steel');
    box([56,.23,8],[0,4.72,-39],'roof');
  });

  // Crosswalks and lane paint sit above the asphalt, never on sidewalk slabs.
  for(const x of CITY_STREETS)for(const z of CITY_STREETS)for(const side of [-1,1])for(let i=0;i<8;i++){
    box([1.45,.014,4],[x-11.2+i*3.2,.012,z+side*16],'white',false);
    box([4,.014,1.45],[x+side*16,.012,z-11.2+i*3.2],'white',false);
  }
  for(const axis of [0,1])for(const road of CITY_STREETS)for(let along=-294;along<300;along+=12){
    if(CITY_STREETS.some(cross=>Math.abs(along-cross)<23))continue;
    box(axis?[5,.012,.14]:[.14,.012,5],axis?[along,.01,road]:[road,.01,along],'cream',false);
  }
  function car(x,z,index,van=false){
    model(van?'Delivery_van':'Parked_city_car',[x,0,z],x%2?Math.PI:0,()=>{
      const length=van?6:4.6,color=van?'white':index%3===0?'taxi':index%3===1?'blue':'red';
      box([1.9,.65,length],[0,.75,0],color);box([1.65,van?1.6:.75,van?3.9:2.6],[0,van?1.8:1.4,van?.7:0],van?'white':'darkGlass');
      box([1.7,.09,van?1.5:2.2],[0,van?2.64:1.82,van?-1.6:0],color);
      if(color==='taxi')box([.65,.23,.7],[0,1.98,0],'cream',false);
      for(const sx of [-1,1])for(const sz of [-1,1])cylinder(.65,.25,[sx*.97,.4,sz*(length*.31)],'rubber',true,[0,0,Math.PI/2]);
      for(const sx of [-.65,.65])box([.38,.16,.08],[sx,.85,-length/2-.04],'cream',false);
    });
  }
  let index=0;
  for(const x of CITY_STREETS)for(const z of [-252,-220,-132,-98,-12,20,105,140,220,266]){
    if(Math.hypot(x+8-60,z-250)<14)continue;
    car(x+8,z,index,index%9===0);index++;
  }
  model('City_bus',[-188,0,30],0,()=>{
    box([2.55,2.5,10.8],[0,1.65,0],'white');box([2.6,.4,10.85],[0,.8,0],'blue');
    for(const x of [-1.29,1.29])for(const z of [-3.7,-1.9,0,1.9,3.7])box([.04,1.1,1.5],[x,2.1,z],'darkGlass',false);
    for(const x of [-1.25,1.25])for(const z of [-3.5,3.5])cylinder(.85,.3,[x,.5,z],'rubber',true,[0,0,Math.PI/2]);
  });
  for(const road of CITY_STREETS)for(const z of CITY_BLOCK_CENTERS){
    cylinder(.18,8,[road+14,4.18,z],'steel');box([3,.15,.18],[road+12.6,8.18,z],'steel');
    box([1.3,.2,.65],[road+11.4,8.12,z],'cream',false);
    if(Math.abs(z)===240){cylinder(.7,1.1,[road+15,.73,z+7],'steel');box([1.8,1.6,.8],[road+15,.98,z-7],'blue');}
  }
  for(const x of CITY_STREETS)for(const z of CITY_STREETS)for(const side of [-1,1]){
    cylinder(.14,5.4,[x+side*14,2.88,z+14],'steel');box([.5,1.6,.45],[x+side*14,4.4,z+14],'rubber');
    for(const [dy,color]of [[-.45,'signal'],[0,'ochre'],[.45,'red']])cylinder(.25,.04,[x+side*14,4.4+dy,z+13.75],color,false,[Math.PI/2,0,0]);
  }
  // Low, permeable boundary markers; bare grass continues beyond the district.
  for(const side of [-1,1])for(let along=-294;along<=294;along+=6){
    if(CITY_STREETS.some(road=>Math.abs(along-road)<14))continue;
    cylinder(.18,1,[side*CITY_SIZE/2,.5,along],'steel',false);
    cylinder(.18,1,[along,.5,side*CITY_SIZE/2],'steel',false);
  }
  const result=p.finish();
  // An infinite floor receives shadows without entering every cascade's caster list.
  result.root.traverse(mesh=>{if(mesh.isMesh&&mesh.material===p.palette.asphalt)mesh.castShadow=false;});
  result.heightAt=citySurfaceHeight;result.update(map.spawn);return result;
}
