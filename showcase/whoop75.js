// Original Rotorift model using the Meteor75 Pro's 80.8 mm / 45 mm proportions.
// Shared AIO and C03 camera parts are reused; frame, motors, props, canopy and
// pack are built separately rather than scaling the entire 65 mm aircraft.
function createRift75(){
 const base=createRift65(),root=base.root,materials=base.materials;
 root.name='Rotorift_Rift_75';root.userData={designer:'Rotorift',model:'Rift 75',units:'meters',motorDiagonalMm:80.8,propDiameterMm:45,battery:'1S 580mAh'};
 const assemblies=[],propellers=[],batteryParts=[],actionParts=[];
 materials.canopy.transparent=false;materials.canopy.opacity=1;materials.canopy.depthWrite=true;materials.canopy.roughness=.45;materials.canopy.clearcoat=.25;materials.canopy.color.set('#eceee7');
 materials.prop.color.set('#e1e8e2');materials.prop.opacity=.8;
 function mesh(p,g,mat,name,x=0,y=0,z=0){const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;p.add(m);return m;}
 function box(p,w,h,d,mat,name,x=0,y=0,z=0){return mesh(p,new THREE.BoxGeometry(w,h,d),mat,name,x,y,z);}
 function cyl(p,r,h,mat,name,x=0,y=0,z=0,n=20){return mesh(p,new THREE.CylinderGeometry(r,r,h,n),mat,name,x,y,z);}
 function rod(p,a,b,r,mat,name){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),m=cyl(p,r,av.distanceTo(bv),mat,name);m.position.copy(av).add(bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return m;}
 function wire(p,points,r,mat,name){return mesh(p,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v))),20,r,6,false),mat,name);}
 function shape(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
 function extrude(p,s,d,mat,name,x=0,y=0,z=0,flat=false){const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:16});g.translate(0,0,-d/2);if(flat)g.rotateX(-Math.PI/2);return mesh(p,g,mat,name,x,y,z);}
 function ring(p,outer,inner,h,mat,name,x=0,y=0,z=0){const s=new THREE.Shape();s.absarc(0,0,outer,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);s.holes.push(hole);return extrude(p,s,h,mat,name,x,y,z,true);}
 function assembly(name,delta){const group=new THREE.Group();group.name=name;root.add(group);assemblies.push({group,base:group.position.clone(),delta:new THREE.Vector3(...delta)});return group;}
 function screw(p,x,y,z){cyl(p,.6,3.7,materials.silver,'M1_4_mount_screw',x,y-1.2,z);cyl(p,1.45,.65,materials.silver,'Mount_screw_head',x,y+.6,z);box(p,.95,.06,.25,materials.black,'Screw_slot',x,y+.95,z);}
 const camera=root.getObjectByName('Tilted_micro_FPV_camera');camera.removeFromParent();
 const board=root.getObjectByName('65_02_AIO_5in1_electronics');board.name='75_02_1S_AIO_electronics';
 const discarded=new Set();
 for(const group of [...root.children])if(group!==board){group.traverse(o=>{if(o.geometry)discarded.add(o.geometry);});root.remove(group);}
 for(const object of [...board.children])if(/Motor_phase_wire|BT2_power_pigtail|BT2_socket|BT2_female/.test(object.name)){discarded.add(object.geometry);object.removeFromParent();}
 for(const g of discarded)g.dispose();assemblies.push({group:board,base:board.position.clone(),delta:new THREE.Vector3(0,10,0)});
 const c=80.8/(2*Math.sqrt(2)),frame=assembly('75_01_Molded_durable_frame',[0,-14,0]),mounts=[[18.38,0],[-18.38,0],[0,18.38],[0,-18.38]];
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const x=sx*c,z=sz*c;ring(frame,24.35,23.2,6.2,materials.frame,'Duct_thin_wall',x,12,z);ring(frame,24.55,23.1,.75,materials.frame,'Duct_upper_rolled_lip',x,15.45,z);ring(frame,5.6,.9,1.3,materials.frame,'1102_triangular_motor_seat',x,7.6,z);
  for(let k=0;k<3;k++){const a=k*2*Math.PI/3+Math.PI/6,dx=Math.cos(a),dz=Math.sin(a);rod(frame,[x+dx*4.2,7.6,z+dz*4.2],[x+dx*23.8,9.4,z+dz*23.8],.88,materials.frame,'Triangular_motor_support');rod(frame,[x+dx*8,7.8,z+dz*8],[x+Math.cos(a+.17)*23.6,9.4,z+Math.sin(a+.17)*23.6],.6,materials.frame,'Motor_support_brace');screw(frame,x+dx*3.3,8,z+dz*3.3);}
  rod(frame,[sx*13,8,sz*13],[x-sx*16,8,z-sz*16],1.4,materials.frame,'Duct_to_AIO_bridge');
  for(const sign of [-1,1]){const a=Math.atan2(sx,sz)+sign*.5,foot=shape(5.1,10,1.5);foot.holes.push(new THREE.Path(shape(2.6,6.8,.8).getPoints(12)));const m=extrude(frame,foot,1.2,materials.frame,'Paired_landing_loop',x+Math.sin(a)*23.9,4.5,z+Math.cos(a)*23.9);m.rotation.y=a;}
  const gap=[Math.PI/2,7*Math.PI/6,11*Math.PI/6].reduce((best,a)=>-sx*Math.cos(a)-sz*Math.sin(a)>-sx*Math.cos(best)-sz*Math.sin(best)?a:best),ax=Math.cos(gap),az=Math.sin(gap);
  for(let i=0;i<3;i++){const px=sx*(7+i*1.2),pz=sz*9,t=(i-1)*.8;wire(board,[[px,9.65,pz],[px,5.6,pz],
    [x+ax*8-az*t,5.6,z+az*8+ax*t],[x+ax*7.2-az*t,9,z+az*7.2+ax*t],
    [x+ax*4.7-az*t,9,z+az*4.7+ax*t]],.32,materials.black,'Motor_phase_wire');}
 }
 for(const [x,z]of mounts)ring(frame,2.8,.8,2.8,materials.frame,'AIO_mount_post',x,8,z);
 for(const side of [-1,1]){wire(frame,[[side*13,8,-13],[side*18,8,0],[side*13,8,13]],1.1,materials.frame,'AIO_frame_rail');const loop=shape(16,10,2);loop.holes.push(new THREE.Path(shape(13.1,7.6,1.3).getPoints(12)));extrude(frame,loop,2.4,materials.frame,'580mAh_battery_holder',0,2.3,side*14);for(const sx of [-1,1])rod(frame,[sx*7,6.4,side*14],[sx*13,8,side*13],.8,materials.frame,'Battery_holder_support');}
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const motor=assembly(`75_03_1102_Motor_${sx}_${sz}`,[sx*15,14,sz*15]);motor.position.set(sx*c,0,sz*c);assemblies.at(-1).base.copy(motor.position);cyl(motor,4.9,1.3,materials.black,'1102_stator_base',0,9,0);ring(motor,5.6,4.1,3.6,materials.silver,'1102_open_motor_bell',0,11.4,0);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;cyl(motor,.72,2.5,materials.copper,'1102_copper_winding',Math.cos(a)*3.6,11.5,Math.sin(a)*3.6,10);rod(motor,[Math.cos(a)*1.5,13.2,Math.sin(a)*1.5],[Math.cos(a)*5.45,13.2,Math.sin(a)*5.45],.3,materials.blue,'Motor_bell_spoke');}
  ring(motor,5.65,5.15,.5,materials.blue,'1102_motor_accent_ring',0,13.25,0);cyl(motor,.75,4.8,materials.silver,'1_5mm_motor_shaft',0,15,0);
  const prop=new THREE.Group();prop.name=`75_04_Propeller_${sx}_${sz}`;prop.position.set(sx*c,15.4,sz*c);root.add(prop);assemblies.push({group:prop,base:prop.position.clone(),delta:new THREE.Vector3(sx*15,32,sz*15)});propellers.push({group:prop,direction:sx*sz});ring(prop,2.2,.77,2.3,materials.prop,'Press_fit_propeller_hub');
  for(let blade=0;blade<3;blade++){const pos=[],indices=[],steps=24;for(let row=0;row<=steps;row++){const t=row/steps,r=1.8+20.7*t,w=1.4+4.5*Math.sin(Math.PI*t)**.7,pitch=sx*sz*(.62-.36*t),sweep=sx*sz*3*t*t;for(let edge=0;edge<2;edge++)pos.push(r,(edge-.5)*w*pitch,sweep+(edge-.5)*w);if(row<steps){const i=row*2;indices.push(i,i+2,i+1,i+1,i+2,i+3);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(indices);const a=g.attributes.position;for(let i=0;i<a.count;i++){const r=Math.hypot(a.getX(i),a.getZ(i));if(r>22.5){a.setX(i,a.getX(i)*22.5/r);a.setZ(i,a.getZ(i)*22.5/r);}}g.computeVertexNormals();mesh(prop,g,materials.prop,`Twisted_45mm_blade_${blade+1}`).rotation.y=blade*2*Math.PI/3;}
 }
 const canopy=assembly('75_05_Micro_camera_canopy',[0,27,0]);
 // A thin, curved injection-moulded shell follows the camera angle and tapers
 // towards the antenna. The vent cells are actual holes, with closed edges.
 const hood=new THREE.Group();hood.name='Sculpted_camera_hood';hood.position.set(0,23,-11);hood.rotation.x=28*Math.PI/180;canopy.add(hood);
 const profiles=[[-1.4,7.8,-5.8,13],[1,8.3,-5.9,13.8],[5,8.1,-5.6,13.2],[10,7,-4.1,12.5],[15,5.3,-1.2,9],[20,2.1,1.4,4]];
 const profileCurve=new THREE.CatmullRomCurve3(profiles.map(([z,w,b,h])=>new THREE.Vector3(w,b,h)),false,'catmullrom',.25);
 const zCurve=new THREE.CatmullRomCurve3(profiles.map(([z])=>new THREE.Vector3(z,0,0)),false,'catmullrom',.25);
 const rows=48,cols=36,positions=[],indices=[],stride=cols+1,layerSize=(rows+1)*stride,kept=[];
 for(let layer=0;layer<2;layer++)for(let i=0;i<=rows;i++){
  const p=profileCurve.getPoint(i/rows),z=zCurve.getPoint(i/rows).x;
  for(let j=0;j<=cols;j++){const angle=j*Math.PI/cols;positions.push((p.x-layer*.7)*Math.cos(angle),p.y+(p.z-layer*.7)*Math.sin(angle),z);}
 }
 for(let i=0;i<rows;i++){kept[i]=[];const z=zCurve.getPoint((i+.5)/rows).x;
  for(let j=0;j<cols;j++){const a=(j+.5)*Math.PI/cols;
   const sideVent=z>3&&z<14&&((a>.20&&a<.70)||(a>Math.PI-.70&&a<Math.PI-.20));
   const roofVent=a>1.05&&a<2.09&&[[3.5,4.5],[6.2,7.2],[8.9,9.9]].some(([start,end])=>z>start&&z<end);
   kept[i][j]=!sideVent&&!roofVent;
  }
 }
 const quad=(a,b,c,d)=>indices.push(a,b,c,a,c,d);
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++)if(kept[i][j]){
  const a=i*stride+j,b=a+stride,c=b+1,d=a+1,k=layerSize;
  quad(a,d,c,b);quad(a+k,b+k,c+k,d+k);
  if(!kept[i-1]?.[j])quad(a,a+k,d+k,d);
  if(!kept[i+1]?.[j])quad(b,c,c+k,b+k);
  if(!kept[i]?.[j-1])quad(a,b,b+k,a+k);
  if(!kept[i]?.[j+1])quad(d,d+k,c+k,c);
 }
 const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));shell.setIndex(indices);shell.computeVertexNormals();mesh(hood,shell,materials.canopy,'Curved_canopy_shell_with_open_vents');
 const nose=shape(16.6,15.6,5);nose.holes.push(new THREE.Path(shape(12.4,11.4,3).getPoints(24)));
 const rim=new THREE.ExtrudeGeometry(nose,{depth:.65,bevelEnabled:true,bevelSize:.28,bevelThickness:.2,bevelSegments:3,curveSegments:20});rim.translate(0,.15,-1.8);
 mesh(hood,rim,materials.canopy,'Rounded_camera_protection_rim');
 for(const side of [-1,1]){
  wire(canopy,[[side*7.7,17.5,-9.2],[side*9.1,14.3,-5],[side*14,12.6,-1.2],[side*18.38,12.1,0]],1,materials.canopy,'Swept_canopy_mount_arm');
  wire(canopy,[[side*7.2,15.7,-2],[side*9.4,13.2,1],[side*14,12.4,1.1],[side*18.38,12.1,0]],.65,materials.canopy,'Canopy_mount_open_brace');
  ring(canopy,2.8,.85,1.2,materials.canopy,'Canopy_mount_eyelet',side*18.38,12.1,0);screw(canopy,side*18.38,12.7,0);
 }
 wire(canopy,[[0,18,7.8],[0,15.5,12.5],[0,12.7,18.38]],1.15,materials.canopy,'Swept_rear_mount_arm');ring(canopy,2.8,.85,1.2,materials.canopy,'Rear_mount_eyelet',0,12.1,18.38);screw(canopy,0,12.7,18.38);
 const oldCradle=camera.getObjectByName('Canopy_front_camera_cradle');oldCradle.geometry.dispose();oldCradle.removeFromParent();
 camera.position.set(0,23,-11);camera.name='Micro_FPV_camera';canopy.add(camera);wire(canopy,[[4,23,-8],[5.2,18,-5],[6,12.6,2]],.4,materials.black,'Camera_signal_wire');
 rod(canopy,[0,15,7],[0,30,11],1.3,materials.rubber,'VTX_antenna_heatshrink');rod(canopy,[0,29.5,10.9],[0,42,14.2],.3,materials.silver,'VTX_wire_radiator');
 const collar=ring(canopy,2.15,1.35,1.5,materials.canopy,'Moulded_antenna_guide',0,21,8.6);collar.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(0,15,4).normalize());
 const battery=assembly('75_06_1S_580mAh_battery',[0,-16,0]);batteryParts.push(battery);extrude(battery,shape(12.5,6.9,1.3),57,materials.cell,'1S_580mAh_pouch',0,2.3,0);for(const z of [-29.5,29.5])extrude(battery,shape(12.5,6.9,1.3),2,materials.black,'Battery_heatshrink_end',0,2.3,z);
 const cv=document.createElement('canvas');cv.width=256;cv.height=512;const ctx=cv.getContext('2d');ctx.fillStyle='#eaece5';ctx.fillRect(0,0,256,512);ctx.fillStyle='#ff6648';ctx.fillRect(14,16,228,88);ctx.fillStyle='#1d2a2b';ctx.font='bold 36px Arial';ctx.fillText('R / 75',35,74);ctx.font='bold 48px Arial';ctx.fillText('1S',34,190);ctx.font='bold 29px Arial';ctx.fillText('580 mAh',28,248);ctx.font='21px Arial';ctx.fillText('ROTORIFT',30,310);ctx.fillText('3.8 V · LiHV',30,355);const texture=new THREE.CanvasTexture(cv);texture.colorSpace=THREE.SRGBColorSpace;materials.label=new THREE.MeshStandardMaterial({map:texture,roughness:.65});const label=mesh(battery,new THREE.PlaneGeometry(12,54),materials.label,'Battery_label_print',0,5.83,0);label.rotation.x=-Math.PI/2;
 for(const side of [-1,1]){wire(board,[[side*2,9.5,12],[side*5.5,9,18],[side*6,8,27],[side*2.8,6.5,33],[side*1.1,5.5,34]],.65,side<0?materials.black:materials.red,'AIO_BT2_pigtail');wire(battery,[[side*2,2.3,30.5],[side*2.8,2.3,33],[side*2.5,1.3,39],[side*1.1,3,43],[side*1.1,5.5,42],[side*1.1,5.5,40]],.55,side<0?materials.black:materials.red,'Battery_BT2_lead');const g=ring(battery,.8,.53,1.1,materials.rubber,'Pack_cable_exit',side*2,2.3,30.65);g.rotation.x=Math.PI/2;}
 box(board,4.7,3.2,4.4,materials.canopy,'BT2_socket_body',0,5.5,36.2);box(battery,4.7,3.2,3.5,materials.canopy,'BT2_mating_plug',0,5.5,40.15);box(battery,3.2,2.1,.7,materials.black,'BT2_join_seam',0,5.5,38.45);
 let meshes=0,triangles=0;const unique=new Set();root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;unique.add(o.material);}});
 function setExplode(v){for(const a of assemblies)a.group.position.copy(a.base).addScaledVector(a.delta,v);}function setWireframe(v){for(const m of unique)m.wireframe=v;}function setColor(hex){materials.frame.color.set(hex);applyBatteryLabelColor(root,hex);}
 return {root,assemblies,propellers,batteryParts,actionParts,materials,meshes,triangles:Math.round(triangles),setExplode,setWireframe,setColor};
}
