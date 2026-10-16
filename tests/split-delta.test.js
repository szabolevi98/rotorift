import test from 'node:test';
import assert from 'node:assert/strict';
import { newLap, advanceLap, clearLapReference } from '../shared/race/gates.js';
import { ghostGateSplits, splitComparison } from '../shared/race/splits.js';
import { SplitDeltaHud, SPLIT_DELTA_VISIBLE_MS } from '../web/game/split-delta.js';

const gates = [
  { p:[0,1,0], n:[0,0,1], width:4, height:3 },
  { p:[0,1,10], n:[0,0,1], width:4, height:3 },
  { p:[0,1,20], n:[0,0,-1], width:4, height:3 },
];
const frame = (ms,z,x=0,y=1) => [ms,x,y,z,0,0,0,1];

test('live splits are substep-accurate and reference one whole best valid lap, not best sectors or the previous lap',()=>{
  const lap=newLap();let at=0,z=-5;
  const move=(next,to)=>{const events=advanceLap(lap,[0,1,z],[0,1,next],at,to,gates);z=next;at=to;return events;};
  move(5,1000);assert.equal(lap.lastSplit,null);
  move(15,2000);assert.equal(lap.lastSplit.ms,1000);assert.equal(lap.lastSplit.referenceMs,null);
  move(25,3000);move(15,4000);assert.equal(lap.lastSplit.ms,3000);
  move(-5,6000);move(5,7000);
  assert.equal(lap.bestMs,6000);assert.deepEqual(lap.bestSplits,[null,1000,3000]);
  assert.equal(lap.lastSplit,null);assert.deepEqual(lap.splits,[null,null,null]);
  move(15,7800);assert.equal(lap.lastSplit.ms,900);assert.equal(lap.lastSplit.referenceMs,1000);
  move(25,8800);move(15,9800);move(-5,12000);move(5,14000);
  assert.equal(lap.lastMs,6500);assert.deepEqual(lap.bestSplits,[null,1000,3000],'faster sectors in a slower lap must not replace the reference');
  move(15,15000);assert.equal(lap.lastSplit.ms,1500);assert.equal(lap.lastSplit.referenceMs,1000);
  lap.invalid=true;move(25,15100);move(15,15200);move(-5,15300);move(5,15400);
  assert.equal(lap.bestMs,6000);assert.deepEqual(lap.bestSplits,[null,1000,3000],'an invalid faster lap cannot become the reference');
  move(15,15500);move(25,15600);move(15,15700);move(-5,15800);move(5,15900);
  assert.equal(lap.bestMs,500);assert.deepEqual(lap.bestSplits,[null,100,300]);
});

test('reset retains the current category best but clears pending splits; changing category clears its reference',()=>{
  const old={...newLap(),bestMs:6000,bestSplits:[null,1000,3000],lastSplit:{index:1},invalid:true};
  const reset=newLap(old);assert.equal(reset.bestMs,6000);assert.deepEqual(reset.bestSplits,old.bestSplits);
  assert.notEqual(reset.bestSplits,old.bestSplits);assert.equal(reset.lastSplit,null);assert.equal(reset.startedAt,null);
  clearLapReference(reset);assert.equal(reset.bestMs,null);assert.equal(reset.bestSplits,null);assert.equal(reset.lastSplit,null);
});

test('ghost split interpolation uses ordered 3D gates, including downward shaft gates',()=>{
  assert.deepEqual(ghostGateSplits([frame(0,0),frame(100,5),frame(300,15),frame(400,25),frame(600,15)],gates),[null,200,500]);
  assert.deepEqual(ghostGateSplits([frame(0,0),frame(300,15)],gates),[null,200,null]);
  assert.deepEqual(ghostGateSplits([frame(0,0,10),frame(300,15,10)],gates),[null,null,null],'outside the aperture is not a checkpoint');
  const dives=[gates[0],{p:[0,30,0],n:[0,-1,0],width:4,height:4},{p:[0,10,0],n:[0,-1,0],width:4,height:4}];
  assert.deepEqual(ghostGateSplits([frame(0,0,0,40),frame(600,0,0,0)],dives),[null,150,450]);
  assert.deepEqual(ghostGateSplits([frame(0,0,0,0),frame(600,0,0,40)],dives),[null,null,null]);
});

