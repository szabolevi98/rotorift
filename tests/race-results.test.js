import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResults } from '../shared/race/results.js';
const pilot=(id,values={})=>({id,name:id,color:'coral',mode:'acro',connected:true,lap:{completed:0,bestMs:null},...values});
test('results rank finishers by total time, retain DNF pilots and do not mutate progress',()=>{
  const players=[pilot('lost',{abandoned:true,lap:{completed:2,bestMs:900}}),pilot('second',{finished:true,finishMs:8000,lap:{completed:3,bestMs:1100}}),pilot('first',{finished:true,finishMs:7000,lap:{completed:3,bestMs:1400}})];
  const before=JSON.stringify(players),rows=buildResults(players,'race',true);
  assert.deepEqual(rows.map(p=>[p.id,p.place,p.status]),[['first',1,'finished'],['second',2,'finished'],['lost',null,'dnf']]);
  assert.equal(JSON.stringify(players),before);
});
test('interim results distinguish a reserved connection and hotlap ranking uses best lap',()=>{
  assert.equal(buildResults([pilot('away',{connected:false})])[0].status,'reconnecting');
  const rows=buildResults([pilot('slow',{finished:true,lap:{completed:5,bestMs:3000}}),pilot('fast',{finished:true,lap:{completed:1,bestMs:2000}})],'hotlap',true);
  assert.deepEqual(rows.map(p=>p.id),['fast','slow']);
});
