// Compact 3.5-inch freestyle aircraft. Built in mm; front is -Z.
function createRiftX35() {
  const root=new THREE.Group();root.name='Rotorift_Rift_X35';root.scale.setScalar(.001);
  root.userData={designer:'Rotorift',model:'Rift X35',units:'meters',propDiameterMm:88.9,motorDiagonalMm:160,battery:'4S 650mAh',actionCamera:false};
  const assemblies=[],propellers=[],batteryParts=[],actionParts=[],materials={};
  const standard=(color,roughness=.55,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  materials.carbon=standard('#292f31',.48,.3);materials.edge=standard('#41494b',.7,.12);
  materials.black=standard('#171e22',.5,.25);materials.rubber=standard('#111719',.94);
  materials.tpu=new THREE.MeshPhysicalMaterial({color:'#ff6648',roughness:.65,specularIntensity:.12,toneMapped:false});configureDronePolymer(materials.tpu);
  materials.tpuDetail=standard('#8c3828',.72);materials.silver=standard('#a4b0b5',.28,.9);materials.gold=standard('#c5a45c',.32,.8);materials.copper=standard('#b67a4e',.3,.8);
  materials.pcb=new THREE.MeshStandardMaterial(DRONE_SURFACES.pcb);materials.glass=new THREE.MeshPhysicalMaterial(DRONE_SURFACES.lens);
  materials.prop=new THREE.MeshPhysicalMaterial({color:'#263e3b',transparent:true,opacity:.9,roughness:.3,clearcoat:.6,depthWrite:false,side:THREE.DoubleSide});
  materials.red=standard('#c74332',.7);materials.white=standard('#deded4',.65);materials.yellow=standard('#efbb26',.7);
  materials.battery=standard('#293439',.58,.16);materials.band=standard('#b59971',.92);
  function mesh(parent,geometry,material,name,x=0,y=0,z=0){const o=new THREE.Mesh(geometry,material);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  const box=(p,w,h,d,m,n,x=0,y=0,z=0)=>mesh(p,new THREE.BoxGeometry(w,h,d),m,n,x,y,z);
  const cyl=(p,r,h,m,n,x=0,y=0,z=0,segments=16)=>mesh(p,new THREE.CylinderGeometry(r,r,h,segments),m,n,x,y,z);
  function shape(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;r=Math.min(r,w/2,h/2);s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);s.closePath();return s;}
  const hole=(x,y,r)=>{const h=new THREE.Path();h.absarc(x,y,r,0,Math.PI*2,true);return h;};
  function geometry(s,d){const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:6});g.translate(0,0,-d/2);return g;}
  function rounded(p,w,h,d,r,m,n,x=0,y=0,z=0){return mesh(p,geometry(shape(w,h,r),d),m,n,x,y,z);}
  function plate(p,s,y,d,n,m=materials.carbon){const g=geometry(s,d);g.rotateX(-Math.PI/2);return mesh(p,g,m,n,0,y,0);}
  function loop(p,w,h,iw,ih,d,m,n,x,y,z){const s=shape(w,h,2);s.holes.push(shape(iw,ih,1.2));return mesh(p,geometry(s,d),m,n,x,y,z);}
  function wire(p,points,r,m,n){const curve=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v)));return mesh(p,new THREE.TubeGeometry(curve,28,r,5,false),m,n);}
  function beam(p,a,b,w,d,m,n){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),o=box(p,w,start.distanceTo(end),d,m,n,...start.clone().add(end).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return o;}
  function screw(p,x,y,z,r=1.5){cyl(p,r,.7,materials.silver,'Socket_head_bolt',x,y,z,12);cyl(p,r*.43,.1,materials.black,'Hex_socket',x,y+.4,z,6);}
  function assembly(name,delta){const group=new THREE.Group();group.name=name;root.add(group);assemblies.push({group,base:group.position.clone(),delta:new THREE.Vector3(...delta)});return group;}
  const frame=assembly('X35_01_Carbon_frame',[0,-12,0]),upper=assembly('X35_02_Upper_deck',[0,18,0]);
  const lowerShape=shape(36,104,7);lowerShape.holes.push(shape(16,22,4));
  for(const x of [-15,15])for(const z of [-34,34])lowerShape.holes.push(hole(x,-z,1.6));
  plate(frame,lowerShape,0,4,'X35_bottom_plate');
  const topShape=shape(38,98,6);
  for(const x of [-15,15])for(const z of [-34,34])topShape.holes.push(hole(x,-z,1.6));
  for(const x of [-15,15]){const slot=shape(3.2,11,1);for(const c of slot.curves)for(const key of ['v0','v1','v2','v3'])if(c[key]){c[key].x+=x;c[key].y-=5;}topShape.holes.push(slot);}
  for(const z of [-37,37]){const slot=shape(12,8,2);for(const c of slot.curves)for(const key of ['v0','v1','v2','v3'])if(c[key])c[key].y-=z;topShape.holes.push(slot);}
  plate(upper,topShape,24,2,'X35_slotted_top_plate');
  for(const x of [-15,15])for(const z of [-34,34]){cyl(frame,2.2,21,materials.black,'Frame_standoff',x,12.5,z,8);screw(frame,x,-2.5,z);screw(upper,x,25.4,z);}
  const motors=[[-56.568,-56.568,1],[56.568,-56.568,-1],[-56.568,56.568,-1],[56.568,56.568,1]];
  const motorSet=assembly('X35_03_Brushless_motors',[0,8,0]),electronic=assembly('X35_04_Electronics',[0,12,0]);
  function bladeGeometry(direction){
    const vertices=[],indices=[],rows=22,sides=8;
    for(let i=0;i<=rows;i++){const t=i/rows,r=6+(44.45-6)*t,a=direction*.23*t*t,chord=(3+5*Math.sin(Math.PI*t))*Math.sqrt(1-t*t)+.3,pitch=direction*(.40-.20*t);
      for(let j=0;j<sides;j++){const theta=j/sides*Math.PI*2,u=Math.cos(theta)*chord*.55,v=Math.sin(theta)*.45;
        vertices.push(r*Math.cos(a)-u*Math.cos(pitch)*Math.sin(a),v+u*Math.sin(pitch),r*Math.sin(a)+u*Math.cos(pitch)*Math.cos(a));}}
    for(let i=0;i<rows;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides);}
    for(let j=1;j<sides-1;j++){indices.push(0,j+1,j);const end=rows*sides;indices.push(end,end+j,end+j+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  const blades=new Map([[1,bladeGeometry(1)],[-1,bladeGeometry(-1)]]);
  for(let index=0;index<4;index++){
    const [x,z,direction]=motors[index],sx=Math.sign(x),sz=Math.sign(z);
    const armStart=new THREE.Vector3(sx*9,-2,sz*9),armEnd=new THREE.Vector3(x,-2,z),armAxis=armEnd.clone().sub(armStart);
    const arm=box(frame,12,4,armAxis.length(),materials.carbon,'X35_conventional_carbon_arm',...armStart.clone().add(armEnd).multiplyScalar(.5).toArray());arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),armAxis.normalize());
    cyl(frame,10,4,materials.carbon,'Motor_mount_pad',x,-2,z,20);
    cyl(motorSet,8.6,1.6,materials.black,'Motor_base',x,.8,z,20);
    cyl(motorSet,7.1,7,materials.black,'Motor_stator',x,5.1,z,18);
    const wallShape=new THREE.Shape();wallShape.absarc(0,0,9.1,0,Math.PI*2,false);wallShape.holes.push(hole(0,0,7.8));
    const wall=plate(motorSet,wallShape,7,9.8,'1404_motor_bell',materials.black);wall.position.x=x;wall.position.z=z;
    for(let turn=0;turn<12;turn++){const a=turn/12*Math.PI*2;cyl(motorSet,1.1,2.8,materials.copper,'Motor_copper_winding',x+Math.cos(a)*6.9,10.6,z+Math.sin(a)*6.9,8);}
    for(let spoke=0;spoke<6;spoke++){const a=spoke/6*Math.PI*2;beam(motorSet,[x,12.3,z],[x+Math.cos(a)*8.5,12.3,z+Math.sin(a)*8.5],1.1,.8,materials.black,'Motor_bell_spoke');}
    cyl(motorSet,3.2,1.2,materials.silver,'Motor_shaft_shoulder',x,12.9,z);cyl(motorSet,1.5,5,materials.silver,'Motor_shaft',x,15,z,12);
    const bumper=new THREE.Shape();bumper.absarc(0,0,10.3,0,Math.PI*2,false);bumper.holes.push(hole(0,0,8.6));
    const guard=plate(frame,bumper,-5.5,3,'X35_motor_TPU_bumper',materials.tpu);guard.position.x=x;guard.position.z=z;
    for(const dx of [-3,3])for(const dz of [-3,3])screw(frame,x+dx,-4.35,z+dz,1.05);
    const prop=new THREE.Group();prop.name='Propeller_'+index;prop.position.set(x,15,z);root.add(prop);assemblies.push({group:prop,base:prop.position.clone(),delta:new THREE.Vector3(0,16,0)});propellers.push({group:prop,direction});
    cyl(prop,3.3,1.7,materials.prop,'Propeller_hub',0,.4,0);cyl(prop,2.6,2,materials.black,'Propeller_locknut',0,2,0,6);
    for(let blade=0;blade<3;blade++){const g=new THREE.Group();g.name='Blade_'+blade;g.rotation.y=blade*2*Math.PI/3;prop.add(g);mesh(g,blades.get(direction),materials.prop,'Twisted_X35_blade_'+blade);}
    for(let lead=0;lead<3;lead++){
      const offset=(lead-1)*1.25,padX=sx*9.3,padZ=sz*(3.5+lead*1.6);
      cyl(electronic,.75,.7,materials.gold,'Motor_phase_pad',padX,9.9,padZ,10);
      wire(electronic,[[padX,9.4,padZ],[sx*13,9.1,padZ],[sx*14,7,sz*13+offset],[sx*25,3,sz*25+offset],[sx*39,2,sz*39+offset],[x-sx*7,2.1,z-sz*7+offset]],.42,materials.rubber,'Motor_phase_wire');
    }
  }
  const boardShape=shape(25,25,2);for(const x of [-10,10])for(const z of [-10,10])boardShape.holes.push(hole(x,z,1.3));plate(electronic,boardShape,10.5,1.2,'X35_35A_AIO_PCB',materials.pcb);
  for(const x of [-10,10])for(const z of [-10,10]){cyl(electronic,1.6,7.8,materials.rubber,'AIO_vibration_grommet',x,6.1,z);screw(electronic,x,11.6,z,1.2);}
  rounded(electronic,7,1.5,7,1,materials.black,'Flight_controller_MCU',0,12.0,-2);
  box(electronic,3,1.2,3,materials.black,'Gyroscope',-5,11.9,4);
  for(const x of [-7,7])for(const z of [-6,-2,2,6])box(electronic,2.8,.9,2.5,materials.black,'ESC_MOSFET',x,11.8,z);
  for(let i=0;i<8;i++)box(electronic,.8,.65,1.2,materials.silver,'SMD_component',-4+i*1.1,11.45,8);
  box(electronic,6,2.8,4,materials.silver,'USB_C_socket',-9,12,0);box(electronic,.2,1.9,3,materials.black,'USB_C_opening',-12.1,12,0);
  rounded(electronic,21,17,1.3,2,materials.pcb,'VTX_board',0,10,29).rotation.x=-Math.PI/2;
  rounded(electronic,15,4,12,1,materials.black,'VTX_heatsink',0,12.8,29);
  for(let i=0;i<6;i++)box(electronic,1,1,11,materials.edge,'VTX_cooling_fin',-5+i*2,15,29);
  rounded(electronic,12,8,1,1,materials.pcb,'ELRS_receiver',0,7,43).rotation.x=-Math.PI/2;
  for(const z of [22,36])for(const x of [-8,8])cyl(electronic,1.3,7.2,materials.rubber,'VTX_mount_spacer',x,5.6,z);
  const tray=rounded(electronic,25,1.5,23,2,materials.tpu,'VTX_bolted_TPU_tray',0,2.8,29);
  for(let i=0;i<4;i++)wire(electronic,[[i-2,11,21],[i-2,14,17],[i-2,13,9]],.25,i===0?materials.red:materials.rubber,'VTX_signal_wire');
  const cameraSet=assembly('X35_05_FPV_camera',[0,0,-16]);
  for(const side of [-1,1]){box(cameraSet,2.5,16,18,materials.tpu,'FPV_camera_side_cheek',side*10.5,12,-40);box(cameraSet,6,4,20,materials.tpu,'Camera_mount_foot',side*11,4,-40);screw(cameraSet,side*12,6.4,-46,1.2);}
  const camera=new THREE.Group();camera.name='X35_tilted_FPV_camera';camera.position.set(0,18,-42);camera.rotation.x=20*Math.PI/180;cameraSet.add(camera);
  rounded(camera,16,15,18,3,materials.black,'FPV_camera_housing');loop(camera,23,21,18.5,17.5,2,materials.tpu,'FPV_TPU_front_frame',0,0,-8);
  cyl(camera,6.4,3,materials.rubber,'FPV_lens_bezel',0,0,-10.5,24).rotation.x=Math.PI/2;
  cyl(camera,4.8,.55,materials.glass,'FPV_coated_lens',0,0,-12.3,32).rotation.x=Math.PI/2;
  cyl(camera,1.0,.1,materials.silver,'FPV_lens_glint',-1.4,1.5,-12.62,12).rotation.x=Math.PI/2;
  for(const side of [-1,1]){const bolt=cyl(cameraSet,2.2,2,materials.silver,'Camera_tilt_pivot',side*12,18,-42,12);bolt.rotation.z=Math.PI/2;}
  wire(cameraSet,[[0,17,-33],[0,13,-25],[0,13,-10]],.65,materials.rubber,'FPV_camera_wire_harness');
  const battery=assembly('X35_06_4S_battery',[0,23,0]);batteryParts.push(battery);
  rounded(battery,28,32,56,3,materials.battery,'4S_650mAh_pack',0,44,4);
  for(const z of [-24.2,32.2])rounded(battery,26,29,1.2,2,materials.black,'Battery_heatshrink_endcap',0,44,z);
  box(battery,28,3,54,materials.rubber,'Battery_anti_slip_pad',0,26.5,4);
  loop(battery,31,39,28.5,37,10,materials.rubber,'Battery_retention_strap',0,41.5,5);
  loop(battery,38,8,32,3,2,materials.black,'Strap_buckle',-1,60.4,5);
  const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=256;const ctx=labelCanvas.getContext('2d');
  ctx.fillStyle='#ed6446';ctx.fillRect(0,0,512,256);ctx.fillStyle='#172025';ctx.font='bold 70px Arial';ctx.fillText('ROTORIFT',24,86);ctx.font='bold 42px Arial';ctx.fillText('4S / 650 mAh',24,159);ctx.font='24px Arial';ctx.fillText('X35 FREESTYLE PACK',24,218);
  const labelTexture=new THREE.CanvasTexture(labelCanvas);labelTexture.colorSpace=THREE.SRGBColorSpace;
  materials.label=new THREE.MeshStandardMaterial({map:labelTexture,roughness:.76});
  mesh(battery,new THREE.PlaneGeometry(26,28),materials.label,'Battery_label_print',14.1,44,4).rotation.y=Math.PI/2;
  mesh(battery,new THREE.PlaneGeometry(26,28),materials.label,'Battery_label_print',-14.1,44,4).rotation.y=-Math.PI/2;
  rounded(battery,12,9,1.2,2,materials.rubber,'Battery_cable_exit_grommet',0,44,33);
  for(const [x,mat] of [[2,materials.rubber],[6,materials.red]])wire(battery,[[x,44,33.5],[x,44,36],[x,44,40],[x-4,42,47],[x-4,36,54],[x-4,36,51.2]],1.05,mat,'Battery_power_lead');
  const rear=assembly('X35_07_Rear_connections',[0,0,16]);
  for(const [center,name] of [[42,'XT30_ESC_half'],[48,'XT30_battery_half']]){
    const keyed=new THREE.Shape();keyed.moveTo(-5,-3);keyed.lineTo(5,-3);keyed.lineTo(5,1.4);keyed.lineTo(3.5,3);keyed.lineTo(-3.5,3);keyed.lineTo(-5,1.4);keyed.closePath();
    for(const x of [-2,2])keyed.holes.push(hole(x,0,1.1));mesh(rear,geometry(keyed,6),materials.yellow,name,0,36,center);
    for(const x of [-2,2])cyl(rear,.8,4,materials.gold,'XT30_contact',x,36,center,12).rotation.x=Math.PI/2;
  }
  loop(rear,14,10,11,7,2,materials.tpu,'XT30_retention_collar',0,36,46);
  for(const x of [-7,7])box(rear,3,10,9,materials.tpu,'XT30_support_leg',x,29,44);
  for(const x of [-2,2]){cyl(electronic,1.2,.8,materials.gold,'AIO_power_solder_pad',x,9.6,11.5);wire(electronic,[[x,8.8,11.5],[x,8.5,16],[x,10,36],[x,23,40],[x,36,38.8]],1.05,x>0?materials.red:materials.rubber,'ESC_power_pigtail');}
  rounded(battery,7,3,5,.6,materials.white,'JST_XH_4S_balance_plug',14,44,39);
  for(let i=0;i<5;i++){box(battery,.45,.7,.3,materials.gold,'Balance_contact',11.6+i*1.2,44,36.35);wire(battery,[[-6+i*1.1,41,33],[-6+i*1.1,40,35],[11.6+i*1.2,42,44],[11.6+i*1.2,44,41.8]],.25,i===4?materials.red:materials.rubber,'Balance_lead');}
  loop(battery,21,9,18.5,6.5,2,materials.band,'Balance_plug_elastic_tether',9,44,39);
  box(rear,20,3,11,materials.tpu,'Rear_lower_mount',0,3.5,53);
  for(const x of [-7,7]){box(rear,3,5,8,materials.tpu,'ELRS_clamp_support',x,7,57);const clamp=loop(rear,5,5,2.3,2.3,3,materials.tpu,'ELRS_dipole_closed_clamp',x,8,60);clamp.rotation.y=Math.PI/2;}
  const dipole=cyl(rear,1,34,materials.rubber,'ELRS_T_dipole',0,8,60,12);dipole.rotation.z=Math.PI/2;
  wire(rear,[[0,7,45],[0,7,52],[0,8,60]],.5,materials.rubber,'ELRS_antenna_coax');
  box(rear,10,3,10,materials.tpu,'VTX_antenna_mount_foot',-9,26.5,44);
  const axis=new THREE.Vector3(0,.92,.39).normalize(),base=new THREE.Vector3(-9,29,46),tip=base.clone().addScaledVector(axis,28);
  wire(rear,[base.toArray(),tip.toArray()],.85,materials.rubber,'VTX_straight_antenna_stem');
  const socket=cyl(rear,2.5,6,materials.tpu,'VTX_antenna_root_socket',...base.toArray());socket.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
  const head=cyl(rear,4,9,materials.black,'Compact_omni_radome',...tip.clone().addScaledVector(axis,4).toArray(),20);head.quaternion.copy(socket.quaternion);
  for(const side of [-1,1])box(rear,.8,5,1,materials.tpu,'Radome_color_accent',-9+side*3.8,tip.y+3,tip.z);
  wire(rear,[[-6,14,36],[-9,23,40],base.toArray()],.6,materials.rubber,'VTX_antenna_coax');
  let meshes=0,triangles=0;const unique=new Set();root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;unique.add(o.material);}});
  return {root,assemblies,propellers,batteryParts,actionParts,materials,meshes,triangles:Math.round(triangles),
    setExplode(value){for(const a of assemblies)a.group.position.copy(a.base).addScaledVector(a.delta,value);},
    setWireframe(value){for(const m of unique)m.wireframe=value;},
    setColor(hex){materials.tpu.color.set(hex);materials.tpuDetail.color.set(hex).multiplyScalar(.55);applyBatteryLabelColor(root,hex);}};
}
