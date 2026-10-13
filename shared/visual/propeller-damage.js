import { freshPropellers, validPropellers } from "../physics/propellers.js";
export class PropellerVisual {
  constructor(model,config) {
    this.entries=[];this.config=config;
    model.traverse(prop=>{
      if(!prop.userData.propeller)return;
      for(const blade of prop.children)if(blade.userData.bladeIndex!==undefined){
        blade.traverse(mesh=>{if(mesh.isMesh)this.entries.push({mesh,original:mesh.geometry,state:0,motor:prop.userData.motorIndex,blade:blade.userData.bladeIndex});});
      }
    });
  }
  update(value) {
    const rotors=validPropellers(value)?value:freshPropellers();
    for(const entry of this.entries){
      const state=rotors[entry.motor][entry.blade];if(state===entry.state)continue;
      if(entry.mesh.geometry!==entry.original)entry.mesh.geometry.dispose();
      entry.mesh.geometry=entry.original;entry.mesh.visible=state!==3;
      if(state===1||state===2){
        const geometry=entry.original.clone(),position=geometry.attributes.position,radius=this.config.propDiameterM/2;
        for(let i=0;i<position.count;i++){
          const x=position.getX(i),z=position.getZ(i),r=Math.hypot(x,z),tip=Math.max(0,(r/radius-.25)/.75);
          const scale=state===2&&r>radius*.55 ? (radius*.55+(r-radius*.55)*.15)/r : 1;
          position.setXYZ(i,x*scale,position.getY(i)-radius*.22*tip*tip,z*scale);
        }
        geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();entry.mesh.geometry=geometry;
      }
      entry.state=state;
    }
  }
  dispose(){for(const entry of this.entries)if(entry.mesh.geometry!==entry.original){entry.mesh.geometry.dispose();entry.mesh.geometry=entry.original;}}
}
