import test from 'node:test';
import assert from 'node:assert/strict';
import { Network } from '../web/net/client.js';

function fixture(t) {
  const names=['WebSocket','location','sessionStorage','localStorage'];
  const old=Object.fromEntries(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const session=new Map(),local=new Map(),events=[];
  const storage=values=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)});
  class Socket { static OPEN=1;constructor(){this.readyState=1;this.sent=[];}send(raw){this.sent.push(JSON.parse(raw));} }
  for(const [name,value] of Object.entries({WebSocket:Socket,location:{protocol:'https:',host:'test.local'},sessionStorage:storage(session),localStorage:storage(local)}))
    Object.defineProperty(globalThis,name,{configurable:true,value});
  const networks=[];
  t.after(()=>{for(const network of networks){clearInterval(network.pingTimer);clearTimeout(network.retry);}for(const name of names){if(old[name])Object.defineProperty(globalThis,name,old[name]);else delete globalThis[name];}});
  const token='a'.repeat(48),room={code:'ABC123',kind:'race',runId:'run-1',players:[]};
  const message=(ws,data)=>ws.onmessage({data:JSON.stringify(data)});
  function network(){const value=new Network(m=>events.push(m));networks.push(value);return value;}
  function welcome(n,extra={}){message(n.ws,{type:'welcome',id:'pilot',token:'profile',resume:token,now:Date.now(),...extra});}
  return {network,welcome,message,session,events,room,token};
}

test('the browser retains its own resume credential across reconnect and reload without stale socket callbacks',t=>{
  const {network,welcome,message,session,room,token}=fixture(t),n=network();n.connect('Pilot');n.ws.onopen();welcome(n);message(n.ws,{type:'room',room});
  const old=n.ws;n.seq=27;old.readyState=0;old.onclose();assert.equal(n.resumption.code,room.code);assert.equal(n.ready,false);
  n.connect('Pilot');n.ws.onopen();assert.equal(n.ws.sent[0].resume,token);assert.equal(n.ws.sent[0].protocol,5);
  welcome(n,{resumed:true});message(n.ws,{type:'room',room});assert.equal(n.seq,0);
  message(old,{type:'left'});assert.equal(n.room.code,room.code,'the superseded socket cannot erase the resumed room');
  n.state({p:[0,0,0],v:[0,0,0],q:{x:0,y:0,z:0,w:1}},{configHash:'config'},'acro',false,{});
  assert.equal(n.ws.sent.at(-1).runId,room.runId);
  assert.equal(network().resumption.token,token,'a reload in the same tab can restore the room');
  n.send('leave');message(n.ws,{type:'left'});assert.equal(session.size,0);assert.equal(network().resumption,null);
});

test('cancelling recovery leaves the reserved room after handshake without reopening it over a local flight',t=>{
  const {network,welcome,message,events,room,session}=fixture(t),n=network();n.connect('Pilot');welcome(n);message(n.ws,{type:'room',room});
  n.ws.readyState=0;n.ws.onclose();n.cancelRecovery();n.connect('Pilot');n.ws.onopen();welcome(n,{resumed:true});
  assert.equal(n.ws.sent.some(m=>m.type==='leave'),true);message(n.ws,{type:'room',room});assert.equal(n.room,null);
  message(n.ws,{type:'left'});assert.equal(events.at(-1).type,'resumeCancelled');assert.equal(session.size,0);
});

test('state serialization carries the four actual rotor speeds beside independent blade damage',t=>{
  const {network,welcome,message,room}=fixture(t),n=network();n.connect('Pilot');welcome(n);message(n.ws,{type:'room',room});
  const speeds=[0,.25,.5,1],blades=[[3,3,3],[1,0,0],[0,0,0],[0,0,0]];
  n.state({p:[0,0,0],v:[0,0,0],q:{x:0,y:0,z:0,w:1}},{configHash:'config'},'acro',false,{},{propellers:blades,rotorSpeeds:speeds,turtleMode:false});
  const sent=n.ws.sent.at(-1);assert.deepEqual(sent.rotorSpeeds,speeds);assert.deepEqual(sent.propellers,blades);assert.equal(sent.runId,room.runId);
});

test('an explicit leave interrupted by disconnect stays a leave, and rejected recovery clears its credential',t=>{
  const {network,welcome,message,events,room,session}=fixture(t),n=network();n.connect('Pilot');welcome(n);message(n.ws,{type:'room',room});
  n.send('leave');n.ws.readyState=0;n.ws.onclose();n.connect('Pilot');n.ws.onopen();welcome(n,{resumed:true});
  assert.equal(n.ws.sent.some(m=>m.type==='leave'),true);message(n.ws,{type:'left'});assert.equal(events.at(-1).type,'left');assert.equal(session.size,0);
  message(n.ws,{type:'room',room});n.ws.readyState=0;n.ws.onclose();n.connect('Pilot');welcome(n,{id:'new-pilot',resumeRejected:true});
  assert.equal(n.resumption,null);assert.equal(session.size,0);
});


test('the generic state envelope carries airplane animation without synthetic quad data',t=>{
  const {network,welcome,message,room}=fixture(t),n=network();n.connect('Pilot');welcome(n);message(n.ws,{type:'room',room});
  const animation={kind:'fixedWing',engine:.6,surfaces:{pitch:-.2,roll:.3,yaw:0}};
  n.state({p:[0,60,0],v:[0,0,-15],q:{x:0,y:0,z:0,w:1}},{configHash:'trainer'},'manual',false,{},{animation});
  const sent=n.ws.sent.at(-1);assert.deepEqual(sent.animation,animation);assert.equal(sent.mode,'manual');assert.equal(sent.configHash,'trainer');
  for(const key of ['propellers','rotorSpeeds','turtleMode'])assert.equal(key in sent,false);
});
