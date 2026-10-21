import * as THREE from 'three';
import {parkHeight} from '../../shared/world/park-layout.js';
import {constructionLandscapeHeight} from '../../shared/world/construction-layout.js';

// Scenery only: fixed in world space, outside the playable square, no colliders,
// shadow maps, textures, per-frame work or camera-following horizon tricks.
export const BACKDROP_PROFILES = {
  park: {seed:71,near:0x78935f,far:0x78939a,height:410,trees:240},
  circuit: {seed:194,near:0x7d945c,far:0x7d9499,height:270,trees:210},
  construction: {seed:307,near:0x928975,far:0x8a969d,height:300,trees:100},
  city: {seed:413,near:0x859580,far:0x81939f,height:330,trees:110},
  playground: {seed:529,near:0x789363,far:0x839ca2,height:260,trees:140},
};
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function material(name) {
  const m=new THREE.MeshBasicMaterial({vertexColors:true,fog:true});m.name=name;
  // Background air is clearer than the near-world fog, so distant ridges stay
  // visible while fading into exactly the same horizon color.
  m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(-fogDensity*fogDensity*vFogDepth*vFogDepth*0.30);
      #else
        float fogFactor = smoothstep(fogNear,fogFar,vFogDepth);
      #endif
      gl_FragColor.rgb = mix(gl_FragColor.rgb,fogColor,fogFactor);
    #endif`);};
  m.customProgramCacheKey=()=> 'rotorift-background-haze-v1';
  return m;
}
export function createWorldBackdrop(scene,map) {
  const profile=BACKDROP_PROFILES[map.kind]??BACKDROP_PROFILES.construction;
  const rng=random(profile.seed),half=map.size/2,root=new THREE.Group();
  root.name='Distant_world_'+map.id;root.userData.sceneryOnly=true;
  const geometries=new Set(),materials=new Set(),color=new THREE.Color(),matrix=new THREE.Matrix4();
  const basic=material('Distant_landscape');materials.add(basic);
  const terrainHeight=map.kind==='park'?parkHeight:map.kind==='construction'?constructionLandscapeHeight:()=>0;
  function mesh(geometry,name) {
    const m=new THREE.Mesh(geometry,basic);m.name=name;m.castShadow=false;m.receiveShadow=false;
    geometries.add(geometry);root.add(m);return m;
  }
  function instances(geometry,items,name) {
    if(!items.length){geometry.dispose();return;}
    const m=new THREE.InstancedMesh(geometry,basic,items.length);m.name=name;
    items.forEach(({p,s,c,yaw=0},i)=>{
      matrix.compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(...s));
      m.setMatrixAt(i,matrix);m.setColorAt(i,color.setHex(c));
    });
    // Bake a little directional light into distant objects: one cheap unlit
    // material still shows roof slopes, building sides and rounded tree crowns.
    const normals=geometry.attributes.normal,shades=new Float32Array(normals.count*3);
    const sun=new THREE.Vector3(-35,75,25).normalize();
    for(let i=0;i<normals.count;i++) {
      const lighting=.72+.28*Math.max(0,normals.getX(i)*sun.x+normals.getY(i)*sun.y+normals.getZ(i)*sun.z);
      shades.fill(lighting,i*3,i*3+3);
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(shades,3));
    m.computeBoundingSphere();m.castShadow=false;m.receiveShadow=false;geometries.add(geometry);root.add(m);
  }
  const inner=Math.max(half*Math.SQRT2+100,440),angles=192;
  const radii=[inner,inner+90,inner+220,inner+400,inner+650,inner+940,inner+1300,inner+1710,inner+2150,inner+2660,inner+3250,inner+3950];
  const positions=[],colors=[],indices=[],shade=new THREE.Color();
  const phase=profile.seed*.13;
  function height(r,a) {
    const d=r-inner;
    const rolling=.58+.19*Math.sin(a*3+phase)+.12*Math.sin(a*7-phase)+.07*Math.sin(a*11+2);
    const distant=.56+.21*Math.sin(a*4-phase)+.14*Math.sin(a*9+phase)+.09*Math.sin(a*15);
    const foothills=Math.exp(-(((d-540)/440)**2))*profile.height*.30*rolling;
    const range=Math.exp(-(((d-1450)/650)**2))*profile.height*distant;
    const farRange=Math.exp(-(((d-2670)/540)**2))*profile.height*1.3*(.65+.22*Math.sin(a*5+phase)+.13*Math.sin(a*12));
    return (foothills+range+farRange)*smooth(d/230)-35*(1-smooth(d/220))-65*smooth((d-3300)/650);
  }
  for(let j=0;j<radii.length;j++)for(let i=0;i<=angles;i++) {
    const a=(i%angles)*Math.PI*2/angles,r=radii[j],y=height(r,a);
    positions.push(Math.cos(a)*r,y,Math.sin(a)*r);
    const t=smooth((r-inner-550)/2300),lighting=.88+.10*Math.cos(a-.6)+.035*Math.sin(a*13+j*1.7);
    shade.setHex(profile.near).lerp(color.setHex(profile.far),t).multiplyScalar(lighting);
    colors.push(shade.r,shade.g,shade.b);
    if(j&&i){const at=j*(angles+1)+i;indices.push(at-1,at-angles-2,at,at,at-angles-2,at-angles-1);}
  }
  const ridges=new THREE.BufferGeometry();ridges.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  ridges.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));ridges.setIndex(indices);ridges.computeVertexNormals();
  mesh(ridges,'Layered_foothills_and_mountain_ranges');

  // Sparse, irregular clusters break up the transition to the distant hills.
  const trunks=[],crowns=[];
  for(let i=0;i<profile.trees;i++) {
    const a=rng()*Math.PI*2,edge=half/Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a)));
    const r=edge+(map.kind==='playground'?35:85)+rng()*(map.kind==='playground'?210:380);
    const x=Math.cos(a)*r,z=Math.sin(a)*r,y=terrainHeight(x,z),h=map.kind==='playground'?5+rng()*5:7+rng()*10;
    trunks.push({p:[x,y+h*.25,z],s:[h*.065,h*.5,h*.065],c:0x716c58});
    crowns.push({p:[x,y+h*.72,z],s:[h*.68,h*.83,h*.62],c:[0x607753,0x71845b,0x7f8f68,0x506b50][i%4]});
  }
  const hillCrowns=[];
  // Small woodland patches sit on the actual triangulated foothill surface.
  // Match its triangle plane instead of floating trees above the coarser mesh.
  const terrainSampler=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  const terrain=root.children[0];root.updateMatrixWorld(true);
  for(let i=0;i<90;i++) {
    const cluster=i%6,a=cluster*Math.PI/3+profile.seed*.03+(rng()-.5)*.32;
    const r=inner+260+rng()*600,x=Math.cos(a)*r,z=Math.sin(a)*r;
    terrainSampler.ray.origin.set(x,1000,z);
    const hit=terrainSampler.intersectObject(terrain,false)[0];
    if(!hit||hit.point.y<8)continue;
    const h=12+rng()*12,y=hit.point.y;
    trunks.push({p:[x,y+h*.25,z],s:[h*.065,h*.5,h*.065],c:0x67705a});
    hillCrowns.push({p:[x,y+h*.72,z],s:[h*.75,h*.9,h*.7],c:i%2?0x5f7956:0x70845c});
  }
  instances(new THREE.IcosahedronGeometry(.5,0),hillCrowns,'Foothill_woodland_clusters');
  instances(new THREE.CylinderGeometry(.5,.65,1,5),trunks,'Distant_tree_trunks');
  instances(new THREE.IcosahedronGeometry(.5,1),crowns,'Distant_woodland');

  const buildings=[],roofs=[],stacks=[];
  const count=map.kind==='playground'?30:map.kind==='city'?90:map.kind==='construction'?22:0;
  for(let i=0;i<count;i++) {
    const a=i/count*Math.PI*2+(rng()-.5)*.13;
    const edge=half/Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a)));
    const residential=map.kind==='playground';
    const r=edge+(residential?75:180)+rng()*(residential?115:420),x=Math.cos(a)*r,z=Math.sin(a)*r;
    const y=terrainHeight(x,z),w=residential?8+rng()*5:16+rng()*25,d=residential?9+rng()*7:14+rng()*22;
    const h=residential?4+rng()*3:map.kind==='city'?8+rng()**2*46:6+rng()*6,yaw=rng()*Math.PI/6;
    buildings.push({p:[x,y+h/2,z],s:[w,h,d],yaw,c:[0xb5b6ab,0xa6aeab,0x9ca9a7,0xc4bba7][i%4]});
    if(residential)roofs.push({p:[x,y+h,z],s:[w+1,3,d+1],yaw,c:i%3?0x7f8078:0xa08371});
    if(map.kind==='construction'&&i%5===0)stacks.push({p:[x+w*.3,y+13,z],s:[2,26,2],c:0x7f898b});
  }
  instances(new THREE.BoxGeometry(1,1,1),buildings,'Distant_neighborhood_or_industrial_estate');
  const roof=new THREE.BufferGeometry();
  const rp=[[-.5,0,-.5],[.5,0,-.5],[0,1,-.5],[-.5,0,.5],[.5,0,.5],[0,1,.5]];
  roof.setAttribute('position',new THREE.Float32BufferAttribute(rp.flat(),3));
  roof.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,2,5,4,2,4,1]);roof.computeVertexNormals();
  instances(roof,roofs,'Distant_house_roofs');
  instances(new THREE.CylinderGeometry(.5,.55,1,8),stacks,'Distant_factory_stacks');
  // Nothing in the playable area is moved or entered into the physics world.
  root.userData.innerRadius=inner;root.userData.profile=map.kind;
  scene.add(root);
  return {root,dispose(){root.removeFromParent();root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}

