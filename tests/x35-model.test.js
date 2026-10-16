import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';import * as THREE from 'three';
import {DRONE_SURFACES,configureDronePolymer} from '../shared/visual/drone-rendering.js';
const config=JSON.parse(await readFile(new URL('../data/drones/rift-x35.json',import.meta.url),'utf8'));
const context=vm.createContext({THREE,DRONE_SURFACES,configureDronePolymer,applyBatteryLabelColor(){},document:{createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})}});
vm.runInContext(await readFile(new URL('../showcase/freestyle35.js',import.meta.url),'utf8'),context);
function model(cameraMount){const m=vm.runInContext(cameraMount?`createRiftX35({cameraMount:'${cameraMount}'})`:'createRiftX35()',context);m.root.scale.setScalar(1);m.root.updateMatrixWorld(true);return m;}
test('X35 is a compact 4S aircraft with no action camera, flat arms and independently exportable tri-blade rotors',()=>{
  const m=model();assert.equal(m.actionParts.length,0);assert.equal(m.propellers.length,4);assert.equal(m.batteryParts.length,1);
  assert.ok(m.root.getObjectByName('FPV_open_corner_bumper'),'the chosen third camera mount is the default');
  assert.equal(m.root.getObjectByName('FPV_contoured_lens_surround'),undefined);
  assert.ok(m.triangles<40000,'the new compact aircraft must stay lightweight');
  for(let i=0;i<4;i++){
    const prop=m.propellers[i].group,expected=config.motors[i].positionM;
    assert.ok(Math.abs(prop.position.x/1000-expected[0])<1e-8);assert.ok(Math.abs(prop.position.z/1000-expected[2])<1e-8);
    assert.ok(Math.abs(prop.position.y/1000+config.visualOffsetM[1]-expected[1])<1e-8);
    const blades=[];prop.traverse(o=>{if(/^Twisted_.*blade/.test(o.name))blades.push(o);});assert.equal(blades.length,3);
    const positions=blades[0].geometry.attributes.position;let radius=0;
    for(let n=0;n<positions.count;n++)radius=Math.max(radius,Math.hypot(positions.getX(n),positions.getZ(n)));
    assert.ok(Math.abs(radius-config.propDiameterM*500)<.1);
  }
  const arms=m.root.getObjectByName('X35_01_Carbon_frame').children.filter(o=>o.name==='X35_conventional_carbon_arm');assert.equal(arms.length,4);
  for(const arm of arms)assert.ok(Math.abs(new THREE.Box3().setFromObject(arm).getSize(new THREE.Vector3()).y-4)<1e-6);
});
test('X35 motor leads clear the carbon and PCB, while the rear ELRS dipole stays below all propellers',()=>{
  const m=model(),frame=m.root.getObjectByName('X35_01_Carbon_frame'),pcb=m.root.getObjectByName('X35_35A_AIO_PCB'),ray=new THREE.Raycaster(),wires=[];
  m.root.traverse(o=>{if(o.name==='Motor_phase_wire')wires.push(o);});assert.equal(wires.length,12);
  for(const wire of wires){const points=wire.geometry.parameters.path.getPoints(120),r=wire.geometry.parameters.radius;
    for(const offset of [[0,0,0],[r,0,0],[-r,0,0],[0,r,0],[0,-r,0],[0,0,r],[0,0,-r]])for(let i=1;i<points.length;i++){
      const a=points[i-1].clone().add(new THREE.Vector3(...offset)),b=points[i].clone().add(new THREE.Vector3(...offset)),d=b.sub(a);ray.set(a,d.clone().normalize());ray.far=d.length();
      assert.equal(ray.intersectObjects([...frame.children,pcb],true).length,0,'phase wire must not cross carbon or PCB');
    }
  }
  const dipole=new THREE.Box3().setFromObject(m.root.getObjectByName('ELRS_T_dipole'));
  assert.ok(dipole.max.y<12,'the receiver antenna must clear the swept rotor surfaces');
});
test('X35 lens surround and camera mount leave the forward optical axis clear',()=>{
  const m=model(),lens=m.root.getObjectByName('FPV_coated_lens');
  const direction=new THREE.Vector3(0,-1,0).applyQuaternion(lens.getWorldQuaternion(new THREE.Quaternion()));
  const start=lens.getWorldPosition(new THREE.Vector3()).addScaledVector(direction,.4);
  const ray=new THREE.Raycaster(start,direction,0,100);
  assert.equal(ray.intersectObject(m.root,true).length,0,'the mount cannot obstruct the FPV camera');
});
test('X35 arm and motor seat expose only one carbon surface at the former flickering overlap',()=>{
  const m=model(),carbon=m.root.getObjectByName('X35_01_Carbon_frame').children.filter(o=>o.material===m.materials.carbon),ray=new THREE.Raycaster();
  for(const prop of m.propellers){
    const x=prop.group.position.x,z=prop.group.position.z;
    ray.set(new THREE.Vector3(x-Math.sign(x)*4,1,z-Math.sign(z)*5),new THREE.Vector3(0,-1,0));ray.far=1.01;
    assert.equal(new Set(ray.intersectObjects(carbon).map(hit=>hit.object)).size,1,'motor seat and arm cannot have competing top faces');
  }
});
test('X35 mount alternatives leave the optical axis and carbon nose bay clear',()=>{
  for(const variant of ['original','cheeks','visor','cage']){
    const m=model(variant),lens=m.root.getObjectByName('FPV_coated_lens');
    const direction=new THREE.Vector3(0,-1,0).applyQuaternion(lens.getWorldQuaternion(new THREE.Quaternion()));
    const ray=new THREE.Raycaster(lens.getWorldPosition(new THREE.Vector3()).addScaledVector(direction,.4),direction,0,100);
    assert.equal(ray.intersectObject(m.root,true).length,0,variant+' optical axis');
    for(const x of [-7,0,7])for(const z of [-49,-42,-33]){
      ray.set(new THREE.Vector3(x,40,z),new THREE.Vector3(0,-1,0));ray.far=30;
      assert.equal(ray.intersectObject(m.root.getObjectByName('X35_slotted_top_plate')).length,0,variant+' open camera bay');
    }
    assert.ok(m.triangles<40000);
    if(variant==='cheeks')assert.equal(m.root.getObjectByName('FPV_contoured_lens_surround'),undefined);
    if(variant==='visor')assert.ok(m.root.getObjectByName('FPV_short_upper_visor'));
    if(variant==='cage')assert.ok(m.root.getObjectByName('FPV_open_corner_bumper'));
  }
});
test('X35 omni antenna clears the XT30 and keeps a black body with small color accents',()=>{
  const m=model(),antenna=new THREE.Box3().setFromObject(m.root.getObjectByName('VTX_straight_antenna_stem'));
  for(const name of ['XT30_ESC_half','XT30_battery_half','XT30_retention_collar','JST_XH_4S_balance_plug'])assert.equal(antenna.intersectsBox(new THREE.Box3().setFromObject(m.root.getObjectByName(name))),false,name);
  for(const name of ['Radome_color_accent','Radome_top_mark'])assert.equal(m.root.getObjectByName(name).material,m.materials.tpu);
  m.setColor('#3e938c');
  assert.equal(m.root.getObjectByName('Radome_color_accent').material.color.getHexString(),'3e938c');
  assert.equal(m.root.getObjectByName('Compact_omni_radome').material,m.materials.black);
  assert.ok(m.root.getObjectByName('VTX_antenna_rear_shelf'));
});

