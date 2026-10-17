import * as THREE from 'three';

// Original trainer design, metres, nose -Z. A few solid lofts and hinged
// surfaces rather than a high-resolution downloaded aircraft asset.
export function createTrainerModel(){
  const root=new THREE.Group();root.name='Rift_T15';root.userData.proceduralAircraft=true;
  const white=new THREE.MeshStandardMaterial({color:'#e4e7de',roughness:.65}),accent=new THREE.MeshStandardMaterial({color:'#ff6648',roughness:.58});accent.userData.droneColorRole='base';
  const dark=new THREE.MeshStandardMaterial({color:'#222c32',roughness:.65}),metal=new THREE.MeshStandardMaterial({color:'#82979b',metalness:.65,roughness:.3}),glass=new THREE.MeshStandardMaterial({color:'#375366',metalness:.25,roughness:.17});
  const mesh=(geometry,material,parent=root,name='')=>{const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
  const box=(size,p,mat=white,parent=root,name='')=>{const m=mesh(new THREE.BoxGeometry(...size),mat,parent,name);m.position.set(...p);return m;};
  function loft(sections,profile,mat,name){
    const vertices=[],indices=[],n=profile.length;
    for(const s of sections)for(const [a,b]of profile)vertices.push(...s(a,b));
    for(let i=0;i<sections.length-1;i++)for(let j=0;j<n;j++){const k=i*n+j,l=i*n+(j+1)%n;indices.push(k,l,l+n,k,l+n,k+n);}
    for(let j=1;j<n-1;j++){indices.push(0,j+1,j);const k=(sections.length-1)*n;indices.push(k,k+j,k+j+1);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return mesh(geometry,mat,root,name);
  }
  const oval=Array.from({length:10},(_,i)=>[Math.cos(i*Math.PI/5),Math.sin(i*Math.PI/5)]);
  loft([[-.51,.032,.035,.012],[-.36,.063,.065,.01],[-.08,.066,.07,0],[.16,.045,.052,0],[.43,.019,.028,.024],[.55,.009,.016,.035]].map(([z,w,h,y])=>(a,b)=>[a*w,y+b*h,z]),oval,white,'T15_fuselage');
  const wingProfile=[[-.12,0],[-.11,.012],[-.065,.024],[.025,.015],[.09,.002],[.09,-.004],[-.065,-.008],[-.115,-.005]];
  loft([[-.75,.16,.83],[-.65,.15,.95],[0,.12,1],[.65,.15,.95],[.75,.16,.83]].map(([x,y,scale])=>(z,h)=>[x,y+h,z*scale-.02]),wingProfile,white,'T15_airfoil_wing');
  for(const side of [-1,1]){
    const tip=box([.13,.008,.185],[side*.68,.164,-.032],accent);tip.rotation.z=side*.06;
    const stripe=box([.042,.006,.19],[side*.49,.163,-.031],dark);stripe.rotation.z=side*.06;
    const hinge=new THREE.Group();hinge.position.set(side*.48,.142,.067);hinge.userData.surface='aileron';hinge.userData.side=side;root.add(hinge);
    box([.39,.009,.048],[0,0,.024],accent,hinge,'T15_aileron');
    const strut=mesh(new THREE.CylinderGeometry(.005,.005,.52,6),metal);const from=new THREE.Vector3(side*.06,-.015,.02),to=new THREE.Vector3(side*.5,.135,-.015);strut.position.copy(from).add(to).multiplyScalar(.5);strut.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());
  }
  box([.5,.012,.105],[0,.045,.43],white,root,'T15_stabilizer');
  const elevator=new THREE.Group();elevator.position.set(0,.045,.482);elevator.userData.surface='elevator';root.add(elevator);box([.49,.01,.055],[0,0,.0275],accent,elevator);
  const fin=new THREE.Shape();fin.moveTo(.34,.04);fin.lineTo(.43,.23);fin.lineTo(.52,.19);fin.lineTo(.54,.04);fin.closePath();
  const finMesh=mesh(new THREE.ExtrudeGeometry(fin,{depth:.012,bevelEnabled:false}),white);finMesh.rotation.y=-Math.PI/2;finMesh.position.x=.006;
  const rudder=new THREE.Group();rudder.position.set(0,.045,.52);rudder.userData.surface='rudder';root.add(rudder);box([.012,.145,.045],[0,.072,.0225],accent,rudder);
  const cabin=box([.112,.07,.17],[0,.075,-.19],glass,root,'T15_cabin');cabin.rotation.x=-.12;
  box([.116,.009,.11],[0,.113,-.185],white);
  for(const side of [-1,1])box([.005,.08,.009],[side*.057,.07,-.15],white);
  box([.078,.006,.19],[0,.074,-.345],accent,root,'T15_motor_cowl');
  for(const [x,z]of [[-.21,-.06],[.21,-.06],[0,-.38]]){
    const leg=mesh(new THREE.CylinderGeometry(.004,.004,.20,6),metal);leg.position.set(x*.5,-.12,z);leg.rotation.z=-Math.atan2(x,.18);
    const wheel=mesh(new THREE.CylinderGeometry(.06,.06,.027,12),dark);wheel.rotation.z=Math.PI/2;wheel.position.set(x,-.22,z);
    const hub=mesh(new THREE.CylinderGeometry(.021,.021,.029,10),metal);hub.rotation.z=Math.PI/2;hub.position.copy(wheel.position);
  }
  const prop=new THREE.Group();prop.position.set(0,.015,-.55);prop.name='T15_propeller';prop.userData={propeller:true,motorIndex:0,phaseOffset:0,axis:'z'};root.add(prop);
  for(const side of [-1,1]){const blade=box([.027,.115,.005],[side*.007,side*.066,0],dark,prop);blade.rotation.z=side*.12;}
  const spinner=mesh(new THREE.ConeGeometry(.025,.046,12),accent);spinner.rotation.x=-Math.PI/2;spinner.position.set(0,.015,-.568);
  const fpv=mesh(new THREE.CylinderGeometry(.012,.012,.022,10),dark);fpv.rotation.x=Math.PI/2;fpv.position.set(0,.135,-.22);
  const lens=mesh(new THREE.CircleGeometry(.009,12),glass);lens.rotation.y=Math.PI;lens.position.set(0,.135,-.232);
  root.updateMatrixWorld(true);return root;
}
export function animateTrainer(model,surfaces,phase){
  model.traverse(o=>{
    if(o.userData.propeller)o.rotation.z=phase;
    if(o.userData.surface==='aileron')o.rotation.x=-surfaces.roll*o.userData.side*.45;
    if(o.userData.surface==='elevator')o.rotation.x=surfaces.pitch*.4;
    if(o.userData.surface==='rudder')o.rotation.y=surfaces.yaw*.4;
  });
}
