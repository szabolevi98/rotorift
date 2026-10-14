import test from 'node:test';
import assert from 'node:assert/strict';
import {GpuTimer,summarizeFrames,FrameDiagnostics} from '../web/game/frame-diagnostics.js';
test('slow display intervals attach to preceding frame work, and pause gaps are excluded',()=>{
  const state={open:true,timer:{poll(){}},previousAt:null,previousSample:null};
  const first=FrameDiagnostics.prototype.begin.call(state,0);first.cpuMs=28;
  const second=FrameDiagnostics.prototype.begin.call(state,33);second.cpuMs=2;
  assert.equal(first.frameMs,33);assert.equal(second.frameMs,null);
  assert.equal(summarizeFrames([first,second]).worst.cpuMs,28);
  FrameDiagnostics.prototype.idle.call(state);
  FrameDiagnostics.prototype.begin.call(state,1000);
  assert.equal(second.frameMs,null,'pause must not become a 967 ms hitch');
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
