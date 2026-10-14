import test from 'node:test';import assert from 'node:assert/strict';
import {GhostSelection,personalGhost,savePersonalGhost,ghostKey} from '../web/game/ghost-selection.js';
const context={map:{id:'map',routeId:'race_1',routeVersion:1},drone:{id:'rift-x5',configHash:'hash'},mode:'acro',simulation:{}};
const replay={version:1,sampleRate:20,frames:[[0,0,1,0,0,0,0,1],[1000,2,1,0,0,0,0,1]]};
const id=i=>i.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
function fixture(t){
 const keys=['localStorage','Option','fetch'],saved=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k)),storage=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}});
 Object.defineProperty(globalThis,'Option',{configurable:true,value:class{constructor(text,value){this.text=text;this.value=value;this.disabled=false;}}});
 t.after(()=>keys.forEach((key,i)=>saved[i]?Object.defineProperty(globalThis,key,saved[i]):delete globalThis[key]));
 const select={options:[],replaceChildren(...values){this.options=values;},append(value){this.options.push(value);}},note={},button={};
 const root={querySelector:s=>s==='select'?select:s==='button'?button:note,classList:{toggle(){}}};
 return {picker:new GhostSelection(root,k=>k,v=>String(v)),select,storage,root};
}
test('own replay persists only faster laps and isolates aircraft/mode/route/rules',t=>{
 const {storage}=fixture(t),key=ghostKey(context);assert.ok(savePersonalGhost(key,1000,replay));
 assert.equal(savePersonalGhost(key,2000,{...replay,frames:[replay.frames[0],[2000,3,1,0,0,0,0,1]]}),false);
 assert.equal(personalGhost(key).ms,1000);
 for(const next of [{...context,mode:'angle'},{...context,map:{...context.map,routeId:'race_2'}},{...context,drone:{...context.drone,id:'rift-c3'}},{...context,simulation:{wind:'strong'}}])assert.equal(personalGhost(ghostKey(next)),null);
 storage.set('rotorift.lap-ghost.'+key,JSON.stringify({ms:900,replay}));assert.equal(personalGhost(key),null,'recorded duration must match the selected time');
});
test('top 10 keeps actual ranking, disables missing legacy recordings, and ignores stale category responses',async t=>{
 const {picker,select}=fixture(t),pending=[];
 globalThis.fetch=()=>new Promise(resolve=>pending.push(resolve));
 const first=picker.refresh(context,true),next={...context,mode:'angle'},second=picker.refresh(next,true);
 pending[1]({ok:true,json:async()=>({available:true,entries:Array.from({length:12},(_,i)=>({ghostId:id(i+1),name:'Pilot '+i,ms:1000+i,hasGhost:i!==1}))})});
 await second;assert.equal(select.options.length,12);assert.equal(select.options[3].disabled,true);assert.equal(select.options.at(-1).value,id(10));
 pending[0]({ok:true,json:async()=>({available:true,entries:[{ghostId:id(99),name:'Stale',ms:1,hasGhost:true}]})});await first;
 assert.equal(select.options.at(-1).value,id(10));assert.equal(picker.context.mode,'angle');
 picker.choose(next,id(3));assert.equal(picker.choice(next),id(3));assert.equal(picker.choice(context),'off');
});
test('global loading checks the returned category and replay; stored own selection survives a new picker',async t=>{
 const {picker,root}=fixture(t);picker.choose(context,id(1));
 globalThis.fetch=async()=>({ok:true,json:async()=>({category:'wrong',replay,name:'Wrong'})});
 await assert.rejects(()=>picker.load(context),/category/);
 globalThis.fetch=async()=>({ok:true,json:async()=>({category:ghostKey(context),replay,name:'Global',ms:1000})});
 assert.equal((await picker.load(context)).label,'Global');
 savePersonalGhost(ghostKey(context),1000,replay);picker.choose(context,'self');assert.equal((await picker.load(context)).label,'ghost.self');
 const restored=new GhostSelection(root,k=>k,v=>String(v));assert.equal(restored.choice(context),'self');assert.equal((await restored.load(context)).ms,1000);
});
