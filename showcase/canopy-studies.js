// Design studies only: none of these canopies replaces the flight model yet.
function createCanopyStudy(kind){
 const model=createRift75(),root=model.root,old=root.getObjectByName('75_05_Micro_camera_canopy'),camera=old.getObjectByName('Micro_FPV_camera');camera.removeFromParent();
 const canopy=new THREE.Group();canopy.name='Canopy_study_'+kind;root.add(canopy);canopy.add(camera);
 for(const name of ['VTX_antenna_heatshrink','VTX_wire_radiator','Moulded_antenna_guide']){const part=old.getObjectByName(name);part.removeFromParent();canopy.add(part);}
 old.removeFromParent();old.traverse(o=>o.geometry?.dispose());
 const white=model.materials.canopy;white.roughness=.35;
 const accent=model.materials.frame;
 function mesh(p,g,m,name,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o;}
 function tube(p,points,r,m=white){return mesh(p,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v))),32,r,8,false),m,'Moulded_rib');}
 function ring(p,outer,inner,depth,x,y,z,flat=false){const s=new THREE.Shape();s.absarc(0,0,outer,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);s.holes.push(hole);const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.18,bevelThickness:.15,bevelSegments:3,curveSegments:24});g.translate(0,0,-depth/2);if(flat)g.rotateX(-Math.PI/2);return mesh(p,g,white,'Rounded_mount_or_lens_rim',x,y,z);}
 function mounts(){for(const [x,z]of [[18.38,0],[-18.38,0],[0,18.38]]){ring(canopy,2.8,.9,1,x,12.1,z,true);mesh(canopy,new THREE.CylinderGeometry(1.45,1.45,.65,20),model.materials.silver,'Mount_screw',x,13.2,z);}}
 function cameraLocal(){const p=new THREE.Group();p.position.copy(camera.position);p.rotation.copy(camera.rotation);canopy.add(p);return p;}
 mounts();
 if(kind==='shell'){
  const shellParent=cameraLocal(),profiles=[[-4.25,4.9,4.8,0],[-2,7.2,6.8,0],[2,8.4,7.1,.3],[6.5,8.1,6.5,.8],[12,6.5,5,1.5],[18,3.4,2.9,2.2],[21,1.2,1.1,2.8]];
  const curve=new THREE.CatmullRomCurve3(profiles.map(([z,w,h,y])=>new THREE.Vector3(w,h,y)),false,'catmullrom',.25),zc=new THREE.CatmullRomCurve3(profiles.map(([z])=>new THREE.Vector3(z,0,0)),false,'catmullrom',.25);
  const rows=64,cols=48,stride=cols+1,layer=(rows+1)*stride,positions=[],indices=[],kept=[];
  for(let inside=0;inside<2;inside++)for(let i=0;i<=rows;i++){const p=curve.getPoint(i/rows),z=zc.getPoint(i/rows).x;for(let j=0;j<=cols;j++){const a=j*2*Math.PI/cols;positions.push((p.x-inside*.65)*Math.cos(a),p.z+(p.y-inside*.65)*Math.sin(a),z);}}
  for(let i=0;i<rows;i++){kept[i]=[];const z=zc.getPoint((i+.5)/rows).x;for(let j=0;j<cols;j++){const a=(j+.5)*2*Math.PI/cols,side=Math.abs(Math.cos(a))>.91;kept[i][j]=!(side&&[[4,5.3],[7,8.3],[10,11.3]].some(([lo,hi])=>z>lo&&z<hi));}}
  const quad=(a,b,c,d)=>indices.push(a,b,c,a,c,d);
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++)if(kept[i][j]){const a=i*stride+j,b=a+stride,c=b+1,d=a+1;quad(a,d,c,b);quad(a+layer,b+layer,c+layer,d+layer);if(!kept[i-1]?.[j])quad(a,a+layer,d+layer,d);if(!kept[i+1]?.[j])quad(b,c,c+layer,b+layer);if(!kept[i]?.[(j+cols-1)%cols])quad(a,b,b+layer,a+layer);if(!kept[i]?.[(j+1)%cols])quad(d,d+layer,c+layer,c);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();mesh(shellParent,geometry,white,'Organic_round_shell');
  ring(shellParent,4.9,4.1,.75,0,0,-4.3);
  for(const s of [-1,1])tube(canopy,[[s*18.38,12.1,0],[s*13,13,-2],[s*9,16,-4],[s*7.6,22,-6.5]],1.05);
  tube(canopy,[[0,12.1,18.38],[0,15,12],[0,18,7]],1.1);
 }else if(kind==='cage'){
  const front=cameraLocal(),bezel=ring(front,7.9,6.35,.9,0,0,-1.8);bezel.scale.y=.95;
  for(const s of [-1,1]){
   tube(canopy,[[s*18.38,12.1,0],[s*10,13.2,-6],[s*7.4,20,-11],[s*5.7,29,-5],[s*6.8,26,4],[s*7,17,11],[0,12.1,18.38]],.8);
   tube(canopy,[[s*18.38,12.1,0],[s*11,12.8,6],[s*7,17,11]],.65);
   tube(canopy,[[s*7,17,-10],[s*6.7,20.5,-11],[s*5.5,23,-11]],.8);
  }
  tube(canopy,[[-5.7,29,-5],[-3,30.3,-5],[0,30.7,-5],[3,30.3,-5],[5.7,29,-5]],.8);
  tube(canopy,[[-6.8,26,4],[0,28,4],[6.8,26,4]],.7);
 }else{
  const visor=cameraLocal(),face=new THREE.Shape();face.moveTo(-7.5,-3.8);face.lineTo(-7.5,2.7);face.quadraticCurveTo(-6.9,6.9,-3.6,7.2);face.lineTo(3.6,7.2);face.quadraticCurveTo(6.9,6.9,7.5,2.7);face.lineTo(7.5,-3.8);face.quadraticCurveTo(6,-6.5,3,-6.5);face.lineTo(-3,-6.5);face.quadraticCurveTo(-6,-6.5,-7.5,-3.8);
  const aperture=new THREE.Path();aperture.absellipse(0,0,6.25,5.75,0,Math.PI*2,true);face.holes.push(aperture);
  const g=new THREE.ExtrudeGeometry(face,{depth:.7,bevelEnabled:true,bevelSize:.2,bevelThickness:.2,bevelSegments:3,curveSegments:24});g.translate(0,0,-1.8);mesh(visor,g,white,'Low_profile_camera_face');
  const roof=new THREE.Shape();roof.moveTo(-7.2,-2);roof.lineTo(7.2,-2);roof.quadraticCurveTo(9,5,5,13);roof.quadraticCurveTo(0,16,-5,13);roof.quadraticCurveTo(-9,5,-7.2,-2);
  const vg=new THREE.ExtrudeGeometry(roof,{depth:.8,bevelEnabled:true,bevelSize:.35,bevelThickness:.25,bevelSegments:3,curveSegments:24});vg.rotateX(Math.PI/2);mesh(visor,vg,white,'Swept_low_visor',0,6.2,0);
  tube(visor,[[-6.5,6.5,3],[0,6.8,4],[6.5,6.5,3]],.35,accent);
  for(const s of [-1,1]){tube(canopy,[[s*18.38,12.1,0],[s*10,13,-2],[s*7.1,18,-10],[s*6.4,23,-11]],.95);tube(canopy,[[s*10,13,-2],[s*7.2,18,1],[s*5.8,26,1]],.8);}
  tube(canopy,[[0,12.1,18.38],[0,15,10],[0,24,1]],.85);
 }
 tube(canopy,[[4,23,-8],[5.2,18,-5],[6,12.6,2]],.4,model.materials.black);
 return model;
}

