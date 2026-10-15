import * as THREE from 'three';
import { CITY_SIZE } from '../../shared/world/city-layout.js';

// Two adjacent surfaces, never a grass sheet beneath an asphalt sheet. Small
// nearby tiles also avoid clipping a horizon-sized triangle across the camera.
export function makeCityGroundGeometry(outside=false) {
  const positions=[],indices=[],half=CITY_SIZE/2;
  function grid(left,right,bottom,top,step) {
    for(let z=bottom;z<top;z+=step)for(let x=left;x<right;x+=step){
      const xx=Math.min(right,x+step),zz=Math.min(top,z+step),i=positions.length/3;
      positions.push(x,0,z,x,0,zz,xx,0,zz,xx,0,z);
      indices.push(i,i+1,i+3,i+3,i+1,i+2);
    }
  }
  if(!outside)grid(-half,half,-half,half,25);
  else for(let inner=half;inner<131072;inner*=2){
    const outer=Math.min(inner*2,131072),step=inner/4;
    grid(-outer,outer,-outer,-inner,step);grid(-outer,outer,inner,outer,step);
    grid(-outer,-inner,-inner,inner,step);grid(inner,outer,-inner,inner,step);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
