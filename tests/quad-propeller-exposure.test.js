import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCatalog} from '../server/catalog.js';
import {createRacingModel} from '../shared/visual/racing-model.js';
import {createAircraftVisual} from '../web/game/aircraft-visual.js';
import {freshPropellers} from '../shared/physics/propellers.js';
const {drones}=await loadCatalog(),config=drones.find(c=>c.id==='rift-r5');
function setup(remote=false){
  const model=createRacingModel(),visual=createAircraftVisual(model,config,{remote});
  const physics={armed:true,turtleMode:false,motorThrust:Array(4).fill(config.motor.maxThrustN*.25),
    effects:{propellers:{blades:freshPropellers(),phase:[0,0,0,0]}}};
  return {model,visual,physics,dispose(){visual.dispose();const geometry=new Set(),materials=new Set();
    model.traverse(o=>{if(o.geometry)geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);});
    for(const g of geometry)g.dispose();for(const m of materials)m.dispose();}};
}
test('local hover blends only the blades in chase, retains FPV exposure, then restores intact stopped blades',()=>{
  const f=setup();
  try{
    const original=new Map();f.model.traverse(o=>{if(o.material)original.set(o,o.material);});
    f.visual.update(1/60,f.physics,{throttle:.5});f.visual.prepareView('chase',f.physics);
    assert.ok(f.visual.exposure.rotors.every(r=>r.disc.visible));
    assert.ok(f.visual.damage.entries.every(e=>!e.mesh.visible));
    const blades=new Set(f.visual.damage.entries.map(e=>e.mesh));
    for(const [object,material]of original)if(!blades.has(object))assert.equal(object.material,material,'motor hubs, guards and body retain their own materials');
    f.visual.prepareView('fpv',f.physics);
    assert.ok(f.visual.damage.entries.every(e=>!e.mesh.visible));
    f.physics.armed=false;f.visual.update(1/60,f.physics,{throttle:0});f.visual.prepareView('chase',f.physics);
    assert.ok(f.visual.exposure.rotors.every(r=>!r.disc.visible));
    assert.ok(f.visual.damage.entries.every(e=>e.mesh.visible&&e.mesh.material.opacity===1&&e.mesh.material.depthWrite));
  }finally{f.dispose();}
});
test('remote and replay rotors expose independent speeds and preserve broken and shortened props through stop/reset',()=>{
  const f=setup(true),blades=freshPropellers();blades[1].fill(3);blades[2].fill(2);
  const player={connected:true,resetId:1,rotorSpeeds:[.5,.5,.5,0],propellers:blades};
  try{
    f.visual.updateRemote(1/60,player);
    const disc=motor=>f.visual.exposure.rotors.find(r=>r.motor===motor).disc;
    assert.equal(disc(0).visible,true);assert.equal(disc(1).visible,false);assert.equal(disc(2).scale.x,.6);assert.equal(disc(3).visible,false);
    // A paused replay keeps the photographed exposure without advancing phase.
    const phase=[...f.visual.motion.phase];f.visual.updateRemote(0,player);f.visual.prepareView('chase',{armed:true});
    assert.deepEqual(f.visual.motion.phase,phase);assert.equal(disc(0).visible,true);
    f.visual.updateRemote(1/60,{...player,connected:false});
    assert.ok(f.visual.exposure.rotors.every(r=>!r.disc.visible));
    assert.ok(f.visual.damage.entries.filter(e=>e.motor===1).every(e=>!e.mesh.visible));
    f.visual.updateRemote(1/60,player);f.visual.reset(f.physics);
    assert.ok(f.visual.exposure.rotors.every(r=>!r.disc.visible));
    assert.ok(f.visual.damage.entries.every(e=>e.mesh.visible));
    assert.deepEqual(f.visual.networkState(f.physics,false).rotorSpeeds,[0,0,0,0]);
  }finally{f.dispose();}
});
test('turtle reverse powers only the selected exposed rotors and leaves the other pair still',()=>{
  const f=setup();
  try{
    f.physics.turtleMode=true;f.physics.motorThrust=[-.25,0,-.25,0].map(v=>v*config.motor.maxThrustN);
    f.visual.update(1/60,f.physics,{throttle:0});
    assert.deepEqual(f.visual.motion.fraction,[.5,0,.5,0]);
    for(const rotor of f.visual.exposure.rotors)assert.equal(rotor.disc.visible,[0,2].includes(rotor.motor));
    for(const i of [0,2])assert.equal(Math.sign(f.visual.motion.speed[i]),-config.motors[i].direction);
  }finally{f.dispose();}
});
