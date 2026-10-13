(() => {
 const scenes=[];let close=true,current='compare';
 for(const [index,initialView]of ['front','side','perspective'].entries()){
  const canvas=document.querySelectorAll('canvas')[index],renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));configureDroneRenderer(THREE,renderer);renderer.setClearColor('#f4f3ee');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.001,3),controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.minDistance=.038;controls.maxDistance=.45;
  addDroneReflections(THREE,renderer,scene);scene.add(new THREE.HemisphereLight(0xfaf8e5,0x768367,2.4));const key=new THREE.DirectionalLight(0xfff0d5,3);key.position.set(-.35,.75,-.25);scene.add(key);const fill=new THREE.DirectionalLight(0xe0efff,1);fill.position.set(.3,.2,.3);scene.add(fill);
  const drone=createRift75();scene.add(drone.root);
  const render=()=>renderer.render(scene,camera);controls.addEventListener('change',render);scenes.push({camera,controls,renderer,render,canvas,initialView});
 }
 function reset(){for(const {camera,controls,render,initialView}of scenes){const target=close?[0,.022,-.004]:[0,.015,0],distance=close?.085:.29,positions={perspective:[.75,.42,-1],front:[0,.12,-1],side:[1,.12,0],top:[0,1,.001],rear:[.5,.28,1]};controls.target.set(...target);camera.position.copy(controls.target).add(new THREE.Vector3(...positions[current==='compare'?initialView:current]).normalize().multiplyScalar(distance));controls.update();render();}}
 new ResizeObserver(()=>{for(const {canvas,renderer,camera,render}of scenes){renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();render();}}).observe(document.querySelector('main'));
 for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{current=button.dataset.view;for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b===button));reset();});
 document.querySelector('#framing').addEventListener('click',e=>{close=!close;e.currentTarget.textContent=close?'Show whole drone':'Canopy close-up';reset();});reset();document.querySelector('#loading').remove();
})();
