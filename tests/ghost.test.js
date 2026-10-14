import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LapGhostRecorder,sanitizeGhost,ghostPose,MAX_GHOST_MS} from '../shared/race/ghost.js';
import {LapGhostPilot} from '../web/game/lap-ghost.js';
import {loadCatalog} from '../server/catalog.js';
const pose=(x,q={x:0,y:0,z:0,w:1})=>({p:[x,1,0],q});
const event=(kind,at,extra={})=>({kind,at,...extra});
test('20 Hz recording starts and finishes at exact gate substep poses and immediately begins the next lap',()=>{
 const recorder=new LapGhostRecorder();recorder.segment(pose(-1),pose(1),0,100,[event('start',50)]);
 const completed=recorder.segment(pose(1),pose(5),100,300,[event('lap',250,{valid:true,ms:200}),event('start',250)]);
 assert.equal(completed.length,1);const replay=completed[0].replay;assert.ok(replay);
 assert.deepEqual(replay.frames.map(f=>f[0]),[0,50,100,150,200]);
 assert.equal(replay.frames[0][1],0);assert.equal(replay.frames.at(-1)[1],4);
 assert.equal(recorder.frames[0][1],4);assert.equal(recorder.startedAt,250);
 assert.equal(ghostPose(replay,125).p[0],2.5);assert.equal(ghostPose(replay,201),null);
});
test('invalid laps and recording overruns never yield a selectable replay',()=>{
 const recorder=new LapGhostRecorder();recorder.begin(0,pose(0));
 const result=recorder.segment(pose(0),pose(2),0,200,[event('lap',200,{valid:false,ms:200})]);
 assert.equal(result[0].replay,null);recorder.sample(MAX_GHOST_MS+1,pose(0));assert.equal(recorder.startedAt,null);
});
test('untrusted ghosts reject strings, duplicate/backward times, out of bounds positions, invalid quaternion and duration',()=>{
 const valid={version:1,sampleRate:20,frames:[[0,0,1,0,0,0,0,1],[100,2,1,0,0,0,0,-1]]};
 assert.ok(sanitizeGhost(valid));assert.ok(Math.abs(ghostPose(valid,50).q.w)===1,'quaternion sign must not flip the model through a long rotation');
 for(const mutate of [v=>v.sampleRate=10,v=>v.frames[0][0]=1,v=>v.frames[1][0]=0,v=>v.frames[1][0]=MAX_GHOST_MS+1,v=>v.frames[1][1]=Infinity,v=>v.frames[1][1]=1e7,v=>v.frames[1][7]=0,v=>v.frames[1][1]='2']){
  const value=structuredClone(valid);mutate(value);assert.equal(sanitizeGhost(value),null);
 }
 const copy=sanitizeGhost(valid);copy.frames[0][1]=99;assert.equal(valid.frames[0][1],0);
});
test('ghost rendering uses no colliders or shadows, hides before/after a lap and near own drone, and leaves source materials/geometry intact',async()=>{
 const {drones}=await loadCatalog(),config=drones.at(-1),scene=new THREE.Scene(),source=new THREE.Group();
 const material=new THREE.MeshStandardMaterial(),geometry=new THREE.BoxGeometry(.1,.02,.1),mesh=new THREE.Mesh(geometry,material);source.add(mesh);
 const replay={version:1,sampleRate:20,frames:[[0,0,1,0,0,0,0,1],[1000,2,1,0,0,0,0,1]]};
 const ghost=new LapGhostPilot(scene,source,config,replay,'Test');ghost.update(null);assert.equal(ghost.model.visible,false);
 ghost.update(500,[10,1,0]);assert.equal(ghost.model.visible,true);assert.equal(ghost.model.quaternion.w,1);
 ghost.update(500,[1,1,0]);assert.equal(ghost.model.visible,false);ghost.update(1001);assert.equal(ghost.model.visible,false);
 assert.equal(mesh.material,material);assert.notEqual(ghost.model.children[0].geometry,geometry);assert.equal(ghost.model.children[0].castShadow,false);
 ghost.dispose();assert.equal(scene.children.length,0);geometry.dispose();material.dispose();
});
test('ghost batches detailed material meshes into one body and four independently rotating propellers',async()=>{
 const {drones}=await loadCatalog(),config=drones.at(-1),source=new THREE.Group(),scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(.01,.01,.01),material=new THREE.MeshBasicMaterial();
 for(let i=0;i<12;i++)source.add(new THREE.Mesh(geometry,material));
 for(const [i,motor]of config.motors.entries()){
  const pivot=new THREE.Group();pivot.position.set(...motor.positionM);pivot.userData={propeller:true,motorIndex:i};source.add(pivot);
  for(let blade=0;blade<3;blade++)pivot.add(new THREE.Mesh(geometry,material));
 }
 const ghost=new LapGhostPilot(scene,source,config,{version:1,sampleRate:20,frames:[[0,0,1,0,0,0,0,1],[1000,2,1,0,0,0,0,1]]},'Batch');
 let meshes=0;ghost.model.traverse(o=>{if(o.isMesh)meshes++;});assert.equal(meshes,5);assert.equal(ghost.props.length,4);
 ghost.update(500);for(const prop of ghost.props)assert.equal(prop.rotation.y,7*config.motors[prop.userData.motorIndex].direction);
 ghost.dispose();assert.equal(source.children[0].geometry,geometry);geometry.dispose();material.dispose();
});
