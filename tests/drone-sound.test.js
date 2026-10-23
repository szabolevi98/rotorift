import test from 'node:test';
import assert from 'node:assert/strict';
import { DroneSound, DRONE_SOUND_PROFILES } from '../web/game/drone-sound.js';
import { loadCatalog } from '../server/catalog.js';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { DronePhysics } from '../shared/physics/drone.js';
import { createAircraftVisual } from '../web/game/aircraft-visual.js';

function context() {
  const nodes = [], events = new Map();
  const param = () => ({value:0, targets:[],setTargetAtTime(value,time,response){assert.ok(Number.isFinite(value));this.targets.push({value,time,response});},cancelScheduledValues(){}});
  const node = () => {
    const value={frequency:param(),gain:param(),Q:param(),detune:param(),pan:param(),connections:[],starts:0,
      connect(other){this.connections.push(other);},disconnect(){this.disconnected=true;},
      start(){this.starts++;},stop(){this.stopped=true;},setPeriodicWave(wave){this.wave=wave;}};
    nodes.push(value);return value;
  };
  return {currentTime:0,sampleRate:44100,state:'running',destination:{},nodes,events,
    win:{addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)},
    createGain:node,createBiquadFilter:node,createOscillator:node,createStereoPanner:node,createBufferSource:node,
    createPeriodicWave:(real,imag)=>({real,imag}),createBuffer:(channels,length)=>({getChannelData:()=>new Float32Array(length)}),
    resume(){this.resumed=true;return Promise.resolve();},close(){this.state='closed';return Promise.resolve();}};
}
const last = param => param.targets.at(-1).value;

test('each current drone has a different acoustic profile; whoops have higher rotor frequencies than the X5',async()=>{
  const {drones,airplanes}=await loadCatalog();
  assert.equal(Object.keys(DRONE_SOUND_PROFILES).length,drones.length+airplanes.length);
  const frequencies=[];
  for(const drone of drones){
    const ctx=context(),sound=new DroneSound(ctx,drone,{win:ctx.win});
    sound.update([.5,.5,.5,.5],{armed:true});
    frequencies.push(last(sound.rotors[0].osc.frequency));
    assert.ok(last(sound.master.gain)>0);
    sound.dispose();
  }
  assert.equal(new Set(frequencies).size,drones.length);
  assert.ok(frequencies.slice(0,5).every((f,i)=>i===0||f<frequencies[i-1]));
});

test('motor-specific demands, stopped motors, disarm, sound off and camera view control the actual audio gains',()=>{
  const ctx=context(),sound=new DroneSound(ctx,{id:'rift-x5'},{win:ctx.win});
  sound.update([.2,.4,.6,.8],{armed:true});
  assert.ok(last(sound.rotors[0].osc.frequency)<last(sound.rotors[3].osc.frequency));
  const levels=sound.rotors.map(rotor=>last(rotor.gain.gain));
  assert.ok(levels.every((v,i)=>i===0||v>levels[i-1]));
  const fpv=last(sound.master.gain);
  sound.update([.2,.4,.6,.8],{armed:true,volume:0});assert.equal(last(sound.master.gain),0);
  sound.update([.2,.4,.6,.8],{armed:true,volume:.35});assert.equal(last(sound.master.gain),fpv/2);
  sound.update([.2,.4,.6,.8],{armed:true,chase:true});assert.ok(last(sound.master.gain)<fpv);
  for(const state of [{armed:false},{armed:true,enabled:false}]){
    sound.update([1,1,1,1],state);assert.equal(last(sound.master.gain),0);
    assert.ok(sound.rotors.every(rotor=>last(rotor.gain.gain)===0));
  }
  sound.update([0,0,0,0],{armed:true});assert.equal(last(sound.master.gain),0);
  sound.update([NaN,Infinity,-1,undefined],{armed:true});assert.equal(last(sound.master.gain),0);
  sound.dispose();
});

