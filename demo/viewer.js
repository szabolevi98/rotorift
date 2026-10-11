(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const viewport = document.getElementById('viewport');
  const loading = document.getElementById('loading');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (error) {
    loading.textContent = 'A 3D nézethez WebGL 2 támogatás szükséges. Próbáld Chrome-ban vagy Edge-ben, bekapcsolt grafikus gyorsítással.';
    document.getElementById('export').disabled = true;
    console.error(error); return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor('#f5f5f1', 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .005, 8);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = .08;
  controls.enablePan = false;
  controls.minDistance = .19;
  controls.maxDistance = 1.25;
  controls.minPolarAngle = .005;
  controls.maxPolarAngle = Math.PI * .8;
  controls.autoRotateSpeed = .8;
  const clock = new THREE.Clock();

  // Saját stúdiófény, HDR-fájl és hálózati textúrák nélkül.
  const room = new THREE.Scene();
  room.background = new THREE.Color('#e3e5df');
  const roomBox = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), new THREE.MeshBasicMaterial({ color:'#adb5ae', side:THREE.BackSide }));
  room.add(roomBox);
  for (const [position,scale,power] of [ [[-2,3,1],[3,2,1],5], [[3,1,0],[1,3,3],3], [[0,2,-3],[3,2,1],4] ]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(...scale),new THREE.MeshBasicMaterial({color:new THREE.Color(power,power,power)}));
    panel.position.set(...position);room.add(panel);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(room,.02,.1,12);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = .58;
  room.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#ffffff','#a1a696',1.7));
  const key = new THREE.DirectionalLight('#fff3e5',3.2); key.position.set(-.3,.55,-.35);
  key.castShadow = true;
  key.shadow.mapSize.set(2048,2048);
  key.shadow.camera.left=-.32;key.shadow.camera.right=.32;key.shadow.camera.top=.32;key.shadow.camera.bottom=-.32;
  key.shadow.camera.near=.01;key.shadow.camera.far=1.6;
  key.shadow.bias=-.00015;key.shadow.normalBias=.0007;
  key.shadow.radius=4;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#e2edf7',1.4);fill.position.set(.4,.2,.2);scene.add(fill);
  const rim = new THREE.DirectionalLight('#ffffff',2);rim.position.set(0,.35,.45);scene.add(rim);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.ShadowMaterial({color:'#4f5b46',opacity:.16}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
  const studioCircle = new THREE.Mesh(new THREE.RingGeometry(.245,.2457,128),new THREE.MeshBasicMaterial({color:'#cdd3c6',transparent:true,opacity:.5,side:THREE.DoubleSide}));
  studioCircle.rotation.x=-Math.PI/2;studioCircle.position.y=-.0025;scene.add(studioCircle);

  let currentModel = MODEL_CATALOG.find(model => model.status === 'ready' && typeof model.create === 'function');
  let drone = currentModel.create();scene.add(drone.root);
  const modelCache = new Map([[currentModel.id, drone]]);
  let originalPropRotations=drone.propellers.map(p=>p.group.rotation.y);
  const modelPropRotations=new Map([[currentModel.id,originalPropRotations]]);
  const stats = document.getElementById('mesh-stats');
  stats.textContent=`${Math.round(drone.triangles/1000)}k háromszög · ${drone.meshes} rész`;
  const state={explode:0,spin:false};
  let cameraTransition=null, exporting=false;
  const names={hero:'Perspektíva',top:'Felülnézet',front:'Elölnézet',side:'Oldalnézet',rear:'Hátulnézet'};
  const views={hero:[.32,.255,-.36],top:[0,.57,.0001],front:[0,.105,-.56],side:[.56,.105,0],rear:[.22,.16,.46]};
  function cameraPosition(view){
    const p=new THREE.Vector3(...views[view]);
    p.multiplyScalar(currentModel.cameraScale || 1);
    const mobile=viewport.clientWidth<520;
    if(mobile)p.multiplyScalar(1.22);
    return p;
  }
  function setView(view,immediate=false){
    const scale=currentModel.cameraScale || 1;
    const target=new THREE.Vector3(0,(view==='hero'?.037:.043)*scale,0);
    const position=cameraPosition(view);
    if(immediate){camera.position.copy(position);controls.target.copy(target);controls.update();}
    else cameraTransition={from:camera.position.clone(),to:position,startTarget:controls.target.clone(),target,time:0};
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
    document.getElementById('view-label').textContent=names[view];
  }
  function resize(){
    const width=viewport.clientWidth,height=viewport.clientHeight;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(viewport);
  resize();setView('hero',true);

  // Csak elérhető, gyártófüggvénnyel rendelkező modellek választhatók.
  // A katalógus bővítése a nézegető kódjának módosítása nélkül történhet.
  const picker=document.getElementById('model-picker');
  const ready=MODEL_CATALOG.filter(model=>model.status==='ready'&&typeof model.create==='function').length;
  document.getElementById('catalog-count').textContent=`${ready} elérhető · ${MODEL_CATALOG.length-ready} készül`;
  for(const model of MODEL_CATALOG){
    const available=model.status==='ready'&&typeof model.create==='function';
    const button=document.createElement('button');button.type='button';button.className='model-card';
    button.dataset.model=model.id;button.disabled=!available;
    button.setAttribute('aria-pressed',String(model.id===currentModel.id));
    button.setAttribute('aria-label',`${model.name}, ${model.category}${available?'':', Készül'}`);
    const badge=document.createElement('span');badge.className='model-badge';badge.textContent=model.badge;
    const info=document.createElement('span');info.className='model-info';
    const name=document.createElement('strong');name.textContent=model.name;
    const category=document.createElement('span');category.textContent=model.category;info.append(name,category);
    const status=document.createElement('span');status.className='model-status';status.textContent=available?'Megnézem ↗':'Készül';
    button.append(badge,info,status);button.addEventListener('click',()=>selectModel(model));picker.append(button);
  }
  function updateModelInfo(model){
    document.getElementById('model-color-label').textContent=model.colorLabel || 'TPU kiegészítők';
    for(const [id,text] of Object.entries({
      'model-title':model.title,'model-suffix':model.suffix,'model-eyebrow':model.eyebrow,
      'model-tagline':model.tagline,'model-heading':model.heading,'model-description':model.description,'model-mark':model.mark,
    }))document.getElementById(id).textContent=text;
    document.querySelector('.edition').textContent=model.edition;
    document.title=`Rotorift Showcase · ${model.name}`;
    canvas.setAttribute('aria-label',`${model.name} háromdimenziós modell. Húzással forgatható, görgetéssel nagyítható.`);
    const rows=model.specs.map(spec=>{
      const row=document.createElement('div'),label=document.createElement('span'),value=document.createElement('strong'),detail=document.createElement('small');
      label.textContent=spec.label;value.textContent=`${spec.value} `;detail.textContent=spec.detail;value.append(detail);row.append(label,value);return row;
    });
    document.getElementById('model-specs').replaceChildren(...rows);
    stats.textContent=`${Math.round(drone.triangles/1000)}k háromszög · ${drone.meshes} rész`;
    picker.querySelectorAll('[data-model]').forEach(button=>{
      const active=button.dataset.model===model.id;button.setAttribute('aria-pressed',String(active));
      if(!button.disabled)button.querySelector('.model-status').textContent=active?'Megnyitva':'Megnézem ↗';
    });
    const actionToggle=document.getElementById('action-camera');
    actionToggle.disabled=drone.actionParts.length===0;actionToggle.checked=drone.actionParts.length>0;
    actionToggle.closest('label').classList.toggle('unavailable',actionToggle.disabled);
  }
  function selectModel(model){
    if(exporting||model.status!=='ready'||typeof model.create!=='function')return;
    if(model.id===currentModel.id){setView('hero');return;}
    try{
      let next=modelCache.get(model.id);
      if(!next){next=model.create();modelCache.set(model.id,next);modelPropRotations.set(model.id,next.propellers.map(prop=>prop.group.rotation.y));}
      scene.remove(drone.root);drone=next;currentModel=model;scene.add(drone.root);
      originalPropRotations=modelPropRotations.get(model.id);
      drone.propellers.forEach((prop,index)=>prop.group.rotation.y=originalPropRotations[index]);
      state.explode=0;state.spin=false;controls.autoRotate=false;
      drone.setExplode(0);drone.setWireframe(false);drone.setColor(colors.coral);
      drone.batteryParts.forEach(part=>part.visible=true);drone.actionParts.forEach(part=>part.visible=true);drone.propellers.forEach(prop=>prop.group.visible=true);
      for(const id of ['battery','props'])document.getElementById(id).checked=true;
      for(const id of ['spin','rotate','wireframe'])document.getElementById(id).checked=false;
      document.getElementById('explode').value='0';document.getElementById('explode-value').textContent='0%';
      document.getElementById('status').textContent='';
      document.querySelectorAll('[data-color]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.color==='coral')));
      controls.minDistance=.19*(model.cameraScale||1);controls.maxDistance=1.25*(model.cameraScale||1);
      studioCircle.scale.setScalar(model.cameraScale||1);
      updateModelInfo(model);setView('hero',true);
    }catch(error){document.getElementById('status').textContent='A modell betöltése nem sikerült. '+error.message;console.error(error);}
  }
  updateModelInfo(currentModel);
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
    controls.autoRotate=false;document.getElementById('rotate').checked=false;setView(button.dataset.view);
  }));
  document.getElementById('reset-view').addEventListener('click',()=>setView('hero'));
  document.getElementById('brand-reset').addEventListener('click',e=>{e.preventDefault();setView('hero');});
  controls.addEventListener('start',()=>{cameraTransition=null;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));document.getElementById('view-label').textContent='Szabad nézet';});
  document.getElementById('battery').addEventListener('change',e=>drone.batteryParts.forEach(p=>p.visible=e.target.checked));
  document.getElementById('props').addEventListener('change',e=>drone.propellers.forEach(p=>p.group.visible=e.target.checked));
  document.getElementById('action-camera').addEventListener('change',e=>drone.actionParts.forEach(p=>p.visible=e.target.checked));
  document.getElementById('rotate').addEventListener('change',e=>controls.autoRotate=e.target.checked);
  document.getElementById('spin').addEventListener('change',e=>{
    state.spin=e.target.checked;
    if(!state.spin)drone.propellers.forEach((p,i)=>p.group.rotation.y=originalPropRotations[i]);
  });
  document.getElementById('wireframe').addEventListener('change',e=>drone.setWireframe(e.target.checked));
  document.getElementById('explode').addEventListener('input',e=>{
    state.explode=Number(e.target.value)/100;drone.setExplode(state.explode);
    document.getElementById('explode-value').textContent=`${e.target.value}%`;
  });
  const colors={yellow:'#ffd000',coral:'#ff6648',teal:'#3e938c',violet:'#8573a8'};
  document.querySelectorAll('[data-color]').forEach(button=>button.addEventListener('click',()=>{
    drone.setColor(colors[button.dataset.color]);document.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  }));

  document.getElementById('export').addEventListener('click',async()=>{
    const button=document.getElementById('export'),status=document.getElementById('status');
    button.disabled=true;exporting=true;status.textContent='GLB modell összeállítása…';
    try{
      // Az export mindig összeszerelt modell, az aktuális színnel és láthatósággal.
      const exported=drone.root.clone(true);
      for(const part of drone.assemblies)exported.getObjectByName(part.group.name).position.copy(part.base);
      drone.propellers.forEach((p,i)=>exported.getObjectByName(p.group.name).rotation.y=originalPropRotations[i]);
      exported.updateMatrixWorld(true);
      const result=await new GLTFExporter().parseAsync(exported,{binary:true,onlyVisible:true,maxTextureSize:1024});
      const blob=new Blob([result],{type:'model/gltf-binary'}),url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=currentModel.filename;document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      status.textContent=`A modell elkészült (${(blob.size/1024/1024).toFixed(2)} MB).`;
    }catch(error){status.textContent='Az export nem sikerült. '+error.message;console.error(error);}
    finally{button.disabled=false;exporting=false;}
  });

  renderer.setAnimationLoop(()=>{
    const dt=Math.min(clock.getDelta(),.05);
    if(cameraTransition){
      cameraTransition.time+=dt;
      const t=Math.min(cameraTransition.time/.6,1),ease=t*t*(3-2*t);
      camera.position.lerpVectors(cameraTransition.from,cameraTransition.to,ease);
      controls.target.lerpVectors(cameraTransition.startTarget,cameraTransition.target,ease);
      if(t===1)cameraTransition=null;
    }
    if(state.spin&&!exporting)for(const prop of drone.propellers)prop.group.rotation.y+=dt*16*prop.direction;
    controls.update(dt);renderer.render(scene,camera);
  });
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();loading.hidden=false;loading.textContent='A grafikus kapcsolat megszakadt. Töltsd újra a demót.';
  });
  loading.hidden=true;
})();