test('X35 underside motor leads sit in twelve silver solder fillets touching their pads',()=>{
  const m=model(),electronics=m.root.getObjectByName('X35_04_Electronics');
  const pads=electronics.children.filter(o=>o.name==='Motor_phase_pad');
  const fillets=electronics.children.filter(o=>o.name==='Motor_phase_solder_fillet');
  const wires=electronics.children.filter(o=>o.name==='Motor_phase_wire');
  const pcb=new THREE.Box3().setFromObject(m.root.getObjectByName('X35_35A_AIO_PCB'));
  assert.equal(fillets.length,12);
  for(const wire of wires){
    const end=wire.geometry.parameters.path.getPoint(0);
    const fillet=fillets.find(o=>Math.hypot(o.position.x-end.x,o.position.z-end.z)<.01);
    const pad=pads.find(o=>Math.hypot(o.position.x-end.x,o.position.z-end.z)<.01);
    const bounds=new THREE.Box3().setFromObject(fillet);
    assert.ok(bounds.containsPoint(end));assert.ok(bounds.intersectsBox(new THREE.Box3().setFromObject(pad)));
    assert.ok(bounds.max.y<pcb.min.y,'silver joint remains exposed underneath the board');
    assert.equal(fillet.material,m.materials.silver);
  }
});

