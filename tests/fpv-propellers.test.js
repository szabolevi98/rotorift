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
test('fast FPV rotors use a transparent exposure disc while stopped and external rotors retain real blades',()=>{
  const {exposure,entries}=fixture();
  exposure.update('fpv',[1,1,1,1]);assert.ok(exposure.rotors.every(r=>r.disc.visible));
  assert.ok(entries.every(e=>!e.mesh.visible&&!e.mesh.castShadow));
  assert.ok(exposure.rotors.every(r=>r.disc.material.opacity<=.12&&!r.disc.material.depthWrite));
  exposure.update('chase',[1,1,1,1]);assert.ok(entries.every(e=>e.mesh.visible&&e.mesh.castShadow));
  assert.ok(exposure.rotors.every(r=>!r.disc.visible));
  exposure.update('fpv',[0,1,1,1]);assert.equal(exposure.rotors[0].disc.visible,false);
  assert.ok(entries.filter(e=>e.motor===0).every(e=>e.mesh.visible));
  exposure.dispose();
});
test('exposure preserves individual broken blades, rotor losses and restores geometry when disposed',()=>{
  const {exposure,entries,model}=fixture();
  entries[0].state=3;for(const e of entries.filter(e=>e.motor===1))e.state=3;
  exposure.update('fpv',[1,1,1,1]);assert.equal(exposure.rotors[1].disc.visible,false);
  assert.ok(Math.abs(exposure.rotors[0].disc.material.opacity-.08)<1e-9);
  exposure.update('fpv-clean',[1,1,1,1]);assert.equal(entries[0].mesh.visible,false);assert.equal(entries[1].mesh.visible,true);
  let geometryFreed=false;exposure.geometry.addEventListener('dispose',()=>geometryFreed=true);
  exposure.dispose();assert.equal(geometryFreed,true);
  let discs=0;model.traverse(o=>{if(o.name==='FPV_rotor_exposure')discs++;});assert.equal(discs,0);
});
