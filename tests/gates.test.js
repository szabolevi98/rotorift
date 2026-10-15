import test from "node:test";
import assert from "node:assert/strict";
import { gateBasis, gateCrossing, newLap, advanceLap } from "../shared/race/gates.js";
const gates = [
  { p: [0, 1, 0], n: [0, 0, 1], width: 2, height: 2 },
  { p: [0, 1, 2], n: [0, 0, -1], width: 2, height: 2 },
];
test("gate crossing is directional, inside the opening and interpolated", () => {
  assert.equal(gateCrossing([0, 1, -1], [0, 1, 3], gates[0]), 0.25);
  assert.equal(gateCrossing([0, 1, 1], [0, 1, -1], gates[0]), null);
  assert.equal(gateCrossing([2, 1, -1], [2, 1, 1], gates[0]), null);
  assert.equal(gateCrossing([0, 3, -1], [0, 3, 1], gates[0]), null);
});
test("horizontal dive gates check both dimensions and reject upward or outside passes",()=>{
  const gate={p:[10,30,20],n:[0,-1,0],width:6,height:4};
  assert.equal(gateCrossing([10,34,20],[10,26,20],gate),.5);
  assert.equal(gateCrossing([10,26,20],[10,34,20],gate),null);
  assert.equal(gateCrossing([13.1,34,20],[13.1,26,20],gate),null);
  assert.equal(gateCrossing([10,34,22.1],[10,26,22.1],gate),null);
  assert.equal(gateCrossing([12,34,21],[12,26,21],gate),.5);
});
test("tilted gate apertures use an orthonormal frame for width and height",()=>{
  const n=[0,-Math.SQRT1_2,Math.SQRT1_2],{right,up}=gateBasis(n),gate={p:[0,10,0],n,width:6,height:2};
  const point=(w,h,d)=>gate.p.map((v,i)=>v+right[i]*w+up[i]*h+n[i]*d);
  assert.ok(Math.abs(right.reduce((s,v,i)=>s+v*up[i],0))<1e-9);
  assert.ok(Math.abs(gateCrossing(point(2,.7,-2),point(2,.7,2),gate)-.5)<1e-9);
  assert.equal(gateCrossing(point(0,1.1,-2),point(0,1.1,2),gate),null);
  assert.equal(gateCrossing(point(3.1,0,-2),point(3.1,0,2),gate),null);
});
function round(lap) {
  advanceLap(lap, [0, 1, -0.5], [0, 1, 0.5], 0, 100, gates);
  advanceLap(lap, [0, 1, 0.5], [0, 1, 3], 100, 200, gates);
  advanceLap(lap, [0, 1, 3], [0, 1, 1], 200, 300, gates);
  advanceLap(lap, [0, 1, 1], [0, 1, -0.5], 300, 400, gates);
  return advanceLap(lap, [0, 1, -0.5], [0, 1, 0.5], 400, 500, gates);
}
test("a lap needs the ordered route and returns a precise time", () => {
  const lap = newLap(),
    events = round(lap);
  assert.equal(lap.completed, 1);
  assert.equal(lap.bestMs, 400);
  assert.equal(events.find((e) => e.kind === "lap").ms, 400);
});
test("interrupted laps and skipped gates cannot produce a record", () => {
  const lap = newLap();
  advanceLap(lap, [0, 1, -0.5], [0, 1, 0.5], 0, 100, gates);
  advanceLap(lap, [0, 1, -0.5], [0, 1, 0.5], 100, 200, gates);
  assert.equal(lap.completed, 0);
  lap.invalid = true;
  advanceLap(lap, [0, 1, 3], [0, 1, 1], 200, 300, gates);
  const events = advanceLap(lap, [0, 1, -0.5], [0, 1, 0.5], 300, 400, gates);
  assert.equal(events.find((e) => e.kind === "lap").valid, false);
  assert.equal(lap.completed, 0);
  assert.equal(lap.invalid, false, "a new start begins a fresh attempt");
});
