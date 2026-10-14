import * as THREE from 'three';
import { playgroundGrass, playgroundWalk, playgroundWalkBoundary } from '../../shared/world/map-surfaces.js';
import { makeSurfaceGeometry } from './surface-geometry.js';

export function makePlaygroundOutsideGround(){
  const positions=[],indices=[];
  // Separate rings have shared edges, never overlapping planes. Nearby cells
  // remain small instead of clipping a 262 km triangle across the FPV camera.
  for(let inner=64;inner<131072;inner*=2){
    const outer=inner*2,step=inner/4;
    for(let z=-outer;z<outer;z+=step)for(let x=-outer;x<outer;x+=step){
      if(x>=-inner&&x<inner&&z>=-inner&&z<inner)continue;
      const i=positions.length/3;positions.push(x,0,z,x,0,z+step,x+step,0,z+step,x+step,0,z);
      indices.push(i,i+1,i+3,i+3,i+1,i+2);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export function addPlaygroundGround(root,materials){
  const positions=[],indices=[];
  // Close the exposed step from the walk down to its grass cutout. A top-only
  // surface leaves a visible slit when a whoop camera skims the edge.
  for(const polygon of playgroundWalkBoundary)for(const ring of polygon)for(let j=1;j<ring.length;j++){
    const a=ring[j-1],b=ring[j],i=positions.length/3;
    positions.push(a[0],0,a[1],a[0],.045,a[1],b[0],.045,b[1],b[0],0,b[1]);indices.push(i,i+1,i+3,i+3,i+1,i+2);
  }
  const edges=new THREE.BufferGeometry();edges.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));edges.setIndex(indices);edges.computeVertexNormals();
  const geometries=[makeSurfaceGeometry(playgroundGrass,()=>0,0),makePlaygroundOutsideGround(),makeSurfaceGeometry(playgroundWalk,()=>0,.045),edges];
  for(const [i,geometry]of geometries.entries()){
    const mesh=new THREE.Mesh(geometry,materials[i>=2?'paving':'grass']);mesh.name=['Playground_grass_surface','Playground_outside_ground','Playground_unified_garden_walk','Playground_walk_step_edges'][i];mesh.receiveShadow=true;root.add(mesh);
  }
  return geometries;
}
