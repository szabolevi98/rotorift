import test from 'node:test';
import assert from 'node:assert/strict';
import {PauseMenu} from '../web/game/pause-menu.js';

function fixture() {
  const doc={};
  const element=()=>{
    const classes=new Set();
    return {inert:false,textContent:'',disabled:false,children:[],parentNode:null,nextSibling:null,
      classList:{add(...names){names.forEach(n=>classes.add(n));},remove(...names){names.forEach(n=>classes.delete(n));},contains:n=>classes.has(n),toggle(n,on){if(on)classes.add(n);else classes.delete(n);}},
      focus(){doc.activeElement=this;},getClientRects(){return [1];},
      append(child){if(child.parentNode)child.parentNode.children=child.parentNode.children.filter(n=>n!==child);this.children.push(child);child.parentNode=this;},
      insertBefore(child,next){if(child.parentNode)child.parentNode.children=child.parentNode.children.filter(n=>n!==child);const i=this.children.indexOf(next);this.children.splice(i<0?this.children.length:i,0,child);child.parentNode=this;},
    };
  };
  const ids=['pause-menu','settings-panel','pause-settings-slot','pause-resume','pause-reset','pause-back','pause-settings','pause-exit','pause-title','pause-description','pause-note','menu','hud','game-scene'];
  const nodes=Object.fromEntries(ids.map(id=>['#'+id,element()])),home=element(),next=element();
  home.append(nodes['#settings-panel']);home.append(next);nodes['#settings-panel'].nextSibling=next;
  nodes['#pause-menu'].querySelectorAll=()=>[nodes['#pause-resume'],nodes['#pause-reset'],nodes['#pause-settings'],nodes['#pause-exit']];
  doc.querySelector=id=>nodes[id];doc.documentElement=element();
  const events={},calls={resume:0,reset:0,leave:0};let state={online:false,description:'Park · X5',canReset:true};
  const menu=new PauseMenu(key=>key,Object.fromEntries(Object.keys(calls).map(key=>[key,()=>calls[key]++])),()=>state,doc,{addEventListener(name,fn){events[name]=fn;}});
  return {menu,nodes,home,next,doc,events,calls,setState:value=>state=value};
}
const escape=()=>({code:'Escape',preventDefault(){},stopImmediatePropagation(){}});

test('pause dialog blocks the background and Escape resumes even with a focused button',()=>{
  const {menu,nodes,doc,events,calls}=fixture();menu.setOpen(true);
  assert.equal(nodes['#menu'].inert,true);assert.equal(nodes['#hud'].inert,true);
  assert.equal(doc.activeElement,nodes['#pause-resume']);assert.equal(nodes['#pause-description'].textContent,'Park · X5');
  events.keydown(escape());assert.equal(calls.resume,1);
  menu.setOpen(false);assert.equal(nodes['#menu'].inert,false);assert.equal(nodes['#pause-menu'].classList.contains('hidden'),true);
  events.keydown(escape());assert.equal(calls.resume,1,'closed dialogs do not consume game shortcuts');
});
test('settings keep the original controls and bindings, Escape goes back before resuming',()=>{
  const {menu,nodes,home,next,events,calls}=fixture();const settings=nodes['#settings-panel'];settings.savedCalibration={channel:2};
  menu.setOpen(true);nodes['#pause-settings'].onclick();
  assert.equal(settings.parentNode,nodes['#pause-settings-slot']);assert.equal(menu.settingsOpen,true);
  events.keydown(escape());assert.equal(menu.settingsOpen,false);assert.equal(calls.resume,0);
  assert.equal(settings.parentNode,home);assert.deepEqual(home.children,[settings,next]);assert.deepEqual(settings.savedCalibration,{channel:2});
  nodes['#pause-settings'].onclick();menu.setOpen(false);assert.equal(settings.parentNode,home);
});
test('online session context, reset permissions and keyboard focus stay inside the dialog',()=>{
  const {menu,nodes,setState,doc,events,calls}=fixture();setState({online:true,description:'Room ABC123',canReset:false});menu.setOpen(true);
  assert.equal(nodes['#pause-note'].textContent,'pause.online');assert.equal(nodes['#pause-reset'].disabled,true);
  nodes['#pause-exit'].focus();let prevented=false;events.keydown({code:'Tab',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(doc.activeElement,nodes['#pause-resume']);
  nodes['#pause-exit'].onclick();assert.equal(calls.leave,1);
});
