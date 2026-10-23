import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import {roomInvite,parseRoomInvite} from '../web/room-invite.js';
import {exportSettings,parseSettings,importSettings} from '../web/settings-transfer.js';
import {FlightRecorder,ReplayPlayer,parseFlightRecording,RECORDING_MS} from '../web/game/flight-recording.js';
import {FollowCamera} from '../web/game/follow-camera.js';
import {loadCatalog} from '../server/catalog.js';
import {DronePhysics} from '../shared/physics/drone.js';
import {DEFAULT_SIMULATION,simulationKey} from '../shared/simulation/options.js';
import {aircraftSimulation} from '../shared/aircraft/capabilities.js';
import {defaultProfile} from '../web/input/radio-profiles.js';

const storage=entries=>{
 const map=new Map(Object.entries(entries));return {get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
};
test('room links contain only a validated room code and optional spectator role',()=>{
 const link=roomInvite('https://fpv.levente.net/?other=secret#old','ABC123');
 assert.equal(link,'https://fpv.levente.net/?room=ABC123');
 assert.deepEqual(parseRoomInvite(link),{code:'ABC123',spectator:false});
 assert.deepEqual(parseRoomInvite(roomInvite(link,'ABC123',true)),{code:'ABC123',spectator:true});
 assert.equal(parseRoomInvite('https://fpv.levente.net/?room=invalid'),null);
 assert.throws(()=>roomInvite(link,'javascript:alert(1)'));
});
test('settings round-trip keeps calibration and preferences but excludes identities and rejects malformed files',()=>{
 const source=storage({'rotorift.profile':'"secret"','rotorift.nickname':'"Private name"','rotorift.records':'{}','rotorift.camera':'{"sound":true,"volume":0.6}',
  'rotorift.keys':'{"arm":"Space"}','rotorift.auto-arm':'true','rotorift.radio.v2.raw.device':JSON.stringify(defaultProfile())});
 const backup=exportSettings(source);assert.equal(JSON.stringify(backup).includes('secret'),false);
 assert.equal(Object.hasOwn(backup.preferences,'records'),false);
 const preferences=parseSettings(JSON.stringify(backup)),target=storage({});importSettings(target,preferences);
 assert.deepEqual(JSON.parse(target.getItem('rotorift.radio.v2.raw.device')),defaultProfile());
 assert.equal(target.getItem('rotorift.profile'),null);
 for(const p of [{profile:'token'},{keys:{arm:{}}},{rates:{'rift-x5':{}}},{camera:null},{'auto-arm':1},{simulation:{unknown:true}}])
  assert.throws(()=>parseSettings(JSON.stringify({format:'rotorift-settings',version:1,preferences:p})));
 assert.throws(()=>parseSettings('{"format":"rotorift-settings","version":1,"preferences":{"camera":{"__proto__":{}}}}'));
});
test('failed settings writes restore previous values rather than applying half a profile',()=>{
 const target=storage({'rotorift.keys':'{"arm":"Space"}'}),write=target.setItem;
 target.setItem=(k,v)=>{if(k==='rotorift.camera')throw Error('Quota');write(k,v);};
 assert.throws(()=>importSettings(target,{keys:{arm:'KeyX'},camera:{sound:false}}));
 assert.equal(target.getItem('rotorift.keys'),'{"arm":"Space"}');
});

const pose=x=>({p:[x,10,0],v:[10,0,0],q:{x:0,y:0,z:0,w:1}});
const visual={rotorSpeeds:[.2,.3,.4,.5],propellers:Array.from({length:4},()=>[0,0,0]),turtleMode:false};
const metadata={aircraftId:'rift-x5',aircraftKind:'quadrotor',configHash:'config',mapId:'liget',routeId:'',mode:'acro',simulation:DEFAULT_SIMULATION,trafficSeed:123};
const sample=(recorder,x,segment=0)=>recorder.sample(.05,pose(x),visual,{angle:20,fov:100},x,true,segment);
test('bounded flight recordings round-trip, interpolate, pause, seek, change speed and preserve resets',()=>{
 const recorder=new FlightRecorder(metadata);sample(recorder,0);sample(recorder,10);sample(recorder,1000,1);
 const recording=parseFlightRecording(JSON.stringify(recorder.snapshot())),player=new ReplayPlayer();player.load(recording);
 player.seek(25);assert.equal(player.frame().p[0],5);
 player.seek(75);assert.equal(player.frame().p[0],10,'do not interpolate a teleport through scenery');
 player.seek(100);assert.equal(player.frame().p[0],1000);
 player.seek(0);player.speed=.5;player.tick(.05);assert.equal(player.time,25);
 player.playing=false;player.tick(.1);assert.equal(player.time,25);
 player.playing=true;player.tick(.25);assert.equal(player.time,player.duration);assert.equal(player.playing,false);
 const broken=structuredClone(recording);broken.frames[1].q.w=0;assert.throws(()=>parseFlightRecording(JSON.stringify(broken)));
 for(let i=0;i<7000;i++)sample(recorder,i);
 const bounded=parseFlightRecording(JSON.stringify(recorder.snapshot()));assert.equal(bounded.frames[0].t,0);assert.ok(bounded.frames.at(-1).t<=RECORDING_MS);assert.ok(bounded.frames.length<=6002);
});
test('spectator camera uses aircraft-local offsets even when the remote mesh is far from the origin',async()=>{
 const {drones}=await loadCatalog(),config=drones.find(c=>c.id==='rift-x5');
 const camera=new THREE.PerspectiveCamera(),follow=new FollowCamera(camera),model=new THREE.Group();
 model.position.set(500,25,-300);model.userData.fpvCameraOffset=[0,.02,-.1];
 follow.update(config,model,pose(0),'chase',.016);assert.ok(camera.position.distanceTo(model.position)<3);
 follow.update(config,model,pose(0),'fpv-clean',.016,{angle:30,fov:115});assert.equal(camera.fov,115);assert.equal(model.visible,false);
 follow.update(config,model,pose(0),'chase',.016);assert.equal(model.visible,true);
});
test('Air Mode off removes zero-throttle motor authority, on preserves it; record keys stay compatible',async()=>{
 await RAPIER.init();const {drones,airplanes}=await loadCatalog(),config=drones.find(c=>c.id==='rift-x5');
 assert.equal(simulationKey(DEFAULT_SIMULATION),'00010');assert.equal(simulationKey({airmode:false}),'00014');
 assert.equal(aircraftSimulation(airplanes[0],{airmode:false}).airmode,true);
 for(const airmode of [false,true]){
  const world=new RAPIER.World({x:0,y:-9.81,z:0}),drone=new DronePhysics(RAPIER,world,config,[0,100,0],{simulation:{airmode}});
  try{drone.armed=true;for(let i=0;i<120;i++)drone.step({throttle:0,roll:1,pitch:0,yaw:0});
   if(airmode){assert.ok(drone.motorThrust.some(v=>v>.1));assert.ok(Math.hypot(...drone.pose.w)>1);}
   else{assert.ok(drone.motorThrust.every(v=>v===0));assert.ok(Math.hypot(...drone.pose.w)<.001);}
  }finally{drone.dispose();world.free();}
 }
});
