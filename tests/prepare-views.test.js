import test from 'node:test';
import assert from 'node:assert/strict';
import { compileForTarget, prepareFlightViews } from '../web/game/prepare-views.js';

test('parallel shader compilation releases render-target state before its asynchronous wait', async () => {
  const original={},target={};let selected=original,finish;
  const renderer={getRenderTarget:()=>selected,setRenderTarget:v=>selected=v,
    compileAsync:()=>{assert.equal(selected,target);return new Promise(resolve=>finish=resolve);}};
  const pending=compileForTarget(renderer,{}, {},target);
  assert.equal(selected,original);finish();await pending;assert.equal(selected,original);
  renderer.compileAsync=()=>{throw Error('compile failure');};
  await assert.rejects(compileForTarget(renderer,{}, {},target),/compile failure/);
  assert.equal(selected,original);
});

function setup(view='fpv-clean') {
  const renders=[],programs=new Set();let target=null;
  const effect={target:{},screen:{post:true},camera:{},resize(){},reset(){}};
  const flight={view,chase:view==='chase',scene:{},camera:{},
    setView(value){this.view=value;this.chase=value==='chase';},
    parkShadows:{update(){}},
    getAnalogVideo(){this.analogVideo=effect;return effect;},
    render(dt,analog){renders.push({view:this.view,analog,dt});},
    renderer:{getRenderTarget:()=>target,setRenderTarget:v=>target=v,
      async compileAsync(scene){programs.add(scene.post?'post':target?'analog world':'direct world');}},
  };
  return {flight,renders,programs,effect};
}

test('preparation covers hidden aircraft, analog and direct programs without advancing physics or changing the selected view', async () => {
  for(const view of ['chase','fpv','fpv-clean']) {
    const {flight,renders,programs}=setup(view);
    assert.equal(await prepareFlightViews(flight,{analog:true}),true);
    assert.deepEqual([...programs],['direct world','analog world','post']);
    assert.ok(renders.some(r=>r.view==='chase'&&!r.analog));
    assert.ok(renders.some(r=>r.view==='chase'&&r.analog));
    assert.ok(renders.some(r=>r.view==='fpv'&&r.analog));
    assert.ok(renders.every(r=>r.dt===0));assert.equal(flight.view,view);
    assert.deepEqual(renders.at(-1),{view,analog:view!=='chase',dt:0});
  }
});

test('disabled analog has no target allocation; failed preparation restores the view', async () => {
  const {flight,programs}=setup();
  flight.getAnalogVideo=()=>{throw Error('must stay lazy');};
  await prepareFlightViews(flight);
  assert.deepEqual([...programs],['direct world']);
  flight.renderer.compileAsync=()=>Promise.reject(Error('GPU reset'));
  await assert.rejects(prepareFlightViews(flight),/GPU reset/);
  assert.equal(flight.view,'fpv-clean');
});

test('cancelled aircraft load cannot restore or render over a newer scene', async () => {
  const {flight,renders}=setup();let valid=true;
  flight.renderer.compileAsync=async()=>{valid=false;flight.setView('fpv');};
  assert.equal(await prepareFlightViews(flight,{current:()=>valid}),false);
  assert.equal(flight.view,'fpv');assert.equal(renders.length,0);
});

test('shader preparation preserves the stationary pilot point and restores direct rendering',async()=>{
  const {flight,renders}=setup('pilot'),point={x:7,y:21.7,z:-10,clone(){return {...this};}};
  flight.cameraRig={pilotPosition:point};
  const setView=flight.setView;let restored;
  flight.setView=function(view,options){setView.call(this,view);if(view==='pilot')restored=options?.pilotPosition;};
  await prepareFlightViews(flight,{analog:true});
  assert.equal(flight.view,'pilot');assert.equal(restored.x,7);assert.notEqual(restored,point);
  assert.equal(renders.at(-1).analog,false);
});
