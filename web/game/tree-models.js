import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const profiles = {
  oak: [[-.16,.61,.07,.20,.80], [.16,.66,-.05,.21,.87], [0,.82,.015,.22,.82], [-.065,.78,-.15,.17,.85], [.08,.60,.15,.16,.8]],
  birch: [[-.11,.59,.045,.17,1.12], [.11,.73,-.045,.17,1.08], [0,.9,0,.14,1.02], [.03,.53,.08,.14,1.12]],
};
function combine(parts) {
  const converted=parts.map(g=>g.index?g.toNonIndexed():g);
  const result=mergeGeometries(converted,false);
  for(const g of new Set([...parts,...converted])) g.dispose();
  return result;
}
function facets(geometry) {
  const g=geometry.index?geometry.toNonIndexed():geometry;
  if(g!==geometry) geometry.dispose();
  g.computeVertexNormals();
  const p=g.attributes.position,n=g.attributes.normal,colors=[];
  for(let i=0;i<p.count;i+=3) {
    const shade=.78+Math.max(0,n.getY(i))*.15+Math.max(0,n.getX(i)*.6+n.getZ(i)*.8)*.065;
    for(let j=0;j<3;j++) colors.push(shade,shade,shade*.97);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3)); return g;
}
export function makeTreeCrown(kind) {
  const parts=[];
  if(kind==='pine') {
    for(const [radius,y,height] of [[.245,.43,.40],[.195,.60,.35],[.145,.76,.30],[.085,.9,.26]])
      parts.push(facets(new THREE.ConeGeometry(radius,height,9).rotateY(y*8).translate(0,y,0)));
  } else {
    for(const [x,y,z,r,aspect] of profiles[kind])
      parts.push(facets(new THREE.IcosahedronGeometry(r,1).scale(1,aspect,.93).rotateY(y*11).translate(x,y,z)));
  }
  return combine(parts);
}
export function makeTreeTrunk() {
  const parts=[new THREE.CylinderGeometry(.013,.03,.74,7).translate(0,.37,0)];
  for(const [x,y,z] of [[-.19,.61,.08],[.18,.69,-.05],[-.04,.83,-.13],[.07,.61,.15]]) {
    const start=new THREE.Vector3(0,.32,0),end=new THREE.Vector3(x,y,z);
    const g=new THREE.CylinderGeometry(.005,.012,start.distanceTo(end),6,1,true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize()));
    g.translate(...start.add(end).multiplyScalar(.5).toArray()); parts.push(g);
  }
  return combine(parts);
}
// Small separate lobes preserve gaps below a branching canopy instead of an
// invisible, oversized ball surrounding the whole tree.
export const treeCanopyLobes = Object.fromEntries(Object.entries(profiles).map(([kind,lobes])=>[kind,lobes.map(([x,y,z,r,aspect])=>[x,y,z,r*Math.min(1,aspect)])]));