test('zero-throttle balanced idle is hidden but airmode corrections drive propellers, sound and multiplayer',async()=>{
  await RAPIER.init();
  const {drones}=await loadCatalog();
  for(const config of drones){
    const world=new RAPIER.World({x:0,y:-9.81,z:0});
    const physics=new DronePhysics(RAPIER,world,config,[0,100,0]);
    const model=new THREE.Group();
    for(let i=0;i<4;i++){
      const prop=new THREE.Group();
      prop.userData={propeller:true,motorIndex:i,phaseOffset:0};model.add(prop);
    }
    const visual=createAircraftVisual(model,config),remote=createAircraftVisual(model.clone(),config,{remote:true});
    const ctx=context(),sound=new DroneSound(ctx,config,{win:ctx.win});
    const input={throttle:0,roll:0,pitch:0,yaw:0};
    try {
      visual.bindPhysics(physics);physics.armed=true;
      for(let i=0;i<60;i++)physics.step(input);
      visual.update(1/60,physics,input);
      assert.deepEqual(visual.motorSpeeds,[0,0,0,0],config.id+': balanced idle stays visually stopped');
      sound.update(visual.motorSpeeds,{armed:true});
      assert.equal(last(sound.master.gain),0);
      const idleLevels=sound.rotors.map(r=>last(r.gain.gain));
      const before=[...visual.motion.phase];
      const steering={...input,roll:1};
      physics.step(steering);visual.update(1/60,physics,steering);
      assert.ok(visual.motion.phase.some((phase,i)=>phase!==before[i]));
      assert.ok(Math.max(...visual.motorSpeeds)-Math.min(...visual.motorSpeeds)>.01);
      assert.ok(Math.max(...visual.motion.speed.map(Math.abs))>4,'correction must be clearly visible');
      sound.update(visual.motorSpeeds,{armed:true});
      assert.ok(sound.rotors.some((r,i)=>last(r.gain.gain)>idleLevels[i]));
      const state=visual.networkState(physics,false);
      remote.updateRemote(1/60,{...state,resetId:1});
      assert.deepEqual(remote.motorSpeeds,visual.motorSpeeds);
      assert.deepEqual(visual.networkState(physics,true).rotorSpeeds,[0,0,0,0]);
      visual.update(1/60,physics,input);
      assert.deepEqual(visual.motorSpeeds,[0,0,0,0],'centred sticks at zero throttle hide idle again');
      physics.armed=false;visual.update(1/60,physics,input);
      sound.update(visual.motorSpeeds,{armed:false});
      assert.deepEqual(visual.motorSpeeds,[0,0,0,0]);assert.equal(last(sound.master.gain),0);
    } finally {visual.dispose();remote.dispose();sound.dispose();world.free();}
  }
});

test('damage and enabled descent propwash change texture without allocating new audio nodes per frame',()=>{
  const ctx=context(),sound=new DroneSound(ctx,{id:'rift-c3'},{win:ctx.win}),count=ctx.nodes.length;
  sound.update([.6,.6,.6,.6],{armed:true,vertical:-6,propwash:false});
  const clean=last(sound.airGain.gain);
  sound.update([.6,.6,.6,.6],{armed:true,vertical:-6,propwash:true});assert.ok(last(sound.airGain.gain)>clean);
  const blades=[[1,0,0],[0,0,0],[0,0,0],[0,0,0]];
  sound.update([.6,.6,.6,.6],{armed:true,blades});assert.equal(sound.rotors[0].rough,true);assert.equal(sound.rotors[1].rough,false);
  assert.notEqual(sound.rotors[0].osc.wave,sound.rotors[1].osc.wave);
  for(let i=0;i<300;i++){ctx.currentTime=i/60;sound.update([.6,.6,.6,.6],{armed:true});}
  assert.equal(ctx.nodes.length,count);assert.ok(sound.rotors.every(rotor=>rotor.osc.starts===1));
  sound.configure({id:'rift-65'});assert.equal(ctx.nodes.length,count);assert.equal(last(sound.master.gain),0);
  ctx.state='suspended';ctx.events.get('pointerdown')();assert.equal(ctx.resumed,true);
  sound.mute();assert.equal(last(sound.master.gain),0);
  sound.dispose();assert.equal(ctx.events.size,0);assert.ok(ctx.nodes.every(node=>node.disconnected));
});

test('two-blade airplane prop damage uses its blade count and changes the motor sound',()=>{
 const ctx=context(),sound=new DroneSound(ctx,{id:'rift-a40'},{win:ctx.win});
 sound.update([.6],{armed:true,blades:[[0,0]]});assert.equal(sound.rotors[0].rough,false);
 const clean=last(sound.rotors[0].gain.gain);
 sound.update([.6],{armed:true,blades:[[2,3]]});assert.equal(sound.rotors[0].rough,true);
 assert.ok(last(sound.rotors[0].gain.gain)<clean);sound.dispose();
});
