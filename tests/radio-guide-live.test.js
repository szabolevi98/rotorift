import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {createRadioModel} from '../web/input/radio-model.js';
import {radioInput,defaultProfile} from '../web/input/controller.js';
import {radioGuideTarget,radioStickPositions} from '../web/input/radio-guide-state.js';

// Exercise the production render method with real gimbal geometry, replacing
// only the browser DOM and GPU renderer. No physical USB radio is needed.
const scope=vm.createContext({THREE,createRadioModel,radioInput,radioGuideTarget,radioStickPositions,
  document:{documentElement:{lang:'en'},querySelectorAll:()=>[]},innerHeight:1000});
const source=(await readFile(new URL('../web/input/radio-guide.js',import.meta.url),'utf8'))
  .replace(/^import .*;\r?\n/gm,'').replace('export class RadioGuide','class RadioGuide');
vm.runInContext(source,scope);
const RadioGuide=vm.runInContext('RadioGuide',scope);
const canvasFactory=()=>({getContext:()=>({clearRect(){},fillRect(){},fillText(){},strokeRect(){}})});
function guide(){
  const model=createRadioModel(canvasFactory),g=Object.create(RadioGuide.prototype);
  Object.assign(g,{root:{offsetParent:{},dataset:{}},t:key=>key,caption:{},timer:{},liveLabel:{},buttons:[],axis:'centres',started:0,
    canvas:{clientWidth:600,clientHeight:400,setAttribute(){},getBoundingClientRect:()=>({top:0,bottom:400})},
    renderer:{render(){}},width:600,height:400,scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),
    sticks:model.sticks,rings:model.rings,arrows:model.arrows});
  g.scene.add(model.root);return {g,model};
}
const controller=()=>({pad:{id:'Test USB radio'},raw:[0,0,-1,0],profile:{...defaultProfile(),deadzone:0},setup:null,range:null});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} vs ${expected}`);

test('connected input moves the real 3D gimbal tips, rather than an overlay marker',()=>{
  const {g,model}=guide(),c=controller();g.render(c,0);model.root.updateMatrixWorld(true);
  const tips=model.sticks.map(stick=>stick.children.at(-1));
  const before=tips.map(tip=>tip.getWorldPosition(new THREE.Vector3()));
  c.raw=[-.5,-.75,.6,.8];g.render(c,500);model.root.updateMatrixWorld(true);
  near(g.sticks[0].rotation.x,-.36);near(g.sticks[0].rotation.y,.48);
  near(g.sticks[1].rotation.x,-.45);near(g.sticks[1].rotation.y,-.3);
  for(let i=0;i<2;i++)assert.ok(tips[i].getWorldPosition(new THREE.Vector3()).distanceTo(before[i])>.1);
  assert.equal(model.markers,undefined);
  g.axis='yaw';g.render(c,1500);
  near(g.sticks[0].rotation.y,.48,'instructions cannot override live input');
});

test('inversion and stick-setup feedback mappings drive the same physical gimbals',()=>{
  const {g}=guide(),c=controller();
  c.profile.axes.yaw.invert=true;c.raw=[0,0,1,.5];g.render(c,500);
  near(g.sticks[0].rotation.y,-.3);near(g.sticks[0].rotation.x,-.6);
  c.setup={axis:'roll',feedbackAxes:{roll:{index:4,invert:false,min:-1,max:1,center:0}}};
  c.raw=[0,0,-1,0,-.7];g.render(c,500);
  near(g.sticks[1].rotation.y,-.42);near(g.sticks[0].rotation.x,.6);
});

test('disconnecting returns the sticks to the instructional animation',()=>{
  const {g}=guide(),c=controller();c.raw=[1,-1,1,1];g.render(c,0);
  c.pad=null;g.axis='pitch';g.render(c,500);
  near(g.sticks[0].rotation.y,0);near(g.sticks[0].rotation.x,.6);
  near(g.sticks[1].rotation.y,0);near(g.sticks[1].rotation.x,-.6);
});
