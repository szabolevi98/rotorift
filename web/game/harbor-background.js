import * as THREE from 'three';
import { HARBOR } from '../../shared/world/harbor-layout.js';
import { makeTreeCrown, makeTreeTrunk } from './tree-models.js';

// Static background woodland, batched into four draws without contact shapes.
export function addHarborWoodland(root,materials,hills) {
  let seed=803;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const groups={oak:[],pine:[]},ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  root.updateMatrixWorld(true);
  const clusters=[[-445,-350],[-450,365],[-620,-440],[-650,510],[-800,-620],[-790,250],
    [-960,900],[-1000,-1100],[-250,-520],[-220,530]];
  for(const [cx,cz]of clusters)for(let i=0;i<18;i++){
    const angle=random()*Math.PI*2,r=12+random()*55,x=cx+Math.cos(angle)*r,z=cz+Math.sin(angle)*r;
    if(x>-420&&Math.abs(z)<435)continue;
    // Keep the existing industrial buildings and their immediate yards clear.
    let occupied=false;
    for(let j=0;j<14;j++){
      const bx=-460-(j%3)*65,bz=-600+j*95,w=45+(j%3)*12;
      if(Math.abs(x-bx)<w/2+12&&Math.abs(z-bz)<38){occupied=true;break;}
    }
    if(occupied)continue;
    let y=HARBOR.quayY;
    if(x<=-650){
      ray.ray.origin.set(x,1000,z);
      const hit=ray.intersectObject(hills,false)[0];
      if(!hit)continue;
      y=hit.point.y;
    }
    groups[i%3?'oak':'pine'].push({p:[x,y-.12,z],height:9+random()*10,yaw:random()*Math.PI*2});
  }
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
  for(const [kind,trees]of Object.entries(groups))for(const crown of [false,true]){
    const geometry=crown?makeTreeCrown(kind):makeTreeTrunk(kind);
    const mesh=new THREE.InstancedMesh(geometry,crown?materials.foliage:materials.wood,trees.length);
    mesh.name=`Harbor_background_${kind}_${crown?'crowns':'trunks'}`;
    trees.forEach(({p,height,yaw},i)=>{
      matrix.compose(new THREE.Vector3(...p),q.setFromAxisAngle(up,yaw),new THREE.Vector3(height,height,height));
      mesh.setMatrixAt(i,matrix);
      if(crown)mesh.setColorAt(i,new THREE.Color(i%3===0?0x83917d:0xa9b3a0));
    });
    mesh.castShadow=false;mesh.receiveShadow=false;mesh.computeBoundingSphere();root.add(mesh);
  }
}