test('X35 pack leads enter the XT30 axially through a broad continuous bend',()=>{
  const m=model();
  const wires=[];m.root.traverse(o=>{if(o.name==='Battery_power_lead')wires.push(o);});
  assert.equal(wires.length,2);
  const connector=new THREE.Box3().setFromObject(m.root.getObjectByName('XT30_battery_half'));
  for(const wire of wires){
    const path=wire.geometry.parameters.path;
    assert.ok(connector.clone().expandByScalar(.3).containsPoint(path.getPoint(1)),'lead ends inside connector entry');
    assert.ok(path.getTangent(1).dot(new THREE.Vector3(0,0,-1))>.999,'straight final entry');
    for(let i=1;i<path.curves.length;i++)assert.ok(path.curves[i-1].getTangent(1).dot(path.curves[i].getTangent(0))>.99999,'no corner at the joined curves');
    const points=path.curves.slice(1).flatMap((curve,i)=>curve.getPoints(80).slice(i?1:0));
    let minRadius=Infinity;
    for(let i=1;i<points.length-1;i++){
      const u=points[i].clone().sub(points[i-1]),v=points[i+1].clone().sub(points[i]),chord=points[i+1].distanceTo(points[i-1]);
      const area=u.clone().cross(v).length();
      if(area>1e-9)minRadius=Math.min(minRadius,u.length()*v.length()*chord/(2*area));
    }
    assert.ok(minRadius>2.5,'no tight kink at the connector');
  }
});

test('X35 camera power, ground and video end inside solder fillets on exposed FC pads',()=>{
  const m=model(),pcb=new THREE.Box3().setFromObject(m.root.getObjectByName('X35_35A_AIO_PCB'));
  for(const name of ['5V','GND','VIDEO']){
    const pad=new THREE.Box3().setFromObject(m.root.getObjectByName('Camera_'+name+'_solder_pad'));
    const fillet=new THREE.Box3().setFromObject(m.root.getObjectByName('Camera_'+name+'_solder_fillet'));
    const core=m.root.getObjectByName('FPV_camera_'+name+'_exposed_core');
    assert.ok(Math.abs(pad.min.y-pcb.max.y)<1e-5,'pad must sit on the PCB surface');
    assert.ok(pad.min.x>pcb.min.x&&pad.max.x<pcb.max.x&&pad.min.z>pcb.min.z&&pad.max.z<pcb.max.z);
    assert.ok(pad.intersectsBox(fillet),'solder must touch the gold pad');
    assert.ok(fillet.containsPoint(core.localToWorld(core.geometry.parameters.path.getPoint(1))),'conductor must terminate inside the solder');
    const insulation=m.root.getObjectByName('FPV_camera_'+name+'_wire');
    assert.ok(insulation.geometry.parameters.path.getPoint(1).distanceTo(core.geometry.parameters.path.getPoint(0))<1e-6);
    const ray=new THREE.Raycaster();
    for(const wire of [insulation,core]){
      const points=wire.geometry.parameters.path.getPoints(60);
      for(let i=1;i<points.length;i++){
        const delta=points[i].clone().sub(points[i-1]);ray.set(points[i-1],delta.clone().normalize());ray.far=delta.length();
        assert.equal(ray.intersectObject(m.root.getObjectByName('X35_35A_AIO_PCB')).length,0,'camera wiring cannot pass through the board');
      }
    }
  }
});

