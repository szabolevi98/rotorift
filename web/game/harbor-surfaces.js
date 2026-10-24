import * as THREE from 'three';

// Large triangles spanning both sides of the camera are unreliable when clipped
// with logarithmic depth. Keep a fine shared grid around the port, coarsening
// only in the distant, fog-covered scenery. Explicit yard edges avoid color bleed.
function axis(min,max,edges){
  const values=[min,max,...edges];
  for(let v=-2048;v<=2048;v+=128)values.push(v);
  for(let v=4096;v<=262144;v*=2)values.push(-v,v);
  return [...new Set(values.filter(v=>v>=min&&v<=max))].sort((a,b)=>a-b);
}

export function makeHarborSurface(xMin,xMax,y,colorAt){
  const xs=axis(xMin,xMax,[-410,60]),zs=axis(-131072,131072,[-410,410]);
  const positions=[],colors=[];
  for(let x=0;x<xs.length-1;x++)for(let z=0;z<zs.length-1;z++){
    const color=colorAt?.((xs[x]+xs[x+1])/2,(zs[z]+zs[z+1])/2);
    for(const [px,pz]of [[xs[x],zs[z]],[xs[x],zs[z+1]],[xs[x+1],zs[z]],
      [xs[x+1],zs[z]],[xs[x],zs[z+1]],[xs[x+1],zs[z+1]]]){
      positions.push(px,y,pz);if(color)colors.push(color.r,color.g,color.b);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  if(colorAt)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();return geometry;
}
