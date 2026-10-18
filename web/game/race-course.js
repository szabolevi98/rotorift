import * as THREE from 'three';
import {gateBasis} from '../../shared/race/gates.js';

const ACTIVE=0xa7ff55,IDLE=0x65ffe2,SELECTED=0xff9b52;
export function gateFrameParts(gate){
  const t=Math.min(.14,gate.width*.045);
  return [[[t,gate.height,t],[-gate.width/2,0,0]],[[t,gate.height,t],[gate.width/2,0,0]],
    [[gate.width,t,t],[0,gate.height/2,0]],[[gate.width,t,t],[0,-gate.height/2,0]]];
}

function roundedGateTube(w,h,r,radius){
  // Sample each quarter-circle independently. Uniform arc-length sampling of
  // the whole frame skipped these small bends on aircraft-sized gates.
  const rings=[],positions=[],normals=[],indices=[],sides=8,steps=8;
  for(const [x,y,start]of [[w-r,-h+r,-Math.PI/2],[w-r,h-r,0],[-w+r,h-r,Math.PI/2],[-w+r,-h+r,Math.PI]])
    for(let i=0;i<=steps;i++){
      const angle=start+i*Math.PI/(2*steps),nx=Math.cos(angle),ny=Math.sin(angle);
      rings.push([x+r*nx,y+r*ny,nx,ny]);
    }
  for(let i=0;i<=rings.length;i++){
    const [x,y,nx,ny]=rings[i%rings.length];
    for(let j=0;j<=sides;j++){
      const angle=j*Math.PI*2/sides,c=Math.cos(angle),s=Math.sin(angle);
      positions.push(x+radius*nx*c,y+radius*ny*c,radius*s);
      normals.push(nx*c,ny*c,s);
      if(i<rings.length&&j<sides){
        const a=i*(sides+1)+j,b=a+sides+1;
        indices.push(a,b,b+1,a,b+1,a+1);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}

export function createNeonGate(gate,index,{selected=false,active=false}={}){
  const group=new THREE.Group();group.name=`Neon_gate_${index+1}`;group.position.set(...gate.p);
  const {right,up}=gateBasis(gate.n);
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...right),new THREE.Vector3(...up),new THREE.Vector3(...gate.n)));
  const w=gate.width/2,h=gate.height/2,r=Math.min(.28,w*.13,h*.13);
  // Keep even the outer glow slimmer than the bend radius on shallow gates.
  const thickness=Math.min(.055,gate.width*.018,r*.24);
  const casing=new THREE.Mesh(roundedGateTube(w,h,r,thickness*1.1),new THREE.MeshBasicMaterial({color:0x25443b}));group.add(casing);
  const core=new THREE.MeshBasicMaterial({color:IDLE,toneMapped:false});
  const glow=new THREE.MeshBasicMaterial({color:IDLE,transparent:true,opacity:.16,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  // A luminous core and translucent sleeve keep the effect lightweight, with
  // normal occlusion; no point lights, bloom pass or through-wall rendering.
  for(const [radius,mat]of [[thickness*.95,core],[thickness*3.6,glow]]){
    const mesh=new THREE.Mesh(roundedGateTube(w,h,r,radius),mat);mesh.position.z=-thickness;group.add(mesh);
    if(mat===core){const back=mesh.clone();back.position.z=thickness;group.add(back);}
  }
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;const c=canvas.getContext('2d');
    c.fillStyle='#101d22';c.fillRect(0,0,128,64);c.fillStyle='#e8fff4';c.font='bold 44px Arial';c.textAlign='center';c.fillText(String(index+1).padStart(2,'0'),64,48);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sign=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true,toneMapped:false}));
    sign.scale.set(Math.min(1.1,gate.width*.3),Math.min(.55,gate.width*.15),1);sign.position.y=h+sign.scale.y*.7;group.add(sign);
  }
  group.userData.setState=(current,chosen=false)=>{const color=chosen?SELECTED:current?ACTIVE:IDLE;core.color.setHex(color);glow.color.setHex(color);glow.opacity=(current||chosen) ? .26 : .12;};
  group.userData.setState(active,selected);return group;
}

export function createRaceGuide(guide=[]){
  const root=new THREE.Group();root.name='Neon_racing_line';const legs=[];
  for(const points of guide){
    const group=new THREE.Group();root.add(group);legs.push(group);
    if(!points||points.length<2)continue;
    for(const [radius,opacity]of [[.035,.85],[.11,.10]]){
      const material=new THREE.MeshBasicMaterial({color:IDLE,toneMapped:false,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});
      group.add(new THREE.Mesh(polylineTube(points,radius),material));
    }
  }
  let last=-2;
  root.userData.highlight=next=>{if(next===last)return;last=next;const active=(next-1+legs.length)%legs.length;
    legs.forEach((leg,i)=>leg.children.forEach((mesh,j)=>{mesh.material.color.setHex(i===active?ACTIVE:IDLE);mesh.material.opacity=i===active?(j===0?.95:.18):(j===0?.22:.035);}));};
  root.userData.highlight(0);return root;
}

function polylineTube(points,radius){
  const positions=[],indices=[],up=new THREE.Vector3(0,1,0);
  for(let i=1;i<points.length;i++){
    const a=new THREE.Vector3(...points[i-1]),b=new THREE.Vector3(...points[i]),delta=b.clone().sub(a),length=delta.length();if(length<.001)continue;
    const segment=new THREE.CylinderGeometry(radius,radius,length,4,1,true);
    segment.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,delta.normalize()));segment.translate(...a.add(b).multiplyScalar(.5).toArray());
    const offset=positions.length/3;positions.push(...segment.attributes.position.array);indices.push(...Array.from(segment.index.array,v=>v+offset));segment.dispose();
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}
