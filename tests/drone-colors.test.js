import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { DRONE_COLORS, validDroneColor, normalizeDroneColor, tagDroneColorMaterials, applyDroneColor } from "../shared/visual/drone-colors.js";
import { isolateModelMaterials, disposeModelMaterials } from "../web/game/models.js";
import { DroneTrail, TRAIL_CAPACITY, TRAIL_LIFETIME } from "../web/game/drone-trail.js";

test("accepted drone assets tint their shared TPU/frame materials without recoloring wiring, optics or connectors", async () => {
  for (const id of ["x5","65","c3"]) {
    const buffer=await readFile(new URL(`../web/assets/models/rotorift-rift-${id}.glb`,import.meta.url));
    const json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString("utf8"));
    const materials=json.materials.map(m=>new THREE.MeshStandardMaterial({color:new THREE.Color().fromArray(m.pbrMetallicRoughness?.baseColorFactor??[1,1,1])}));
    const root=new THREE.Group(),geometry=new THREE.BoxGeometry();
    for(const n of json.nodes.filter(n=>n.mesh!==undefined))for(const primitive of json.meshes[n.mesh].primitives) {
      const mesh=new THREE.Mesh(geometry,materials[primitive.material]);mesh.name=n.name??"";root.add(mesh);
    }
    tagDroneColorMaterials(root);
    assert.equal(materials.filter(m=>m.userData.droneColorRole==="base").length,1,id+" has one shared color material");
    assert.equal(materials.filter(m=>m.userData.droneColorRole==="detail").length,id==="65"?0:1);
    const original=materials.map(m=>m.color.toArray()),a=root.clone(),b=root.clone();
    isolateModelMaterials(a);isolateModelMaterials(b);
    applyDroneColor(a,"teal");applyDroneColor(b,"violet");
    assert.deepEqual(materials.map(m=>m.color.toArray()),original,"cached materials remain pristine");
    for(const [model,color]of [[a,"teal"],[b,"violet"]]) {
      const seen=new Set();model.traverse(o=>{if(o.material)seen.add(o.material);});
      for(const [index,source]of materials.entries()) {
        const m=[...seen].find(candidate=>candidate.userData.droneColorRole===source.userData.droneColorRole&&
          (source.userData.droneColorRole||candidate.color.equals(source.color)));
        assert.ok(m);
        if(source.userData.droneColorRole) {
          const expected=new THREE.Color(DRONE_COLORS[color]);if(source.userData.droneColorRole==="detail")expected.multiplyScalar(.55);
          assert.ok(m.color.equals(expected),id+" TPU follows the chosen color");
        } else assert.deepEqual(m.color.toArray(),original[index],"non-TPU material stays unchanged");
      }
      disposeModelMaterials(model);
    }
    geometry.dispose();materials.forEach(m=>m.dispose());
  }
  for(const value of ["#ff0000","__proto__",{},null,2]) {assert.equal(validDroneColor(value),false);assert.equal(normalizeDroneColor(value),"coral");}
});

test("colored trails reuse bounded buffers, fade while hovering, and break on resets, teleports and rendering gaps", () => {
  const scene=new THREE.Scene(),trail=new DroneTrail(scene,"yellow",60);
  const positions=trail.geometry.attributes.position.array,indices=trail.geometry.index.array;
  for(let i=0;i<=300;i++)trail.update([i*.2,2,Math.sin(i*.03)],i/60,1,1920,1080);
  assert.ok(trail.points.length>10&&trail.points.length<=TRAIL_CAPACITY);
  assert.ok(trail.geometry.drawRange.count>0&&trail.geometry.drawRange.count<=(TRAIL_CAPACITY-1)*6);
  assert.equal(trail.geometry.attributes.position.array,positions);assert.equal(trail.geometry.index.array,indices);
  assert.equal(trail.material.uniforms.trailColor.value.getHexString(),"ffd000");
  const end=trail.points.at(-1).p;
  for(let i=301;i<=330;i++)trail.update(end,i/60,1);
  assert.ok(trail.geometry.drawRange.count>0,"stopping must fade the existing path rather than erase it immediately");
  assert.ok(trail.geometry.attributes.fade.getX((trail.points.length-2)*4+2)<.9);
  for(let i=331;i<=(300+(TRAIL_LIFETIME+1)*60);i++)trail.update(end,i/60,1);
  assert.equal(trail.geometry.drawRange.count,0,"expired hover path disappears");
  trail.update([1,2,3],10,2);trail.update([2,2,3],10.04,2);assert.equal(trail.geometry.drawRange.count,6);
  trail.update([2.05,2,3],10.08,3);assert.equal(trail.geometry.drawRange.count,0,"nearby reset still starts a fresh trail");
  trail.update([500,2,3],10.12,3);assert.equal(trail.geometry.drawRange.count,0,"teleport cannot draw a map-wide line");
  trail.update([501,2,3],11,3);assert.equal(trail.geometry.drawRange.count,0,"resuming after a gap does not bridge old positions");
  trail.setColor("teal");assert.equal(trail.material.uniforms.trailColor.value.getHexString(),"3e938c");
  let freed=0;trail.geometry.addEventListener("dispose",()=>freed++);trail.material.addEventListener("dispose",()=>freed++);
  trail.dispose();assert.equal(scene.children.length,0);assert.equal(freed,2);
});
