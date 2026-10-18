(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const viewport = document.getElementById('viewport');
  const loading = document.getElementById('loading');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (error) {
    loading.textContent = 'WebGL 2 is required. Try Chrome or Edge with hardware acceleration enabled.';
    document.getElementById('export').disabled = true;
    console.error(error); return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor('#f5f5f1', 0);
  configureDroneRenderer(THREE, renderer);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .005, 50);
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

  // Ugyanaz a színkezelés, tükröződési környezet és napfény, mint repüléskor.
  const envTarget = addDroneReflections(THREE, renderer, scene);
  scene.add(new THREE.HemisphereLight(0xfaf8e5, 0x768367, 2.4));
  const key = new THREE.DirectionalLight(0xfff0d5,3); key.position.set(-.35,.75,.25);
  key.castShadow = true;
  key.shadow.mapSize.set(2048,2048);
  key.shadow.camera.left=-.32;key.shadow.camera.right=.32;key.shadow.camera.top=.32;key.shadow.camera.bottom=-.32;
  key.shadow.camera.near=.01;key.shadow.camera.far=1.6;
  key.shadow.bias=-.00015;key.shadow.normalBias=.0007;
  key.shadow.radius=4;
  scene.add(key);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.ShadowMaterial({color:'#4f5b46',opacity:.16}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
  const studioCircle = new THREE.Mesh(new THREE.RingGeometry(.245,.2457,128),new THREE.MeshBasicMaterial({color:'#cdd3c6',transparent:true,opacity:.5,side:THREE.DoubleSide}));
  studioCircle.rotation.x=-Math.PI/2;studioCircle.position.y=-.0025;scene.add(studioCircle);

  let currentModel = MODEL_CATALOG.find(model => model.status === 'ready' && typeof model.create === 'function');
  let drone = currentModel.create();scene.add(drone.root);
  const modelCache = new Map([[currentModel.id, drone]]);
  let originalPropRotations=drone.propellers.map(p=>p.group.rotation[p.axis??'y']);
  const modelPropRotations=new Map([[currentModel.id,originalPropRotations]]);
  const stats = document.getElementById('mesh-stats');
  stats.textContent=`${Math.round(drone.triangles/1000)}k triangles · ${drone.meshes} parts`;
  const state={explode:0,spin:false,throttle:.5},rotorMotion=new RotorMotion();
  let cameraTransition=null, exporting=false;
  const names={hero:'Perspective',top:'Top view',front:'Front view',side:'Side view',rear:'Rear view'};
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
    if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.fov=Math.min(75,36*Math.max(1,1.25/camera.aspect));camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(viewport);
  resize();setView('hero',true);

  // Csak available, gyártófüggvénnyel rendelkező modellek választhatók.
  // A katalógus bővítése a nézegető kódjának módosítása nélkül történhet.
  const picker=document.getElementById('model-picker');
  const ready=MODEL_CATALOG.filter(model=>model.status==='ready'&&typeof model.create==='function').length;
  document.getElementById('catalog-count').textContent=`${ready} available · ${MODEL_CATALOG.length-ready} coming soon`;
  for(const model of MODEL_CATALOG){
    const available=model.status==='ready'&&typeof model.create==='function';
    const option=new Option(`${model.name} · ${model.category}${available?'':' · Coming soon'}`,model.id);
    option.disabled=!available;picker.append(option);
  }
  picker.addEventListener('change',()=>selectModel(MODEL_CATALOG.find(model=>model.id===picker.value)));

  function updateModelInfo(model){
    document.getElementById('model-color-label').textContent=model.colorLabel || 'TPU accessories';
    for(const [id,text] of Object.entries({
      'model-title':model.title,'model-suffix':model.suffix,'model-eyebrow':model.eyebrow,
      'model-tagline':model.tagline,'model-heading':model.heading,'model-description':model.description,'model-mark':model.mark,
    }))document.getElementById(id).textContent=text;
    document.querySelector('.edition').dataset.droneEdition=model.edition;if(!document.getElementById('drone-panel').hidden)document.querySelector('.edition').textContent=model.edition;
    if(!document.getElementById("drone-panel").hidden)document.title=`Rotorift Showcase · ${model.name}`;
    canvas.setAttribute('aria-label',`${model.name} 3D model. Drag to rotate, scroll to zoom.`);
    const rows=model.specs.map(spec=>{
      const row=document.createElement('div'),label=document.createElement('span'),value=document.createElement('strong'),detail=document.createElement('small');
      label.textContent=spec.label;value.textContent=`${spec.value} `;detail.textContent=spec.detail;value.append(detail);row.append(label,value);return row;
    });
    document.getElementById('model-specs').replaceChildren(...rows);
    stats.textContent=`${Math.round(drone.triangles/1000)}k triangles · ${drone.meshes} parts`;
    picker.value=model.id;
    const batteryToggle=document.getElementById('battery');
    batteryToggle.disabled=drone.batteryParts.length===0;batteryToggle.checked=!batteryToggle.disabled;
    batteryToggle.closest('label').classList.toggle('unavailable',batteryToggle.disabled);
    const explode=document.getElementById('explode');explode.disabled=drone.assemblies.length===0;
    const actionToggle=document.getElementById('action-camera');
    actionToggle.disabled=drone.actionParts.length===0;actionToggle.checked=drone.actionParts.length>0;
    actionToggle.closest('label').classList.toggle('unavailable',actionToggle.disabled);
  }
  function selectModel(model){
    if(exporting||!model||model.status!=='ready'||typeof model.create!=='function'){picker.value=currentModel.id;return;}
    if(model.id===currentModel.id){setView('hero');return;}
    try{
      let next=modelCache.get(model.id);
      if(!next){next=model.create();modelCache.set(model.id,next);modelPropRotations.set(model.id,next.propellers.map(prop=>prop.group.rotation[prop.axis??'y']));}
      scene.remove(drone.root);drone=next;currentModel=model;scene.add(drone.root);
      originalPropRotations=modelPropRotations.get(model.id);
      drone.propellers.forEach((prop,index)=>prop.group.rotation[prop.axis??'y']=originalPropRotations[index]);
      state.explode=0;state.spin=false;controls.autoRotate=false;
      rotorMotion.count=drone.propellers.length;rotorMotion.reset();document.getElementById('prop-throttle').disabled=true;
      drone.setExplode(0);drone.setWireframe(false);drone.setColor(colors.coral);
      drone.batteryParts.forEach(part=>part.visible=true);drone.actionParts.forEach(part=>part.visible=true);drone.propellers.forEach(prop=>prop.group.visible=true);
      for(const id of ['battery','props'])document.getElementById(id).checked=true;
      for(const id of ['spin','rotate','wireframe'])document.getElementById(id).checked=false;
      document.getElementById('explode').value='0';document.getElementById('explode-value').textContent='0%';
      document.getElementById('status').textContent='';
      document.querySelectorAll('[data-color]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.color==='coral')));
      controls.minDistance=.19*(model.cameraScale||1);controls.maxDistance=1.25*(model.cameraScale||1);
      studioCircle.scale.setScalar(model.cameraScale||1);
      const scale=model.cameraScale||1;
      key.position.set(-.35*scale,.75*scale,.25*scale);
      Object.assign(key.shadow.camera,{left:-.32*scale,right:.32*scale,top:.32*scale,bottom:-.32*scale,far:1.6*scale});
      key.shadow.camera.updateProjectionMatrix();
      updateModelInfo(model);setView('hero',true);
    }catch(error){picker.value=currentModel.id;document.getElementById('status').textContent='Cannot load the model. '+error.message;console.error(error);}
  }
  updateModelInfo(currentModel);
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
    controls.autoRotate=false;document.getElementById('rotate').checked=false;setView(button.dataset.view);
  }));
  document.getElementById('reset-view').addEventListener('click',()=>setView('hero'));
  document.getElementById('brand-reset').addEventListener('click',e=>{e.preventDefault();setView('hero');});
  controls.addEventListener('start',()=>{cameraTransition=null;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));document.getElementById('view-label').textContent='Free view';});
  document.getElementById('battery').addEventListener('change',e=>drone.batteryParts.forEach(p=>p.visible=e.target.checked));
  document.getElementById('props').addEventListener('change',e=>drone.propellers.forEach(p=>p.group.visible=e.target.checked));
  document.getElementById('action-camera').addEventListener('change',e=>drone.actionParts.forEach(p=>p.visible=e.target.checked));
  document.getElementById('rotate').addEventListener('change',e=>controls.autoRotate=e.target.checked);
  document.getElementById('spin').addEventListener('change',e=>{
    state.spin=e.target.checked;
    document.getElementById('prop-throttle').disabled=!state.spin;
    if(!state.spin)drone.propellers.forEach((p,i)=>p.group.rotation[p.axis??'y']=originalPropRotations[i]);
  });
  document.getElementById('prop-throttle').addEventListener('input',e=>{
    state.throttle=Number(e.target.value)/100;
    document.getElementById('prop-throttle-value').textContent=`${e.target.value}%`;
  });
  document.getElementById('wireframe').addEventListener('change',e=>drone.setWireframe(e.target.checked));
  document.getElementById('explode').addEventListener('input',e=>{
    state.explode=Number(e.target.value)/100;drone.setExplode(state.explode);
    document.getElementById('explode-value').textContent=`${e.target.value}%`;
  });
  const colors=DRONE_COLORS;
  const colorNames={coral:'Orange',yellow:'Yellow',teal:'Teal',violet:'Violet',blue:'Blue',lime:'Green',pink:'Pink',white:'White'};
  for(const [id,hex] of Object.entries(colors)){
    const button=document.createElement('button');button.type='button';button.className='swatch';button.dataset.color=id;
    button.style.background=hex;button.setAttribute('aria-label',colorNames[id]);button.setAttribute('aria-pressed',String(id==='coral'));
    document.getElementById('color-picker').append(button);
  }
  document.querySelectorAll('[data-color]').forEach(button=>button.addEventListener('click',()=>{
    drone.setColor(colors[button.dataset.color]);document.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  }));

  document.getElementById('export').addEventListener('click',async()=>{
    const button=document.getElementById('export'),status=document.getElementById('status');
    button.disabled=true;exporting=true;status.textContent='Building GLB model…';
    try{
      // Az export mindig összeszerelt modell, az aktuális színnel és láthatósággal.
      const exported=drone.root.clone(true);
      for(const part of drone.assemblies)exported.getObjectByName(part.group.name).position.copy(part.base);
      drone.propellers.forEach((p,i)=>exported.getObjectByName(p.group.name).rotation[p.axis??'y']=originalPropRotations[i]);
      exported.updateMatrixWorld(true);
      const result=await new GLTFExporter().parseAsync(exported,{binary:true,onlyVisible:true,maxTextureSize:1024});
      const blob=new Blob([result],{type:'model/gltf-binary'}),url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=currentModel.filename;document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      status.textContent=`Model ready (${(blob.size/1024/1024).toFixed(2)} MB).`;
    }catch(error){status.textContent='Cannot export the model. '+error.message;console.error(error);}
    finally{button.disabled=false;exporting=false;}
  });

  renderer.setAnimationLoop(()=>{
    const dt=Math.min(clock.getDelta(),.05);
    if(document.getElementById("drone-panel").hidden || document.hidden) return;
    if(cameraTransition){
      cameraTransition.time+=dt;
      const t=Math.min(cameraTransition.time/.6,1),ease=t*t*(3-2*t);
      camera.position.lerpVectors(cameraTransition.from,cameraTransition.to,ease);
      controls.target.lerpVectors(cameraTransition.startTarget,cameraTransition.target,ease);
      if(t===1)cameraTransition=null;
    }
    if(state.spin&&!exporting){
      rotorMotion.update(dt,Array(drone.propellers.length).fill(state.throttle**ROTOR_THRUST_EXPONENTS[currentModel.id]),1,drone.propellers,state.throttle>0);
      drone.propellers.forEach((prop,i)=>prop.group.rotation[prop.axis??'y']=originalPropRotations[i]+rotorMotion.phase[i]);
    }
    controls.update(dt);renderer.render(scene,camera);
  });
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();loading.hidden=false;loading.textContent='Graphics context lost. Reload the showcase.';
  });
  loading.hidden=true;
})();
