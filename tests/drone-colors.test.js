import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { DRONE_COLORS, validDroneColor, normalizeDroneColor, tagDroneColorMaterials, applyDroneColor } from "../shared/visual/drone-colors.js";
import { isolateModelMaterials, disposeModelMaterials } from "../web/game/models.js";
import { DroneTrail, TRAIL_CAPACITY, TRAIL_LIFETIME } from "../web/game/drone-trail.js";
import { colorBatteryLabel } from "../shared/visual/battery-labels.js";

test("accepted drone assets tint their shared TPU/frame materials without recoloring wiring, optics or connectors", async () => {
  for (const id of ["x5","65","75","c3","x35"]) {
    const buffer=await readFile(new URL(`../web/assets/models/rotorift-rift-${id}.glb`,import.meta.url));
    const json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString("utf8"));
    const materials=json.materials.map(m=>new THREE.MeshStandardMaterial({color:new THREE.Color().fromArray(m.pbrMetallicRoughness?.baseColorFactor??[1,1,1])}));
    const root=new THREE.Group(),geometry=new THREE.BoxGeometry();
    const nodes=json.nodes.map(n=>{
      const primitive=n.mesh===undefined?null:json.meshes[n.mesh].primitives[0];
      const object=primitive?new THREE.Mesh(geometry,materials[primitive.material]):new THREE.Group();object.name=n.name??"";return object;
    });
    for(const [index,n]of json.nodes.entries())for(const child of n.children??[])nodes[index].add(nodes[child]);
    for(const object of nodes)if(!object.parent)root.add(object);
    tagDroneColorMaterials(root);
    assert.equal(materials.filter(m=>m.userData.droneColorRole==="base").length,1,id+" has one shared color material");
    assert.equal(materials.filter(m=>m.userData.droneColorRole==="detail").length,["65","75","x35"].includes(id)?0:1);
    assert.equal(materials.filter(m=>m.userData.droneColorRole==="label").length,["65","75"].includes(id)?1:2,"battery print only, excluding camera labels");
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
        if (source.userData.droneColorRole === "base") {
          assert.equal(m.toneMapped, false, "GLB clones retain the showroom polymer finish");
          const shader = {fragmentShader: "#include <opaque_fragment>"};
          m.onBeforeCompile(shader);
          assert.match(shader.fragmentShader, /outgoingLight \*= 0\.7;/);
          assert.equal(m.customProgramCacheKey(), "rotorift-polymer-0.7");
        } else assert.equal(m.toneMapped, source.toneMapped, "other surfaces keep their original tone mapping");
        if(source.userData.droneColorRole && source.userData.droneColorRole!=="label") {
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

test("battery label ink changes without modifying print, shared source images or another pilot's texture", () => {
  const oldDocument=globalThis.document;
  globalThis.document={createElement:()=>{
    const canvas={width:0,height:0,pixels:null};let source;
    canvas.getContext=()=>({drawImage:image=>source=image,
      getImageData:()=>({data:new Uint8ClampedArray(source.pixels)}),putImageData:image=>canvas.pixels=new Uint8ClampedArray(image.data)});
    return canvas;
  }};
  try {
    const pixels=new Uint8ClampedArray([255,102,72,255,23,38,42,255,233,234,227,255,120,142,132,255]);
    const texture=new THREE.Texture({width:4,height:1,pixels});texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;
    const source=new THREE.MeshStandardMaterial({map:texture}),a=source.clone(),b=source.clone();
    colorBatteryLabel(a,DRONE_COLORS.teal);colorBatteryLabel(b,DRONE_COLORS.violet);
    assert.deepEqual([...a.map.image.pixels.slice(0,4)],[62,147,140,255]);
    assert.deepEqual([...b.map.image.pixels.slice(0,4)],[133,115,168,255]);
    assert.deepEqual(a.map.image.pixels.slice(4),pixels.slice(4),"dark print and neutral backgrounds survive");
    assert.deepEqual(texture.image.pixels,pixels,"cached source stays orange");
    assert.notEqual(a.map.source,b.map.source);assert.notEqual(a.map.source,texture.source);
    assert.equal(a.map.flipY,false);assert.equal(a.map.colorSpace,THREE.SRGBColorSpace);
    const teal=a.map;
    colorBatteryLabel(a,DRONE_COLORS.blue);colorBatteryLabel(a,DRONE_COLORS.teal);
    assert.equal(a.map,teal,"repeated selections reuse the bounded palette cache");
    assert.deepEqual([...b.map.image.pixels.slice(0,4)],[133,115,168,255],"another pilot stays violet");
  } finally {
    if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
  }
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
