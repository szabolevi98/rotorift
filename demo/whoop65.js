// Saját Air65-jellegű vizuális modell. Milliméterben épül, előre: -Z.
function createRift65() {
  const root = new THREE.Group(); root.name = 'Rotorift_Rift_65'; root.scale.setScalar(.001);
  root.userData = { designer:'Rotorift', model:'Rift 65', units:'meters', motorDiagonalMm:65, propDiameterMm:31, battery:'1S 300mAh', purpose:'visual demo' };
  const assemblies=[], propellers=[], batteryParts=[], actionParts=[];
  const materials = {
    frame: new THREE.MeshPhysicalMaterial({color:'#ff6648',roughness:.48,metalness:0,specularIntensity:.2,toneMapped:false}),
    canopy: new THREE.MeshPhysicalMaterial({color:'#e4eeeb',roughness:.23,metalness:0,transparent:true,opacity:.68,clearcoat:1,depthWrite:false,side:THREE.DoubleSide}),
    prop: new THREE.MeshPhysicalMaterial({color:'#dbe5e3',roughness:.22,transparent:true,opacity:.64,clearcoat:1,depthWrite:false,side:THREE.DoubleSide}),
    silver: new THREE.MeshStandardMaterial({color:'#b9c4c6',metalness:.9,roughness:.24}),
    blue: new THREE.MeshStandardMaterial({color:'#348fa7',metalness:.72,roughness:.27}),
    black: new THREE.MeshStandardMaterial({color:'#182125',metalness:.12,roughness:.55}),
    rubber: new THREE.MeshStandardMaterial({color:'#202526',roughness:.88}),
    pcb: new THREE.MeshStandardMaterial(DRONE_SURFACES.pcb),
    gold: new THREE.MeshStandardMaterial({color:'#c9a354',metalness:.8,roughness:.32}),
    copper: new THREE.MeshStandardMaterial({color:'#b8783d',metalness:.82,roughness:.3}),
    red: new THREE.MeshStandardMaterial({color:'#bd392e',roughness:.66}),
    white: new THREE.MeshStandardMaterial({color:'#f0eeea',roughness:.6}),
    cell: new THREE.MeshStandardMaterial({color:'#bec4c3',metalness:.55,roughness:.45}),
    glass: new THREE.MeshPhysicalMaterial(DRONE_SURFACES.lens),
  };
  configureDronePolymer(materials.frame);
  function mesh(parent,g,mat,name,x=0,y=0,z=0) {const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function box(p,w,h,d,mat,name,x=0,y=0,z=0){return mesh(p,new THREE.BoxGeometry(w,h,d),mat,name,x,y,z);}
  function cyl(p,rt,rb,h,mat,name,x=0,y=0,z=0,n=32){return mesh(p,new THREE.CylinderGeometry(rt,rb,h,n),mat,name,x,y,z);}
  function tube(p,points,r,mat,name){return mesh(p,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v))),24,r,8,false),mat,name);}
  function rod(p,a,b,r,mat,name){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),m=mesh(p,new THREE.CylinderGeometry(r,r,av.distanceTo(bv),12),mat,name);m.position.copy(av).add(bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return m;}
  function roundShape(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
  function hole(x,y,r){const h=new THREE.Path();h.absarc(x,y,r,0,Math.PI*2,true);return h;}
  function extrude(p,s,depth,mat,name,x=0,y=0,z=0,horizontal=false){const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:24});g.translate(0,0,-depth/2);if(horizontal)g.rotateX(-Math.PI/2);return mesh(p,g,mat,name,x,y,z);}
  function ring(p,outer,inner,h,mat,name,x,y,z){const s=new THREE.Shape();s.absarc(0,0,outer,0,Math.PI*2,false);s.holes.push(hole(0,0,inner));return extrude(p,s,h,mat,name,x,y,z,true);}
  function assembly(name,delta){const group=new THREE.Group();group.name=name;root.add(group);assemblies.push({group,base:group.position.clone(),delta:new THREE.Vector3(...delta)});return group;}
  function screw(p,x,y,z,name){cyl(p,.48,.48,4,materials.silver,name+'_shaft',x,y-1.7,z,12);cyl(p,1.25,1.35,.5,materials.silver,name+'_head',x,y+.25,z,20);box(p,1.15,.06,.22,materials.black,name+'_slot',x,y+.52,z);}

  const frame=assembly('65_01_Molded_PP_frame',[0,-12,0]);
  const c=65/(2*Math.sqrt(2)), mount=13, corner=mount*Math.sqrt(2);
  const mounts=[[corner,0],[-corner,0],[0,corner],[0,-corner]];
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const x=sx*c,z=sz*c;
    // A fal vékony marad; belső átmérő 32.3 mm, a propeller 31 mm.
    ring(frame,16.9,16.15,4.6,materials.frame,'Duct_thin_wall',x,9.3,z);
    ring(frame,17.05,16.05,.65,materials.frame,'Duct_rolled_upper_lip',x,11.65,z);
    ring(frame,17.05,16.1,.7,materials.frame,'Duct_lower_lip',x,6.95,z);
    ring(frame,4.05,.8,1.1,materials.frame,'Motor_three_screw_seat',x,6.8,z);
    for(let k=0;k<3;k++){
      const a=k*2*Math.PI/3+Math.PI/6,dx=Math.cos(a),dz=Math.sin(a);
      rod(frame,[x+dx*3.5,6.8,z+dz*3.5],[x+dx*16.5,7.15,z+dz*16.5],.62,materials.frame,'Duct_radial_support');
      const bx=x+dx*3.3,bz=z+dz*3.3;
      cyl(frame,.55,.55,1.9,materials.silver,'Motor_mount_bolt',bx,7.25,bz,12);
      cyl(frame,.85,.85,.3,materials.silver,'Motor_mount_bolt_head',bx,6.1,bz,12);
    }
    const nearX=x-sx*11.6,nearZ=z-sz*11.6;
    rod(frame,[sx*mount,7.2,sz*mount],[nearX,7.2,nearZ],1.1,materials.frame,'Duct_to_board_junction');
    // Gyűrűnként két karcsú talp a külső íven, a sarok két oldalára elosztva.
    const footShape=roundShape(4.4,8.6,1.45);
    const footOpening=new THREE.Path(roundShape(2.6,6.2,.9).getPoints(16).map(p=>p.add(new THREE.Vector2(0,.1))));
    footOpening.closePath();footShape.holes.push(footOpening);
    const footGeometry=new THREE.ExtrudeGeometry(footShape,{depth:.85,bevelEnabled:true,
      bevelSize:.12,bevelThickness:.12,bevelSegments:3,curveSegments:16});
    footGeometry.translate(0,0,-.425);
    for(const branch of [-1,1]){
      const angle=Math.atan2(sx,sz)+branch*Math.PI/5;
      const foot=mesh(frame,footGeometry,materials.frame,`Molded_paired_landing_foot_${sx}_${sz}_${branch}`,
        x+Math.sin(angle)*16.4,2.75,z+Math.cos(angle)*16.4);
      foot.rotation.y=angle;
    }
  }
  for(const [x,z] of mounts){
    ring(frame,2.9,1.25,2,materials.frame,'AIO_mounting_post',x,8,z);
    rod(frame,[x,7.2,z],[x*.88,7.2,z*.88],1.1,materials.frame,'AIO_post_to_center_rail');
  }
  for(const side of [-1,1]){
    tube(frame,[[side*13,7,-13],[side*17,7,0],[side*13,7,13]],.9,materials.frame,'Open_center_side_rail');
    tube(frame,[[-13,7,side*13],[0,7,side*17],[13,7,side*13]],.9,materials.frame,'Open_center_end_rail');
    // Akkuhoz kapcsolódó két vékony téglalap alakú klipsz.
    const shape=roundShape(13.5,8.1,1.8);shape.holes.push(roundShape(11.7,6.3,1.1));
    extrude(frame,shape,1.8,materials.frame,'Underbody_battery_loop',0,2.9,side*11);
    rod(frame,[-6,6.8,side*11],[-13,7,side*13],.75,materials.frame,'Battery_loop_attachment');
    rod(frame,[6,6.8,side*11],[13,7,side*13],.75,materials.frame,'Battery_loop_attachment');
  }

  const board=assembly('65_02_AIO_5in1_electronics',[0,9,0]);
  const pcbShape=roundShape(29,29,3.4);for(const x of [-13,13])for(const z of [-13,13])pcbShape.holes.push(hole(x,-z,1.45));
  extrude(board,pcbShape,.8,materials.pcb,'AIO_26mm_mounting_PCB',0,10.6,0,true).rotation.y=Math.PI/4;
  for(const [x,z] of mounts){
    ring(board,2.45,.7,2.2,materials.rubber,'AIO_vibration_grommet',x,9.1,z);
    ring(board,2.1,.7,.8,materials.rubber,'Canopy_upper_grommet',x,11.4,z);
  }
  box(board,5,.95,5,materials.black,'Flight_controller_MCU',-2,11.45,-1);
  box(board,2.6,.6,2.6,materials.black,'Gyroscope',4.1,11.28,-3);
  box(board,5.6,.8,4.4,materials.silver,'ELRS_RF_shield',-5.8,11.4,7.1);
  box(board,3.5,.8,5,materials.red,'Analog_VTX_shield',5.8,11.4,5.5);
  for(const sx of [-1,1])for(const sz of [-1,1]){
    for(let k=0;k<3;k++)box(board,1.6,.65,2.2,materials.black,'ESC_MOSFET',sx*(5.3+k*2),11.35,sz*5);
  }
  for(let k=0;k<23;k++){
    const x=-8+(k%8)*2.25,z=-8+Math.floor(k/8)*2.25;
    box(board,.65,.4,1.1,k%3===0?materials.silver:materials.black,'SMD_component',x,11.2,z);
    for(const end of [-1,1])box(board,.7,.12,.22,materials.silver,'SMD_solder_end',x,11.13,z+end*.5);
  }
  for(const sx of [-1,1])for(const sz of [-1,1]){
    for(let phase=0;phase<3;phase++){
      const px=sx*(7+phase*1.2),pz=sz*9;
      box(board,1.05,.15,1.4,materials.gold,'Motor_phase_pad',px,11.07,pz);
      const solder=mesh(board,new THREE.SphereGeometry(.55,12,8),materials.silver,'Motor_phase_solder',px,11.28,pz);solder.scale.y=.5;
      tube(board,[[px,11.5,pz],[sx*17,8.5,sz*(13+phase*.8)],[sx*(c-4.5),7.8,sz*c+phase*.65],[sx*c,8.15,sz*c]],.28,materials.black,'Motor_phase_wire');
    }
  }
  // Alsó oldali tápforrasztás: a vezetékek az AIO és a váz között haladnak.
  for(const side of [-1,1]){
    box(board,1.5,.2,2,materials.gold,'Battery_power_pad',side*2.2,10.1,12);
    const joint=mesh(board,new THREE.SphereGeometry(.6,12,8),materials.silver,
      'Battery_power_solder_joint',side*2.2,9.8,12);joint.scale.y=.65;
    // A hátsó gumibakot kétoldalt kerülik, a canopy lábai alatt futnak hátra.
    tube(board,[[side*2.2,9.5,12],[side*4.6,9,15],[side*4.8,9,19],
      [side*4.8,9,23],[side*3.8,8,27],[side*1.3,4,27.5],[side*1.3,4,28.7]],
      .55,side<0?materials.black:materials.red,'BT2_power_pigtail');
  }
  box(board,4.5,3.1,5,materials.white,'BT2_socket_body',0,4,31);
  box(board,3.15,2.05,.3,materials.black,'BT2_socket_recess',0,4,33.65);
  for(const side of [-1,1]){const pin=cyl(board,.42,.42,2.2,materials.gold,'BT2_female_contact',side*.95,4,33);pin.rotation.x=Math.PI/2;}

  for(const sx of [-1,1])for(const sz of [-1,1]){
    const motor=assembly(`65_03_Motor_${sx}_${sz}`,[sx*12,12,sz*12]);motor.position.set(sx*c,0,sz*c);assemblies.at(-1).base.copy(motor.position);
    cyl(motor,3.2,3.3,1.2,materials.black,'0702_stator_base',0,7.8,0);
    ring(motor,3.65,2.55,2.2,materials.silver,'0702_silver_bell',0,9.7,0);
    for(let k=0;k<9;k++){
      const a=k*2*Math.PI/9;
      cyl(motor,.63,.63,1.7,materials.copper,'0702_copper_winding',Math.cos(a)*2.2,9.5,Math.sin(a)*2.2,12);
      rod(motor,[Math.cos(a)*1,10.85,Math.sin(a)*1],[Math.cos(a)*3.55,10.85,Math.sin(a)*3.55],.25,materials.blue,'0702_open_top_spoke');
    }
    ring(motor,3.68,3.25,.35,materials.blue,'0702_blue_bell_rim',0,10.85,0);
    cyl(motor,1.1,1.1,.6,materials.blue,'0702_shaft_bearing',0,11,0);
    cyl(motor,.5,.5,3.4,materials.silver,'0702_motor_shaft',0,12,0,16);
    const prop=new THREE.Group();prop.name=`65_04_Propeller_${sx}_${sz}`;prop.position.set(sx*c,12,sz*c);root.add(prop);
    assemblies.push({group:prop,base:prop.position.clone(),delta:new THREE.Vector3(sx*12,26,sz*12)});
    const direction=sx*sz;propellers.push({group:prop,direction});prop.rotation.y=(sx+sz)*.24;
    ring(prop,1.65,.52,1.9,materials.prop,'Press_fit_propeller_hub',0,.1,0);
    for(let blade=0;blade<3;blade++){
      const positions=[],indices=[],steps=20;
      for(let row=0;row<=steps;row++){
        const t=row/steps,r=1.4+14.1*t;
        const width=1.1+3.2*Math.sin(Math.PI*t)**.65;
        const sweep=direction*(t*t*2.2-.3),pitch=direction*(.65-.35*t);
        for(let edge=0;edge<2;edge++)positions.push(r,(edge-.5)*width*pitch,sweep+(edge-.5)*width);
        if(row<steps){const i=row*2;indices.push(i,i+2,i+1,i+1,i+2,i+3);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
      // Leszabjuk a söprésből adódó sugárt: 31 mm a teljes átmérő.
      const a=g.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getZ(i),len=Math.hypot(x,z);if(len>15.5){a.setX(i,x*15.5/len);a.setZ(i,z*15.5/len);}}
      g.computeVertexNormals();const m=mesh(prop,g,materials.prop,'Twisted_31mm_blade');m.rotation.y=blade*2*Math.PI/3;
      rod(prop,[Math.cos(m.rotation.y)*1,0,-Math.sin(m.rotation.y)*1],[Math.cos(m.rotation.y)*3.2,0,-Math.sin(m.rotation.y)*3.2],.35,materials.prop,'Blade_root');
    }
  }

  const canopy=assembly('65_05_Transparent_camera_canopy',[0,23,0]);
  for(const side of [-1,1]){
    // Vékony, íves bordák és tágas nyílások, a fotók nyitott canopy-jához.
    tube(canopy,[[side*corner,12.1,0],[side*9,13.6,-9],[side*6.1,20.8,-7],[side*5.3,24,1],[side*6.3,22,6],[side*9,14,11],[0,12.1,corner]],.8,materials.canopy,'Canopy_arch_side_rail');
    tube(canopy,[[0,12.1,-corner],[side*5,12.2,-14],[side*5.5,15,-11],[side*5.1,19,-8]],.8,materials.canopy,'Canopy_front_lower_lens_support');
    tube(canopy,[[side*corner,12.1,0],[side*9,12.2,6],[side*5.4,15,8],[side*5.8,21,6]],.7,materials.canopy,'Canopy_open_rear_foot');
  }
  for(const [x,z] of mounts){ring(canopy,2.6,.72,.9,materials.canopy,'Canopy_mount_eyelet',x,12.2,z);screw(canopy,x,12.65,z,'Canopy_fastener');}
  tube(canopy,[[-5.3,24,1],[-3.2,25.6,1],[0,26,1],[3.2,25.6,1],[5.3,24,1]],.8,materials.canopy,'Canopy_open_crown_bridge');
  for(const side of [-1,1])rod(canopy,[side*6.1,20.8,-7],[side*6.1,19,-7],1,materials.canopy,'FPV_side_pivot_support');
  const camera=new THREE.Group();camera.name='Tilted_micro_FPV_camera';camera.position.set(0,19,-7);camera.rotation.x=28*Math.PI/180;canopy.add(camera);
  extrude(camera,roundShape(10,9.2,1.5),2.3,materials.black,'C03_style_camera_case');
  box(camera,8.5,7.6,.65,materials.pcb,'Camera_rear_PCB',0,0,1.5);
  const surround=roundShape(12.7,11.8,3);surround.holes.push(roundShape(10.4,9.6,1.6));extrude(camera,surround,1.5,materials.canopy,'Canopy_front_camera_cradle',0,0,-.45);
  const lens=cyl(camera,3.55,3.85,3.6,materials.black,'FPV_lens_barrel',0,0,-2.9,48);lens.rotation.x=Math.PI/2;
  const lip=cyl(camera,3.65,3.65,.45,materials.rubber,'FPV_lens_front_bezel',0,0,-4.85,48);lip.rotation.x=Math.PI/2;
  const glass=cyl(camera,2.9,2.9,.15,materials.glass,'FPV_multicoated_lens',0,0,-5.11,48);glass.rotation.x=Math.PI/2;
  const glint=cyl(camera,.35,.35,.16,materials.silver,'Lens_small_reflection',-.7,.55,-5.2,16);glint.rotation.x=Math.PI/2;
  for(const side of [-1,1]){const axle=cyl(camera,.65,.65,3,materials.silver,'FPV_tilt_axle',side*5.5,0,0,12);axle.rotation.z=Math.PI/2;}
  for(const [index,mat] of [materials.gold,materials.red,materials.black].entries())tube(canopy,[[2.7+index*.65,19,-4.5],[4.5+index*.4,14,-3],[4+index*.8,11.5,1]],.22,mat,'Camera_signal_wire');
  // A pálcaantenna nem gomba: zsugorcsöves VTX-talp és csupasz sugárzó.
  rod(canopy,[0,15,4],[0,26,8],1.55,materials.rubber,'VTX_antenna_heatshrink');
  rod(canopy,[0,25.7,7.9],[0,36,11.65],.32,materials.silver,'VTX_straight_wire_radiator');
  const keeper=ring(canopy,2.15,1.5,1.2,materials.canopy,'VTX_antenna_retaining_collar',0,21.5,6.36);
  keeper.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(0,11,4).normalize());
  for(const side of [-1,1])rod(canopy,[side*6.3,22,6],[side*1.9,21.5,6.36],.7,materials.canopy,'VTX_collar_to_canopy');
  tube(canopy,[[0,15,4],[1.5,12.7,4],[5.8,12.1,5.5]],.32,materials.black,'VTX_coax_feed');
  // Rövid, felfelé álló vevőantenna a canopy mellett, a propellerkörökön kívül.
  const receiverAntennaBase=[-9,16,10], receiverAntennaTip=[-9,21,10.5];
  tube(board,[[-5.8,11.9,7],[-8,13,8],[-9,14.4,9.8],receiverAntennaBase],
    .28,materials.black,'ELRS_receiver_antenna_feed');
  rod(board,[-9,14.4,9.84],[-9,16.2,10.02],.6,materials.rubber,'ELRS_antenna_heatshrink_base');
  rod(board,receiverAntennaBase,receiverAntennaTip,.19,materials.silver,'ELRS_linear_receiver_antenna');
  const receiverKeeper=ring(canopy,1.1,.65,1.1,materials.canopy,'ELRS_antenna_canopy_keeper',-9,15.2,9.92);
  receiverKeeper.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(0,5,.5).normalize());
  rod(canopy,[-9,14,11],[-9,15.2,10.7],.55,materials.canopy,'ELRS_keeper_to_canopy_foot');

  const battery=assembly('65_06_1S_300mAh_battery',[0,-14,0]);batteryParts.push(battery);
  // A cella a végburkolatok belső síkjáig tart: nincs egymásra fekvő külső felület.
  const cellLength=45.8, endLength=2.2, endCenter=(cellLength+endLength)/2;
  extrude(battery,roundShape(10.8,5.8,1),cellLength,materials.cell,'1S_pouch_cell',0,2.9,0);
  box(battery,10.9,.2,41,materials.white,'Own_Rotorift_battery_label',0,5.85,0);
  for(const z of [-endCenter,endCenter])extrude(battery,roundShape(10.8,5.8,1),endLength,materials.black,'Battery_heatshrink_end',0,2.9,z);
  const cv=document.createElement('canvas');cv.width=256;cv.height=512;const ctx=cv.getContext('2d');
  ctx.fillStyle='#e9eae3';ctx.fillRect(0,0,256,512);ctx.fillStyle='#ff6648';ctx.fillRect(14,16,228,90);ctx.fillStyle='#17262a';ctx.font='bold 36px Arial';ctx.fillText('R / 65',36,76);ctx.font='bold 48px Arial';ctx.fillText('1S',33,186);ctx.font='bold 29px Arial';ctx.fillText('300 mAh',30,248);ctx.font='18px Arial';ctx.fillText('ROTORIFT',31,301);ctx.font='17px Arial';ctx.fillText('3.8 V · LiHV',31,341);ctx.fillText('VISUAL DEMO',31,405);
  const labelMap=new THREE.CanvasTexture(cv);labelMap.colorSpace=THREE.SRGBColorSpace;
  const labelMat=new THREE.MeshStandardMaterial({map:labelMap,roughness:.65});materials.label=labelMat;
  const label=mesh(battery,new THREE.PlaneGeometry(10.5,40),labelMat,'Battery_label_print',0,5.97,0);label.rotation.x=-Math.PI/2;
  const batteryExit=roundShape(10.8,5.8,1);
  for(const side of [-1,1])batteryExit.holes.push(hole(side*2,0,.68));
  extrude(battery,batteryExit,.55,materials.black,'Battery_wire_exit_panel',0,2.9,25.075);
  for(const side of [-1,1]){
    const exit=ring(battery,.78,.47,1.4,materials.rubber,'Battery_wire_exit_grommet',side*2,2.9,25.8);
    exit.rotation.x=Math.PI/2;
    // A cella végéből indul; az összedugott házak alatt, majd hátulról érkezik a dugóba.
    tube(battery,[[side*2,2.9,25.1],[side*2,2.9,27],[side*2,1.35,29],
      [side*1.8,1.35,35],[side*1.1,1.35,38.8],[side*1.1,2.9,40],
      [side*1.1,4,40],[side*1.1,4,38.8],[side*1.1,4,37.6]],
      .45,side<0?materials.black:materials.red,'Battery_BT2_lead');
    const entry=ring(battery,.7,.48,1.4,materials.white,'BT2_plug_wire_entry',side*1.1,4,37.6);
    entry.rotation.x=Math.PI/2;
  }
  box(battery,4.4,3.1,3.4,materials.white,'BT2_mating_plug',0,4,35.2);
  box(battery,3,1.85,1.15,materials.white,'BT2_inserted_key',0,4,33.15);
  for(const side of [-1,1]){const pin=cyl(battery,.3,.3,1.7,materials.gold,'BT2_male_contact',side*.95,4,33.1);pin.rotation.x=Math.PI/2;}

  let meshes=0,triangles=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;}});
  const uniqueMaterials=new Set();root.traverse(o=>{if(o.isMesh)uniqueMaterials.add(o.material);});
  function setExplode(v){for(const a of assemblies)a.group.position.copy(a.base).addScaledVector(a.delta,v);}
  function setWireframe(v){for(const m of uniqueMaterials)m.wireframe=v;}
  function setColor(hex){materials.frame.color.set(hex);}
  return {root,assemblies,propellers,batteryParts,actionParts,materials,meshes,triangles:Math.round(triangles),setExplode,setWireframe,setColor};
}
