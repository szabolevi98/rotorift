import * as THREE from 'three';
import { aircraftMeshTools, sectionSampler, samples, airfoilContour, airfoilHeight } from './aircraft-mesh-utils.js';
import { batchAirplaneShell } from './airplane-model-utils.js';
import { configureDronePolymer } from './drone-rendering.js';

// Original 400 mm foam warbird, inspired by the P-51D's silhouette. Metres,
// Y up, -Z forward. Windows replace the skin; paint never conceals a second hull.
export function createWarbirdModel({batchStatic=true}={}) {
  const root=new THREE.Group();root.name='Rift_Aero_40';root.userData.proceduralAircraft=true;
  const {mesh,loft,rod,tube}=aircraftMeshTools(root);
  const material=(color,roughness=.55,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const silver=material('#b9c4c6',.48,.32),dark=material('#253137',.7),
    accent=material('#ff6648',.5),white=material('#e7e9dd'),glass=material('#244a5b',.17,.28),
    olive=material('#45504a',.73),metal=material('#9ca6a8',.3,.7),rubber=material('#202629',.95);
  accent.userData.droneColorRole='base';configureDronePolymer(accent);
  const body=sectionSampler([
    [-.145,.0128,.0128,.001],[-.132,.0175,.016,.001],[-.107,.0202,.018,.001],
    [-.075,.0205,.0185,0],[-.043,.019,.018,0],[-.012,.0178,.0175,0],
    [.022,.0159,.0162,.001],[.055,.0125,.013,.003],[.09,.0085,.009,.006],
    [.123,.0047,.0057,.009],[.145,.0014,.0023,.01],
  ]);
  const canopyStart=-.048,canopyEnd=.041;
  function skin(z,angle,offset=0) {
    const [w,h,cy]=body(z),t=THREE.MathUtils.clamp((z-canopyStart)/(canopyEnd-canopyStart),0,1);
    const bump=.0215*Math.sin(Math.PI*t)**1.45;
    return new THREE.Vector3((w+offset)*Math.cos(angle),cy+(h+offset+(Math.sin(angle)>0?bump:0))*Math.sin(angle),z);
  }
  function normal(z,angle) {
    return skin(z,angle+.0001).sub(skin(z,angle-.0001)).cross(skin(z+.00001,angle).sub(skin(z-.00001,angle))).normalize();
  }
  function strip(zs,from,to,steps,mat,name,offset=0) {
    const positions=[],normals=[],indices=[];
    zs.forEach(z=>samples(from(z),to(z),steps).forEach(angle=>{
      const n=normal(z,angle),p=skin(z,angle).addScaledVector(n,offset);
      positions.push(...p.toArray());normals.push(...n.toArray());
    }));
    for(let i=0;i<zs.length-1;i++)for(let j=0;j<steps;j++) {
      const a=i*(steps+1)+j,b=a+1,c=b+steps+1,d=a+steps+1;
      indices.push(a,b,c,a,c,d);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);
    return mesh(g,mat,name);
  }
  const constant=v=>()=>v;
  for(const [start,end,n] of [[-.145,canopyStart,24],[canopyEnd,.145,24]])
    strip(samples(start,end,n),constant(0),constant(2*Math.PI),32,silver,'A40_fuselage');
  const windowEdge=z=>{
    const t=(z-canopyStart)/(canopyEnd-canopyStart);
    return Math.PI/2-1.08*Math.sqrt(Math.max(0,1-(2*t-1)**4));
  };
  const zs=samples(canopyStart,canopyEnd,32);
  strip(zs,constant(0),windowEdge,8,silver,'A40_cabin_shoulder_right');
  strip(zs,windowEdge,z=>Math.PI-windowEdge(z),16,glass,'A40_flush_bubble_canopy');
  strip(zs,z=>Math.PI-windowEdge(z),constant(Math.PI),8,silver,'A40_cabin_shoulder_left');
  strip(zs,constant(Math.PI),constant(2*Math.PI),16,silver,'A40_cabin_belly');
  strip(samples(-.138,-.052,15),constant(.87),constant(Math.PI-.87),8,olive,'A40_anti_glare_panel',.00015);
  for(const side of [1,-1]) {
    tube(zs.map(z=>skin(z,side>0?windowEdge(z):Math.PI-windowEdge(z),.00015).toArray()),.00038,dark,'A40_canopy_seal');
    // A shallow anti-glare panel, exhausts and a conformal fuselage accent band.
    strip(samples(.05,.064,4),constant(side>0?-.45:Math.PI-.45),constant(side>0?.45:Math.PI+.45),6,accent,'A40_tail_identification_band',.00018);
    for(let i=0;i<6;i++) {
      const z=-.127+i*.0063,p=skin(z,side>0?-.05:Math.PI+.05,.0001);
      rod(p.toArray(),p.clone().add(new THREE.Vector3(side*.003,-.0015,.0015)).toArray(),.00115,dark,'A40_exhaust_stub');
    }
  }
  tube(samples(windowEdge(-.024),Math.PI-windowEdge(-.024),20).map(a=>skin(-.024,a,.0002).toArray()),.00045,silver,'A40_windscreen_arch');
  // The cowl ring and spinner meet within 0.7 mm; no protruding axle.
  const ring=(z,r,y=.001)=>samples(0,Math.PI*2,31).slice(0,-1).map(a=>[Math.cos(a)*r,y+Math.sin(a)*r,z]);
  loft([ring(-.151,.0115),ring(-.145,.0128)],accent,'A40_nose_band');
  rod([0,.001,-.151],[0,.001,-.153],.003,metal,'A40_prop_hub');
  loft([[-.17,.0004],[-.168,.004],[-.163,.008],[-.158,.0105],[-.152,.0115]].map(([z,r])=>ring(z,r)),accent,'A40_spinner');
  const prop=new THREE.Group();prop.name='A40_tractor_propeller';prop.position.set(0,.001,-.152);prop.userData.propeller=true;root.add(prop);
  // Two working blades suit the 1S micro airframe; broad, swept and pitched.
  for(const side of [-1,1]) {
    const blade=loft([[.007,.003],[.018,.006],[.043,.0065],[.059,.0045],[.064,.0003]].map(([r,w])=>[
      [side*r,-w,.0018],[side*r,w,.0002],[side*r,w,-.0008],[side*r,-w,-.0002],
    ]),dark,'A40_propeller_blade',prop);
    if(side<0){const index=blade.geometry.index;for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}blade.geometry.computeVertexNormals();}
  }
  const wing=sectionSampler([[0,-.071,.09],[.055,-.067,.084],[.11,-.059,.074],[.155,-.049,.061],[.18,-.042,.049],[.19,-.036,.036],[.197,-.029,.019],[.2,-.021,.001]]);
  const wingY=x=>-.011+Math.abs(x)*.065;
  function wingRing(x,end=1,start=0,paint=0) {
    const [le,chord]=wing(Math.abs(x));
    return airfoilContour(chord,le,.11,end,start).map(([y,z],i)=>[x,wingY(x)+y+(i<=16?paint:-paint),z]);
  }
  const hingeZ=-.008,aileronStart=.076,aileronEnd=.174;
  for(const side of [-1,1]) {
    for(const [start,end,cut] of [[0,aileronStart,false],[aileronStart,aileronEnd,true],[aileronEnd,.2,false]]){
      const rings=samples(start,end,12).map(r=>{
        const [le,chord]=wing(r);return wingRing(side*r,cut?(hingeZ-le)/chord:1);
      });
      if(side<0)rings.reverse();
      loft(rings,silver,'A40_laminar_wing_'+side);
    }
    const pivot=new THREE.Group();pivot.name='A40_aileron_'+side;
    pivot.userData={surface:'aileron',side,hingeTilt:side*Math.atan(.065)};
    pivot.position.set(side*(aileronStart+aileronEnd)/2,wingY((aileronStart+aileronEnd)/2),hingeZ);
    pivot.rotation.z=pivot.userData.hingeTilt;root.add(pivot);pivot.updateMatrixWorld(true);
    const inverse=pivot.matrixWorld.clone().invert();
    const moving=samples(aileronStart+.00025,aileronEnd-.00025,10).map(r=>{
      const [le,chord]=wing(r);
      return wingRing(side*r,1,(hingeZ+.00012-le)/chord).map(p=>new THREE.Vector3(...p).applyMatrix4(inverse).toArray());
    });
    if(side<0)moving.reverse();
    loft(moving,silver,'A40_aileron_skin_'+side,pivot);
    // Painted invasion stripes follow the upper and lower airfoil exactly.
    for(const [a,b,mat] of [[.103,.113,white],[.113,.124,dark],[.124,.135,white],[.135,.146,dark],[.146,.157,white],[.183,.194,accent]]) {
      const movingBand=a>=aileronStart&&b<=aileronEnd;
      const front=samples(a,b,3).map(r=>{
        const [le,chord]=wing(r);return wingRing(side*r,movingBand?(hingeZ-le)/chord:1,0,.00017);
      });
      if(side<0)front.reverse();loft(front,mat,'A40_wing_paint_'+side,root,false);
      if(movingBand){
        const aft=samples(a,b,3).map(r=>{
          const [le,chord]=wing(r);return wingRing(side*r,1,(hingeZ+.00012-le)/chord,.00017).map(p=>new THREE.Vector3(...p).applyMatrix4(inverse).toArray());
        });
        if(side<0)aft.reverse();loft(aft,mat,'A40_aileron_paint_'+side,pivot,false);
      }
    }
    function insignia(shape,mat,height,name){
      const geometry=new THREE.ShapeGeometry(shape,20),positions=geometry.attributes.position;
      for(let i=0;i<positions.count;i++){
        const x=side*.051+positions.getX(i),z=-.033+positions.getY(i),[le,chord]=wing(Math.abs(x));
        const y=wingY(x)+airfoilHeight(chord,(z-le)/chord,1,.11)+height;
        positions.setXYZ(i,x,y,z);
      }
      // Shape coordinates are X/Z, so reverse winding for the upper face.
      const index=geometry.index;for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}
      geometry.computeVertexNormals();mesh(geometry,mat,name);
    }
    const badge=new THREE.Shape();badge.absarc(0,0,.0084,0,Math.PI*2,false);
    insignia(badge,dark,.00025,'A40_wing_roundel');
    const star=new THREE.Shape();
    for(let i=0;i<10;i++){const angle=-Math.PI/2+i*Math.PI/5,r=i%2?.0031:.0072;const point=[Math.cos(angle)*r,Math.sin(angle)*r];i?star.lineTo(...point):star.moveTo(...point);}star.closePath();
    insignia(star,white,.00031,'A40_wing_star');
  }
  // Rounded tailplanes with actual hinges, flush at neutral.
  const tail=sectionSampler([[0,.096,.051],[.04,.104,.042],[.064,.116,.026],[.073,.127,.006]]);
  const tailRing=(x,end=1)=>{const [le,chord]=tail(Math.abs(x));return airfoilContour(chord,le,.07,end).map(([y,z])=>[x,.012+y,z]);};
  loft(samples(-.073,.073,24).map(x=>{const [le,chord]=tail(Math.abs(x));return tailRing(x,Math.min(1,(.128-le)/chord));}),silver,'A40_horizontal_stabilizer');
  const elevator=new THREE.Group();elevator.name='A40_elevator';elevator.userData.surface='elevator';elevator.position.set(0,.012,.128);root.add(elevator);
  loft(samples(-.069,.069,24).map(x=>{
    const [le,chord]=tail(Math.abs(x)),te=le+chord;
    return [[x,0,.00015],[x,.0011,Math.max(.0003,te-.128)],[x,-.0011,Math.max(.0003,te-.128)],[x,-.0004,.00015]];
  }),accent,'A40_elevator_skin',elevator);
  const fin=[[.009,.092],[.024,.106],[.059,.119],[.072,.127],[.075,.132],[.071,.138],[.015,.138]];
  loft([-.0015,.0015].map(x=>fin.map(([y,z])=>[x,y,z])),silver,'A40_swept_vertical_fin');
  const rudder=new THREE.Group();rudder.name='A40_rudder';rudder.userData.surface='rudder';rudder.position.set(0,.015,.138);root.add(rudder);
  loft([-.0014,.0014].map(x=>[[x,0,.00015],[x,.056,.00015],[x,.057,.003],[x,.049,.01],[x,.005,.017],[x,0,.014]]),accent,'A40_rudder_skin',rudder);
  // P-51 belly radiator, a recessed dark mouth and a small outlet lip.
  loft([[-.005,.009,.008],[.015,.011,.012],[.044,.008,.007]].map(([z,w,d])=>[[w,-.013,z],[w,-.013-d,z],[-w,-.013-d,z],[-w,-.013,z]]),silver,'A40_belly_radiator');
  const intake=mesh(new THREE.PlaneGeometry(.013,.004),dark,'A40_radiator_intake');intake.rotation.y=Math.PI;intake.position.set(0,-.019,-.0052);
  // Light fixed micro-model undercarriage: slender main legs and a tail wheel.
  for(const side of [-1,1]) {
    rod([side*.041,-.008,-.023],[side*.047,-.056,-.027],.0012,metal,'A40_main_gear');
    const wheel=mesh(new THREE.CylinderGeometry(.013,.013,.007,18),rubber,'A40_main_tire');wheel.rotation.z=Math.PI/2;wheel.position.set(side*.047,-.056,-.027);
    const hub=mesh(new THREE.CylinderGeometry(.005,.005,.0073,14),metal,'A40_wheel_hub');hub.rotation.z=Math.PI/2;hub.position.copy(wheel.position);
  }
  rod([0,.004,.125],[0,-.013,.137],.0007,metal,'A40_tailwheel_leg');
  const rear=mesh(new THREE.CylinderGeometry(.005,.005,.003,12),rubber,'A40_tailwheel');rear.rotation.z=Math.PI/2;rear.position.set(0,-.014,.138);
  // Subtle FPV camera in the windshield; the view looks clear over the spinner.
  root.userData.fpvCameraOffset=[0,.036,-.042];
  root.updateMatrixWorld(true);
  if(batchStatic)batchAirplaneShell(root,'A40');
  return root;
}
