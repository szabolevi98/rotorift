import * as THREE from 'three';

// A fast rotor cannot be drawn as three almost opaque, frozen blades in each
// frame: it strobes across the terrain. Approximate camera exposure with a
// faint swept disc in FPV and external views. Only the blades change; hubs,
// guards and the airframe keep their opaque geometry. Geometry is shared by
// four rotors and needs no offscreen render or per-frame texture generation.
export class FpvPropellers {
  constructor(model, config, propVisual) {
    this.maxThrust = config.motor.maxThrustN;
    this.rotors = [];
    const radius = config.propDiameterM / 2;
    this.geometry = new THREE.RingGeometry(radius * .2, radius, 48, 3).rotateX(-Math.PI / 2);
    const positions = this.geometry.attributes.position, colors = [];
    for(let i=0;i<positions.count;i++) {
      const r = Math.hypot(positions.getX(i),positions.getZ(i)) / radius;
      const alpha = Math.max(0,Math.min(1,(r-.2)/.2)*Math.min(1,(1-r)/.12));
      colors.push(1,1,1,alpha);
    }
    this.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
    model.traverse(prop=>{
      if(!prop.userData.propeller)return;
      const entries=propVisual.entries.filter(entry=>entry.motor===prop.userData.motorIndex);
      if(!entries.length)return;
      const source=Array.isArray(entries[0].mesh.material)?entries[0].mesh.material[0]:entries[0].mesh.material;
      const material=new THREE.MeshBasicMaterial({color:source.color,vertexColors:true,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide});
      const disc=new THREE.Mesh(this.geometry,material);disc.name='FPV_rotor_exposure';disc.position.y=.0015;disc.visible=false;
      prop.add(disc);
      this.rotors.push({disc,motor:prop.userData.motorIndex,entries:entries.map(entry=>{
        const original=entry.mesh.material;
        entry.mesh.material=Array.isArray(original)?original.map(m=>m.clone()):original.clone();
        const materials=(Array.isArray(entry.mesh.material)?entry.mesh.material:[entry.mesh.material]).map(material=>({material,opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite}));
        return {entry,castShadow:entry.mesh.castShadow,original,materials};
      })});
    });
  }
  update(view, thrust, fractions) {
    for(const rotor of this.rotors) {
      const speed=fractions?.[rotor.motor]??Math.sqrt(Math.max(0,Math.min(1,thrust[rotor.motor]/this.maxThrust)));
      // External hover should already look like fast rotation. The FPV curve
      // retains its existing exposure; clean FPV hides the entire local model.
      const raw=Math.max(0,Math.min(1,view==='chase'?(speed-.06)/.29:(speed-.12)/.53));
      const blur=view==='fpv'||view==='chase'?raw*raw*(3-2*raw):0;
      const states=new Map(rotor.entries.map(({entry})=>[entry.blade,entry.state]));
      const remaining=[...states.values()].reduce((sum,state)=>sum+[1,.95,.55,0][state],0)/3;
      rotor.disc.scale.setScalar(Math.min(...states.values())>=2?.6:1);
      rotor.disc.visible=blur>0&&remaining>0;
      rotor.disc.material.opacity=(.04+.12*speed)*remaining*blur;
      for(const {entry,castShadow,materials}of rotor.entries) {
        entry.mesh.visible=blur<.999&&entry.state!==3;
        entry.mesh.castShadow=blur>0?false:castShadow;
        for(const state of materials){state.material.opacity=state.opacity*(1-blur);state.material.transparent=blur>0||state.transparent;state.material.depthWrite=blur>0?false:state.depthWrite;}
      }
    }
  }
  dispose() {
    for(const rotor of this.rotors) {
      for(const {entry,castShadow,original,materials}of rotor.entries){entry.mesh.visible=entry.state!==3;entry.mesh.castShadow=castShadow;for(const {material}of materials)material.dispose();entry.mesh.material=original;}
      rotor.disc.removeFromParent();rotor.disc.material.dispose();
    }
    this.geometry.dispose();this.rotors.length=0;
  }
}
