import * as THREE from "three";
import { constructionHeight } from "../../shared/world/construction-layout.js";

export const CONSTRUCTION_LANDSCAPE_RINGS = [
  { inner: 300, outer: 600, step: 10, edgeStep: 2 },
  { inner: 600, outer: 1200, step: 40, edgeStep: 10 },
  { inner: 1200, outer: 2400, step: 80, edgeStep: 40 },
  { inner: 2400, outer: 4800, step: 160, edgeStep: 80 },
  { inner: 4800, outer: 9600, step: 320, edgeStep: 160 },
  { inner: 9600, outer: 19200, step: 640, edgeStep: 320 },
  { inner: 19200, outer: 38400, step: 1280, edgeStep: 640 },
];

export function makeConstructionLandscape(ring, soilColor) {
  const positions = [], normals = [], colors = [], indices = [];
  const vertices = new Map();
  const vertex = (x,z) => {
    const key=`${x}:${z}`;
    if(vertices.has(key))return vertices.get(key);
    const index = positions.length / 3;
    vertices.set(key,index);
    positions.push(x, constructionHeight(x,z), z);
    const n = new THREE.Vector3((constructionHeight(x-2,z)-constructionHeight(x+2,z))/4,1,
      (constructionHeight(x,z-2)-constructionHeight(x,z+2))/4).normalize();
    normals.push(n.x,n.y,n.z);
    const color=soilColor(x,z), distant=new THREE.Color(0x82705c).lerp(new THREE.Color(0xd1b28a),0.32);
    const fade=Math.max(0,Math.min(1,(Math.max(Math.abs(x),Math.abs(z))-24000)/4000));
    color.lerp(distant,fade);colors.push(color.r,color.g,color.b);
    return index;
  };
  const {inner,outer,step,edgeStep}=ring;
  for(let z=-outer;z<outer;z+=step)for(let x=-outer;x<outer;x+=step) {
    if(x>=-inner&&x<inner&&z>=-inner&&z<inner)continue;
    const corners=[[x,z],[x,z+step],[x+step,z+step],[x+step,z]],polygon=[];
    for(let edge=0;edge<4;edge++) {
      const a=corners[edge],b=corners[(edge+1)%4];
      const onX=a[0]===b[0]&&Math.abs(a[0])===inner&&Math.min(a[1],b[1])>=-inner&&Math.max(a[1],b[1])<=inner;
      const onZ=a[1]===b[1]&&Math.abs(a[1])===inner&&Math.min(a[0],b[0])>=-inner&&Math.max(a[0],b[0])<=inner;
      const count=onX||onZ?step/edgeStep:1;
      for(let i=0;i<count;i++)polygon.push(vertex(a[0]+(b[0]-a[0])*i/count,a[1]+(b[1]-a[1])*i/count));
    }
    const middle=vertex(x+step/2,z+step/2);
    for(let i=0;i<polygon.length;i++)indices.push(middle,polygon[i],polygon[(i+1)%polygon.length]);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute("normal",new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);
  return geometry;
}

export function buildConstructionLandscape(parts, soilColor) {
  for(const ring of CONSTRUCTION_LANDSCAPE_RINGS)
    parts.ground(makeConstructionLandscape(ring,soilColor),"earthTerrain",true,true).name=`bare-landscape-${ring.outer}`;
  // Far beyond the view distance / boundary timer, the rolling landscape
  // becomes flat bare earth. This final apron has no visible outer edge.
  const shape=new THREE.Shape(),extent=500000,inner=38400;
  shape.moveTo(-extent,-extent);shape.lineTo(extent,-extent);shape.lineTo(extent,extent);shape.lineTo(-extent,extent);shape.closePath();
  const hole=new THREE.Path();hole.moveTo(-inner,-inner);hole.lineTo(-inner,inner);hole.lineTo(inner,inner);hole.lineTo(inner,-inner);hole.closePath();shape.holes.push(hole);
  const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);
  const c=new THREE.Color(0x82705c).lerp(new THREE.Color(0xd1b28a),0.32),colors=[];
  for(let i=0;i<geometry.attributes.position.count;i++)colors.push(c.r,c.g,c.b);
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  parts.ground(geometry,"earthTerrain").name="bare-continuous-outside-ground";
}
