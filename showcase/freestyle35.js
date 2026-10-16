// Compact 3.5-inch freestyle aircraft. Built in mm; front is -Z.
function createRiftX35({cameraMount='cage'}={}) {
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
  materials.battery=standard('#293439',.58,.16);
  function mesh(parent,geometry,material,name,x=0,y=0,z=0){const o=new THREE.Mesh(geometry,material);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  const box=(p,w,h,d,m,n,x=0,y=0,z=0)=>mesh(p,new THREE.BoxGeometry(w,h,d),m,n,x,y,z);
  const cyl=(p,r,h,m,n,x=0,y=0,z=0,segments=16)=>mesh(p,new THREE.CylinderGeometry(r,r,h,segments),m,n,x,y,z);
  function shape(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;r=Math.min(r,w/2,h/2);s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);s.closePath();return s;}
  const hole=(x,y,r)=>{const h=new THREE.Path();h.absarc(x,y,r,0,Math.PI*2,true);return h;};
  function geometry(s,d){const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:6});g.translate(0,0,-d/2);return g;}
  function rounded(p,w,h,d,r,m,n,x=0,y=0,z=0){return mesh(p,geometry(shape(w,h,r),d),m,n,x,y,z);}
  function softened(s,d,b=.35){const g=new THREE.ExtrudeGeometry(s,{depth:d-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,curveSegments:6});g.translate(0,0,-(d-2*b)/2);return g;}
  function softBox(p,w,h,d,r,m,n,x,y,z){return mesh(p,softened(shape(w-.7,h-.7,r),d),m,n,x,y,z);}
  function plate(p,s,y,d,n,m=materials.carbon){const g=geometry(s,d);g.rotateX(-Math.PI/2);return mesh(p,g,m,n,0,y,0);}
  function loop(p,w,h,iw,ih,d,m,n,x,y,z){const s=shape(w,h,2);s.holes.push(shape(iw,ih,1.2));return mesh(p,geometry(s,d),m,n,x,y,z);}
  function wire(p,points,r,m,n,segments=28){const curve=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v)));return mesh(p,new THREE.TubeGeometry(curve,segments,r,5,false),m,n);}
  function beam(p,a,b,w,d,m,n){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),o=box(p,w,start.distanceTo(end),d,m,n,...start.clone().add(end).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return o;}
  function screw(p,x,y,z,r=1.5){cyl(p,r,.7,materials.silver,'Socket_head_bolt',x,y,z,12);cyl(p,r*.43,.1,materials.black,'Hex_socket',x,y+.4,z,6);}
  function assembly(name,delta){const group=new THREE.Group();group.name=name;root.add(group);assemblies.push({group,base:group.position.clone(),delta:new THREE.Vector3(...delta)});return group;}
  const frame=assembly('X35_01_Carbon_frame',[0,-12,0]),upper=assembly('X35_02_Upper_deck',[0,18,0]);
  const lowerShape=shape(36,104,7);lowerShape.holes.push(shape(16,22,4));
  for(const x of [-15,15])for(const z of [-29,29])lowerShape.holes.push(hole(x,-z,1.6));
  plate(frame,lowerShape,0,4,'X35_bottom_plate');
  // An open nose bay leaves room for the tilted camera; the two side rails
  // retain the front standoff bolts without carbon crossing the camera body.
  const topShape=new THREE.Shape();
  topShape.moveTo(-13,49);topShape.lineTo(-13,30);topShape.quadraticCurveTo(-13,28,-11,28);topShape.lineTo(11,28);topShape.quadraticCurveTo(13,28,13,30);topShape.lineTo(13,49);topShape.quadraticCurveTo(19,49,19,43);topShape.lineTo(19,-43);topShape.quadraticCurveTo(19,-49,13,-49);topShape.lineTo(-13,-49);topShape.quadraticCurveTo(-19,-49,-19,-43);topShape.lineTo(-19,43);topShape.quadraticCurveTo(-19,49,-13,49);topShape.closePath();
  for(const x of [-15,15])for(const z of [-29,29])topShape.holes.push(hole(x,-z,1.6));
  for(const x of [-15.8,15.8])for(const z of [-10,20]){const slot=shape(3.2,10,1);for(const c of slot.curves)for(const key of ['v0','v1','v2','v3'])if(c[key]){c[key].x+=x;c[key].y-=z;}topShape.holes.push(slot);}
  for(const z of [37]){const slot=shape(12,8,2);for(const c of slot.curves)for(const key of ['v0','v1','v2','v3'])if(c[key])c[key].y-=z;topShape.holes.push(slot);}
  plate(upper,topShape,24,2,'X35_slotted_top_plate');
  for(const x of [-15,15])for(const z of [-29,29]){cyl(frame,2.2,21,materials.black,'Frame_standoff',x,12.5,z,8);screw(frame,x,-2.5,z);screw(upper,x,25.4,z);}
  const motors=[[-56.568,-56.568,1],[56.568,-56.568,-1],[-56.568,56.568,-1],[56.568,56.568,1]];
  const motorSet=assembly('X35_03_Brushless_motors',[0,8,0]),electronic=assembly('X35_04_Electronics',[0,12,0]);
  function bladeGeometry(direction){
    const vertices=[],indices=[],rows=22,sides=8;
    // Broad 3.5×2-style paddle with a rounded tip, tapered airfoil thickness
    // and decreasing pitch angle along the radius, rather than a needle tip.
    for(let i=0;i<=rows;i++){const t=i/rows,r=4.8+(44.45-4.8)*t,a=direction*.23*t*t;
      const chord=Math.max(.14,(4+7.7*Math.pow(Math.sin(Math.PI*t),.85))*Math.min(1,Math.sqrt((1-t)/.10)));
      const pitch=direction*Math.atan(50.8/(2*Math.PI*Math.max(r,14))),thickness=.65*(1-t)+.13;
      for(let j=0;j<sides;j++){const theta=j/sides*Math.PI*2,u=Math.cos(theta)*chord*.5,v=Math.sin(theta)*thickness+chord*.035*Math.sin(theta)**2;
        vertices.push(r*Math.cos(a)-u*Math.cos(pitch)*Math.sin(a),v+u*Math.sin(pitch),r*Math.sin(a)+u*Math.cos(pitch)*Math.cos(a));}}
    for(let i=0;i<rows;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;indices.push(a,a+sides,b,b,a+sides,b+sides);}
    for(let j=1;j<sides-1;j++){indices.push(0,j,j+1);const end=rows*sides;indices.push(end,end+j+1,end+j);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  const blades=new Map([[1,bladeGeometry(1)],[-1,bladeGeometry(-1)]]);
  for(let index=0;index<4;index++){
    const [x,z,direction]=motors[index],sx=Math.sign(x),sz=Math.sign(z);
    const armStart=new THREE.Vector3(sx*9,-2,sz*9),armEnd=new THREE.Vector3(x,-2,z),armAxis=armEnd.clone().sub(armStart);
    // The arm and its round motor seat are one solid: separate coplanar top
    // faces flicker in the rotating menu preview, even without shadow maps.
    const length=armAxis.length(),padRadius=9.3,joinAngle=Math.acos(6/padRadius),armShape=new THREE.Shape();
    armShape.moveTo(-6,0);armShape.lineTo(6,0);armShape.lineTo(6,length-Math.sqrt(padRadius*padRadius-36));armShape.absarc(0,length,padRadius,-joinAngle,Math.PI+joinAngle,false);armShape.lineTo(-6,0);armShape.closePath();
    const armGeometry=geometry(armShape,4);armGeometry.rotateX(-Math.PI/2);
    const arm=mesh(frame,armGeometry,materials.carbon,'X35_conventional_carbon_arm',...armStart.toArray());arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),armAxis.normalize());
    cyl(motorSet,7.8,1.6,materials.black,'Motor_base',x,.8,z,20);
    cyl(motorSet,7,4,materials.black,'Motor_stator',x,4.4,z,18);
    const wallShape=new THREE.Shape();wallShape.absarc(0,0,8.95,0,Math.PI*2,false);wallShape.holes.push(hole(0,0,7.6));
    const wall=plate(motorSet,wallShape,6.1,8.2,'1404_motor_bell',materials.black);wall.position.x=x;wall.position.z=z;
    for(let turn=0;turn<12;turn++){const a=turn/12*Math.PI*2;cyl(motorSet,.9,3.6,materials.copper,'Motor_copper_winding',x+Math.cos(a)*6.6,6,z+Math.sin(a)*6.6,8);}
    for(let spoke=0;spoke<6;spoke++){const a=spoke/6*Math.PI*2;beam(motorSet,[x,10.4,z],[x+Math.cos(a)*8.3,10.4,z+Math.sin(a)*8.3],1.1,.8,materials.black,'Motor_bell_spoke');}
    cyl(motorSet,2.7,1.2,materials.silver,'Motor_shaft_shoulder',x,11.3,z);cyl(motorSet,1,6.1,materials.silver,'Motor_shaft',x,13.55,z,12);
    const bumper=new THREE.Shape();bumper.absarc(0,0,10.6,0,Math.PI*2,false);bumper.holes.push(hole(0,0,2.1));
    for(const dx of [-3,3])for(const dz of [-3,3])bumper.holes.push(hole(dx,dz,1.65));
    const guardGeometry=softened(bumper,4,.3);guardGeometry.rotateX(-Math.PI/2);
    mesh(frame,guardGeometry,materials.tpu,'X35_motor_TPU_skid_with_bolt_access',x,-6,z);
    // Only the outboard half rises around the carbon; the inboard motor leads stay exposed.
    const rim=new THREE.Shape();rim.absarc(0,0,10.9,-Math.PI/2,Math.PI/2,false);rim.absarc(0,0,9.65,Math.PI/2,-Math.PI/2,true);rim.closePath();
    const rimGeometry=geometry(rim,4.5);rimGeometry.rotateX(-Math.PI/2);
    const lip=mesh(frame,rimGeometry,materials.tpu,'X35_motor_outboard_TPU_wrap',x,-1.75,z);lip.rotation.y=-Math.atan2(z,x);
    for(const dx of [-3,3])for(const dz of [-3,3])screw(frame,x+dx,-4.35,z+dz,1.05);
    const prop=new THREE.Group();prop.name='Propeller_'+index;prop.position.set(x,15,z);root.add(prop);assemblies.push({group:prop,base:prop.position.clone(),delta:new THREE.Vector3(0,16,0)});propellers.push({group:prop,direction});
    const hub=new THREE.Shape();hub.absarc(0,0,5.1,0,Math.PI*2,false);hub.holes.push(hole(0,0,1.05));
    for(const boltX of [-2.5,2.5])hub.holes.push(hole(boltX,0,.85));
    plate(prop,hub,-.75,4.7,'Propeller_T_mount_hub',materials.prop);
    for(const boltX of [-2.5,2.5])screw(prop,boltX,1.95,0,.95);
    for(let blade=0;blade<3;blade++){const g=new THREE.Group();g.name='Blade_'+blade;g.rotation.y=blade*2*Math.PI/3;prop.add(g);mesh(g,blades.get(direction),materials.prop,'Twisted_X35_blade_'+blade);}
    for(let lead=0;lead<3;lead++){
      const offset=(lead-1)*1.25,padX=sx*9.3,padZ=sz*(3.5+lead*1.6);
      cyl(electronic,.75,.7,materials.gold,'Motor_phase_pad',padX,9.9,padZ,10);
      const solder=mesh(electronic,new THREE.SphereGeometry(1,6,3),materials.silver,'Motor_phase_solder_fillet',padX,9.35,padZ);
      solder.scale.set(.85,.42,.85);
      wire(electronic,[[padX,9.4,padZ],[sx*13,9.1,padZ],[sx*14,7,sz*13+offset],[sx*25,3,sz*25+offset],[sx*39,2,sz*39+offset],[x-sx*7,2.1,z-sz*7+offset]],.42,materials.rubber,'Motor_phase_wire',24);
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
  // Four discrete analog VTX leads: regulated power, ground, video and control.
  // Each tinned end lands on its own exposed pad, outside the heatsink/MCU.
  for(const [i,name,mat]of [[0,'5V',materials.red],[1,'GND',materials.rubber],[2,'VIDEO',materials.yellow],[3,'CONTROL',materials.white]]){
    const x=(i-1.5)*2.2;
    for(const [prefix,z,pcbTop]of [['FC',11,11.1],['VTX',21.9,10.65]]){
      box(electronic,1.8,.18,1.8,materials.gold,prefix+'_VTX_'+name+'_pad',x,pcbTop+.09,z);
      const solder=mesh(electronic,new THREE.SphereGeometry(1,8,5),materials.silver,prefix+'_VTX_'+name+'_solder',x,pcbTop+.32,z);
      solder.scale.set(.72,.32,.72);
      const end=prefix==='FC'?[x,12.0,12.2]:[x,11.65,20.9];
      wire(electronic,[end,[x,pcbTop+.6,z],[x,pcbTop+.32,z]],.12,materials.silver,prefix+'_VTX_'+name+'_tinned_end',6);
    }
    wire(electronic,[[x,12,12.2],[x,13.5,14.5],[x,13.5,18.3],[x,11.65,20.9]],.25,mat,'VTX_'+name+'_wire');
  }
  const cameraSet=assembly('X35_05_FPV_camera',[0,0,-16]);
  if(cameraMount==='original')for(const side of [-1,1]){
    const cheek=new THREE.Shape();cheek.moveTo(-11,-14);cheek.lineTo(10,-14);cheek.quadraticCurveTo(12,-14,11,-10);cheek.lineTo(4,3);cheek.quadraticCurveTo(0,9,-5,4);cheek.quadraticCurveTo(-11,-2,-11,-14);
    const opening=new THREE.Path();opening.moveTo(-6,-9);opening.lineTo(5,-9);opening.quadraticCurveTo(6,-9,4,-5);opening.lineTo(1,-3);opening.quadraticCurveTo(-2,-2.5,-4,-4);opening.closePath();cheek.holes.push(opening);cheek.holes.push(hole(0,0,1.4));
    const cheekGeometry=softened(cheek,3,.25);cheekGeometry.rotateY(Math.PI/2);
    mesh(cameraSet,cheekGeometry,materials.tpu,'FPV_sculpted_camera_cheek',side*10.3,18,-42);
    softBox(cameraSet,6.5,4,23,1.5,materials.tpu,'Camera_bolted_mount_foot',side*10.8,4,-42);
    for(const z of [-49,-34])screw(cameraSet,side*11,6.4,z,1.2);
  }
  const camera=new THREE.Group();camera.name='X35_tilted_FPV_camera';camera.position.set(0,18,-42);camera.rotation.x=20*Math.PI/180;cameraSet.add(camera);
  rounded(camera,16,15,18,3,materials.black,'FPV_camera_housing');
  if(cameraMount==='original'){
    const surround=new THREE.Shape();surround.moveTo(-8.6,-3);surround.quadraticCurveTo(-8,-8.6,0,-8.6);surround.quadraticCurveTo(8,-8.6,8.6,-3);surround.lineTo(8.6,3);surround.quadraticCurveTo(8,9,0,9);surround.quadraticCurveTo(-8,9,-8.6,3);surround.closePath();surround.holes.push(hole(0,0,6.9));
    mesh(camera,softened(surround,2,.2),materials.tpu,'FPV_contoured_lens_surround',0,0,-9.5);
  }else{
    const cage=cameraMount==='cage',visor=cameraMount==='visor';
    for(const side of [-1,1]){
      const cheek=new THREE.Shape();
      cheek.moveTo(-8,-12);cheek.lineTo(8,-12);cheek.lineTo(6.5,0);
      cheek.quadraticCurveTo(5.5,5,0,5);cheek.quadraticCurveTo(-5.5,5,-6.5,0);cheek.closePath();
      cheek.holes.push(hole(0,0,1.4));
      const vent=shape(7,3,1);for(const c of vent.curves)for(const key of ['v0','v1','v2','v3'])if(c[key])c[key].y-=7;cheek.holes.push(vent);
      const cheekGeometry=softened(cheek,2.8,.2);cheekGeometry.rotateY(Math.PI/2);
      mesh(cameraSet,cheekGeometry,materials.tpu,'FPV_'+cameraMount+'_side_mount',side*10.1,18,-42);
      softBox(cameraSet,5.6,4,20,1,materials.tpu,'Camera_bolted_mount_foot',side*10.8,4,-42);
      for(const z of [-49,-35])screw(cameraSet,side*11,6.4,z,1.2);
    }
    if(visor){
      softBox(camera,20,2.8,7,1.2,materials.tpu,'FPV_short_upper_visor',0,9,-8.6);
      for(const side of [-1,1])softBox(camera,2.8,6,5,1,materials.tpu,'FPV_visor_corner',side*9.6,5.8,-8.2);
    }
    if(cage){
      const bumper=shape(20.5,19,3.6);bumper.holes.push(shape(16.9,15.8,2.4));
      mesh(camera,softened(bumper,3,.2),materials.tpu,'FPV_open_corner_bumper',0,0,-10.1);
      for(const side of [-1,1])softBox(camera,2.8,9,10,1,materials.tpu,'FPV_bumper_side_retainer',side*9.5,0,-4.7);
    }
  }
  cyl(camera,6.4,3,materials.rubber,'FPV_lens_bezel',0,0,-10.5,24).rotation.x=Math.PI/2;
  cyl(camera,4.8,.55,materials.glass,'FPV_coated_lens',0,0,-12.3,32).rotation.x=Math.PI/2;
  cyl(camera,1.0,.1,materials.silver,'FPV_lens_glint',-1.4,1.5,-12.62,12).rotation.x=Math.PI/2;
  for(const side of [-1,1]){const bolt=cyl(cameraSet,2.2,2,materials.silver,'Camera_tilt_pivot',side*12,18,-42,12);bolt.rotation.z=Math.PI/2;}
  box(camera,5.2,2.5,1.4,materials.rubber,'FPV_camera_rear_wire_socket',0,-1,9.5);
  for(const [i,name,mat] of [[0,'5V',materials.red],[1,'GND',materials.rubber],[2,'VIDEO',materials.yellow]]){
    const x=(i-1)*3,padZ=-11;
    rounded(electronic,1.8,.18,2.8,.35,materials.gold,'Camera_'+name+'_solder_pad',x,11.19,padZ);
    const fillet=mesh(electronic,new THREE.SphereGeometry(1,10,6),materials.silver,'Camera_'+name+'_solder_fillet',x,11.42,-10.8);fillet.scale.set(.72,.32,.85);
    const start=new THREE.Vector3((i-1)*1.25,-1,10).applyQuaternion(camera.quaternion).add(camera.position);
    wire(cameraSet,[start.toArray(),[(i-1)*1.6,13.6,-29],[x,13,-20],[x,12.5,-15.8],[x,11.95,-12.7]],.28,mat,'FPV_camera_'+name+'_wire');
    wire(cameraSet,[[x,11.95,-12.7],[x,11.8,-12.1],[x,11.5,-10.8]],.13,materials.silver,'FPV_camera_'+name+'_exposed_core');
  }
  const battery=assembly('X35_06_4S_battery',[0,23,0]);batteryParts.push(battery);
  softBox(battery,29,29,53,2.4,materials.battery,'4S_650mAh_pack',0,42.5,4);
  for(const z of [-23,31])softBox(battery,29,29,2,2.4,materials.rubber,'Battery_heatshrink_endcap',0,42.5,z);
  box(battery,29,3,51,materials.rubber,'Battery_anti_slip_pad',0,26.5,4);
  for(const side of [-1,1])for(let cell=1;cell<4;cell++)box(battery,.16,.35,47,materials.edge,'4S_cell_seam',side*14.55,28+cell*7.25,4);
  for(const z of [-10,20]){
    const strapShape=shape(33,35,3.7);strapShape.holes.push(shape(29.6,29.6,2.6));
    mesh(battery,geometry(strapShape,8),materials.rubber,'Woven_4S_battery_strap',0,42.5,z);
    const buckle=loop(battery,6,9,3.2,5.8,1.4,materials.silver,'Battery_strap_side_buckle',17.25,45,z);buckle.rotation.y=Math.PI/2;
    box(battery,4,.25,6,materials.tpu,'Battery_strap_brand_tab',-8,60.15,z);
  }
  function batteryLabel(line,small,w,h,x,y,z,top){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#223036';ctx.fillRect(0,0,512,160);ctx.fillStyle='#ff6648';ctx.fillRect(12,14,12,132);ctx.fillStyle='#eef1e8';ctx.font='bold 50px Arial';ctx.fillText(line,42,75);ctx.font='24px Arial';ctx.fillText(small,42,118);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.MeshStandardMaterial({map:texture,roughness:.58});
    const label=mesh(battery,new THREE.PlaneGeometry(w,h),mat,'Battery_label_print',x,y,z);if(top)label.rotation.x=-Math.PI/2;
  }
  batteryLabel('RIFT / 4S','650 mAh · X35',25,13,0,57.1,5,true);
  batteryLabel('4S','FLIGHT PACK',23,7,0,50.5,32.1,false);
  rounded(battery,12,8,1.2,2,materials.rubber,'Battery_cable_exit_grommet',0,40,32.2);
  // A broad, tangent-continuous loop ends straight along the XT30 entry axis.
  // The old interpolated path doubled back sharply just behind the connector.
  for(const [x,mat] of [[2,materials.rubber],[6,materials.red]]){
    const path=new THREE.CurvePath(),v=(a,b,c)=>new THREE.Vector3(a,b,c);
    path.add(new THREE.CubicBezierCurve3(v(x,40,32.5),v(x,44,38),v(x-4,45,44),v(x-4,45,51.2)));
    const k=.55228475;
    path.add(new THREE.CubicBezierCurve3(v(x-4,45,51.2),v(x-4,45,51.2+6*k),v(x-4,40.5+4.5*k,57.2),v(x-4,40.5,57.2)));
    path.add(new THREE.CubicBezierCurve3(v(x-4,40.5,57.2),v(x-4,40.5-4.5*k,57.2),v(x-4,36,51.2+6*k),v(x-4,36,51.2)));
    mesh(battery,new THREE.TubeGeometry(path,40,1.05,5,false),mat,'Battery_power_lead');
  }
  const rear=assembly('X35_07_Rear_connections',[0,0,16]);
  for(const [center,name] of [[42,'XT30_ESC_half'],[48,'XT30_battery_half']]){
    const keyed=new THREE.Shape();keyed.moveTo(-5,-3);keyed.lineTo(5,-3);keyed.lineTo(5,1.4);keyed.lineTo(3.5,3);keyed.lineTo(-3.5,3);keyed.lineTo(-5,1.4);keyed.closePath();
    for(const x of [-2,2])keyed.holes.push(hole(x,0,1.1));mesh(rear,geometry(keyed,6),materials.yellow,name,0,36,center);
    for(const x of [-2,2])cyl(rear,.8,4,materials.gold,'XT30_contact',x,36,center,12).rotation.x=Math.PI/2;
  }
  loop(rear,14,10,11,7,2,materials.tpu,'XT30_retention_collar',0,36,46);
  for(const x of [-7,7])box(rear,3,10,9,materials.tpu,'XT30_support_leg',x,29,44);
  for(const x of [-2,2]){cyl(electronic,1.2,.8,materials.gold,'AIO_power_solder_pad',x,9.6,11.5);wire(electronic,[[x,8.8,11.5],[x,8.5,16],[x,10,36],[x,23,40],[x,36,38.8]],1.05,x>0?materials.red:materials.rubber,'ESC_power_pigtail');}
  // Rest the plug directly on the power-lead pair so a small black band
  // can retain it, instead of spanning a large empty gap beside the pack.
  rounded(battery,7,3,5,.6,materials.white,'JST_XH_4S_balance_plug',4,47,40);
  for(let i=0;i<5;i++){box(battery,.45,.7,.3,materials.gold,'Balance_contact',1.6+i*1.2,47,37.35);wire(battery,[[-6+i*1.1,38,32.5],[-6+i*1.1,39,35],[1.6+i*1.2,45.6,45.2],[1.6+i*1.2,47,42.8]],.25,i===4?materials.red:materials.rubber,'Balance_lead');}
  rounded(battery,6.6,.5,2.5,.2,materials.rubber,'Balance_plug_power_lead_cushion',4,45.27,40);
  const balanceBand=shape(8.4,6.6,2);balanceBand.holes.push(shape(7.4,5.6,1.4));
  mesh(battery,geometry(balanceBand,1),materials.rubber,'Balance_plug_black_retaining_band',4,45.7,40);
  box(rear,20,3,11,materials.tpu,'Rear_lower_mount',0,3.5,53);
  for(const x of [-7,7]){box(rear,3,5,8,materials.tpu,'ELRS_clamp_support',x,7,57);const clamp=loop(rear,5,5,2.3,2.3,3,materials.tpu,'ELRS_dipole_closed_clamp',x,8,60);clamp.rotation.y=Math.PI/2;}
  const dipole=cyl(rear,1,34,materials.rubber,'ELRS_T_dipole',0,8,60,12);dipole.rotation.z=Math.PI/2;
  wire(rear,[[0,7,45],[0,7,52],[0,8,60]],.5,materials.rubber,'ELRS_antenna_coax');
  // Separate the antenna behind the XT30 cradle rather than sharing its edge.
  box(rear,24,3,8,materials.tpu,'VTX_antenna_rear_shelf',0,26.5,53);
  for(const side of [-1,1]){
    softBox(rear,7,3,8,1,materials.tpu,'VTX_shelf_bolted_foot',side*15,26.5,44);
    screw(rear,side*15,28.4,44,1.3);
    beam(rear,[side*15,26.5,44],[side*10,26.5,53],3,3,materials.tpu,'VTX_shelf_side_brace');
  }
  const axis=new THREE.Vector3(0,.94,.34).normalize(),base=new THREE.Vector3(0,29,54),tip=base.clone().addScaledVector(axis,27);
  wire(rear,[base.toArray(),tip.toArray()],.85,materials.rubber,'VTX_straight_antenna_stem');
  const socket=cyl(rear,2.5,6,materials.tpu,'VTX_antenna_root_socket',...base.toArray());socket.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
  const head=cyl(rear,4,9,materials.black,'Compact_omni_radome',...tip.clone().addScaledVector(axis,4).toArray(),20);head.quaternion.copy(socket.quaternion);
  cyl(rear,4.06,.65,materials.tpu,'Radome_color_accent',...tip.clone().addScaledVector(axis,.9).toArray(),16).quaternion.copy(socket.quaternion);
  cyl(rear,1.7,.12,materials.tpu,'Radome_top_mark',...tip.clone().addScaledVector(axis,8.55).toArray(),12).quaternion.copy(socket.quaternion);
  cyl(rear,3,1,materials.black,'Omni_radome_base_seam',...tip.clone().addScaledVector(axis,-.8).toArray(),20).quaternion.copy(socket.quaternion);
  cyl(electronic,1.5,.5,materials.gold,'VTX_UFL_board_socket',-6,10.9,36,12);
  cyl(electronic,1.3,.4,materials.silver,'VTX_UFL_mated_plug',-6,11.3,36,12);
  wire(rear,[[-6,11.5,36],[-10,12,38],[-11,18,42],[-11,23,51],[0,27,54],base.toArray()],.6,materials.rubber,'VTX_antenna_coax');
  let meshes=0,triangles=0;const unique=new Set();root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;unique.add(o.material);}});
  return {root,assemblies,propellers,batteryParts,actionParts,materials,meshes,triangles:Math.round(triangles),
    setExplode(value){for(const a of assemblies)a.group.position.copy(a.base).addScaledVector(a.delta,value);},
    setWireframe(value){for(const m of unique)m.wireframe=value;},
    setColor(hex){materials.tpu.color.set(hex);materials.tpuDetail.color.set(hex).multiplyScalar(.55);applyBatteryLabelColor(root,hex);}};
}
