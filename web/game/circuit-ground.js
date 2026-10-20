import * as THREE from 'three';
import {CIRCUIT_GROUND} from '../../shared/world/circuit-ground-data.js';

// All authored ground regions are disjoint, including paint and landscaping.
// Small local triangles also avoid interpolating depth across horizon-size faces.
export function installCircuitGround(root, palette) {
  const positions = [], colors = [], color = new THREE.Color();
  for (const {color: hex, y, polygons} of CIRCUIT_GROUND) {
    color.setHex(hex);
    for (const [outer, ...holes] of polygons) {
      const points = ring => ring.map(([x,z])=>new THREE.Vector2(x,-z));
      const shape = new THREE.Shape(points(outer));
      shape.holes = holes.map(ring=>new THREE.Path(points(ring)));
      const g = new THREE.ShapeGeometry(shape).toNonIndexed();
      const p = g.attributes.position;
      for (let i=0;i<p.count;i++) {
        positions.push(p.getX(i),y,-p.getY(i));
        colors.push(color.r,color.g,color.b);
      }
      g.dispose();
    }
  }
  function quad(x,z,xx,zz) {
    for (const [px,pz] of [[x,z],[x,zz],[xx,z],[xx,z],[x,zz],[xx,zz]]) {
      positions.push(px,-.05,pz); colors.push(color.r,color.g,color.b);
    }
  }
  function grid(left,right,bottom,top,step) {
    for(let z=bottom;z<top;z+=step)for(let x=left;x<right;x+=step)
      quad(x,z,Math.min(right,x+step),Math.min(top,z+step));
  }
  color.setHex(0x647e43);
  for(let inner=400;inner<131072;inner*=2) {
    const outer=Math.min(inner*2,131072),step=inner/4;
    grid(-outer,outer,-outer,-inner,step);grid(-outer,outer,inner,outer,step);
    grid(-outer,-inner,-inner,inner,step);grid(inner,outer,-inner,inner,step);
  }
  for (const mesh of [...root.children]) {
    if (!mesh.isMesh || (!mesh.userData.groundSurface && (mesh.isInstancedMesh || mesh.name.startsWith('box:')))) continue;
    // Custom sign planes are vertical; source ground meshes have upward normals.
    if (!mesh.userData.groundSurface && mesh.geometry.attributes.normal?.getY(0)<.99) continue;
    mesh.removeFromParent();
    if (!mesh.isInstancedMesh) mesh.geometry.dispose();
    mesh.dispose?.();
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const ground=new THREE.Mesh(geometry,palette.racingSurface);
  ground.name='Apex_disjoint_ground';ground.userData.groundSurface=true;
  ground.receiveShadow=true;ground.castShadow=false;root.add(ground);
  root.userData.batches=root.children.filter(mesh=>mesh.isInstancedMesh).length;
  root.userData.instances=root.children.filter(mesh=>mesh.isInstancedMesh).reduce((n,mesh)=>n+mesh.count,0);
}
