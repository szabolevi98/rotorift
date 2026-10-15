import test from 'node:test';
import assert from 'node:assert/strict';
import { analogSignal, analogResolution, AnalogVideo } from '../web/game/analog-video.js';

test('analog interference is brief, bounded and based on elapsed time rather than frames', () => {
  let active=0, longest=0, run=0;
  for(let i=0;i<18000;i++) {
    const seconds=i/100, state=analogSignal(seconds);
    assert.deepEqual(state,analogSignal(seconds));
    assert.ok(state.burst>=0&&state.burst<=1);
    assert.ok(Math.abs(state.shear)<=.018);
    assert.ok(state.bandY>=.12&&state.bandY<=.88);
    if(state.burst>0){active++;run++;longest=Math.max(longest,run);}else run=0;
  }
  assert.ok(active>200&&active<600,'only a small fraction of receiver time contains a burst');
  assert.ok(longest<=18,'a burst never lasts longer than 180 ms');
  for(const hz of [30,60,120,240]) {
    let time=0;for(let frame=0;frame<10*hz;frame++)time+=1/hz;
    assert.ok(Math.abs(analogSignal(time).burst-analogSignal(10).burst)<1e-8);
  }
  for(const t of [-1,NaN,Infinity])assert.ok(Object.values(analogSignal(t)).every(Number.isFinite));
});

test('reduced motion disables animated interference and noise changes', () => {
  for(let t=0;t<40;t+=.03) {
    const state=analogSignal(t,true);
    assert.equal(state.burst,0);assert.equal(state.shear,0);assert.equal(state.noiseFrame,0);
  }
});

test('analog rendering is capped, preserves aspect ratio and does not upscale small screens', () => {
  assert.deepEqual(analogResolution(3840,2160),[1024,576]);
  assert.deepEqual(analogResolution(1920,1080),[1024,576]);
  assert.deepEqual(analogResolution(844,390),[844,390]);
  assert.deepEqual(analogResolution(0,0),[1,1]);
  for(const [w,h] of [[3440,1440],[390,844],[1366,768]]) {
    const [x,y]=analogResolution(w,h);
    assert.ok(x<=1024&&y<=576);assert.ok(Math.abs(x/y-w/h)<.01);
  }
});

test('analog pass restores renderer state and counts both scene and post pass', () => {
  const calls=[],renderer={
    extensions:{has:()=>true},domElement:{width:1920,height:1080},
    info:{autoReset:true,reset:()=>calls.push('reset')},
    getRenderTarget:()=>null,
    setRenderTarget:target=>calls.push(target?'buffer':'screen'),
    render:()=>calls.push('render'),
  };
  const effect=new AnalogVideo(renderer);
  effect.render({}, {}, 1/60);
  assert.deepEqual(calls,['reset','buffer','render','screen','render','screen']);
  assert.equal(renderer.info.autoReset,true);
  assert.equal(effect.target.width,1024);assert.equal(effect.target.height,576);
  renderer.render=()=>{throw Error('context lost');};
  assert.throws(()=>effect.render({}, {}, 1/60),/context lost/);
  assert.equal(calls.at(-1),'screen');assert.equal(renderer.info.autoReset,true);
  effect.reset();assert.equal(effect.time,0);effect.dispose();
});
