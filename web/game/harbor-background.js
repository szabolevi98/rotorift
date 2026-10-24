import * as THREE from 'three';
import { HARBOR } from '../../shared/world/harbor-layout.js';
import { makeTreeCrown, makeTreeTrunk } from './tree-models.js';

// Static background woodland, batched into four draws without contact shapes.
export function addHarborWoodland(root,materials,hills) {
  let seed=803;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const groups={oak:[],pine:[]},ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  root.updateMatrixWorld(true);
  // Jittered coverage extends along the whole landward edge and both flanks.
  // Broad density changes leave clearings without isolated circular tree blobs.
  for(let row=-1200;row<=1200;row+=45)for(let column=-1350;column<=30;column+=45){
    const x=column+(random()-.5)*30,z=row+(random()-.5)*30;
    const density=.64+.14*Math.sin(x*.007+Math.sin(z*.004))+.1*Math.cos(z*.009-x*.003);
    if(random()>density)continue;
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
    groups[random()<.7?'oak':'pine'].push({p:[x,y-.12,z],height:11+random()*13,yaw:random()*Math.PI*2});
  }
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
  for(const [kind,trees]of Object.entries(groups))for(const crown of [false,true]){
    const geometry=crown?makeTreeCrown(kind):makeTreeTrunk(kind);
    const mesh=new THREE.InstancedMesh(geometry,crown?materials.foliage:materials.wood,trees.length);
    mesh.name=`Harbor_background_${kind}_${crown?'crowns':'trunks'}`;
    trees.forEach(({p,height,yaw},i)=>{
      matrix.compose(new THREE.Vector3(...p),q.setFromAxisAngle(up,yaw),new THREE.Vector3(height,height,height));
      mesh.setMatrixAt(i,matrix);
      if(crown)mesh.setColorAt(i,new THREE.Color([0x9cbe75,0x85b356,0xb0c788][i%3]));
    });
    mesh.castShadow=false;mesh.receiveShadow=false;mesh.computeBoundingSphere();root.add(mesh);
  }
}
