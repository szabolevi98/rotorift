import test from 'node:test';
import assert from 'node:assert/strict';
import {GpuTimer,summarizeFrames,FrameDiagnostics} from '../web/game/frame-diagnostics.js';
import {FrameHistory} from '../web/game/frame-history.js';
test('slow display intervals attach to preceding frame work, and pause gaps are excluded',()=>{
  const state={open:true,timer:{poll(){}},history:new FrameHistory()};
  const first=FrameDiagnostics.prototype.begin.call(state,0);first.cpuMs=28;
  const second=FrameDiagnostics.prototype.begin.call(state,33);second.cpuMs=2;
  assert.equal(first.frameMs,33);assert.equal(second.frameMs,null);
  assert.equal(summarizeFrames([first,second]).worst.cpuMs,28);
  FrameDiagnostics.prototype.idle.call(state);
  FrameDiagnostics.prototype.begin.call(state,1000);
  assert.equal(second.frameMs,null,'pause must not become a 967 ms hitch');
});

test('opening and closing the panel retains a hitch recorded while closed and uses no GPU queries',()=>{
  let polls=0,renders=0,disposed=0;
  const history=new FrameHistory(),state={history,open:false,longTasks:[],
    timer:{poll(){polls++;},dispose(){disposed++;}},
    panel:{classList:{toggle(){}}},toggle:{setAttribute(){}},render(){renders++;}};
  const a=FrameDiagnostics.prototype.begin.call(state,0);history.record(a,83,{map:'liget'});
  const b=FrameDiagnostics.prototype.begin.call(state,120);history.record(b,4,{map:'liget'});
  FrameDiagnostics.prototype.begin.call(state,133);
  assert.equal(polls,0,'closed capture must not query the GPU');
  FrameDiagnostics.prototype.setOpen.call(state,true);
  assert.equal(history.worstSinceReset,a);assert.equal(history.samples().length,2);assert.equal(renders,1);
  FrameDiagnostics.prototype.setOpen.call(state,false);
  assert.equal(history.worstSinceReset.frameMs,120);assert.equal(disposed,1);
});

test('history is bounded, retains an older worst frame and discards idle gaps and incomplete frames',()=>{
  const history=new FrameHistory(8);
  for(const at of [0,200,...Array.from({length:12},(_,i)=>216+i*16)]){
    const sample=history.begin(at);history.record(sample,3,{map:'jatszoter'});
  }
  assert.equal(history.size,8);assert.equal(history.samples().length,7);
  assert.equal(history.worstSinceReset.frameMs,200);
  assert.ok(!history.samples().includes(history.worstSinceReset),'evicted spike remains separately available');
  const pending=history.previousSample;history.idle();
  const resumed=history.begin(20000);history.record(resumed,4,{});
  assert.equal(pending.frameMs,null,'idle must not create a giant interval');
  assert.equal(history.samples().length,0,'only the recent ten seconds, no unfinished sample');
  assert.equal(history.worstSinceReset.frameMs,200);
  history.reset();assert.equal(history.size,0);assert.equal(history.worstSinceReset,null);
});

test('reports show actual capture duration and keep an old spike separate from the current summary',()=>{
  const history=new FrameHistory(4);
  for(const at of [0,200,216,232,248,264,280])history.record(history.begin(at),4,{map:'liget'});
  const report=FrameDiagnostics.prototype.report.call({history,longTasks:[{at:5,durationMs:180},{at:230,durationMs:20},{at:5000,durationMs:100}],
    renderer:{domElement:{width:1920,height:911},getPixelRatio:()=>1}});
  assert.equal(report.version,2);assert.equal(report.summary.worst.frameMs,16);
  assert.equal(report.worstSinceReset.frameMs,200);assert.equal(report.worstSinceReset.map,'liget');
  assert.equal(report.capturedSeconds,.048);assert.equal(report.gpuTimerSupported,null);
  assert.equal(report.summary.gpuMs,null);assert.equal(report.gpuCaptureMode,'panel-open-only');
  assert.deepEqual(report.worstLongTasks,[{at:5,durationMs:180}]);
  assert.deepEqual(report.longTasks,[{at:230,durationMs:20}]);
});
test('frame summary retains spikes and separates CPU and GPU samples without inventing unavailable GPU measurements',()=>{
  const samples=Array.from({length:20},(_,i)=>({frameMs:i===19?32:16,physicsMs:1,cpuMs:4,renderMs:2,steps:4,droppedMs:0}));
  samples[0].gpuMs=3;
  const report=summarizeFrames(samples);
  assert.equal(report.worst,samples[19]);assert.equal(report.p95Ms,16);assert.equal(report.frameMs,16.8);
  assert.equal(report.physicsMs,1);assert.equal(report.cpuMs,4);assert.equal(report.gpuMs,3);
  assert.equal(summarizeFrames([]).gpuMs,null);assert.equal(summarizeFrames([{frameMs:16}]).gpuMs,null);
});
test('GPU timer polls asynchronously, discards disjoint results, and deletes all outstanding queries',()=>{
  let available=false,disjoint=false,reads=0,deleted=0;
  const gl={QUERY_RESULT_AVAILABLE:1,QUERY_RESULT:2,getExtension:()=>({GPU_DISJOINT_EXT:3,TIME_ELAPSED_EXT:4}),
    getParameter:()=>disjoint,isContextLost:()=>false,createQuery:()=>({}),beginQuery(){},endQuery(){},
    getQueryParameter(q,p){if(p===1)return available;reads++;return 2e6;},deleteQuery(){deleted++;}};
  const timer=new GpuTimer(gl),sample={};timer.begin(sample);timer.end();timer.poll();
  assert.equal(reads,0);assert.equal(sample.gpuMs,undefined);
  available=true;timer.poll();assert.equal(sample.gpuMs,2);assert.equal(deleted,1);
  const invalid={};timer.begin(invalid);timer.end();disjoint=true;timer.poll();assert.equal(invalid.gpuMs,undefined);
  disjoint=false;available=false;
  for(let i=0;i<8;i++){timer.begin({});timer.end();}
  assert.equal(timer.pending.length,4);timer.dispose();assert.equal(timer.pending.length,0);assert.equal(deleted,6);
  const unsupported=new GpuTimer({...gl,getExtension:()=>null});unsupported.begin({});unsupported.end();unsupported.poll();assert.equal(unsupported.pending.length,0);
});
