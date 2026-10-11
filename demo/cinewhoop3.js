// Cinelog30 V3 formai referencia alapján készített, saját procedurális modell.
// +Y felfelé, -Z előre; milliméterben épül, a gyökér méterre skáláz.
function createRiftC3() {
  const root=new THREE.Group();root.name='Rotorift_Rift_C3';root.scale.setScalar(.001);
  root.userData={designer:'Rotorift',model:'Rift C3',units:'meters',motorDiagonalMm:128,propDiameterMm:76,battery:'4S 720mAh',configuration:'pusher',purpose:'visual demo'};
  const assemblies=[],propellers=[],batteryParts=[],actionParts=[],materials={};
  function texture(draw,w=512,h=512){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
  const carbon=texture(ctx=>{ctx.fillStyle='#22292c';ctx.fillRect(0,0,512,512);for(let y=0;y<512;y+=12)for(let x=0;x<512;x+=12){const horizontal=(x/12+y/12)%4<2;const g=ctx.createLinearGradient(x,y,x+(horizontal?0:12),y+(horizontal?12:0));g.addColorStop(0,'#171e21');g.addColorStop(.5,'#384145');g.addColorStop(1,'#1c2427');ctx.fillStyle=g;ctx.fillRect(x,y,12,12);ctx.strokeStyle='#a2aaaa25';ctx.lineWidth=.5;for(let i=2;i<12;i+=3){ctx.beginPath();ctx.moveTo(x+(horizontal?0:i),y+(horizontal?i:0));ctx.lineTo(x+(horizontal?12:i),y+(horizontal?i:12));ctx.stroke();}}});
  carbon.wrapS=carbon.wrapT=THREE.RepeatWrapping;
  materials.carbon=new THREE.MeshStandardMaterial({color:'#aeb6b5',map:carbon,metalness:.35,roughness:.43});
  materials.edge=new THREE.MeshStandardMaterial({color:'#273236',metalness:.25,roughness:.65});
  materials.orange=new THREE.MeshPhysicalMaterial({color:'#ff6648',roughness:.56,metalness:0,specularIntensity:.16,toneMapped:false});
  materials.orange.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight *= 0.7;\n#include <opaque_fragment>');};
  materials.orange.customProgramCacheKey=()=> 'rotorift-c3-saturated-polymer-v1';
  materials.orangeDetail=new THREE.MeshStandardMaterial({color:'#9e3d2b',roughness:.62});
  materials.black=new THREE.MeshStandardMaterial({color:'#192125',metalness:.55,roughness:.36});
  materials.rubber=new THREE.MeshStandardMaterial({color:'#171d1f',roughness:.91});
  materials.silver=new THREE.MeshStandardMaterial({color:'#aab5b9',metalness:.91,roughness:.23});
  materials.copper=new THREE.MeshStandardMaterial({color:'#b37340',metalness:.8,roughness:.3});
  materials.gold=new THREE.MeshStandardMaterial({color:'#c5a159',metalness:.86,roughness:.28});
  materials.pcb=new THREE.MeshStandardMaterial({color:'#173e38',roughness:.65,metalness:.15});
  materials.chip=new THREE.MeshStandardMaterial({color:'#10191c',roughness:.72});
  materials.prop=new THREE.MeshPhysicalMaterial({color:'#243031',roughness:.31,metalness:0,transparent:true,opacity:.96,clearcoat:.55,side:THREE.DoubleSide,depthWrite:false});
  materials.glass=new THREE.MeshPhysicalMaterial({color:'#162f41',metalness:.56,roughness:.07,clearcoat:1});
  materials.battery=new THREE.MeshStandardMaterial({color:'#333e43',metalness:.22,roughness:.47});
  materials.red=new THREE.MeshStandardMaterial({color:'#c44937',roughness:.65});
  materials.white=new THREE.MeshStandardMaterial({color:'#dcded4',roughness:.62});
  materials.connector=new THREE.MeshStandardMaterial({color:'#f9bb08',roughness:.61});
  materials.band=new THREE.MeshStandardMaterial({color:'#b49367',roughness:.94});
  materials.led=new THREE.MeshStandardMaterial({color:'#86c8b5',emissive:'#28755c',emissiveIntensity:.45});
  function mesh(p,g,mat,name,x=0,y=0,z=0){const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;p.add(m);return m;}
  function box(p,w,h,d,mat,name,x=0,y=0,z=0){return mesh(p,new THREE.BoxGeometry(w,h,d),mat,name,x,y,z);}
  function cyl(p,rt,rb,h,mat,name,x=0,y=0,z=0,n=28){return mesh(p,new THREE.CylinderGeometry(rt,rb,h,n),mat,name,x,y,z);}
  function rod(p,a,b,r,mat,name){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),m=mesh(p,new THREE.CylinderGeometry(r,r,av.distanceTo(bv),16),mat,name);m.position.copy(av).add(bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return m;}
  function wire(p,points,r,mat,name,segments=30){return mesh(p,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v))),segments,r,8,false),mat,name);}
  function roundedShape(w,h,r){r=Math.min(r,w/2,h/2);const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
  function circle(x,y,r){const s=new THREE.Path();s.absarc(x,y,r,0,Math.PI*2,true);return s;}
  function contour(points){const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return s;}
  function shifted(shape,x,y){return new THREE.Path(shape.getPoints(16).map(p=>p.add(new THREE.Vector2(x,y))));}
  function extrusion(p,s,d,mat,name,x=0,y=0,z=0,horizontal=false,bevel=0,curveSegments=24){const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3,curveSegments});g.translate(0,0,-d/2);if(horizontal)g.rotateX(-Math.PI/2);return mesh(p,g,mat,name,x,y,z);}
  function rounded(p,w,h,d,r,mat,name,x=0,y=0,z=0){return extrusion(p,roundedShape(w,h,r),d,mat,name,x,y,z,false,.18);}
  function sleeve(p,w,h,d,r,iw,ih,ir,mat,name,x=0,y=0,z=0){const s=roundedShape(w,h,r);s.holes.push(roundedShape(iw,ih,ir));return extrusion(p,s,d,mat,name,x,y,z,false,.12);}
  function washer(p,ro,ri,h,mat,name,x,y,z){const s=new THREE.Shape();s.absarc(0,0,ro,0,Math.PI*2,false);s.holes.push(circle(0,0,ri));return extrusion(p,s,h,mat,name,x,y,z,true);}
  function plate(p,s,h,y,name,x=0,z=0){const m=extrusion(p,s,h,[materials.carbon,materials.edge],name,x,y,z,true);const uv=m.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/32,uv.getY(i)/32);return m;}
  function moldedSupport(p,shape,depth,name,side,offset){
    const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.3,bevelThickness:.3,bevelSegments:3,curveSegments:20});g.translate(0,0,-depth/2);
    const a=g.attributes.position;
    for(let i=0;i<a.count;i++){const u=a.getX(i),y=a.getY(i),d=a.getZ(i);a.setXYZ(i,offset(u,y)+d,y,-u);}
    g.computeVertexNormals();const m=mesh(p,g,materials.orange,name);m.scale.x=side;return m;
  }
  function screw(p,x,y,z,name='M2_socket_screw',size=1.45){cyl(p,size,size,.85,materials.black,name,x,y,z,16);cyl(p,size*.46,size*.46,.09,materials.silver,name+'_hex',x,y+.46,z,6);}
  function assembly(name,delta){const g=new THREE.Group();g.name=name;root.add(g);assemblies.push({group:g,base:g.position.clone(),delta:new THREE.Vector3(...delta)});return g;}
  function label(p,line,small,w,h,x,y,z,top=false){const t=texture((ctx,cw,ch)=>{ctx.fillStyle='#223036';ctx.fillRect(0,0,cw,ch);ctx.fillStyle='#ff6648';ctx.fillRect(12,14,12,ch-28);ctx.fillStyle='#eef1e8';ctx.font='bold 50px Arial';ctx.fillText(line,42,75);ctx.font='24px Arial';ctx.fillText(small,42,118);},512,160);const mat=new THREE.MeshStandardMaterial({map:t,roughness:.58});const m=mesh(p,new THREE.PlaneGeometry(w,h),mat,'Rotorift_own_label',x,y,z);if(top)m.rotation.x=-Math.PI/2;}
  const mx=43,mz=Math.sqrt(64*64-mx*mx),ro=41.3,ri=39.3;

  const guard=assembly('C3_01_Integrated_propeller_guard',[0,-18,0]);
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const x=sx*mx,z=sz*mz;
    const s=new THREE.Shape();s.absarc(0,0,ro,0,Math.PI*2,false);s.holes.push(circle(0,0,ri));
    extrusion(guard,s,4.6,materials.orange,'Low_profile_protective_ring',x,12.6,z,true,.45,64);
    washer(guard,41.35,40.9,.3,materials.orangeDetail,'Molded_ring_lower_seam',x,10.55,z);
    // Két szélesebb, lekerekített talp gyűrűnként, a külső sarok két oldalán.
    const foot=new THREE.Shape();foot.moveTo(-4.5,12.9);foot.lineTo(4.5,12.9);
    foot.quadraticCurveTo(5.1,12.9,5.1,12.1);foot.lineTo(4.1,1.1);
    foot.quadraticCurveTo(4,-1.4,2.6,-1.4);foot.lineTo(-2.6,-1.4);
    foot.quadraticCurveTo(-4,-1.4,-4.1,1.1);foot.lineTo(-5.1,12.1);
    foot.quadraticCurveTo(-5.1,12.9,-4.5,12.9);foot.closePath();
    for(const branch of [-1,1]){
      const angle=Math.atan2(sx,sz)+branch*Math.PI/6;
      const g=extrusion(guard,foot,2.4,materials.orange,`Guard_paired_landing_foot_${sx}_${sz}_${branch}`,
        x+Math.sin(angle)*40.7,0,z+Math.cos(angle)*40.7,false,.35);
      g.rotation.y=angle;
    }
  }
  for(const side of [-1,1]){
    const outer=contour([[62,-13],[73,-10],[78,0],[73,10],[62,13],[61,10],[66,5],[68,0],[66,-5],[61,-10]]);
    outer.holes.push(contour([[67,-7],[72,-5],[72,-1.5]]));outer.holes.push(contour([[67,7],[72,5],[72,1.5]]));
    const bridge=extrusion(guard,outer,4.6,materials.orange,'Guard_sculpted_side_bridge',0,12.6,0,true,.3);bridge.scale.x=side;
    // Széles, íves, egybeöntött nyereg: a végek a két gyűrűbe simulnak.
    const saddle=new THREE.Shape();saddle.moveTo(-22,26.45);saddle.lineTo(22,26.45);saddle.lineTo(22,24.7);
    saddle.quadraticCurveTo(13,22,11,15);saddle.quadraticCurveTo(10.8,12.2,8.5,12.2);saddle.lineTo(-8.5,12.2);
    saddle.quadraticCurveTo(-10.8,12.2,-11,15);saddle.quadraticCurveTo(-13,22,-22,24.7);saddle.closePath();
    saddle.holes.push(shifted(roundedShape(19,4.1,1.7),0,22.2));
    moldedSupport(guard,saddle,4.2,'Integrated_curved_side_saddle',side,(_u,y)=>{
      const t=THREE.MathUtils.clamp((y-12.2)/(26.45-12.2),0,1);return 28-9*t*t*(3-2*t);
    });
    for(const fore of [-1,1]){
      washer(guard,3.8,1.05,1.8,materials.orange,'Saddle_carbon_contact_boss',side*19,25.85,fore*18);
    }
    // Az első cső helyett rövid, lapos borda, beöntött alsó gyűrűcsatlakozással.
    const nose=new THREE.Shape();nose.moveTo(59,26.45);nose.lineTo(64,26.45);
    nose.quadraticCurveTo(74,26,81,19.8);nose.quadraticCurveTo(83,17.5,84.5,15);
    nose.lineTo(84.5,12.2);nose.lineTo(83.1,12.2);nose.lineTo(82.5,16.8);
    nose.quadraticCurveTo(81,20,74,22);nose.quadraticCurveTo(65,24.4,59,23.5);nose.closePath();
    moldedSupport(guard,nose,2.6,'Integrated_front_guard_web',side,(u,_y)=>{
      const t=THREE.MathUtils.clamp((u-60)/24.5,0,1);return 19+6*t*t*(3-2*t);
    });
    washer(guard,2.5,1.05,1.6,materials.orange,'Front_web_carbon_contact_boss',side*19,25.95,-61);
    cyl(guard,.8,.8,5.4,materials.silver,'Front_web_to_carbon_bolt',side*19,26.7,-61,12);
  }
  for(const fore of [-1,1])rounded(guard,8,4.6,6,1,materials.orange,'Guard_inner_ring_link',0,12.6,fore*mz);

  const frame=assembly('C3_02_Carbon_chassis',[0,9,0]);
  // Nyitott orrvilla: a kamera helyén nincs keresztben futó karbonlemez.
  const half=[[0,-34],[17,-34],[17,-66],[21,-66],[23,-57],[23,-40],[35,-50],[43,-56],[50,-53],[52,-47],[49,-39],[43,-38],[34,-32],[23,-20],[23,18],[35,31],[45,37],[51,41],[52,48],[48,54],[43,56],[36,51],[21,39],[17,66],[0,66]];
  const outline=half.concat(half.slice(1,-1).reverse().map(([x,z])=>[-x,z])).map(([x,z])=>[x,-z]);
  const topShape=contour(outline);
  for(const sx of [-1,1])for(const sz of [-1,1])for(const dx of [-4.5,4.5])for(const dz of [-4.5,4.5])topShape.holes.push(circle(sx*mx+dx,-(sz*mz+dz),.95));
  for(const x of [-19,19])for(const z of [-18,18])topShape.holes.push(circle(x,-z,1.1));
  for(const x of [-19,19])for(const z of [-40,-58])topShape.holes.push(circle(x,-z,1.05));
  for(const side of [-1,1]){
    topShape.holes.push(contour([[side*4,22],[side*15,23],[side*15,30],[side*5,29]]));
    topShape.holes.push(contour([[side*4,-34],[side*15,-36],[side*12,-56],[side*4,-54]]));
  }
  for(const z of [-8,2,12,50])topShape.holes.push(shifted(roundedShape(8,4,1),0,-z));
  plate(frame,topShape,2.5,28,'Perforated_2_5mm_upper_carbon_frame');
  const bottomShape=roundedShape(40,101,8);bottomShape.holes.push(shifted(roundedShape(19,26,4),0,-29));
  for(const x of [-12.75,12.75])for(const z of [-20.75,4.75])bottomShape.holes.push(circle(x,-z,1.2));
  plate(frame,bottomShape,2.5,16.5,'Lower_suspended_carbon_electronics_tray',0,0);
  for(const x of [-19,19])for(const z of [-18,18]){
    cyl(frame,2.1,2.1,9,materials.black,'Continuous_chassis_standoff',x,22.25,z,20);
    cyl(frame,.85,.85,13.3,materials.silver,'Through_chassis_bolt',x,22.4,z,12);
    screw(frame,x,29.65,z,'Chassis_top_screw');
  }
  const trayShape=roundedShape(36,48,5);for(const x of [-9,0,9])trayShape.holes.push(shifted(roundedShape(3,23,1.2),x,0));
  plate(frame,trayShape,1.5,30,'Raised_vented_battery_saddle',0,7);
  rounded(frame,30,1.25,55,1.5,materials.rubber,'Battery_antislip_contact_pad',0,31.375,7);
  for(const side of [-1,1]){
    const wall=contour([[-38,17],[-38,24],[-28,26],[32,26],[48,22],[48,17]]);
    for(const z of [-25,-13,0,13,26])wall.holes.push(shifted(roundedShape(6,3,1),-z,21.3));
    const panel=extrusion(frame,wall,1.3,materials.orange,'Vented_electronics_side_shell',side*20.4,0,0);panel.rotation.y=Math.PI/2;
    for(const z of [-32,38])screw(frame,side*18,27,z,'Bay_cover_bolt');
    screw(frame,side*19,29.7,-61,'Front_web_mount_screw',1.1);
  }

  const electronics=assembly('C3_03_AIO_and_digital_video',[0,20,0]);
  const aio=roundedShape(32,32,3);for(const x of [-12.75,12.75])for(const z of [-12.75,12.75])aio.holes.push(circle(x,-z,1.3));
  extrusion(electronics,aio,.9,materials.pcb,'25_5mm_AIO_FC_ESC',0,20,-8,true);
  for(const x of [-12.75,12.75])for(const z of [-20.75,4.75]){
    washer(electronics,2.4,.85,1.8,materials.rubber,'AIO_lower_damping_grommet',x,18.65,z);
    washer(electronics,2.1,.85,.9,materials.rubber,'AIO_upper_damping_grommet',x,20.9,z);
    cyl(electronics,.85,.85,6.5,materials.silver,'AIO_mount_bolt_shaft',x,20,z,12);screw(electronics,x,21.7,z,'AIO_fastener',1.15);
  }
  box(electronics,6.6,1.1,6.6,materials.chip,'F722_MCU',-1,21,-9);
  box(electronics,3.2,.8,3.2,materials.chip,'AIO_gyro',6,20.9,-6);
  for(const side of [-1,1])for(const fore of [-1,1])for(let k=0;k<3;k++)box(electronics,2.4,.8,3.7,materials.chip,'ESC_power_MOSFET',side*(5+k*3.1),20.9,-8+fore*8);
  for(let i=0;i<24;i++){const x=-10+(i%8)*2.8,z=-19+Math.floor(i/8)*3;box(electronics,.8,.5,1.2,materials.chip,'AIO_SMD_component',x,20.8,z);for(const end of [-1,1])box(electronics,.8,.16,.25,materials.silver,'AIO_SMD_solder',x,20.65,z+end*.5);}
  for(const sx of [-1,1])for(const sz of [-1,1])for(let phase=0;phase<3;phase++){
    const px=sx*14,pz=-8+sz*(5+phase*2);
    box(electronics,1.7,.2,1.2,materials.gold,'ESC_motor_phase_pad',px,20.6,pz);
    const solder=mesh(electronics,new THREE.SphereGeometry(.7,12,8),materials.silver,'ESC_motor_phase_solder',px,20.9,pz);solder.scale.y=.5;
    wire(electronics,[[px,21.1,pz],[sx*23,23,sz*22],[sx*35,25,sz*39+phase*.6],[sx*mx,25.8,sz*mz+phase*.6]],.48,materials.rubber,'Connected_motor_phase_wire');
  }
  rounded(electronics,28,6.5,34,2,materials.black,'Digital_VTX_heat_spreader',0,21.5,29);
  box(electronics,26,.5,30,materials.rubber,'Digital_VTX_contact_pad',0,18,29);
  for(const x of [-11.5,11.5])for(const z of [15,43]){
    cyl(electronics,.75,.75,9.1,materials.silver,'VTX_to_lower_tray_bolt',x,21.2,z,12);
    screw(electronics,x,26.05,z,'VTX_mount_screw',1.1);
  }
  for(let i=0;i<11;i++)box(electronics,.85,.7,28,materials.silver,'Digital_VTX_heatsink_fin',-11+i*2.2,25.3,29);
  rounded(electronics,7,2.8,1.4,.6,materials.rubber,'VTX_USB_dust_cover',-7,21.5,46.7);
  rounded(electronics,6,2.8,1.4,.6,materials.rubber,'VTX_storage_dust_cover',7,21.5,46.7);
  box(electronics,5,2,2,materials.white,'VTX_power_socket',0,22,11);
  wire(electronics,[[0,22,10],[6,22,7],[7,21,1]],.55,materials.red,'AIO_to_VTX_power');
  wire(electronics,[[1.5,22,10],[8,22,6],[9,21,1]],.55,materials.rubber,'AIO_to_VTX_ground');
  box(electronics,15,.8,12,materials.pcb,'Rear_power_and_ELRS_board',0,22.5,54);
  for(const x of [-6,6]){
    cyl(electronics,1.3,1.3,4.1,materials.black,'Rear_board_to_upper_frame_post',x,24.7,58,16);
    cyl(electronics,.65,.65,8,materials.silver,'Rear_board_mounting_shaft',x,26,58,12);
    screw(frame,x,29.7,58,'Rear_board_upper_mount_screw',1.1);
  }
  box(electronics,4,.9,4,materials.silver,'ELRS_RF_chip',0,23.35,53);
  cyl(electronics,2.6,2.6,2.4,materials.black,'Rear_buzzer',-4.4,24.1,57);
  box(electronics,1.4,.8,1.4,materials.led,'Receiver_status_LED',4.5,23.4,55);
  wire(electronics,[[0,23,49],[4,22,43],[8,21,32],[11,21,6]],.6,materials.rubber,'Rear_board_signal_harness');

  for(const sx of [-1,1])for(const sz of [-1,1]){
    const motor=assembly(`C3_04_Inverted_1404_motor_${sx}_${sz}`,[sx*13,-12,sz*13]);motor.position.set(sx*mx,0,sz*mz);assemblies.at(-1).base.copy(motor.position);
    cyl(motor,7.2,7.2,1.6,materials.black,'1404_upper_motor_mount',0,25.9,0);
    washer(motor,8.5,6.2,5,materials.black,'1404_open_bell_shell',0,20.3,0);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;cyl(motor,1.05,1.05,3.5,materials.copper,'1404_copper_stator_winding',Math.cos(a)*5.6,23.5,Math.sin(a)*5.6,12);rod(motor,[Math.cos(a)*2.8,18,Math.sin(a)*2.8],[Math.cos(a)*8.1,18,Math.sin(a)*8.1],.45,materials.black,'1404_lower_bell_spoke');}
    washer(motor,8.55,7.9,.55,materials.silver,'1404_bell_edge',0,18,0);
    cyl(motor,2.2,2.2,1.3,materials.silver,'1404_lower_bearing',0,17.3,0);
    cyl(motor,1,1,6.5,materials.silver,'Downward_motor_shaft',0,14.7,0,16);
    for(const dx of [-4.5,4.5])for(const dz of [-4.5,4.5]){cyl(motor,.75,.75,5.3,materials.silver,'9mm_motor_bolt_shaft',dx,27,dz,12);screw(motor,dx,29.7,dz,'Motor_top_bolt',1.35);}
    const prop=new THREE.Group();prop.name=`C3_05_Pusher_propeller_${sx}_${sz}`;prop.position.set(sx*mx,13,sz*mz);root.add(prop);assemblies.push({group:prop,base:prop.position.clone(),delta:new THREE.Vector3(sx*13,-24,sz*13)});
    const direction=-sx*sz;propellers.push({group:prop,direction});prop.rotation.y=(sx+sz)*.3;
    washer(prop,3.2,1.05,2.4,materials.prop,'76mm_three_blade_hub',0,0,0);
    cyl(prop,1.9,1.9,.8,materials.black,'Propeller_shaft_lock',0,-1.65,0,6);
    for(let blade=0;blade<3;blade++){
      const pos=[],indices=[];for(let row=0;row<=24;row++){const t=row/24,r=2.5+35.5*t,w=2.2+9.5*Math.sin(Math.PI*t)**.75,sweep=direction*(t*t*5-1),pitch=direction*(.5-.29*t);for(let edge=0;edge<2;edge++)pos.push(r,(edge-.5)*w*pitch,sweep+(edge-.5)*w);if(row<24){const i=row*2;indices.push(i,i+2,i+1,i+1,i+2,i+3);}}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(indices);const a=g.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getZ(i),r=Math.hypot(x,z);if(r>38){a.setX(i,x*38/r);a.setZ(i,z*38/r);}}g.computeVertexNormals();mesh(prop,g,materials.prop,'Twisted_76mm_pusher_blade').rotation.y=blade*2*Math.PI/3;
    }
  }

  const front=assembly('C3_06_Isolated_FPV_camera_and_cage',[0,5,-23]);
  for(const side of [-1,1]){
    const s=contour([[62,30.5],[62,37],[55,44],[43,44],[35,37],[35,30.5]]);
    s.holes.push(contour([[58,34.5],[53,40.5],[44,40.5],[39,35],[39,34.5]]));
    // A fül és a csillapító közös tengelye; a csavar a valódi furaton megy át.
    s.holes.push(circle(49,32,1.15));
    extrusion(front,s,2.2,materials.orange,'Contoured_FPV_protective_canopy_side',side*17.8,0,0).rotation.y=Math.PI/2;
    for(const z of [-40,-58]){
      rounded(front,6,2,8,1.5,materials.orange,'Canopy_frame_mounting_foot',side*19,30.43,z);
      screw(front,side*19,31.9,z,'Canopy_mount_screw');
    }
    washer(front,2.5,1.2,6.7,materials.rubber,'FPV_vibration_damper',side*13.5,32,-49).rotation.z=Math.PI/2;
    rod(front,[side*9.8,32,-49],[side*19.4,32,-49],1.1,materials.silver,'FPV_camera_tilt_bolt');
    rod(front,[side*17.8,43.5,-46],[side*17.8,49.8,-46],1.1,materials.orange,'Canopy_upper_crossbrace_root');
  }
  const fpv=new THREE.Group();fpv.name='Micro_digital_FPV_camera_25deg';fpv.position.set(0,32,-49);fpv.rotation.x=25*Math.PI/180;front.add(fpv);
  rounded(fpv,20,21,17,3,materials.black,'Digital_FPV_camera_case');
  sleeve(fpv,29,27,2.4,6,23,23,4,materials.orange,'FPV_front_lens_protection',0,0,-7);
  for(const [r,h,z] of [[10.8,3.5,-9],[9.3,2.2,-11.6],[8.3,.7,-13.1]]){const m=cyl(fpv,r,r,h,materials.black,'FPV_lens_barrel',0,0,z,48);m.rotation.x=Math.PI/2;}
  const lens=cyl(fpv,7.6,7.6,.16,materials.glass,'FPV_multicoated_front_lens',0,0,-13.55,48);lens.rotation.x=Math.PI/2;
  const glint=cyl(fpv,.58,.58,.12,materials.silver,'FPV_lens_glint',-1.5,1.8,-13.66,16);glint.rotation.x=Math.PI/2;
  rounded(fpv,5,3,1.4,.5,materials.white,'FPV_rear_coax_socket',0,-2,9.4);
  fpv.updateMatrix();const fpvCoaxExit=new THREE.Vector3(0,-2,10.3).applyMatrix4(fpv.matrix).toArray();
  wire(front,[fpvCoaxExit,[6,21,-31],[6,21,-23],[0,22,12]],.7,materials.rubber,'FPV_coax_to_digital_VTX',42);
  for(let i=0;i<7;i++)rounded(front,1,7,3,.4,materials.orange,'Canopy_upper_cooling_rib',-5+i*1.7,35.7,-34.3);
  rounded(front,30,3,4,1,materials.orange,'Canopy_cooling_rib_support_crossrail',0,32.5,-34.5);
  rounded(front,37,2.6,9,2,materials.orange,'Canopy_upper_hinge_support_crossbrace',0,49.8,-46);
  rounded(front,17,2.8,11,1.4,materials.orange,'Naked_camera_hinge_mount_platform',0,50.9,-46);

  const rear=assembly('C3_07_Dual_video_antennas_and_T_receiver',[0,5,22]);
  rounded(rear,31,4,14,2,materials.rubber,'Rear_dual_antenna_bracket',0,31.3,61);
  for(const x of [-12,12])screw(rear,x,33.9,59,'Antenna_mount_bolt');
  for(const side of [-1,1]){
    const start=[side*10,33,64],originalEnd=[side*24,86,80];
    const antennaAxis=new THREE.Vector3(...originalEnd).sub(new THREE.Vector3(...start));
    // Teljes hossz a tartótól a fej tetejéig: 25%-kal rövidebb, azonos radomával.
    const stemLength=(antennaAxis.length()+12.05)*.75-12.05;
    const end=new THREE.Vector3(...start).add(antennaAxis.normalize().multiplyScalar(stemLength)).toArray();
    rod(rear,start,[side*12,42,66.7],2.6,materials.rubber,'Video_antenna_root_boot');
    rod(rear,[side*11.7,40.5,66.3],end,1.3,materials.black,'Slanted_video_antenna_stem');
    const head=new THREE.Group();head.name=`C3_Omni_head_${side}`;head.position.set(...end);head.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...end).sub(new THREE.Vector3(...start)).normalize());rear.add(head);
    cyl(head,4.6,4.8,12,materials.black,'Modern_cylindrical_omni_radome',0,5.5,0,24);cyl(head,4.35,4.6,.7,materials.rubber,'Flat_radome_top',0,11.7,0,24);
    washer(head,4.85,4.5,.5,materials.orange,'Omni_radome_small_brand_ring',0,.1,0);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;rod(head,[Math.cos(a)*4.65,3,Math.sin(a)*4.65],[Math.cos(a)*4.65,9,Math.sin(a)*4.65],.14,materials.edge,'Radome_molded_fluting');}
    wire(rear,[[side*10,33,64],[side*10,27,61],[side*10,24.5,43]],.55,materials.rubber,'Dual_video_antenna_coax');
  }
  rod(rear,[-20,34,66],[20,34,66],.75,materials.black,'ELRS_T_dipole_crossbar');
  rod(rear,[0,28,60],[0,34,66],.8,materials.rubber,'ELRS_T_center_stem');
  wire(rear,[[0,28,60],[3,25,58],[1,23.5,54]],.38,materials.rubber,'ELRS_T_receiver_coax');

  const battery=assembly('C3_08_4S_battery_and_straps',[0,48,0]);batteryParts.push(battery);
  // Burkolatok végpontosan illeszkednek: nincsenek coplanar átfedések.
  extrusion(battery,roundedShape(29,29,2.4),53,materials.battery,'4S_720mAh_LiHV_pack',0,46.5,7);
  for(const z of [-20.5,34.5])extrusion(battery,roundedShape(29,29,2.4),2,materials.rubber,'Battery_end_shrink_protection',0,46.5,z);
  for(let i=0;i<4;i++)box(battery,.15,5.6,45,materials.edge,'4S_cell_seam',14.7,36.1+i*7,7);
  label(battery,'RIFT / 4S','720 mAh · LiHV',25,13,0,61.22,8,true);
  label(battery,'4S','FLIGHT PACK',23,10,0,51.7,35.76);
  for(const z of [-10,23]){
    const s=roundedShape(33.8,33.8,4.3);s.holes.push(roundedShape(29.5,29.5,2.8));
    extrusion(battery,s,9,materials.rubber,'Woven_4S_battery_strap',0,46.5,z);
    const buckle=sleeve(battery,6,9,1.4,1,3.2,5.8,.7,materials.silver,'Battery_strap_buckle',17.4,49,z);buckle.rotation.y=Math.PI/2;
    box(battery,4,.25,7,materials.orange,'Battery_strap_brand_tab',-8,63.55,z);
  }
  for(const [x,r] of [[5,1.22],[9,1.22]]){const s=new THREE.Shape();s.absarc(0,0,1.9,0,Math.PI*2,false);s.holes.push(circle(0,0,r));extrusion(battery,s,3,materials.rubber,'4S_power_exit_grommet',x,42,35.6);}
  sleeve(battery,7,2.8,3,.8,5.4,1.4,.5,materials.rubber,'4S_balance_exit_boot',-7,40,37);
  function xt30(p,z,female){const g=new THREE.Group();g.name=female?'XT30_battery_socket':'XT30_ESC_plug';g.position.set(12,29,z);p.add(g);const s=contour([[-4.5,-2.7],[4.5,-2.7],[4.5,1.1],[3.2,2.7],[-3.2,2.7],[-4.5,1.1]]);for(const x of [-2.4,2.4])s.holes.push(circle(x,0,1.25));extrusion(g,s,7,materials.connector,'XT30_keyed_connector_body',0,0,3.5);for(const x of [-2.4,2.4]){if(female){const s=new THREE.Shape();s.absarc(0,0,1.16,0,Math.PI*2,false);s.holes.push(circle(0,0,.78));extrusion(g,s,5,materials.gold,'XT30_recessed_female_contact',x,0,2.7);}else{const m=cyl(g,.75,.75,8,materials.gold,'XT30_gold_male_contact',x,0,6);m.rotation.x=Math.PI/2;}const boot=cyl(g,1.55,1.75,3,materials.rubber,'XT30_wire_boot',x,0,female?8.5:-1.5);boot.rotation.x=Math.PI/2;}return g;}
  xt30(electronics,45,false);xt30(battery,52,true);
  wire(electronics,[[8,20.6,3],[12,22,22],[17,25,37],[14.4,29,42]],1.1,materials.red,'AIO_positive_XT30_pigtail');
  wire(electronics,[[4,20.6,3],[9,22,23],[12,25,37],[9.6,29,42]],1.1,materials.rubber,'AIO_negative_XT30_pigtail');
  wire(battery,[[9,42,35.6],[9,42,38.65],[9,42,40],[16,40,46],[17,35,56],[14.4,29,62]],1.2,materials.red,'4S_positive_battery_lead');
  wire(battery,[[5,42,35.6],[5,42,38.65],[5,42,40],[12,40,46],[13,35,56],[9.6,29,62]],1.2,materials.rubber,'4S_negative_battery_lead');
  const balance=new THREE.Group();balance.name='Five_pin_4S_balance_plug';balance.position.set(20,35,58);balance.rotation.x=Math.PI/2;battery.add(balance);
  sleeve(balance,7.2,3.2,5,.6,5.9,2.1,.3,materials.white,'JST_XH_five_pin_housing');box(balance,6.6,.5,4.5,materials.white,'JST_pin_separating_web');
  for(let i=0;i<5;i++){
    const pin=cyl(balance,.22,.22,3.4,materials.silver,'4S_balance_pin',-2.4+i*1.2,.45,0,10);pin.rotation.x=Math.PI/2;
    wire(battery,[[-9.4+i*1.2,40,35.6],[-9.4+i*1.2,40,38.55],[-9.4+i*1.2,40,39.5],
      [2+i*.6,43,45],[17.6+i*1.2,41,61.5],[17.6+i*1.2,31.8,58]],.28,
      i===0?materials.rubber:(i===4?materials.red:materials.white),'4S_balance_cell_wire',40);
    const collar=cyl(balance,.42,.42,1.4,materials.white,'4S_balance_wire_entry',-2.4+i*1.2,0,3.2,12);collar.rotation.x=Math.PI/2;
  }
  wire(battery,[[13,35,56],[12.6,35,58],[14,35,60],[20,35,61],[24,35,58],[21,35,55],[17,35,54],[13,35,56]],.42,materials.band,'Balance_plug_elastic_retaining_loop',42);

  const action=assembly('C3_09_Naked_action_camera_and_mount',[0,42,-22]);actionParts.push(action);
  for(const side of [-1,1]){
    const ear=roundedShape(4.4,8.3,2);ear.holes.push(circle(0,1.3,1.1));const e=extrusion(action,ear,2.1,materials.orange,'Naked_camera_lower_mount_ear',side*5,52.5,-46);e.rotation.y=Math.PI/2;
  }
  rod(action,[-8,53.8,-46],[8,53.8,-46],1,materials.silver,'Naked_camera_adjustable_hinge_axle');
  const cam=new THREE.Group();cam.name='Naked_action_camera_25deg';cam.position.set(0,70.5,-46);cam.rotation.x=25*Math.PI/180;action.add(cam);
  rounded(cam,48,35,9,4,materials.black,'Naked_action_camera_lightweight_core');
  sleeve(cam,51,38,2.4,5.4,47.8,34.8,3.8,materials.orange,'Naked_camera_fitted_front_frame',0,0,-4.4);
  sleeve(cam,51,38,2.4,5.4,44,30,3,materials.orange,'Naked_camera_open_rear_frame',0,0,4.4);
  rounded(cam,42,28,.8,3,materials.pcb,'Naked_camera_visible_rear_circuit_board',0,0,4.55);
  rounded(cam,19,22,1.2,2,materials.black,'Naked_camera_rear_heat_spreader',-8,0,5.5);
  for(let i=0;i<7;i++)box(cam,1,19,.7,materials.silver,'Naked_camera_rear_cooling_fin',-16+i*2.6,0,6.3);
  // A klipszek vége 0,8 mm-rel a fekete ház elé/mögé nyúlik, így nincs közös felületsík.
  for(const side of [-1,1])for(const y of [-11,11])rounded(cam,3,5,10.6,1,materials.orange,'Naked_camera_side_retention_clip',side*24.4,y,0);
  const glass=cyl(cam,8.2,8.2,.2,materials.glass,'Naked_camera_front_lens',12,3,-9.05,48);glass.rotation.x=Math.PI/2;
  for(const [r,d,z] of [[10.5,3,-5.5],[9.3,2,-7.6]]){const m=cyl(cam,r,r,d,materials.black,'Naked_camera_lens_barrel',12,3,z,48);m.rotation.x=Math.PI/2;}
  const shine=cyl(cam,.55,.55,.15,materials.silver,'Naked_lens_reflection',10,5,-9.2,16);shine.rotation.x=Math.PI/2;
  const record=cyl(cam,2,2,.6,materials.rubber,'Naked_camera_record_button',-10,17.8,0,20);
  box(cam,1.3,1.3,.35,materials.led,'Naked_camera_status_light',-12,5,-4.8);
  label(cam,'R / C3','NAKED CAMERA',18,7,-10,-5,-4.8);
  for(const x of [-18,18])for(const y of [-10,10]){const m=cyl(cam,.7,.7,.25,materials.silver,'Naked_camera_case_screw',x,y,6,12);m.rotation.x=Math.PI/2;}
  // A kamera aljához érő szár és döntővillák a felső vázra támaszkodnak.
  for(const side of [-1,1])rod(action,[side*5,53.8,-46],[side*5,54.8,-53.4],1.5,materials.orange,'Naked_camera_hinge_to_lower_frame_link');
  rounded(cam,4,2,1.3,.5,materials.white,'Naked_camera_rear_power_connector',8,-12,6.4);
  cam.updateMatrix();const nakedPowerExit=new THREE.Vector3(8,-12,7.2).applyMatrix4(cam.matrix).toArray();
  wire(action,[nakedPowerExit,[10,37,-30],[9,26,-22],[9,21,-13]],.5,materials.rubber,'Naked_camera_power_ground_harness');
  box(electronics,4,1.8,2.2,materials.white,'Naked_camera_BEC_socket',9,21,-13);

  let meshes=0,triangles=0;const allMaterials=new Set();root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])allMaterials.add(m);}});
  function setExplode(v){for(const a of assemblies)a.group.position.copy(a.base).addScaledVector(a.delta,v);}
  function setWireframe(v){for(const m of allMaterials)m.wireframe=v;}
  function setColor(hex){materials.orange.color.set(hex);materials.orangeDetail.color.set(hex).multiplyScalar(.55);}
  return {root,assemblies,propellers,batteryParts,actionParts,materials,meshes,triangles:Math.round(triangles),setExplode,setWireframe,setColor};
}
