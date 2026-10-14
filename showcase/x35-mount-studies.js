(() => {
  const views=[],positions={perspective:[.65,.3,-1],front:[0,.1,-1],side:[1,.06,0],top:[0,1,.001],rear:[.65,.4,1]};
  let close=true,current='perspective';
  for(const [index,cameraMount] of ['cheeks','visor','cage'].entries()){
    const canvas=document.querySelectorAll('canvas')[index];
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));configureDroneRenderer(THREE,renderer);renderer.setClearColor('#15171b');
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.001,3),controls=new OrbitControls(camera,canvas);
    controls.enablePan=false;controls.minDistance=.035;controls.maxDistance=.65;
    addDroneReflections(THREE,renderer,scene);
    scene.add(new THREE.HemisphereLight(0xdce9ff,0x45443b,2.1));
    const key=new THREE.DirectionalLight(0xfff1e1,3.2);key.position.set(-.4,.7,-.3);scene.add(key);
    const fill=new THREE.DirectionalLight(0xa7dcff,1.6);fill.position.set(.5,.1,.4);scene.add(fill);
    const drone=createRiftX35({cameraMount});scene.add(drone.root);
    const render=()=>renderer.render(scene,camera);controls.addEventListener('change',render);
    views.push({canvas,renderer,scene,camera,controls,drone,render});
  }
  function reset(){
    const detail=close&&current!=='rear';
    for(const {drone,camera,controls,render} of views){
      drone.root.getObjectByName('X35_03_Brushless_motors').visible=!detail;
      drone.propellers.forEach(({group})=>group.visible=!detail);
      const rearDetail=close&&current==='rear';
      controls.target.set(...(detail?[0,.015,-.043]:rearDetail?[0,.034,.052]:[0,.025,.005]));
      camera.position.copy(controls.target).add(new THREE.Vector3(...positions[current]).normalize().multiplyScalar(detail?.079:rearDetail?.145:.34));
      controls.update();render();
    }
  }
  const resize=new ResizeObserver(()=>{for(const {canvas,renderer,camera,render} of views){renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();render();}});
  for(const {canvas} of views)resize.observe(canvas);
  for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{
    current=button.dataset.view;
    for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b===button));
    reset();
  });
  document.querySelector('#framing').addEventListener('click',event=>{close=!close;event.currentTarget.textContent=close?'Show whole drone':'Camera mount close-up';reset();});
  reset();document.querySelector('#loading').remove();
})();
