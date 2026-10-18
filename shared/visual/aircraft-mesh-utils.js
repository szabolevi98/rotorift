import * as THREE from 'three';

// Small, deterministic mesh tools shared by the original micro airframes.
export function aircraftMeshTools(root) {
  const mesh = (geometry, material, name, parent = root) => {
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    object.castShadow = object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  function loft(rings, material, name, parent = root, caps = true) {
    const n = rings[0].length, indices = [];
    for (let i=0;i<rings.length-1;i++) for(let j=0;j<n;j++) {
      const a=i*n+j,b=i*n+(j+1)%n;
      indices.push(a,b,b+n,a,b+n,a+n);
    }
    if(caps)for(let j=1;j<n-1;j++) {
      indices.push(0,j+1,j);
      const end=(rings.length-1)*n;
      indices.push(end,end+j,end+j+1);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(rings.flat(2),3));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    return mesh(geometry,material,name,parent);
  }
  function rod(a,b,radius,material,name,parent=root,segments=8) {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
    const object=mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),segments),material,name,parent);
    object.position.copy(start).add(end).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    return object;
  }
  function tube(points,radius,material,name,parent=root) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(8,points.length*2),radius,6,false),material,name,parent);
  }
  function box(size,position,material,name,parent=root) {
    const object=mesh(new THREE.BoxGeometry(...size),material,name,parent);
    object.position.set(...position);return object;
  }
  return {mesh,loft,rod,tube,box};
}

// Shape-preserving cubic interpolation: no bulges beyond adjacent sections.
export function sectionSampler(sections) {
  return value => {
    let i=sections.findIndex(row=>row[0]>=value)-1;
    if(value<=sections[0][0])return sections[0].slice(1);
    if(i<0)return sections.at(-1).slice(1);
    const a=sections[i],b=sections[i+1],h=b[0]-a[0],t=(value-a[0])/h;
    const slope=(j,k)=>{
      const prev=sections[Math.max(0,j-1)],cur=sections[j],next=sections[Math.min(sections.length-1,j+1)];
      const d0=j===0?(next[k]-cur[k])/(next[0]-cur[0]):(cur[k]-prev[k])/(cur[0]-prev[0]);
      const d1=j===sections.length-1?d0:(next[k]-cur[k])/(next[0]-cur[0]);
      return d0*d1>0?2*d0*d1/(d0+d1):0;
    };
    return a.slice(1).map((v,k)=>(2*t**3-3*t*t+1)*v+(t**3-2*t*t+t)*h*slope(i,k+1)+(-2*t**3+3*t*t)*b[k+1]+(t**3-t*t)*h*slope(i+1,k+1));
  };
}

export const samples = (a,b,n) => Array.from({length:n+1},(_,i)=>a+(b-a)*i/n);

export function airfoilHeight(chord,u,side=1,thickness=.1) {
  const t=5*thickness*(.2969*Math.sqrt(u)-.126*u-.3516*u*u+.2843*u**3-.1036*u**4);
  return (side*t+.014*Math.sin(Math.PI*u))*chord;
}
export function airfoilContour(chord, leading, thickness=.1, end=1, start=0) {
  const points=[],steps=16;
  const point=(u,side)=>{
    return [airfoilHeight(chord,u,side,thickness),leading+u*chord];
  };
  for(let i=0;i<=steps;i++)points.push(point(start+(end-start)*(1-Math.cos(Math.PI*i/steps))/2,1));
  for(let i=steps;i>=0;i--)points.push(point(start+(end-start)*(1-Math.cos(Math.PI*i/steps))/2,-1));
  return points;
}
