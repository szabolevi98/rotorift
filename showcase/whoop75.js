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
 // Solid, gently tapered landing tabs distinguish the durable 75 frame from
 // the 65's open loop feet. Two tabs remain attached to each duct.
 const footShape=new THREE.Shape();footShape.moveTo(-2.5,5);footShape.lineTo(2.5,5);
 footShape.quadraticCurveTo(3.05,5,2.85,4.1);footShape.lineTo(2.15,-3.6);
 footShape.quadraticCurveTo(2,-5,0,-5);footShape.quadraticCurveTo(-2,-5,-2.15,-3.6);
 footShape.lineTo(-2.85,4.1);footShape.quadraticCurveTo(-3.05,5,-2.5,5);footShape.closePath();
 const footGeometry=new THREE.ExtrudeGeometry(footShape,{depth:1.5,bevelEnabled:true,bevelSize:.18,bevelThickness:.18,bevelSegments:2,curveSegments:12});footGeometry.translate(0,0,-.75);
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const x=sx*c,z=sz*c;ring(frame,24.35,23.2,6.2,materials.frame,'Duct_thin_wall',x,12,z);ring(frame,24.55,23.1,.75,materials.frame,'Duct_upper_rolled_lip',x,15.45,z);ring(frame,5.6,.9,1.5,materials.frame,'1102_triangular_motor_seat',x,7.6,z);
  for(let k=0;k<3;k++){
   const a=k*2*Math.PI/3+Math.PI/6,dx=Math.cos(a),dz=Math.sin(a);
   rod(frame,[x+dx*4.2,7.6,z+dz*4.2],[x+dx*23.8,9.4,z+dz*23.8],.88,materials.frame,'Triangular_motor_support');
   rod(frame,[x+dx*8,7.8,z+dz*8],[x+Math.cos(a+.17)*23.6,9.4,z+Math.sin(a+.17)*23.6],.6,materials.frame,'Motor_support_brace');
   // Motor bolts enter from below; only their shallow heads remain exposed.
   const bx=x+dx*3.3,bz=z+dz*3.3;
   cyl(frame,.6,2.3,materials.silver,'Motor_mount_bolt',bx,8,bz,12);
   cyl(frame,1,.35,materials.silver,'Motor_mount_bolt_head',bx,6.675,bz,16);
   box(frame,.85,.025,.2,materials.black,'Motor_mount_bolt_slot',bx,6.495,bz);
  }
  rod(frame,[sx*13,8,sz*13],[x-sx*16,8,z-sz*16],1.4,materials.frame,'Duct_to_AIO_bridge');
  for(const sign of [-1,1]){const a=Math.atan2(sx,sz)+sign*.5,m=mesh(frame,footGeometry,materials.frame,'Paired_solid_landing_tab',x+Math.sin(a)*23.9,4.5,z+Math.cos(a)*23.9);m.rotation.y=a;}
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
 // Photo-led canopy: broad rounded crown, tapered chin and inset camera.
 // The side wings and rear arch belong to the shell, rather than separate rods.
 const hood=new THREE.Group();hood.name='Reference_moulded_camera_hood';hood.position.set(0,23,-11);hood.rotation.x=28*Math.PI/180;canopy.add(hood);
 const crown=new THREE.Path();crown.moveTo(-3,-12);
 crown.bezierCurveTo(-6.5,-12,-8.3,-5,-9.4,0);crown.bezierCurveTo(-11,4.5,-8.5,7,-5,7.6);
 crown.quadraticCurveTo(0,8.6,5,7.6);crown.bezierCurveTo(8.5,7,11,4.5,9.4,0);crown.bezierCurveTo(8.3,-5,6.5,-12,3,-12);
 // [camera-local Z, width scale, underside height, crown height]. The two
 // side mounting eyes at (+/-18.38,12.1,0) are integrated into row 14.83.
 const earZ=14.829,earBase=-4.461,earScale=1.08;
 // Crown heights compensate for the camera group's 28-degree tilt: the
 // world-space roof forms one convex dome, without a dip over the side ears.
 const profiles=[[-4.7,.80,-12,8.1],[0,1.05,-11.2,13.8],[7,1.14,-8.5,17.5],[earZ,earScale,earBase,17],[21,.88,-1.6,15],[27,.48,2.7,11],[31.06,.28,4.17,5.3]];
 const profileCurve=new THREE.CatmullRomCurve3(profiles.map(([z,w,b,h])=>new THREE.Vector3(w,b,h)),false,'catmullrom',.25);
 const zCurve=new THREE.CatmullRomCurve3(profiles.map(([z])=>new THREE.Vector3(z,0,0)),false,'catmullrom',.25);
 const rows=80,cols=64,positions=[],indices=[],stride=cols+1,layerSize=(rows+1)*stride,kept=[];
 function surface(t,u){const p=profileCurve.getPoint(t),z=zCurve.getPoint(t).x,edge=crown.getPointAt(u),height=(edge.y+12)/20.1;
  const flare=(18.38-3*earScale)*Math.exp(-(((z-earZ)/2.8)**4));
  const x=edge.x*p.x+Math.sign(edge.x)*flare*(1-height)**2,y=p.y+(p.z-p.y)*height;
  const faceBow=.025*x*x+.006*(y-1)**2;
  return new THREE.Vector3(x,y,z+faceBow*Math.max(0,(3-z)/7.7));
 }
 for(let layer=0;layer<2;layer++)for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
  const t=i/rows,u=j/cols,point=surface(t,u);
  if(layer){const across=surface(t,Math.min(1,u+.001)).sub(surface(t,Math.max(0,u-.001))),along=surface(Math.min(1,t+.001),u).sub(surface(Math.max(0,t-.001),u));point.addScaledVector(along.cross(across).normalize(),-.75);}
  positions.push(...point.toArray());
 }
 for(let i=0;i<rows;i++){kept[i]=[];const z=zCurve.getPoint((i+.5)/rows).x;
  for(let j=0;j<cols;j++){const u=(j+.5)/cols,edge=crown.getPointAt(u),height=(edge.y+12)/20.1,side=Math.abs(edge.x)>4;
   const cheekWindow=side&&((z-5.1)/3.8)**2+((height-.34)/.17)**2<1;
   const arch=z>15.1&&z<29.1&&height<.88*Math.sin(Math.PI*(z-15.1)/14)**.65;
   const smallSideVent=side&&((z-12.9)/1.15)**2+((height-.63)/.065)**2<1;
   const roofVent=height>.80&&((Math.abs(edge.x)-5.8)/.65)**2+((z-1.0)/1.6)**2<1;
   const point=surface((i+.5)/rows,u),angle=28*Math.PI/180,wy=23+Math.cos(angle)*point.y-Math.sin(angle)*point.z,wz=-11+Math.sin(angle)*point.y+Math.cos(angle)*point.z;
   const antennaExit=z>24&&point.x**2+(3*(wy-13)-wz)**2/10<1.7**2;
   kept[i][j]=!cheekWindow&&!arch&&!smallSideVent&&!roofVent&&!antennaExit;
  }
 }
 const quad=(a,b,c,d)=>indices.push(a,b,c,a,c,d);
 const border=new Map(),edge=(a,b)=>{if(!border.has(a))border.set(a,new Set());if(!border.has(b))border.set(b,new Set());border.get(a).add(b);border.get(b).add(a);};
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++)if(kept[i][j]){
  const a=i*stride+j,b=a+stride,c=b+1,d=a+1,k=layerSize;
  quad(a,b,c,d);quad(a+k,d+k,c+k,b+k);
  if(!kept[i-1]?.[j])quad(a,a+k,d+k,d);
  if(!kept[i+1]?.[j])quad(b,c,c+k,b+k);
  if(!kept[i]?.[j-1])quad(a,b,b+k,a+k);
  if(!kept[i]?.[j+1])quad(d,d+k,c+k,c);
  if(i>0&&!kept[i-1][j])edge(a,d);
  if(i<rows-1&&!kept[i+1][j])edge(b,c);
  if(j>0&&!kept[i][j-1])edge(a,b);
  if(j<cols-1&&!kept[i][j+1])edge(d,c);
 }
 // Round the sampled window edges without changing the outer silhouette or
 // mounting junctions. The inner edge follows, preserving wall thickness.
 for(let pass=0;pass<4;pass++){const before=positions.slice();for(const [vertex,neighbors]of border)if(neighbors.size===2){const [a,b]=neighbors;for(const layer of [0,layerSize])for(let axis=0;axis<3;axis++){const v=(vertex+layer)*3+axis;positions[v]=before[v]*.5+(before[(a+layer)*3+axis]+before[(b+layer)*3+axis])*.25;}}}
 const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));shell.setIndex(indices);shell.computeVertexNormals();mesh(hood,shell,materials.canopy,'Moulded_crown_with_arch_and_cheek_windows');
 const nose=new THREE.Shape(crown.getPoints(40).map(p=>new THREE.Vector2(p.x*.80,p.y)));nose.quadraticCurveTo(0,-13.2,-2.4,-12);nose.closePath();
 const aperture=new THREE.Path();aperture.absarc(0,0,4.50,0,Math.PI*2,true);nose.holes.push(aperture);
 for(const side of [-1,1]){const vent=new THREE.Path(shape(.95,2.3,.35).getPoints(12).map(p=>p.add(new THREE.Vector2(side*4.5,6.2))));nose.holes.push(vent);}
 const face=new THREE.ExtrudeGeometry(nose,{depth:.85,bevelEnabled:true,bevelSize:.22,bevelThickness:.15,bevelSegments:3,curveSegments:24});face.translate(0,0,-5.55);
 const facePositions=face.attributes.position,faceNormals=face.attributes.normal;for(let i=0;i<facePositions.count;i++){const x=facePositions.getX(i),y=facePositions.getY(i),nz=faceNormals.getZ(i);facePositions.setZ(i,facePositions.getZ(i)+.025*x*x+.006*(y-1)**2);const normal=new THREE.Vector3(faceNormals.getX(i)-.05*x*nz,faceNormals.getY(i)-.012*(y-1)*nz,nz).normalize();faceNormals.setXYZ(i,normal.x,normal.y,normal.z);}
 mesh(hood,face,materials.canopy,'Integrated_tapered_camera_nose');
 for(const side of [-1,1]){
  ring(canopy,2.8,.85,1.2,materials.canopy,'Canopy_mount_eyelet',side*18.38,12.1,0);screw(canopy,side*18.38,12.7,0);
  rod(hood,[side*6.2,-2.7,-3.5],[side*5.5,0,0],.7,materials.canopy,'Internal_camera_pivot_bracket');
 }
 ring(canopy,2.8,.85,1.2,materials.canopy,'Rear_mount_eyelet',0,12.1,18.38);screw(canopy,0,12.7,18.38);
 const oldCradle=camera.getObjectByName('Canopy_front_camera_cradle');oldCradle.geometry.dispose();oldCradle.removeFromParent();
 for(const name of ['FPV_lens_barrel','FPV_lens_front_bezel'])camera.getObjectByName(name).geometry.scale(1.18,1,1.18);
 camera.getObjectByName('FPV_multicoated_lens').geometry.scale(1.15,1,1.15);
 camera.position.set(0,23,-11);camera.name='Micro_FPV_camera';canopy.add(camera);wire(canopy,[[4,23,-8],[5.2,18,-5],[6,12.6,2]],.4,materials.black,'Camera_signal_wire');
 rod(canopy,[0,16,9],[0,21.5,25.5],1.3,materials.rubber,'VTX_antenna_heatshrink');rod(canopy,[0,21.3,25],[0,25.4,37.5],.3,materials.silver,'VTX_wire_radiator');
 const collar=ring(canopy,2.15,1.35,1.5,materials.canopy,'Moulded_antenna_guide',0,18.9,17.7);collar.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(0,1,3).normalize());
 const battery=assembly('75_06_1S_580mAh_battery',[0,-16,0]);batteryParts.push(battery);extrude(battery,shape(12.5,6.9,1.3),57,materials.cell,'1S_580mAh_pouch',0,2.3,0);for(const z of [-29.5,29.5])extrude(battery,shape(12.5,6.9,1.3),2,materials.black,'Battery_heatshrink_end',0,2.3,z);
 materials.label=addWhoopBatteryPrint(battery,{model:75,capacity:580,width:12.5,height:6.9,centerY:2.3,radius:1.3,length:54});
 for(const side of [-1,1]){wire(board,[[side*2,9.5,12],[side*5.5,9,18],[side*6,8,27],[side*2.8,6.5,33],[side*1.1,5.5,34]],.65,side<0?materials.black:materials.red,'AIO_BT2_pigtail');wire(battery,[[side*2,2.3,30.5],[side*2.8,2.3,33],[side*2.5,1.3,39],[side*1.1,3,43],[side*1.1,5.5,42],[side*1.1,5.5,40]],.55,side<0?materials.black:materials.red,'Battery_BT2_lead');const g=ring(battery,.8,.53,1.1,materials.rubber,'Pack_cable_exit',side*2,2.3,30.65);g.rotation.x=Math.PI/2;}
 box(board,4.7,3.2,4.4,materials.canopy,'BT2_socket_body',0,5.5,36.2);box(battery,4.7,3.2,3.5,materials.canopy,'BT2_mating_plug',0,5.5,40.15);box(battery,3.2,2.1,.7,materials.black,'BT2_join_seam',0,5.5,38.45);
 let meshes=0,triangles=0;const unique=new Set();root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;unique.add(o.material);}});
 function setExplode(v){for(const a of assemblies)a.group.position.copy(a.base).addScaledVector(a.delta,v);}function setWireframe(v){for(const m of unique)m.wireframe=v;}function setColor(hex){materials.frame.color.set(hex);applyBatteryLabelColor(root,hex);}
 return {root,assemblies,propellers,batteryParts,actionParts,materials,meshes,triangles:Math.round(triangles),setExplode,setWireframe,setColor};
}
