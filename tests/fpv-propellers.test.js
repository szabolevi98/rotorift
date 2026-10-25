import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FpvPropellers} from '../shared/visual/fpv-propellers.js';

function fixture(){
  const model=new THREE.Group(),entries=[];
  for(let motor=0;motor<4;motor++){
    const prop=new THREE.Group();prop.userData={propeller:true,motorIndex:motor};model.add(prop);
    for(let blade=0;blade<3;blade++){
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(.03,.001,.007),new THREE.MeshStandardMaterial({color:'#263e3b'}));mesh.castShadow=true;prop.add(mesh);
      entries.push({mesh,motor,blade,state:0});
    }
  }
  const exposure=new FpvPropellers(model,{propDiameterM:.127,motor:{maxThrustN:10}},{entries});
  return {exposure,entries,model};
}
test('FPV and external rotors use a transparent exposure disc while stopped rotors retain real blades',()=>{
  const {exposure,entries}=fixture();
  exposure.update('fpv',[10,10,10,10]);assert.ok(exposure.rotors.every(r=>r.disc.visible));
  assert.ok(entries.every(e=>!e.mesh.visible&&!e.mesh.castShadow));
  assert.ok(exposure.rotors.every(r=>r.disc.material.opacity<=.16&&!r.disc.material.depthWrite));
  exposure.update('chase',[2.5,2.5,2.5,2.5]);assert.ok(entries.every(e=>!e.mesh.visible&&!e.mesh.castShadow));
  assert.ok(exposure.rotors.every(r=>r.disc.visible));
  exposure.update('fpv',[0,1,1,1]);assert.equal(exposure.rotors[0].disc.visible,false);
  assert.ok(entries.filter(e=>e.motor===0).every(e=>e.mesh.visible));
  exposure.dispose();
});

test('FPV exposure changes continuously with rotor speed and restores stopped materials',()=>{
  const {exposure,entries}=fixture(),blade=entries[0].mesh,opacities=[];
  for(const fraction of [0,.15,.25,.5,.75,1]){
    exposure.update('fpv',[10*fraction*fraction,0,0,0]);
    opacities.push(exposure.rotors[0].disc.material.opacity);
    if(fraction===.25)assert.ok(blade.visible&&blade.material.opacity>0&&blade.material.opacity<1);
  }
  assert.ok(opacities.every((v,i)=>i===0||v>opacities[i-1]));
  exposure.update('chase',[0,0,0,0]);assert.equal(blade.material.opacity,1);assert.equal(blade.material.depthWrite,true);
  exposure.dispose();
});

test('external exposure is progressive, remains subtle at hover and preserves shortened or missing blades',()=>{
  const {exposure,entries}=fixture(),opacities=[];
  for(const speed of [0,.1,.2,.35,.5,1]){
    exposure.update('chase',[],[speed,0,0,0]);opacities.push(exposure.rotors[0].disc.material.opacity);
  }
  assert.ok(opacities.every((v,i)=>!i||v>opacities[i-1]));
  assert.ok(opacities.at(-1)<=.16);
  for(const e of entries.filter(e=>e.motor===0))e.state=2;
  exposure.update('chase',[],[.5,.5,.5,.5]);
  assert.equal(exposure.rotors[0].disc.scale.x,.6);
  assert.ok(exposure.rotors[0].disc.material.opacity<exposure.rotors[1].disc.material.opacity);
  for(const e of entries.filter(e=>e.motor===0))e.state=3;
  exposure.update('chase',[],[.5,.5,.5,.5]);assert.equal(exposure.rotors[0].disc.visible,false);
  exposure.update('chase',[],[0,0,0,0]);
  assert.ok(entries.filter(e=>e.motor===0).every(e=>!e.mesh.visible));
  assert.ok(entries.filter(e=>e.motor===1).every(e=>e.mesh.visible&&e.mesh.material.depthWrite));
  exposure.dispose();
});

test('FPV and chase have exactly the same onset, exposure, shadows and damaged-blade visibility',()=>{
  const {exposure,entries}=fixture();entries[0].state=3;entries[1].state=2;
  const snapshot=()=>({rotors:exposure.rotors.map(r=>[r.disc.visible,r.disc.material.opacity,r.disc.scale.x]),
    blades:entries.map(e=>[e.mesh.visible,e.mesh.castShadow,e.mesh.material.opacity,e.mesh.material.depthWrite])});
  for(const speed of [0,.03,.06,.061,.1,.15,.25,.349,.35,.5,.75,1]){
    exposure.update('chase',[],[speed,speed,.1,0]);const chase=snapshot();
    exposure.update('fpv',[],[speed,speed,.1,0]);assert.deepEqual(snapshot(),chase,`camera-independent at ${speed}`);
  }
  exposure.dispose();
});
test('exposure preserves individual broken blades, rotor losses and restores geometry when disposed',()=>{
  const {exposure,entries,model}=fixture();
  entries[0].state=3;for(const e of entries.filter(e=>e.motor===1))e.state=3;
  exposure.update('fpv',[1,1,1,1]);assert.equal(exposure.rotors[1].disc.visible,false);
  assert.ok(exposure.rotors[0].disc.material.opacity<exposure.rotors[2].disc.material.opacity);
  exposure.update('fpv-clean',[1,1,1,1]);assert.equal(entries[0].mesh.visible,false);assert.equal(entries[1].mesh.visible,true);
  let geometryFreed=false;exposure.geometry.addEventListener('dispose',()=>geometryFreed=true);
  exposure.dispose();assert.equal(geometryFreed,true);
  let discs=0;model.traverse(o=>{if(o.name==='FPV_rotor_exposure')discs++;});assert.equal(discs,0);
});
