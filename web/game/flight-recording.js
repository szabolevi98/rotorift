import {interpolatePose} from '../../shared/race/ghost.js';
import {validRotorSpeeds} from '../../shared/visual/rotor-motion.js';
import {validPropellers} from '../../shared/physics/propellers.js';
import {validAirplaneAnimation} from '../../shared/aircraft/animation.js';
import {validSimulation} from '../../shared/simulation/options.js';
export const RECORDING_MS=5*60*1000,MAX_RECORDING_FRAMES=6002;
const copy=value=>JSON.parse(JSON.stringify(value));
export class FlightRecorder {
  constructor(metadata){this.metadata=copy(metadata);this.frames=[];this.time=0;this.nextAt=0;}
  sample(dt,pose,visual,camera,trafficTime,armed,segment=0){
    this.time+=Math.max(0,Math.min(.1,dt))*1000;
    if(this.time<this.nextAt)return;
    this.nextAt=this.time+50;
    this.frames.push(copy({t:Math.round(this.time),p:pose.p,q:pose.q,v:pose.v,visual,camera,trafficTime:trafficTime??0,armed:!!armed,segment}));
    while(this.frames.length>MAX_RECORDING_FRAMES||this.time-this.frames[0].t>RECORDING_MS)this.frames.shift();
  }
  snapshot(){
    if(this.frames.length<2)return null;
    const start=this.frames[0].t;
    return {format:'rotorift-flight',version:1,...copy(this.metadata),frames:this.frames.map(f=>({...copy(f),t:f.t-start}))};
  }
}
export function parseFlightRecording(text){
  if(typeof text!=='string'||text.length>12000000)throw Error('Invalid recording size');
  const r=JSON.parse(text);
  if(r?.format!=='rotorift-flight'||r.version!==1||!Array.isArray(r.frames)||r.frames.length<2||r.frames.length>MAX_RECORDING_FRAMES)throw Error('Invalid recording');
  if(!/^rift-[a-z0-9]+$/.test(r.aircraftId)||!/^[a-z0-9_-]{1,80}$/.test(r.mapId)||typeof r.configHash!=='string'||r.configHash.length>64)throw Error('Invalid aircraft/map');
  if(!['quadrotor','fixedWing'].includes(r.aircraftKind)||!['acro','angle','horizon','manual','stabilized'].includes(r.mode)||!validSimulation(r.simulation)||typeof r.routeId!=='string'||r.routeId.length>80||!Number.isInteger(r.trafficSeed)||r.trafficSeed<0||r.trafficSeed>0xffffffff)throw Error('Invalid metadata');
  let previous=-1;
  for(const f of r.frames){
    if(!Number.isInteger(f.t)||f.t<=previous||f.t>RECORDING_MS||f.t<0)throw Error('Invalid time');previous=f.t;
    if(![f.p,f.v].every(v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<1e6)))throw Error('Invalid position');
    if(!f.q||!['x','y','z','w'].every(k=>Number.isFinite(f.q[k]))||Math.abs(Math.hypot(f.q.x,f.q.y,f.q.z,f.q.w)-1)>.01)throw Error('Invalid rotation');
    if(typeof f.armed!=='boolean'||!Number.isFinite(f.trafficTime)||Math.abs(f.trafficTime)>1e12)throw Error('Invalid state');
    if(!Number.isSafeInteger(f.segment)||f.segment<0)throw Error('Invalid reset');
    if(!f.camera||!Number.isFinite(f.camera.angle)||f.camera.angle<0||f.camera.angle>60||!Number.isFinite(f.camera.fov)||f.camera.fov<70||f.camera.fov>140)throw Error('Invalid camera');
    if(!f.visual||!(r.aircraftKind==='fixedWing'?validAirplaneAnimation(f.visual.animation):validRotorSpeeds(f.visual.rotorSpeeds)&&validPropellers(f.visual.propellers)))throw Error('Invalid motor state');
  }
  if(r.frames[0].t!==0)throw Error('Invalid start');
  return r;
}
export class ReplayPlayer {
  load(recording){this.recording=recording;this.time=0;this.speed=1;this.playing=true;}
  get duration(){return this.recording?.frames.at(-1).t??0;}
  seek(time){this.time=Math.max(0,Math.min(this.duration,Number(time)||0));}
  tick(dt){if(this.playing){this.seek(this.time+Math.max(0,Math.min(.25,dt))*1000*this.speed);if(this.time===this.duration)this.playing=false;}return this.frame();}
  frame(){
    if(!this.recording)return null;
    const frames=this.recording.frames;
    let lo=0,hi=frames.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(frames[mid].t<=this.time)lo=mid;else hi=mid;}
    const a=frames[lo],b=frames[hi],t=(this.time-a.t)/(b.t-a.t);
    const pose=a.segment===b.segment?interpolatePose(a,b,t):this.time===b.t?b:a;
    const state=this.time===b.t?b:a;
    return {...state,...pose,v:a.v.map((v,i)=>v+(b.v[i]-v)*t),trafficTime:a.trafficTime+(b.trafficTime-a.trafficTime)*t};
  }
}
