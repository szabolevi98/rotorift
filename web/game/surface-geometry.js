import * as THREE from 'three';

function clip(polygon, distance) {
  const result=[];
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length],da=distance(a),db=distance(b);
    if(da>=0) result.push(a);
    if((da>=0)!==(db>=0)) {
      const t=da/(da-db); result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
    }
  }
  return result;
}
// Preserve every ground-triangle edge, including the diagonal. A raised road
// then stays above the terrain throughout its interior, not just at vertices.
export function makeSurfaceGeometry(polygons,height,lift=0.065) {
  const positions=[],uv=[],indices=[],cell=2;
  function emit(polygon) {
    for(let i=1;i<polygon.length-1;i++) {
      let tri=[polygon[0],polygon[i],polygon[i+1]];
      const [a,b,c]=tri,area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      if(Math.abs(area)<1e-9) continue;
      if(area>0) tri=[a,c,b];
      for(const [x,z] of tri) { indices.push(positions.length/3); positions.push(x,height(x,z)+lift,z); uv.push(x/2,z/2); }
    }
  }
  function split(tri) {
    const lengths=tri.map((a,i)=>Math.hypot(a[0]-tri[(i+1)%3][0],a[1]-tri[(i+1)%3][1]));
    const longest=Math.max(...lengths);
    if(longest>12) {
      const i=lengths.indexOf(longest),a=tri[i],b=tri[(i+1)%3],c=tri[(i+2)%3],m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      split([a,m,c]); split([m,b,c]); return;
    }
    const x0=Math.floor(Math.min(...tri.map(p=>p[0]))/cell),x1=Math.floor(Math.max(...tri.map(p=>p[0]))/cell);
    const z0=Math.floor(Math.min(...tri.map(p=>p[1]))/cell),z1=Math.floor(Math.max(...tri.map(p=>p[1]))/cell);
    for(let ix=x0;ix<=x1;ix++) for(let iz=z0;iz<=z1;iz++) {
      const x=ix*cell,z=iz*cell;
      let p=clip(tri,v=>v[0]-x); p=clip(p,v=>x+cell-v[0]); p=clip(p,v=>v[1]-z); p=clip(p,v=>z+cell-v[1]);
      emit(clip(p,v=>x+z+cell-v[0]-v[1])); emit(clip(p,v=>v[0]+v[1]-x-z-cell));
    }
  }
  for(const polygon of polygons) {
    const rings=polygon.map(r=>r.slice(0,-1).map(([x,z])=>new THREE.Vector2(x,z)));
    const vertices=rings.flat();
    for(const face of THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1))) split(face.map(i=>vertices[i].toArray()));
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