test('X35 rounded 3.5-inch paddles clear the frame throughout their full swept volume',()=>{
  const m=model(),parts=[];
  for(const a of m.assemblies)if(!a.group.name.startsWith('Propeller_'))a.group.traverse(o=>{if(o.isMesh)parts.push(o);});
  for(const {group:prop}of m.propellers){
    const blade=prop.getObjectByName('Twisted_X35_blade_0'),p=blade.geometry.attributes.position;
    let low=Infinity,high=-Infinity,maxChord=0;
    for(let row=0;row<23;row++){
      const points=Array.from({length:8},(_,j)=>new THREE.Vector3().fromBufferAttribute(p,row*8+j));
      for(const point of points){low=Math.min(low,point.y+prop.position.y);high=Math.max(high,point.y+prop.position.y);}
      maxChord=Math.max(maxChord,points[0].distanceTo(points[4]));
    }
    assert.ok(maxChord>11&&maxChord<12.1,'a 3520-style paddle must not look like a narrow needle');
    const hub=new THREE.Box3().setFromObject(prop.getObjectByName('Propeller_T_mount_hub'));
    assert.ok(Math.abs(hub.max.y-hub.min.y-4.7)<1e-5,'the T-mount hub has actual thickness');
    for(const part of parts){
      const vertices=part.geometry.attributes.position;
      for(let i=0;i<vertices.count;i++){
        const point=new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(part.matrixWorld);
        if(point.y<low-.3||point.y>high+.3)continue;
        const radius=Math.hypot(point.x-prop.position.x,point.z-prop.position.z);
        if(radius<6)continue; // Own shaft inside the drilled propeller hub.
        assert.ok(radius>44.45+.5,part.name+' intrudes into the rotating blade envelope');
      }
    }
  }
});

test('X35 VTX harness is soldered at both boards and stays above their surfaces',()=>{
  const m=model(),ray=new THREE.Raycaster();
  const boards=['X35_35A_AIO_PCB','VTX_board'].map(name=>m.root.getObjectByName(name));
  for(const name of ['5V','GND','VIDEO','CONTROL']){
    const insulation=m.root.getObjectByName('VTX_'+name+'_wire'),path=insulation.geometry.parameters.path;
    for(const [prefix,t]of [['FC',0],['VTX',1]]){
      const pad=new THREE.Box3().setFromObject(m.root.getObjectByName(prefix+'_VTX_'+name+'_pad'));
      const solder=new THREE.Box3().setFromObject(m.root.getObjectByName(prefix+'_VTX_'+name+'_solder'));
      const core=m.root.getObjectByName(prefix+'_VTX_'+name+'_tinned_end'),corePath=core.geometry.parameters.path;
      assert.ok(pad.intersectsBox(solder),'solder contacts its pad');
      assert.ok(solder.containsPoint(corePath.getPoint(1)),'tinned end is embedded in solder');
      assert.ok(path.getPoint(t).distanceTo(corePath.getPoint(0))<1e-6,'insulation meets conductor');
    }
    const points=path.getPoints(80);
    for(let i=1;i<points.length;i++){
      const delta=points[i].clone().sub(points[i-1]);ray.set(points[i-1],delta.clone().normalize());ray.far=delta.length();
      assert.equal(ray.intersectObjects(boards).length,0,'harness must not cross either PCB');
    }
  }
  const coax=m.root.getObjectByName('VTX_antenna_coax');
  assert.ok(new THREE.Box3().setFromObject(m.root.getObjectByName('VTX_UFL_mated_plug')).containsPoint(coax.geometry.parameters.path.getPoint(0)));
});
