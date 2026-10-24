import * as THREE from 'three';
import { ColliderRegions } from '../../shared/world/collider-regions.js';

// Static pieces are batched by primitive/material; contact shapes stay analytic.
// Bespoke closed hulls use the same mesh for visible surfaces and contact.
export function harborParts(root,world,RAPIER,materials) {
  const geometries={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(.5,.5,1,12),
    cone:new THREE.ConeGeometry(.5,1,16),sphere:new THREE.SphereGeometry(.5,12,8)};
  const batches=new Map(),colliders=[],regions=new ColliderRegions(),landmarks=[];
  let anchor=new THREE.Matrix4();
  function part(kind,size,p,color,solid=true,rotation=[0,0,0],visible=true) {
    const matrix=anchor.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...p),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...size)));
    if(visible){const key=kind+':'+color;if(!batches.has(key))batches.set(key,{kind,color,matrices:[]});batches.get(key).matrices.push(matrix);}
    if(!solid||!world)return;
    const p3=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();matrix.decompose(p3,q,s);
    const desc=kind==='box'?RAPIER.ColliderDesc.cuboid(s.x/2,s.y/2,s.z/2):
      kind==='sphere'?RAPIER.ColliderDesc.ball(s.x/2):kind==='cone'?RAPIER.ColliderDesc.cone(s.y/2,s.x/2):RAPIER.ColliderDesc.cylinder(s.y/2,s.x/2);
    const collider=world.createCollider(desc.setTranslation(p3.x,p3.y,p3.z).setRotation(q).setFriction(.8));colliders.push(collider);
    const bounds=new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5)).applyMatrix4(matrix);
    regions.add(collider,bounds.min.toArray(),bounds.max.toArray());
  }
  const box=(s,p,c,solid=true,r)=>part('box',s,p,c,solid,r);
  const cylinder=(d,h,p,c,solid=true,r)=>part('cylinder',[d,h,d],p,c,solid,r);
  function beam(a,b,width,color,solid=true,depth=width) {
    const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),length=av.distanceTo(bv);
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),bv.clone().sub(av).normalize());
    const e=new THREE.Euler().setFromQuaternion(q);box([width,length,depth],av.add(bv).multiplyScalar(.5).toArray(),color,solid,[e.x,e.y,e.z]);
  }
  function pipe(a,b,width,color,solid=true) {
    const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),length=av.distanceTo(bv);
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),bv.clone().sub(av).normalize());
    const e=new THREE.Euler().setFromQuaternion(q);cylinder(width,length,av.add(bv).multiplyScalar(.5).toArray(),color,solid,[e.x,e.y,e.z]);
  }
  function model(name,p,yaw,build) {
    const previous=anchor;anchor=anchor.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...p),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(1,1,1)));
    landmarks.push({name,position:new THREE.Vector3().setFromMatrixPosition(anchor).toArray()});
    try{build();}finally{anchor=previous;}
  }
  function mesh(geometry,color,name,solid=true) {
    geometry.applyMatrix4(anchor);geometry.computeBoundingBox();
    const object=new THREE.Mesh(geometry,materials[color]);object.name=name;object.castShadow=true;object.receiveShadow=true;root.add(object);
    if(world&&solid){
      const vertices=geometry.attributes.position.array,indices=geometry.index?.array??Uint32Array.from({length:vertices.length/3},(_,i)=>i);
      const collider=world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,new Uint32Array(indices),RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(.8));
      colliders.push(collider);regions.add(collider,geometry.boundingBox.min.toArray(),geometry.boundingBox.max.toArray());
    }
    return object;
  }
  function prism(points,bottom,height,color,name,solid=true) {
    const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:height,steps:1,bevelEnabled:false});
    geometry.rotateX(-Math.PI/2);geometry.translate(0,bottom,0);return mesh(geometry,color,name,solid);
  }
  function finish() {
    let instances=0;
    for(const {kind,color,matrices}of batches.values()){
      const object=new THREE.InstancedMesh(geometries[kind],materials[color],matrices.length);
      object.name='Harbor_'+kind+'_'+color;matrices.forEach((m,i)=>object.setMatrixAt(i,m));
      object.castShadow=!['asphalt','concrete','water','paint','light','glass','grass'].includes(color);object.receiveShadow=true;
      object.computeBoundingBox();object.computeBoundingSphere();root.add(object);instances+=matrices.length;
    }
    Object.assign(root.userData,{landmarks,instances,batches:batches.size,colliders:colliders.length});
  }
  return {box,cylinder,beam,pipe,model,mesh,prism,part,finish,
    update(p,v){regions.update(p,v);root.userData.activeColliders=regions.activeCount;},
    dispose(){
      for(const c of colliders)if(c.isValid())world.removeCollider(c,false);
      const geometrySet=new Set(Object.values(geometries)),textures=new Set();
      root.traverse(o=>{o.dispose?.();if(o.geometry)geometrySet.add(o.geometry);});
      for(const g of geometrySet)g.dispose();
      for(const m of Object.values(materials)){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}
      for(const texture of textures)texture.dispose();regions.clear();root.removeFromParent();
    }};
}