test('one replay sample can cross several ordered gates without inventing a split at an earlier out-of-order pass',()=>{
  const forward=[gates[0],gates[1],{...gates[1],p:[0,1,20]}];
  assert.deepEqual(ghostGateSplits([frame(0,0),frame(300,30)],forward),[null,100,200]);
  assert.deepEqual(ghostGateSplits([frame(0,30),frame(300,0),frame(600,30)],forward),[null,400,500]);
});

test('selected own/global ghosts always win over personal best and missing/loading ghost splits never fall back',()=>{
  const split={index:1,ms:1300,referenceMs:1000},labels={bestLabel:'Best lap',ghostLabel:'Top 10 pilot'};
  assert.deepEqual(splitComparison(split,labels),{deltaMs:300,label:'Best lap'});
  assert.deepEqual(splitComparison(split,{...labels,ghostRequested:true,ghostSplits:[null,1500]}),{deltaMs:-200,label:'Top 10 pilot'});
  assert.equal(splitComparison(split,{...labels,ghostRequested:true}),null);
  assert.equal(splitComparison(split,{...labels,ghostRequested:true,ghostSplits:[null,null]}),null);
  assert.equal(splitComparison({...split,referenceMs:null},labels),null,'no personal delta before a valid reference lap');
});

function hudFixture(){
  const classes=new Set(['hidden']),value={},reference={};
  const root={querySelector:s=>s==='[data-delta-value]'?value:reference,setAttribute(){},classList:{
    add:c=>classes.add(c),remove:c=>classes.delete(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c),
  }};
  return {hud:new SplitDeltaHud(root,key=>key),classes,value,reference};
}
const liveLap=()=>({...newLap(),startedAt:100,lastSplit:{index:1,ms:1300,at:1400,startedAt:100,referenceMs:1000}});

test('HUD shows signed seconds and its reference briefly, does not reflash on repeated snapshots, and clears at the next lap',()=>{
  const {hud,classes,value,reference}=hudFixture(),lap=liveLap(),update=(now,changes={})=>hud.update({lap,gates,active:true,now,...changes});
  update(10);assert.equal(value.textContent,'+0.30 s');assert.equal(reference.textContent,'hud.delta.best');assert.ok(classes.has('is-slower'));assert.ok(!classes.has('hidden'));
  update(10+SPLIT_DELTA_VISIBLE_MS);assert.ok(classes.has('hidden'));
  update(9999,{lap:structuredClone(lap)});assert.ok(classes.has('hidden'),'an unchanged server split cannot restart the display timer');
  lap.lastSplit={...lap.lastSplit,index:2,at:2200,ms:2100,referenceMs:2300};update(10000);
  assert.equal(value.textContent,'−0.20 s');assert.ok(classes.has('is-faster'));assert.ok(!classes.has('hidden'));
  lap.startedAt=3000;lap.lastSplit=null;update(10001);assert.ok(classes.has('hidden'));
});

test('HUD uses ghost time and hides invalid, paused, reset, finished or inactive laps without resurfacing stale splits',()=>{
  const {hud,classes,value,reference}=hudFixture(),lap=liveLap();
  const ghost={label:'Selected pilot',replay:{frames:[frame(0,0),frame(3000,20)]}};
  const update=(now,changes={})=>hud.update({lap,gates,active:true,ghostRequested:true,ghost,now,...changes});
  update(0);assert.equal(value.textContent,'−0.20 s');assert.equal(reference.textContent,'Selected pilot');
  update(1,{active:false});assert.ok(classes.has('hidden'));update(2);assert.ok(classes.has('hidden'));
  lap.lastSplit={...lap.lastSplit,at:2300,index:2};update(3,{lap:{...lap,invalid:true}});assert.ok(classes.has('hidden'));
  update(4);assert.ok(classes.has('hidden'),'invalid split cannot reappear after unpausing');
  update(5,{context:'other-route',ghost:null});assert.ok(classes.has('hidden'),'missing selected ghost must not show personal best');
  update(6,{lap:newLap(lap)});assert.ok(classes.has('hidden'));
});
