import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {sanitizeGhost,ghostPose} from '../../shared/race/ghost.js';
export class LapGhostPilot {
  constructor(scene,source,config,replay,label) {
    this.replay=sanitizeGhost(replay);this.label=label;this.config=config;
    this.model=new THREE.Group();this.model.name='Lap ghost';this.props=[];this.geometries=[];
    this.material=new THREE.MeshBasicMaterial({color:0x85ffe4,transparent:true,opacity:.3,depthWrite:false,toneMapped:false});
    // One body draw plus four rotor draws. Colored/material batches from the
    // detailed model do not need separate calls for a single-color ghost.
    source.updateMatrixWorld(true);const buckets=new Map();
    source.traverse(o=>{
      if(!o.isMesh)return;
      let pivot=o.parent;while(pivot&&pivot!==source&&!pivot.userData.propeller)pivot=pivot.parent;
      pivot??=source;
      const geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().copy(pivot.matrixWorld).invert().multiply(o.matrixWorld));
      for(const key of Object.keys(geometry.attributes))if(key!=='position')geometry.deleteAttribute(key);
      if(!buckets.has(pivot))buckets.set(pivot,[]);buckets.get(pivot).push(geometry);
    });
    for(const[pivot,parts]of buckets){
      const geometry=mergeGeometries(parts,false);for(const part of parts)part.dispose();this.geometries.push(geometry);
      const mesh=new THREE.Mesh(geometry,this.material);
      if(pivot===source)this.model.add(mesh);
      else {const rotor=new THREE.Group();rotor.position.copy(pivot.position);rotor.quaternion.copy(pivot.quaternion);rotor.scale.copy(pivot.scale);rotor.userData={...pivot.userData};rotor.add(mesh);this.model.add(rotor);this.props.push(rotor);}
    }
    this.model.visible=false;scene.add(this.model);
    this.position=new THREE.Vector3();this.offset=new THREE.Vector3(...config.visualOffsetM);
    this.rotation=new THREE.Quaternion();this.lastMs=null;
  }
  update(ms,playerPosition) {
    const pose=this.replay&&Number.isFinite(ms)?ghostPose(this.replay,ms):null;
    this.model.visible=!!pose;
    if(!pose)return;
    this.position.set(...pose.p);this.rotation.set(pose.q.x,pose.q.y,pose.q.z,pose.q.w);
    this.model.position.copy(this.offset).applyQuaternion(this.rotation).add(this.position);
    this.model.quaternion.copy(this.rotation);
    if(playerPosition&&this.position.distanceTo(new THREE.Vector3(...playerPosition))<this.config.motorDiagonalM*.65)this.model.visible=false;
    for(const prop of this.props)prop.rotation.y=ms*.014*this.config.motors[prop.userData.motorIndex].direction;
  }
  dispose(){this.model.removeFromParent();this.material.dispose();for(const geometry of this.geometries)geometry.dispose();}
}