(() => {
 const scenes=[];let close=true,current='perspective';
 for(const [index,kind]of ['shell','cage','visor'].entries()){
  const canvas=document.querySelectorAll('canvas')[index],renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));configureDroneRenderer(THREE,renderer);renderer.setClearColor('#f4f3ee');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.001,3),controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.minDistance=.038;controls.maxDistance=.45;
  addDroneReflections(THREE,renderer,scene);scene.add(new THREE.HemisphereLight(0xfaf8e5,0x768367,2.4));const key=new THREE.DirectionalLight(0xfff0d5,3);key.position.set(-.35,.75,-.25);scene.add(key);const fill=new THREE.DirectionalLight(0xe0efff,1);fill.position.set(.3,.2,.3);scene.add(fill);
  const drone=createCanopyStudy(kind);scene.add(drone.root);
  const render=()=>renderer.render(scene,camera);controls.addEventListener('change',render);scenes.push({camera,controls,renderer,render,canvas});
 }
 function reset(){for(const {camera,controls,render}of scenes){const target=close?[0,.022,-.004]:[0,.015,0],distance=close?.085:.29,positions={perspective:[.75,.42,-1],front:[0,.12,-1],side:[1,.12,0],top:[0,1,.001],rear:[.5,.28,1]};controls.target.set(...target);camera.position.copy(controls.target).add(new THREE.Vector3(...positions[current]).normalize().multiplyScalar(distance));controls.update();render();}}
 new ResizeObserver(()=>{for(const {canvas,renderer,camera,render}of scenes){renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();render();}}).observe(document.querySelector('main'));
 for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{current=button.dataset.view;for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b===button));reset();});
 document.querySelector('#framing').addEventListener('click',e=>{close=!close;e.currentTarget.textContent=close?'Show whole drone':'Canopy close-up';reset();});reset();document.querySelector('#loading').remove();
})();
