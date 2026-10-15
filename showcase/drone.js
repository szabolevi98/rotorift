// Saját, parametrikus modell. A geometria milliméterben épül, a gyökér méterre skáláz.
// A tárgy +Y irányban felfelé, -Z irányban előre mutat.
function createRiftX5() {
  const root = new THREE.Group();
  root.name = 'Rotorift_Rift_X5';
  root.scale.setScalar(0.001);
  root.userData = { designer: 'Rotorift', model: 'Rift X5', units: 'meters', propDiameterMm: 127, motorDiagonalMm: 230, battery: '6S 1300mAh', purpose: 'visual demo' };
  const assemblies = [], propellers = [], batteryParts = [], actionParts = [];
  const materials = {};

  function canvasTexture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }
  const carbonMap = canvasTexture((ctx) => {
    ctx.fillStyle = '#272b2d'; ctx.fillRect(0, 0, 512, 512);
    const tile = 16;
    for (let y = 0; y < 512; y += tile) for (let x = 0; x < 512; x += tile) {
      const horizontal = ((x / tile + y / tile) % 4) < 2;
      const gradient = ctx.createLinearGradient(x, y, x + (horizontal ? 0 : tile), y + (horizontal ? tile : 0));
      gradient.addColorStop(0, '#151a1c'); gradient.addColorStop(.45, '#353b3d'); gradient.addColorStop(1, '#202527');
      ctx.fillStyle = gradient; ctx.fillRect(x, y, tile, tile);
      ctx.strokeStyle = '#69707128'; ctx.lineWidth = .5;
      for (let f = 2; f < tile; f += 3) {
        ctx.beginPath();
        if (horizontal) { ctx.moveTo(x, y + f); ctx.lineTo(x + tile, y + f); }
        else { ctx.moveTo(x + f, y); ctx.lineTo(x + f, y + tile); }
        ctx.stroke();
      }
    }
  });
  carbonMap.wrapS = carbonMap.wrapT = THREE.RepeatWrapping;
  materials.carbon = new THREE.MeshStandardMaterial({ color: '#c1c5c4', map: carbonMap, metalness: .36, roughness: .44 });
  materials.carbonEdge = new THREE.MeshStandardMaterial({ color: '#303437', metalness: .22, roughness: .64 });
  materials.black = new THREE.MeshStandardMaterial({ color: '#202729', metalness: .7, roughness: .32 });
  materials.rubber = new THREE.MeshStandardMaterial({ color: '#171c1b', roughness: .93 });
  materials.tpu = new THREE.MeshPhysicalMaterial({ color: '#ff6648', roughness: .65, metalness: 0, specularIntensity: .12, toneMapped: false });
  configureDronePolymer(materials.tpu);
  materials.tpuDetail = new THREE.MeshStandardMaterial({ color: '#9e3d2b', roughness: .65, metalness: 0 });
  materials.silver = new THREE.MeshStandardMaterial({ color: '#a4adb0', metalness: .94, roughness: .25 });
  materials.copper = new THREE.MeshStandardMaterial({ color: '#b96c35', metalness: .78, roughness: .3 });
  materials.gold = new THREE.MeshStandardMaterial({ color: '#c3a360', metalness: .85, roughness: .32 });
  materials.connectorYellow = new THREE.MeshStandardMaterial({ color: '#ffc000', metalness: 0, roughness: .7 });
  materials.antennaShell = new THREE.MeshStandardMaterial({ color: '#16191b', metalness: .12, roughness: .52 });
  materials.pcb = new THREE.MeshStandardMaterial(DRONE_SURFACES.pcb);
  materials.chip = new THREE.MeshStandardMaterial({ color: '#101718', metalness: .1, roughness: .73 });
  materials.prop = new THREE.MeshPhysicalMaterial({ color: '#263e3b', metalness: 0, roughness: .3, transparent: true, opacity: .9, side: THREE.DoubleSide, clearcoat: .65, clearcoatRoughness: .28, depthWrite: false });
  materials.glass = new THREE.MeshPhysicalMaterial(DRONE_SURFACES.lens);
  materials.battery = new THREE.MeshStandardMaterial({ color: '#303b40', metalness: .28, roughness: .43 });
  materials.redWire = new THREE.MeshStandardMaterial({ color: '#c44232', roughness: .66 });
  materials.videoWire = new THREE.MeshStandardMaterial({ color: '#e5b52a', roughness: .7 });
  materials.white = new THREE.MeshStandardMaterial({ color: '#c8c9ba', roughness: .5 });
  materials.led = new THREE.MeshStandardMaterial({ color: '#8ce9b6', emissive: '#50cc87', emissiveIntensity: 1.3 });

  function mesh(parent, geometry, material, name, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, material);
    object.name = name; object.position.set(x, y, z);
    object.castShadow = true; object.receiveShadow = true;
    parent.add(object); return object;
  }
  function box(parent, w, h, d, mat, name, x = 0, y = 0, z = 0) {
    return mesh(parent, new THREE.BoxGeometry(w, h, d), mat, name, x, y, z);
  }
  function roundedShape(w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    const s = new THREE.Shape(), a = -w / 2, b = -h / 2;
    s.moveTo(a + r, b); s.lineTo(a + w - r, b); s.quadraticCurveTo(a + w, b, a + w, b + r);
    s.lineTo(a + w, b + h - r); s.quadraticCurveTo(a + w, b + h, a + w - r, b + h);
    s.lineTo(a + r, b + h); s.quadraticCurveTo(a, b + h, a, b + h - r);
    s.lineTo(a, b + r); s.quadraticCurveTo(a, b, a + r, b);
    return s;
  }
  function rounded(parent, w, h, d, r, mat, name, x = 0, y = 0, z = 0) {
    const g = new THREE.ExtrudeGeometry(roundedShape(w, h, r), { depth: d, bevelEnabled: false, curveSegments: 5 });
    g.translate(0, 0, -d / 2);
    return mesh(parent, g, mat, name, x, y, z);
  }
  function beveled(parent, w, h, d, r, mat, name, x=0, y=0, z=0, bevel=.45) {
    const geometry = new THREE.ExtrudeGeometry(roundedShape(w-2*bevel,h-2*bevel,r-bevel), {
      depth:d-2*bevel, bevelEnabled:true, bevelSize:bevel, bevelThickness:bevel, bevelSegments:3, curveSegments:8,
    });
    geometry.translate(0,0,-(d-2*bevel)/2);
    return mesh(parent,geometry,mat,name,x,y,z);
  }
  function sideProfile(parent, points, holes, thickness, x, name, material=materials.tpu) {
    const shape = new THREE.Shape();
    points.forEach(([z,y],i) => i ? shape.lineTo(-z,y) : shape.moveTo(-z,y)); shape.closePath();
    for(const {z,y,r} of holes) { const h=new THREE.Path(); h.absarc(-z,y,r,0,Math.PI*2,true); shape.holes.push(h); }
    const g=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelSize:.25,bevelThickness:.25,bevelSegments:2,curveSegments:20});
    g.translate(0,0,-thickness/2); g.rotateY(Math.PI/2);
    return mesh(parent,g,material,name,x);
  }
  function sleeve(parent,w,h,d,r,innerW,innerH,innerR,mat,name,x=0,y=0,z=0) {
    const shape=roundedShape(w,h,r); shape.holes.push(roundedShape(innerW,innerH,innerR));
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelSize:.22,bevelThickness:.22,bevelSegments:2,curveSegments:10});
    geometry.translate(0,0,-d/2); return mesh(parent,geometry,mat,name,x,y,z);
  }
  function ringWasher(parent,outer,inner,height,x,y,z,name,material=materials.rubber) {
    const shape=new THREE.Shape(); shape.absarc(0,0,outer,0,Math.PI*2,false); shape.holes.push(circleHole(0,0,inner));
    const object=tpuExtrusion(parent,shape,height,y,name,material,0); object.position.set(x,y,z); return object;
  }
  function cylinder(parent, rt, rb, h, mat, name, x = 0, y = 0, z = 0, segments = 24) {
    return mesh(parent, new THREE.CylinderGeometry(rt, rb, h, segments), mat, name, x, y, z);
  }
  function torus(parent, radius, tube, mat, name, x = 0, y = 0, z = 0) {
    const m = mesh(parent, new THREE.TorusGeometry(radius, tube, 6, 32), mat, name, x, y, z);
    m.rotation.x = Math.PI / 2; return m;
  }
  function wire(parent, points, radius, material, name, segments = 22) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return mesh(parent, new THREE.TubeGeometry(curve, segments, radius, 6, false), material, name);
  }
  function circleHole(x, z, r) {
    const hole = new THREE.Path(); hole.absarc(x, -z, r, 0, Math.PI * 2, true); return hole;
  }
  function slotHole(x, z, w, d) {
    const hole = roundedShape(w, d, Math.min(2, w / 3, d / 3));
    // Shape és Path egyaránt használható belső kontúrként.
    hole.curves.forEach(curve => {
      for (const key of ['v0', 'v1', 'v2', 'v3']) if (curve[key]) { curve[key].x += x; curve[key].y -= z; }
    });
    return hole;
  }
  function plate(parent, points, holes, y, thickness, name) {
    const shape = new THREE.Shape();
    points.forEach((p, i) => i ? shape.lineTo(p[0], -p[1]) : shape.moveTo(p[0], -p[1])); shape.closePath();
    shape.holes = holes;
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 12 });
    geometry.rotateX(-Math.PI / 2);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 45, uv.getY(i) / 45);
    uv.needsUpdate = true;
    return mesh(parent, geometry, [materials.carbon, materials.carbonEdge], name, 0, y, 0);
  }
  function screw(parent, x, y, z, size = 1.6) {
    cylinder(parent, size, size, .95, materials.black, 'Socket_head_screw', x, y, z, 12);
    cylinder(parent, size * .45, size * .45, .09, materials.silver, 'Hex_socket_recess', x, y + .51, z, 6);
  }
  function assembly(name, offset = [0, 0, 0], explode = [0, 0, 0]) {
    const group = new THREE.Group(); group.name = name; group.position.set(...offset); root.add(group);
    assemblies.push({ group, base: group.position.clone(), delta: new THREE.Vector3(...explode) });
    return group;
  }
  function tpuExtrusion(parent, shape, height, y, name, material = materials.tpu, bevel = .3) {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height, curveSegments: 28, bevelEnabled: bevel > 0,
      bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2,
    });
    geometry.rotateX(-Math.PI / 2);
    return mesh(parent, geometry, material, name, 0, y, 0);
  }
  function annularSector(outer, inner, start, end) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, start, end, false);
    shape.lineTo(Math.cos(end) * inner, Math.sin(end) * inner);
    shape.absarc(0, 0, inner, end, start, true);
    shape.closePath(); return shape;
  }
  function motorProtector(parent, motorX, motorZ) {
    const group = new THREE.Group(); group.name = 'TPU_motor_protector'; parent.add(group);
    // Furatolt alsó talp: szerelőnyílás és a négy motorcsavar helye.
    const base = new THREE.Shape(); base.absarc(0, 0, 15.8, 0, Math.PI * 2, false);
    base.holes.push(circleHole(0, 0, 4.4));
    for (const a of [-1, 1]) for (const b of [-1, 1]) base.holes.push(circleHole(a * 5.65, b * 5.65, 1.8));
    tpuExtrusion(group, base, 2.5, -.8, 'TPU_perforated_mounting_saddle', materials.tpu, .35);
    // A karbonkar felé nyitott perem, így a kar nem metszi a védőt.
    const inward = Math.atan2(motorZ, -motorX);
    const start = inward + .53, end = inward + Math.PI * 2 - .53;
    tpuExtrusion(group, annularSector(16, 13.3, start, end), 5.4, 1.7, 'TPU_open_wraparound_bumper', materials.tpu, .45);
    tpuExtrusion(group, annularSector(16.15, 13.15, start, end), .7, 6.6, 'TPU_rounded_protective_lip', materials.tpu, .22);
    // Finom nyomtatási rétegillesztések és vastagabb ütközőbordák.
    for (const y of [2.8, 4.1, 5.4]) {
      tpuExtrusion(group, annularSector(16.05, 15.85, start + .02, end - .02), .16, y, 'TPU_print_layer_groove', materials.tpuDetail, 0);
    }
    for (const t of [.12, .5, .88]) {
      const angle = start + (end - start) * t;
      const rib = rounded(group, 2.2, 6, 2.1, .8, materials.tpu, 'TPU_impact_rib', Math.cos(angle) * 15.9, 4.1, -Math.sin(angle) * 15.9);
      rib.rotation.y = angle;
    }
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      // Alulról látható csavarfejek, fekete süllyesztett peremmel.
      cylinder(group, 2.3, 2.3, .3, materials.rubber, 'Recessed_motor_screw_seat', a * 5.65, -1.28, b * 5.65, 16);
      cylinder(group, 1.4, 1.4, .4, materials.silver, 'Motor_mount_screw_head', a * 5.65, -1.45, b * 5.65, 6);
    }
    for (const side of [-1, 1]) rounded(group, 3.8, 1.1, 9, .5, materials.rubber, 'TPU_skid_contact_pad', side * 10.2, -1.5, 0);
  }
  function label(parent, text, sub, width, height, x, y, z, rotation = [-Math.PI / 2, 0, 0], color = '#e8e9dc') {
    const map = canvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#263135'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ed6848'; ctx.fillRect(0, 0, 13, h);
      ctx.fillStyle = color; ctx.font = 'bold 65px Arial'; ctx.fillText(text, 35, 92);
      ctx.font = '24px Arial'; ctx.fillStyle = '#a3b0ab'; ctx.fillText(sub, 35, 139);
      ctx.fillStyle = '#788e84'; ctx.fillRect(35, 162, 390, 3);
      ctx.font = '18px monospace'; ctx.fillText('ROTORIFT / FLIGHT SERIES', 35, 199);
    }, 512, 224);
    const material = new THREE.MeshStandardMaterial({ map, roughness: .61, metalness: .1 });
    const m = mesh(parent, new THREE.PlaneGeometry(width, height), material, `Label_${text}`, x, y, z);
    m.rotation.set(...rotation); m.castShadow = false; return m;
  }

  // Karbon középlemezek, valódi furatokkal és hosszúkás kivágásokkal.
  const bottom = assembly('01_Lower_carbon_frame', [0, 0, 0], [0, -9, 0]);
  const rearExtension=30;
  const outline = [[-13,-61],[13,-61],[20,-50],[20,-30],[24,-19],[24,21],[22,37],[21,68],[19,81],[12,88],[-12,88],[-19,81],[-21,68],[-22,37],[-24,21],[-24,-19],[-20,-30],[-20,-50]];
  const mounting = [[-15,-37],[15,-37],[-15,66],[15,66]];
  const vtxMounting=[-9,9].flatMap(x=>[41,61].map(z=>[x,z]));
  plate(bottom, outline, [...mounting.map(p=>circleHole(...p,1.6)),...vtxMounting.map(p=>circleHole(...p,1.2)),...[-7,7].map(x=>circleHole(x,86.5,1.2)),circleHole(0,74,4),slotHole(0,-41,8,14)], 7, 2.5, 'Bottom_plate_2_5mm');
  root.userData.centralBodyLengthMm=149;root.userData.rearExtensionMm=rearExtension;
  const stackCenterZ=0;
  root.userData.stackCenterMm=[0,stackCenterZ];
  const stackMounting=[-1,1].flatMap(side=>[-1,1].map(end=>[side*15.25,stackCenterZ+end*15.25]));
  plate(bottom, [[-23,-25],[23,-25],[23,25],[-23,25]], [circleHole(0,0,8),...stackMounting.map(p=>circleHole(...p,1.2))], 9.5, 2, 'Arm_lock_plate');
  for (const [x,z] of mounting) {
    cylinder(bottom,2.7,2.7,27.5,materials.black,'Frame_aluminum_standoff',x,23.25,z,12);
    cylinder(bottom,1.2,1.2,32.5,materials.silver,'Standoff_bolt_shaft',x,23.25,z,12);
    for(const y of [9.5,36.3]) cylinder(bottom,3,3,.7,materials.black,'Standoff_seating_flange',x,y+.35,z,16);
    const head=cylinder(bottom,2.5,2.5,1.3,materials.black,'Underside_frame_bolt',x,6.35,z,12);
    cylinder(bottom,1.05,1.05,.12,materials.silver,'Underside_hex_socket',x,5.65,z,6);
  }
  for (const x of [-13,13]) for (const z of [-22,22]) {
    cylinder(bottom,1.25,1.25,9.5,materials.silver,'Arm_clamp_bolt_shaft',x,6.75,z,12);
    screw(bottom,x,12,z);
  }
  const upper = assembly('02_Upper_carbon_plate', [0,0,0], [0,39,0]);
  const topOutline = [[-12,-58],[12,-58],[17,-49],[17,-28],[20,-18],[20,18],[20,34],[19,60],[17,80],[11,86],[-11,86],[-17,80],[-19,60],[-20,34],[-20,18],[-20,-18],[-17,-28],[-17,-49]];
  plate(upper, topOutline, [...mounting.map(p=>circleHole(...p,1.6)),...[-11,11].map(x=>circleHole(x,61,1.2)),slotHole(0,-45,7,13),slotHole(0,47,14,12),slotHole(-9,72,5,18),slotHole(9,72,5,18),slotHole(-11,0,4,21),slotHole(11,0,4,21)], 37, 2.5, 'Slotted_top_plate');
  for (const [x,z] of mounting) screw(upper,x,40,z);
  beveled(upper,32,2.5,70,1,materials.rubber,'Anti_slip_battery_pad',0,40.75,5,.2);

  // ESC és flight controller: soft mount, csatlakozók, chipek és kondenzátorok.
  const electronics = assembly('03_Flight_controller_and_ESC', [0,0,0], [0,17,0]);
  for (const y of [17,25]) {
    const shape=roundedShape(37,37,3); for(const [x,z] of stackMounting) shape.holes.push(circleHole(x,z-stackCenterZ,2.15));
    tpuExtrusion(electronics,shape,1.5,y-.75,y===17?'4in1_ESC_board':'Flight_controller_board',materials.pcb,0).position.z=stackCenterZ;
  }
  for(const [x,z] of stackMounting) {
    cylinder(electronics,1.1,1.1,19,materials.silver,'Continuous_stack_bolt',x,19,z,12);
    ringWasher(electronics,2.7,1.15,4.75,x,11.5,z,'ESC_lower_soft_mount');
    ringWasher(electronics,2.1,1.15,1.5,x,16.25,z,'ESC_through_board_grommet');
    ringWasher(electronics,2.7,1.15,6.5,x,17.75,z,'FC_ESC_continuous_spacer');
    ringWasher(electronics,2.1,1.15,1.5,x,24.25,z,'FC_through_board_grommet');
    ringWasher(electronics,2.8,1.15,.9,x,25.75,z,'FC_top_grommet_lip');
    cylinder(electronics,2.25,2.25,1.8,materials.black,'Stack_locknut',x,27.55,z,6);
  }
  box(electronics,9,1.9,9,materials.chip,'Flight_controller_MCU',0,26.7,stackCenterZ);
  box(electronics,4,1.5,4,materials.silver,'Gyroscope',9,26.5,stackCenterZ-1);
  for (const x of [-10,10]) for (const z of [stackCenterZ-9,stackCenterZ+9]) box(electronics,6,1.7,5,materials.chip,'ESC_MOSFET',x,18.6,z);
  for (let i=0;i<7;i++) {
    box(electronics,1.8,.6,2.5,materials.gold,'Solder_pad',-13+i*4.3,26.05,stackCenterZ-15.5);
    box(electronics,1.6,.7,1,materials.white,'SMD_component',-12+i*4,26.1,stackCenterZ+9);
  }
  rounded(electronics,7,3,4,1,materials.silver,'USB_C_port',18,26,stackCenterZ);
  rounded(electronics,4.5,1.8,4.1,.5,materials.chip,'USB_C_socket',18.4,26,stackCenterZ);
  box(electronics,1.5,1,1.5,materials.led,'Status_LED',-9,26.25,stackCenterZ);
  for(const y of [18.6,26.65]) {
    beveled(electronics,8,1.8,3, .5,materials.white,'Stack_harness_socket',0,y,stackCenterZ+15,.18);
  }
  for(let i=0;i<6;i++) wire(electronics,[[-3+i*1.2,18.6,stackCenterZ+16.5],[-3+i*1.2,20,stackCenterZ+20],[-3+i*1.2,24,stackCenterZ+20],[-3+i*1.2,26.65,stackCenterZ+16.5]],.25,i===0?materials.redWire:materials.rubber,'ESC_FC_ribbon_wire');
  const vtxBay=new THREE.Group();vtxBay.name='Extended_rear_video_and_capacitor_bay';vtxBay.position.z=18;electronics.add(vtxBay);
  const trayShape=roundedShape(25.5,26.5,3); for(const x of [-9,9]) for(const z of [-11,9]) trayShape.holes.push(circleHole(x,z,1.2));
  tpuExtrusion(vtxBay,trayShape,3,9.5,'VTX_bolted_TPU_tray').position.z=34;
  beveled(vtxBay,23,1.5,25,1,materials.rubber,'VTX_isolation_pad',0,13.25,34,.2);
  beveled(vtxBay,23,10,25,1.4,materials.antennaShell,'Rear_video_transmitter',0,19,34);
  for(const x of [-9,9]) for(const z of [23,43]){
    cylinder(vtxBay,.9,.9,5.7,materials.silver,'VTX_tray_through_bolt',x,10.1,z,12);screw(vtxBay,x,13,z,1.3);
  }
  for(const z of [28,40]) sleeve(vtxBay,26,13,2.5,2,23.3,10.3,1.5,materials.rubber,'VTX_retention_band',0,19,z);
  for (let i=0;i<7;i++) box(vtxBay,18,.65,.8,materials.black,'VTX_cooling_fin',0,24.25,26+i*2.5);
  beveled(vtxBay,3,2.5,5,.5,materials.silver,'VTX_service_port',12,19,28,.2);
  const coax=cylinder(vtxBay,2.3,2.3,3,materials.gold,'VTX_coax_connector',0,20,48,16); coax.rotation.x=Math.PI/2;
  beveled(vtxBay,12,2,10,.8,materials.tpu,'Capacitor_TPU_saddle',-8,13,53,.2);
  const capacitor = cylinder(vtxBay,4.8,4.8,11,materials.black,'Low_ESR_capacitor',-8,18,53);
  capacitor.rotation.x = Math.PI/2;
  mesh(vtxBay,new THREE.TorusGeometry(4.9,.65,8,32),materials.rubber,'Capacitor_retaining_band',-8,18,53);
  const capEnd = cylinder(vtxBay,4.5,4.5,.5,materials.silver,'Capacitor_end',-8,18,47.4);
  capEnd.rotation.x = Math.PI/2;
  box(vtxBay,6,.16,.45,materials.black,'Capacitor_pressure_vent',-8,18,47.1).rotation.x=Math.PI/2;
  for(const [x,mat] of [[-7,materials.redWire],[-9,materials.rubber]]) wire(electronics,[[x,18,76.5],[x,18,79],[x,27,79],[x,28,65],[x,28,42],[-12,24,32],[-12,14.5,stackCenterZ+28],[x===-7?8:-8,17.9,stackCenterZ+16]],.55,mat,'Capacitor_ESC_lead',64);
  beveled(vtxBay,7,2.5,3,.5,materials.white,'VTX_control_socket',0,19,21,.2);
  for(let i=0;i<4;i++) wire(electronics,[[-2.1+i*1.4,26.1,stackCenterZ+17],[-2.1+i*1.4,27,27],[-2.1+i*1.4,27,33],[-2.1+i*1.4,19,38]],.3,i===0?materials.redWire:materials.rubber,'VTX_control_harness',40);
  for(const x of [-8,8]) box(electronics,4,.3,3,materials.gold,'ESC_battery_solder_pad',x,17.9,stackCenterZ+16);

  const motorX = 86, motorZ = Math.sqrt(115*115-86*86);
  const motors = [];
  for (const side of [-1,1]) for (const fore of [-1,1]) {
    const x = side*motorX, z = fore*motorZ, index = motors.length+1;
    const motor = assembly(`Motor_${index}_2207`, [x,0,z], [side*17,15,fore*15]);
    motors.push(motor);
    const arm = assembly(`Carbon_arm_${index}_5mm`, [0,0,0], [side*9,0,fore*9]);
    const start = new THREE.Vector2(side*13,fore*15), end = new THREE.Vector2(x,z);
    const dir = end.clone().sub(start).normalize(), perp = new THREE.Vector2(-dir.y,dir.x);
    const p=(base,offset)=>[base.x+perp.x*offset,base.y+perp.y*offset];
    const near=end.clone().addScaledVector(dir,-13), tip=end.clone().addScaledVector(dir,11);
    plate(arm,[p(start,-8),p(near,-7),p(tip,-9),p(tip,9),p(near,7),p(start,8)], [circleHole(x,z,3),...[-1,1].flatMap(a=>[-1,1].map(b=>circleHole(x+a*5.65,z+b*5.65,1.35)))], 2, 5, `Replaceable_carbon_arm_${index}`);
    for (const shift of [-2,0,2]) {
      // A forrasztási bankok az ESC közepéhez igazodnak, a sarokbakok között.
      const padZ=stackCenterZ+fore*6+shift;
      box(electronics,2,.3,2,materials.gold,'ESC_motor_solder_pad',side*17.5,17.9,padZ);
      const solder=mesh(electronics,new THREE.SphereGeometry(.95,12,8),materials.silver,`Motor_phase_solder_joint_${index}_${shift}`,side*17.5,18.35,padZ);
      solder.scale.y=.55;
      wire(arm,[[side*17.5,18.75,padZ],[side*31,9,fore*26+shift],[x*.75,7.7,z*.75+shift],[x-side*9,8.3,z+shift]],.7,materials.rubber,`Motor_wire_${index}_${shift}`);
    }
    const wireClamp=sleeve(arm,16,4.5,3,1,9,2.8,.6,materials.rubber,'Arm_wire_retaining_clip',x*.6,8.4,z*.6);
    wireClamp.rotation.y=Math.atan2(dir.x,dir.y);
    motorProtector(motor, x, z);
    cylinder(motor,10,10,2,materials.black,'Motor_base',0,8,0);
    cylinder(motor,8.8,8.8,9,materials.chip,'Stator_core',0,13.5,0);
    for(let c=0;c<12;c++) {
      const a=c/12*Math.PI*2;
      const coil=box(motor,2.7,6.8,3.5,materials.copper,'Copper_winding',Math.cos(a)*8,14.2,Math.sin(a)*8);
      coil.rotation.y=-a;
    }
    mesh(motor,new THREE.CylinderGeometry(12.5,12.5,9,32,1,true),materials.black,'Open_motor_bell',0,15.5,0);
    torus(motor,11.8,.65,materials.tpu,'Motor_accent_ring',0,11,0);
    torus(motor,11.9,.8,materials.black,'Bell_top_ring',0,20,0);
    cylinder(motor,4.5,4.5,2,materials.black,'Bell_center',0,20.4,0);
    for(let s=0;s<7;s++) {
      const a=s/7*Math.PI*2;
      const spoke=box(motor,9,1.5,2.3,materials.black,'Ventilated_bell_spoke',Math.cos(a)*7.5,20,Math.sin(a)*7.5);
      spoke.rotation.y=-a;
    }
    cylinder(motor,2.4,2.4,9,materials.silver,'Motor_shaft',0,24,0);
    for(const a of [-1,1]) for(const b of [-1,1]) screw(motor,a*5.65,7.6,b*5.65,1.3);
    const prop = assembly(`Propeller_${index}_${side===fore?'CW':'CCW'}`, [x,24,z], [side*17,50,fore*15]);
    propellers.push({ group:prop, direction:side===fore?1:-1 });
    cylinder(prop,6,6,3,materials.prop,'Prop_hub');
    for(let b=0;b<3;b++) {
      const blade=mesh(prop,bladeGeometry(side===fore?1:-1),materials.prop,`Twisted_blade_${b+1}`);
      blade.rotation.y=b*Math.PI*2/3;
    }
    cylinder(prop,4.2,4.2,3.6,materials.black,'M5_prop_nut',0,3,0,6);
    cylinder(prop,2,2,.4,materials.silver,'Shaft_tip',0,5,0,12);
    prop.rotation.y = index*.52;
  }

  // Az ötcolos propeller nem sík lap: keskenyedő, csavart, kétoldali térbeli felület.
  function bladeGeometry(direction) {
    const positions=[],uvs=[],indices=[],sections=22,across=6;
    for(let layer=0;layer<2;layer++) for(let i=0;i<=sections;i++) {
      const t=i/sections, radius=5.3+t*58.2;
      const chord=(5+14*Math.sin(Math.PI*Math.pow(t,.72)))*(1-.65*Math.pow(t,7));
      const sweep=direction*(2+10*t*t);
      const pitch=(.57-.42*t)*direction;
      for(let j=0;j<=across;j++) {
        const v=j/across-.5;
        const camber=1.2*Math.sin((v+.5)*Math.PI)*(1-t*.65);
        positions.push(radius,Math.sin(pitch)*chord*v+camber+(layer===0?.35:-.35),sweep+Math.cos(pitch)*chord*v);
        uvs.push(t,j/across);
      }
    }
    const stride=across+1, face=(sections+1)*stride;
    for(let layer=0;layer<2;layer++) for(let i=0;i<sections;i++) for(let j=0;j<across;j++) {
      const a=layer*face+i*stride+j,b=a+1,c=a+stride,d=c+1;
      if(layer===0) indices.push(a,c,b,b,c,d); else indices.push(a,b,c,b,d,c);
    }
    for(let i=0;i<sections;i++) for(const j of [0,across]) {
      const a=i*stride+j,b=a+stride; indices.push(a,a+face,b,b,a+face,b+face);
    }
    for(const i of [0,sections]) for(let j=0;j<across;j++) {
      const a=i*stride+j,b=a+1; indices.push(a,b,a+face,b,b+face,a+face);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  }

  // Orr: döntött FPV kamera, valódi lencsetubus és oldalsó kameravédők.
  const front = assembly('04_FPV_camera_and_cage', [0,0,0], [0,6,-32]);
  for(const side of [-1,1]) {
    sideProfile(front,[[-62,13],[-59,10],[-36,10],[-33,14],[-33,35],[-37,38],[-49,38],[-61,31]],
      [{z:-50,y:25,r:2.4},{z:-40,y:18,r:3.4},{z:-42,y:32,r:2.3}],3.2,side*13.3,'Contoured_FPV_TPU_side_guard');
    sideProfile(front,[[-57,14],[-35,14],[-35,34],[-43,36],[-57,30]],
      [{z:-50,y:25,r:2.2},{z:-40,y:18,r:3.4},{z:-42,y:32,r:2.3}],.65,side*15.1,'FPV_guard_reinforcement',materials.carbonEdge);
    const damper=cylinder(front,2.6,2.6,2.5,materials.rubber,'FPV_camera_side_damper',side*10.7,25,-50,20); damper.rotation.z=Math.PI/2;
    const shaft=cylinder(front,1.3,1.3,7,materials.silver,'FPV_camera_pivot_shaft',side*12.5,25,-50,12); shaft.rotation.z=Math.PI/2;
    const bolt=cylinder(front,2.7,2.7,1.3,materials.black,'Camera_tilt_bolt',side*16,25,-50,12); bolt.rotation.z=Math.PI/2;
    const socket=cylinder(front,1.15,1.15,.14,materials.silver,'Camera_tilt_hex_socket',side*16.75,25,-50,6); socket.rotation.z=Math.PI/2;
    beveled(front,6,2,12,1,materials.tpu,'FPV_guard_frame_foot',side*13.3,10.5,-40,.25);
    screw(front,side*13.3,12,-42,1.4);
  }
  const noseShape=roundedShape(31,10,3); noseShape.holes.push(slotHole(0,0,23,5));
  tpuExtrusion(front,noseShape,3,9.5,'Connected_FPV_nose_bumper').position.z=-59;
  const fpv=new THREE.Group(); fpv.name='FPV_camera_25deg'; fpv.position.set(0,25,-50); fpv.rotation.x=25*Math.PI/180; front.add(fpv);
  beveled(fpv,19,19,15,2.4,materials.antennaShell,'FPV_camera_housing');
  for(const side of [-1,1]) { const boss=cylinder(fpv,2.4,2.4,1,materials.black,'FPV_camera_threaded_boss',side*9.4,0,0,16); boss.rotation.z=Math.PI/2; }
  for(const [r,d,z] of [[8,4,-9],[6.6,3,-12],[5.4,1,-14]]) {
    const lens=cylinder(fpv,r,r,d,materials.black,'FPV_lens_barrel',0,0,z,32); lens.rotation.x=Math.PI/2;
  }
  const glass=cylinder(fpv,4.9,4.9,.7,materials.glass,'FPV_coated_lens',0,0,-14.8,32); glass.rotation.x=Math.PI/2;
  const glint=mesh(fpv,new THREE.SphereGeometry(1.15,10,8),new THREE.MeshStandardMaterial({color:'#7293b1',metalness:.8,roughness:.05}),'Lens_reflection',-1.9,1.5,-15.3); glint.scale.z=.14;
  beveled(fpv,7,3,2,.5,materials.white,'FPV_camera_rear_socket',0,0,8,.2);
  beveled(fpv,5.8,2.4,2,.4,materials.white,'FPV_camera_three_pin_plug',0,0,9.7,.15);
  beveled(electronics,7,2.4,3,.5,materials.white,'FC_camera_socket',0,26.9,stackCenterZ-16,.2);
  beveled(electronics,5.8,1.9,2,.35,materials.white,'FC_camera_three_pin_plug',0,26.9,stackCenterZ-18.2,.15);
  for(const [i,name,mat]of [[0,'5V',materials.redWire],[1,'GND',materials.rubber],[2,'VIDEO',materials.videoWire]]){
    const x=(i-1)*1.6;
    box(fpv,.95,1.1,.08,materials.rubber,'Camera_'+name+'_plug_cavity',x,0,10.72);
    box(electronics,.95,1.1,.08,materials.rubber,'FC_camera_'+name+'_plug_cavity',x,26.9,stackCenterZ-19.22);
    const start=new THREE.Vector3(x,0,10.78).applyQuaternion(fpv.quaternion).add(fpv.position);
    wire(front,[start.toArray(),[x+4,21,-34],[x+5,23,-27],[x,26.9,stackCenterZ-22],[x,26.9,stackCenterZ-19.26]],.3,mat,'FPV_camera_'+name+'_wire',32);
    // Exposed PCB legs anchor the board connector rather than floating above it.
    box(electronics,.5,.3,1.4,materials.gold,'FC_camera_'+name+'_socket_pin',x,25.8,stackCenterZ-14.1);
    const solder=mesh(electronics,new THREE.SphereGeometry(.5,8,5),materials.silver,'FC_camera_'+name+'_socket_solder',x,25.92,stackCenterZ-13.65);solder.scale.y=.45;
  }

  // 6S LiPo, vékonyrétegű burkolat, két tépőzáras pánt és saját címkék.
  const battery=assembly('05_6S_battery_and_straps',[0,0,0],[0,74,3]); batteryParts.push(battery);
  beveled(battery,38,39,74,3.2,materials.battery,'6S_1300mAh_LiPo',0,61.5,6);
  for(const z of [-29,41]) beveled(battery,38.2,35,3,2.7,materials.rubber,'Battery_end_protection',0,61.5,z);
  for(let i=0;i<6;i++) box(battery,.2,5.8,64,materials.carbonEdge,'Cell_seam',19.1,45.5+i*6.1,6);
  label(battery,'RIFT / 6S','1300 mAh · 22.2 V',33,16,0,81.1,7);
  // Az akku hátlapján külön, furatolt kábelkivezetés marad a címke alatt.
  const packEnd=roundedShape(37,35,2.7);
  for(const x of [10,16]) { const port=new THREE.Path();port.absarc(x,-4.5,1.9,0,Math.PI*2,true);packEnd.holes.push(port); }
  const balancePort=new THREE.Path(roundedShape(8.6,2.6,.8).getPoints(12).map(p=>p.add(new THREE.Vector2(-10,-9.5))));
  balancePort.closePath();packEnd.holes.push(balancePort);
  const packEndGeometry=new THREE.ExtrudeGeometry(packEnd,{depth:1.1,bevelEnabled:false,curveSegments:20});
  mesh(battery,packEndGeometry,materials.rubber,'Battery_molded_cable_exit_endcap',0,61.5,42.95);
  label(battery,'6S','FLIGHT PACK',25,9,0,72.2,44.1,[0,0,0]);
  for(const x of [10,16]) {
    const grommet=new THREE.Shape();grommet.absarc(0,0,2.35,0,Math.PI*2,false);
    const bore=new THREE.Path();bore.absarc(0,0,1.7,0,Math.PI*2,true);grommet.holes.push(bore);
    mesh(battery,new THREE.ExtrudeGeometry(grommet,{depth:3.3,bevelEnabled:false,curveSegments:24}),materials.rubber,'Battery_power_exit_grommet',x,57,43.55);
    sleeve(battery,5.2,5.2,.6,2,3.5,3.5,1.5,materials.rubber,'Battery_power_grommet_flange',x,57,44.1);
  }
  sleeve(battery,8.6,2.6,3.6,.8,7.2,1.3,.4,materials.rubber,'Battery_balance_bundle_strain_relief',-10,52,45.5);
  sleeve(battery,9.6,3.6,.65,1.1,7.2,1.3,.4,materials.rubber,'Battery_balance_exit_flange',-10,52,44.1);
  for(const z of [-17,28]) {
    const beltShape=roundedShape(42.4,43.6,5);
    beltShape.holes.push(roundedShape(38.2,39.6,3.5));
    const beltGeo=new THREE.ExtrudeGeometry(beltShape,{depth:13,bevelEnabled:false,curveSegments:8}); beltGeo.translate(0,61.3,-6.5);
    mesh(battery,beltGeo,materials.rubber,'Woven_battery_strap',0,0,z);
    const buckleShape=roundedShape(8,12,1); buckleShape.holes.push(roundedShape(4.8,8.5,.8));
    const buckleGeo=new THREE.ExtrudeGeometry(buckleShape,{depth:2,bevelEnabled:false});
    const buckle=mesh(battery,buckleGeo,materials.silver,'Strap_buckle',20.4,65.5,z); buckle.rotation.y=Math.PI/2;
    box(battery,5,.15,9,materials.tpu,'Strap_tag',-11,83.15,z);
  }
  function xt60(parent,position,batterySide) {
    const group=new THREE.Group(); group.name=batterySide?'XT60_battery_socket_half':'XT60_ESC_plug_half'; group.position.set(...position); parent.add(group);
    const shape=new THREE.Shape(); shape.moveTo(-7,-4);shape.lineTo(7,-4);shape.lineTo(7,1.8);shape.lineTo(4.8,4);shape.lineTo(-4.8,4);shape.lineTo(-7,1.8);shape.closePath();
    for(const x of [-3.5,3.5]) { const hole=new THREE.Path();hole.absarc(x,0,1.85,0,Math.PI*2,true);shape.holes.push(hole); }
    const housing=new THREE.ExtrudeGeometry(shape,{depth:9,bevelEnabled:true,bevelSize:.3,bevelThickness:.3,bevelSegments:3,curveSegments:20});
    mesh(group,housing,materials.connectorYellow,'XT60_keyed_housing');
    sleeve(group,14.8,8.8,1.2,1,10.8,4.7,.8,materials.connectorYellow,'XT60_grip_collar',0,0,batterySide?7.6:1.4);
    for(const x of [-3.5,3.5]) {
      if(batterySide) {
        const contact=new THREE.Shape(); contact.absarc(0,0,1.75,0,Math.PI*2,false);
        const bore=new THREE.Path(); bore.absarc(0,0,1.2,0,Math.PI*2,true);contact.holes.push(bore);
        mesh(group,new THREE.ExtrudeGeometry(contact,{depth:6.5,bevelEnabled:false,curveSegments:20}),materials.gold,'XT60_recessed_socket_contact',x,0,.3);
      } else {
        const pin=cylinder(group,1.15,1.15,11,materials.gold,'XT60_mating_gold_pin',x,0,7.8,20); pin.rotation.x=Math.PI/2;
      }
      const bootProfile=[[1.8,0],[2.6,0],[2.3,4],[1.8,4],[1.8,0]].map(p=>new THREE.Vector2(...p));
      const boot=mesh(group,new THREE.LatheGeometry(bootProfile,24),materials.rubber,'XT60_wire_strain_relief',x,0,batterySide?9:0);
      boot.rotation.x=batterySide?Math.PI/2:-Math.PI/2;
    }
    for(const side of [-1,1]) for(const z of [2.5,4.3,6.1]) beveled(group,.4,4,.55,.18,materials.connectorYellow,'XT60_grip_rib',side*7.15,-.5,z,.1);
    return group;
  }
  // Az ESC vezetékei a lemezek között, a VTX fölött futnak a felső kivezetéshez.
  xt60(electronics,[0,46,56],false); xt60(battery,[0,46,65],true);
  wire(electronics,[[8,17.9,stackCenterZ+16],[9,21,30],[3.5,27,41],[3.5,34,47],[3.5,42,47],[3.5,46,52]],1.55,materials.redWire,'ESC_positive_pigtail',52);
  wire(electronics,[[-8,17.9,stackCenterZ+16],[-8,21,30],[-3.5,27,41],[-3.5,34,47],[-3.5,42,47],[-3.5,46,52]],1.55,materials.rubber,'ESC_negative_pigtail',52);
  const exitGrommet=roundedShape(12.8,10.8,2);exitGrommet.holes.push(roundedShape(11,9,1.5));
  tpuExtrusion(upper,exitGrommet,2.5,37,'Top_plate_power_cable_grommet',materials.rubber,0).position.z=47;
  const exitFlange=roundedShape(16,14,2.5);exitFlange.holes.push(roundedShape(11,9,1.5));
  tpuExtrusion(upper,exitFlange,.8,39.5,'Power_cable_grommet_top_flange',materials.rubber,0).position.z=47;
  // A közös kábelívben van egy egyenes szakasz a balanszdugó gumipántjának.
  for(const [positive,startX,bundleX,endX] of [[true,16,2.5,3.5],[false,10,-2.5,-3.5]]) {
    wire(battery,[[startX,57,43.2],[startX,57,46.9],[startX,57,49],[bundleX,62,52],
      [bundleX,61,61],[bundleX,60,66],[bundleX,59,66],[bundleX,57,66],[bundleX,53,66],[bundleX,53,73],
      [endX,53,83],[endX,48,85],[endX,46,83],[endX,46,81],[endX,46,77.8]],
      1.65,positive?materials.redWire:materials.rubber,positive?'Battery_positive_lead':'Battery_negative_lead',112);
  }
  const balanceAnchor=new THREE.Vector3(0,60,71);
  const balance=new THREE.Group(); balance.name='JST_XH_6S_balance_plug'; balance.position.copy(balanceAnchor);balance.rotation.x=Math.PI/2;battery.add(balance);
  sleeve(balance,10,3.8,6,.65,8.6,2.4,.25,materials.white,'Seven_pin_balance_housing');
  box(balance,9,.5,5,materials.white,'JST_contact_separating_web',0,0,0);
  beveled(balance,4,.8,2,.25,materials.white,'JST_locking_tab',0,2,-2.4,.15);
  for(let i=0;i<7;i++) {
    const x=-3.6+i*1.2;
    const pin=cylinder(balance,.25,.25,4,materials.silver,'Balance_contact_pin',x,.65,0,10);pin.rotation.x=Math.PI/2;
    wire(battery,[[-13+i,52,43.2],[-13+i,52,47.5],[-13+i,52,49],[-12+i*.5,55,52],
      [-8+i*.55,64,64],[x,65,78],[x,balanceAnchor.y-2.8,78],[x,balanceAnchor.y-4,balanceAnchor.z]],.32,
      i===0?materials.rubber:(i===6?materials.redWire:materials.white),'Balance_cell_wire',56);
    const relief=cylinder(balance,.5,.5,1.8,materials.white,'JST_wire_entry_collar',x,0,3.8,12);relief.rotation.x=Math.PI/2;
    box(balance,.25,1.5,5,materials.white,'JST_pin_separator',x+.55,.65,0);
  }
  materials.balanceBand=new THREE.MeshStandardMaterial({color:'#b59467',roughness:.94});
  const tieShape=roundedShape(12,10.6,2.2);tieShape.holes.push(roundedShape(10.4,9,1.2));
  const tieGeometry=new THREE.ExtrudeGeometry(tieShape,{depth:2.2,bevelEnabled:true,bevelSize:.1,bevelThickness:.1,bevelSegments:2,curveSegments:16});
  tieGeometry.translate(0,0,-1.1);tieGeometry.rotateX(Math.PI/2);
  mesh(battery,tieGeometry,materials.balanceBand,'Elastic_band_securing_balance_plug_to_power_leads',balanceAnchor.x,balanceAnchor.y-1.5,balanceAnchor.z-2.4);

  const rear=assembly('06_Antennas_and_rear_mount',[0,0,rearExtension],[0,7,35]);
  // Villás talp: a VTX tálcája és a hátsó oszlopok külön kivágásban ülnek.
  const rearBase=new THREE.Shape();
  [[-19,33],[-11,33],[-11,40],[11,40],[11,33],[19,33],[19,54],[15,58],[-15,58],[-19,54]].forEach(([x,z],i)=>i?rearBase.lineTo(x,-z):rearBase.moveTo(x,-z));rearBase.closePath();
  for(const x of [-15,15]) rearBase.holes.push(circleHole(x,36,2.9));
  tpuExtrusion(rear,rearBase,2.5,9.5,'Rear_bolted_TPU_bridge',materials.tpu,0);
  for(const side of [-1,1]) {
    sideProfile(rear,[[40,12],[57,12],[63,18],[63,32],[59,36],[48,35],[40,36.75]],
      [{z:47,y:23,r:6},{z:57,y:26,r:2.5}],2.5,side*14.5,'Rear_contoured_antenna_support');
    const anchor=roundedShape(8,12,1);anchor.holes.push(circleHole(side*.5,-1,2.9));
    tpuExtrusion(rear,anchor,2.5,34.5,'Rear_top_plate_anchor',materials.tpu,0).position.set(side*14.5,34.5,37);
  }
  beveled(rear,32,6,10,2,materials.tpu,'Rear_antenna_crossbrace',0,33,58);
  sleeve(rear,18,12,3,2,14.7,8.6,1.2,materials.tpu,'XT60_frame_retention_collar',0,46,31);
  for(const side of [-1,1]) {
    beveled(rear,6,2,8,1,materials.tpu,'XT60_top_deck_mounting_foot',side*10,40.5,31,.2);
    cylinder(rear,.9,.9,5,materials.silver,'XT60_mount_through_bolt',side*11,40,31,12);
    screw(rear,side*11,42.4,31,1.2);
  }
  const socket=cylinder(rear,4.4,4.4,8,materials.tpu,'VTX_antenna_root_socket',0,34,60,24);socket.rotation.x=.38;
  cylinder(rear,2,2,3,materials.rubber,'VTX_antenna_root_grommet',0,36,60,20).rotation.x=.38;
  wire(rear,[[0,20,37.5],[0,21,42],[0,28,58],[0,36,60]],1.05,materials.rubber,'VTX_coax_pigtail');
  // A tartótól a fej tetejéig mért középvonal 25%-kal hosszabb a korábbi antennánál.
  const antennaBase = new THREE.Vector3(0,36,60);
  const originalStem = [[0,36,60],[0,41,69],[0,60,78],[0,77.5,85.5]].map(p => new THREE.Vector3(...p));
  const originalStemLength = new THREE.CatmullRomCurve3(originalStem).getLength();
  const radomeHeight = 18;
  const exposedAntennaLength = (originalStemLength + 14.5) * 1.25;
  const antennaAxis=new THREE.Vector3(0,Math.cos(.38),Math.sin(.38));
  const straightStemLength=exposedAntennaLength-radomeHeight;
  const straightStem=[0,1/3,2/3,1].map(t=>antennaBase.clone().addScaledVector(antennaAxis,t*straightStemLength));
  wire(rear,straightStem.map(p => p.toArray()),1.35,materials.rubber,'VTX_antenna_stem');
  const omni = new THREE.Group(); omni.name = 'Omni_5_8GHz_antenna_head';
  omni.position.copy(straightStem.at(-1)); omni.rotation.x = .38;
  omni.userData = { style: 'faceted omni radome', exposedLengthMm: exposedAntennaLength, lengthMultiplier: 1.25, straightStem:true };
  rear.add(omni);
  // Karcsú, nyolclapú burkolat, egyenes oldalakkal és lecsapott vállakkal.
  const radomeProfile = [[0,0],[2.5,0],[2.5,2],[4.5,3],[6.9,4.5],[7.2,6],[6.5,15.5],[4.8,18],[0,18]];
  const radomeGeometry = new THREE.LatheGeometry(radomeProfile.map(p => new THREE.Vector2(...p)), 8).toNonIndexed();
  radomeGeometry.computeVertexNormals();
  mesh(omni,radomeGeometry,materials.antennaShell,'Faceted_omni_radome');
  cylinder(omni,2.6,2.1,3.4,materials.rubber,'Antenna_strain_relief',0,.1,0,16);
  cylinder(omni,6.95,6.84,.22,materials.rubber,'Radome_lower_shell_seam',0,4.6,0,8);
  cylinder(omni,4.55,4.55,.15,materials.antennaShell,'Radome_flat_top_panel',0,18.03,0,8);
  for(let i=0;i<8;i++) {
    const angle = (i+.5)*Math.PI/4;
    const face = new THREE.Group(); face.name = 'Radome_stripe_face'; face.rotation.y = angle; omni.add(face);
    const groove = box(face,.55,8,.16,materials.tpu,'Radome_vertical_detail',0,10.2,6.39);
    groove.rotation.x = -.068;
  }
  beveled(rear,14,2.5,10,1,materials.rubber,'ELRS_receiver_mount_pad',0,13.25,52,.2);
  beveled(rear,12,3,8,.8,materials.chip,'ELRS_2_4GHz_receiver',0,16,52,.25);
  sleeve(rear,15,6,2,1,12.2,3.2,.6,materials.rubber,'ELRS_receiver_retaining_band',0,16,52);
  const ufl=cylinder(rear,1.2,1.2,.8,materials.gold,'ELRS_UFL_connector',0,17.9,54,16);
  wire(rear,[[0,18,54],[-2,18,61],[0,18,67],[0,20,75]],.55,materials.rubber,'ELRS_antenna_coax');
  // Csavarozott alsó talp, két lapos merevítő és a dipólt körbefogó gumibetétes hüvelyek.
  const elrsFoot=roundedShape(20,7,1.2);for(const x of [-7,7])elrsFoot.holes.push(circleHole(x,-1.5,1.2));
  tpuExtrusion(rear,elrsFoot,2.5,9.5,'ELRS_mount_bolted_tail_foot',materials.tpu,0).position.z=58;
  for(const side of [-1,1]) {
    cylinder(rear,.9,.9,5.5,materials.silver,'ELRS_mount_through_bolt',side*7,9.75,56.5,12);
    screw(rear,side*7,12.5,56.5,1.4);
    sideProfile(rear,[[57,12],[60,12],[77,14.5],[78,15.2],[78,17.3],[74,17.3],[61,16.3],[57,16.3]],[],2.4,side*6,'ELRS_molded_lower_support_web');
  }
  beveled(rear,19,2.8,8,1,materials.tpu,'ELRS_T_lower_cradle',0,16.6,75,.25);
  for(const side of [-1,1]) {
    const clamp=new THREE.Shape();clamp.absarc(0,0,2.7,0,Math.PI*2,false);clamp.holes.push(circleHole(0,0,1.35));
    const g=new THREE.ExtrudeGeometry(clamp,{depth:4.5,bevelEnabled:false,curveSegments:24});g.translate(0,0,-2.25);g.rotateY(Math.PI/2);
    mesh(rear,g,materials.tpu,'ELRS_T_wraparound_dipole_clamp',side*6,20,75);
    const lining=new THREE.Shape();lining.absarc(0,0,1.35,0,Math.PI*2,false);lining.holes.push(circleHole(0,0,1.12));
    const insert=new THREE.ExtrudeGeometry(lining,{depth:4.5,bevelEnabled:false,curveSegments:24});insert.translate(0,0,-2.25);insert.rotateY(Math.PI/2);
    mesh(rear,insert,materials.rubber,'ELRS_T_clamp_rubber_liner',side*6,20,75);
  }
  const tCenter=beveled(rear,5,4,4,1,materials.rubber,'ELRS_T_center_junction',0,20,75);
  const tBar=cylinder(rear,1.1,1.1,58,materials.rubber,'ELRS_T_dipole_crossbar',0,20,75,16);tBar.rotation.z=Math.PI/2;
  for(const side of [-1,1]) {
    const end=cylinder(rear,1.35,1.35,4,materials.rubber,'ELRS_T_dipole_endcap',side*28,20,75,16);end.rotation.z=Math.PI/2;
  }
  beveled(rear,8,2,3,.6,materials.white,'ELRS_UART_socket',0,16,47.5,.2);
  for(let i=0;i<4;i++) wire(rear,[[-2+i*1.3,16,46],[-2+i*1.3,26.5,42],[-2+i*1.3,29,29],[-2+i*1.3,29,4],[-10+i*1.4,26.1,stackCenterZ+16.5-rearExtension]],.23,i===0?materials.redWire:materials.rubber,'ELRS_FC_UART_wire',52);

  // Teljes méretű akciókamera: csavaros villás csukló és a házra simuló TPU keret.
  const actionSetback=8;
  const action=assembly('07_Action_camera_and_mount',[0,0,actionSetback],[0,49,-38]); actionParts.push(action);
  action.userData={setbackMm:actionSetback};
  // Rövidebb talp: hátrébb kerül a kamera, de a talp nem csúszik az akkumulátor alá.
  const actionBase=roundedShape(30,24,3); for(const x of [-10,10]) actionBase.holes.push(circleHole(x,5,1.6));
  tpuExtrusion(action,actionBase,3,39.5,'Action_camera_bolted_base').position.z=-54;
  for(const x of [-10,10]) screw(action,x,43,-49,1.5);
  for(const x of [-7,0,7]) sideProfile(action,[[-67.5,42],[-53,42],[-53,45],[-60,49],[-62,53],[-66,53],[-68.5,49]],
    [{z:-65,y:49,r:2.6}],2.8,x,'GoPro_style_lower_mount_finger',materials.black);
  const hinge=new THREE.Group(); hinge.name='Action_camera_adjustable_hinge_25deg';hinge.position.set(0,49,-65);hinge.rotation.x=25*Math.PI/180;action.add(hinge);
  for(const x of [-3.5,3.5]) sideProfile(hinge,[[-3,-3],[3,-3],[4,0],[4,7],[-8,7],[-8,3],[-4,2]],
    [{z:0,y:0,r:2.6}],2.8,x,'GoPro_style_upper_mount_finger');
  const hingeBolt=cylinder(action,2.45,2.45,24,materials.silver,'GoPro_mount_pivot_bolt',0,49,-65,20);hingeBolt.rotation.z=Math.PI/2;
  const screwNeck=cylinder(action,3.8,3.8,3.4,materials.black,'GoPro_thumb_screw_contact_neck',10.3,49,-65,20);screwNeck.rotation.z=Math.PI/2;
  const pivotWasher=cylinder(action,4.2,4.2,.9,materials.silver,'GoPro_pivot_clamping_washer',-9.1,49,-65,24);pivotWasher.rotation.z=Math.PI/2;
  const thumb=beveled(action,4,10,18,2,materials.black,'GoPro_mount_thumb_screw',14,49,-65);thumb.rotation.x=.3;
  const nut=cylinder(action,4.1,4.1,3,materials.silver,'GoPro_mount_hex_nut',-11,49,-65,6);nut.rotation.z=Math.PI/2;
  beveled(hinge,67,3,32,2,materials.tpu,'Action_camera_cradle_floor',0,6.5,-8);
  const camera=new THREE.Group();camera.name='Action_camera_in_fitted_TPU_sleeve';camera.position.set(0,30,-8);hinge.add(camera);
  beveled(camera,62,44,28,4.2,materials.antennaShell,'Action_camera_body',0,0,0,.7);
  sleeve(camera,67,49,4,6,62,44,4.2,materials.tpu,'GoPro_style_TPU_front_frame',0,0,-12.5);
  sleeve(camera,67,49,4,6,62,44,4.2,materials.tpu,'GoPro_style_TPU_rear_frame',0,0,12.5);
  for(const side of [-1,1]) {
    const sideShape=roundedShape(23,41,2); const window=roundedShape(16,27,3);
    for(const curve of window.curves) for(const key of ['v0','v1','v2','v3']) if(curve[key]) curve[key].y+=2;
    sideShape.holes.push(window);
    const g=new THREE.ExtrudeGeometry(sideShape,{depth:2.5,bevelEnabled:true,bevelSize:.22,bevelThickness:.22,bevelSegments:2,curveSegments:12});
    g.translate(0,0,-1.25);g.rotateY(Math.PI/2);
    mesh(camera,g,materials.tpu,'GoPro_TPU_side_access_window',side*32.25);
  }
  const topRail=roundedShape(62,23,1);topRail.holes.push(circleHole(12,0,5.2));
  tpuExtrusion(camera,topRail,2.5,22,'GoPro_TPU_top_shutter_access');
  beveled(camera,62,2.5,23,1,materials.tpu,'GoPro_TPU_lower_retention_rail',0,-23.25,0,.2);
  sleeve(camera,67,49,2,6,58,40,3,materials.tpu,'Action_camera_front_retention_lip',0,0,-14.1);
  beveled(camera,26,22,.6,2,materials.glass,'Action_camera_front_screen',-15,2,-14.5,.2);
  beveled(camera,22,22,4.5,3,materials.rubber,'Action_camera_square_lens_bezel',17,7,-16);
  const actionLens=cylinder(camera,8.3,8.3,.65,materials.glass,'Action_camera_lens',17,7,-18.55,40);actionLens.rotation.x=Math.PI/2;
  const actionGlint=mesh(camera,new THREE.SphereGeometry(.75,16,10),new THREE.MeshStandardMaterial({color:'#b8d0e0',metalness:.45,roughness:.08}),'Action_camera_lens_reflection',15.2,9.1,-18.96);actionGlint.scale.z=.12;
  beveled(camera,52,30,.6,2,materials.glass,'Action_camera_rear_touchscreen',0,0,14.5,.2);
  beveled(camera,8,2,8,1,materials.rubber,'Action_camera_shutter_button',12,22,0,.3);
  box(camera,1.6,1.6,.3,materials.led,'Recording_LED',-27,15,-14.5);
  for(const side of [-1,1]) for(const y of [-17,-11,-5,1,7,13,19]) for(const z of [-10,10]) {
    box(camera,.16,.15,2.7,materials.tpuDetail,'Camera_mount_print_layer',side*33.55,y,z);
  }

  let triangles=0, meshes=0;
  root.traverse(object=>{ if(object.isMesh){meshes++;triangles+=(object.geometry.index?object.geometry.index.count:object.geometry.attributes.position.count)/3;} });
  const uniqueMaterials=new Set();root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])uniqueMaterials.add(m);});
  function setExplode(value) { for(const a of assemblies) a.group.position.copy(a.base).addScaledVector(a.delta,value); }
  function setWireframe(value) { for(const m of uniqueMaterials)m.wireframe=value; }
  function setColor(hex) { materials.tpu.color.set(hex); materials.tpuDetail.color.set(hex).multiplyScalar(.55); applyBatteryLabelColor(root,hex); }
  return { root, assemblies, propellers, batteryParts, actionParts, materials, meshes, triangles:Math.round(triangles), setExplode, setWireframe, setColor };
}
