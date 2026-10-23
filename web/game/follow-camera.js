import * as THREE from 'three';
import {DroneCameraRig} from './camera-rig.js';
export class FollowCamera {
  constructor(camera){this.rig=new DroneCameraRig(camera);}
  update(config,model,pose,view,dt,settings){
    if(this.model!==model){
      const anchor=new THREE.Group();anchor.userData.fpvCameraOffset=model.userData.fpvCameraOffset;
      this.rig.configure(config,anchor);this.model=model;
    }
    this.rig.setSettings(settings?.angle??(config.kind==='fixedWing'?0:20),settings?.fov??100);
    if(this.rig.view!==view)this.rig.setView(view);
    const q=model.quaternion;
    const p=model.position.clone().sub(new THREE.Vector3(...config.visualOffsetM).applyQuaternion(q));
    this.rig.update(p,q,dt);
    model.visible=view!=='fpv-clean';
  }
}
