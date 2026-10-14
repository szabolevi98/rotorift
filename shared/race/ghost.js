// Racing's 20 Hz lap-replay approach, adapted to FPV quaternion poses.
export const GHOST_SAMPLE_MS=50;
export const MAX_GHOST_MS=20*60*1000;
export const MAX_GHOST_FRAMES=MAX_GHOST_MS/GHOST_SAMPLE_MS+1;
const round=(n,d)=>Math.round(n*10**d)/10**d;
export function interpolatePose(a,b,t) {
  let qa=[a.q.x,a.q.y,a.q.z,a.q.w],qb=[b.q.x,b.q.y,b.q.z,b.q.w];
  let dot=qa.reduce((sum,v,i)=>sum+v*qb[i],0);
  if(dot<0){qb=qb.map(v=>-v);dot=-dot;}
  let q;
  if(dot>.9995)q=qa.map((v,i)=>v+(qb[i]-v)*t);
  else {const angle=Math.acos(Math.min(1,dot)),s=Math.sin(angle);q=qa.map((v,i)=>(v*Math.sin((1-t)*angle)+qb[i]*Math.sin(t*angle))/s);}
  const norm=Math.hypot(...q);q=q.map(v=>v/norm);
  return {p:a.p.map((v,i)=>v+(b.p[i]-v)*t),q:{x:q[0],y:q[1],z:q[2],w:q[3]}};
}
export function ghostFrame(ms,pose) {
  return [Math.round(ms),...pose.p.map(v=>round(v,3)),...[pose.q.x,pose.q.y,pose.q.z,pose.q.w].map(v=>round(v,4))];
}
export function sanitizeGhost(value) {
  if(!value||value.version!==1||value.sampleRate!==20||!Array.isArray(value.frames)||value.frames.length<2||value.frames.length>MAX_GHOST_FRAMES)return null;
  let last=-1;
  for(const f of value.frames){
    if(!Array.isArray(f)||f.length!==8||!f.every(Number.isFinite)||!Number.isInteger(f[0])||f[0]<=last||f[0]>MAX_GHOST_MS||f[0]<0)return null;
    if(f.slice(1,4).some(v=>Math.abs(v)>1e6)||Math.abs(Math.hypot(...f.slice(4))-1)>.01)return null;
    last=f[0];
  }
  if(value.frames[0][0]!==0)return null;
  return {version:1,sampleRate:20,frames:value.frames.map(f=>[...f])};
}
const framePose=f=>({p:f.slice(1,4),q:{x:f[4],y:f[5],z:f[6],w:f[7]}});
export function ghostPose(replay,ms) {
  const frames=replay.frames;
  if(ms<0||ms>frames.at(-1)[0])return null;
  let lo=0,hi=frames.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(frames[mid][0]<=ms)lo=mid;else hi=mid;}
  return interpolatePose(framePose(frames[lo]),framePose(frames[hi]),(ms-frames[lo][0])/(frames[hi][0]-frames[lo][0]));
}

export class LapGhostRecorder {
  constructor(){this.clear();}
  clear(){this.startedAt=null;this.frames=[];this.nextAt=null;this.lastPose=null;this.lastAt=null;}
  begin(at,pose){this.clear();this.startedAt=at;this.frames=[ghostFrame(0,pose)];this.nextAt=at+GHOST_SAMPLE_MS;this.lastAt=at;this.lastPose=pose;}
  sample(at,pose,force=false) {
    if(this.startedAt===null)return;
    if(at-this.startedAt>MAX_GHOST_MS){this.clear();return;}
    while(this.nextAt<=at){
      const t=at===this.lastAt?1:(this.nextAt-this.lastAt)/(at-this.lastAt);
      this.frames.push(ghostFrame(this.nextAt-this.startedAt,interpolatePose(this.lastPose,pose,t)));
      this.nextAt+=GHOST_SAMPLE_MS;
    }
    if(force){const frame=ghostFrame(at-this.startedAt,pose);if(frame[0]===this.frames.at(-1)[0])this.frames[this.frames.length-1]=frame;else this.frames.push(frame);}
    this.lastAt=at;this.lastPose=pose;
  }
  segment(previous,current,start,end,events) {
    const laps=[];
    for(const e of events){
      const pose=interpolatePose(previous,current,Math.max(0,Math.min(1,(e.at-start)/(end-start))));
      if(e.kind==='lap'){
        this.sample(e.at,pose,true);
        const replay=e.valid?sanitizeGhost({version:1,sampleRate:20,frames:this.frames}):null;
        laps.push({event:e,replay});
      }
      if(e.kind==='start')this.begin(e.at,pose);
    }
    this.sample(end,current);
    return laps;
  }
}
