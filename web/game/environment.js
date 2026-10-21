import {createWorldBackdrop} from './world-backdrop.js';
import { buildCircuit } from "./circuit.js";
import { CircuitTraffic } from "./circuit-traffic.js";
import * as THREE from "three";
import { buildPark } from "./park.js";
import { parkSurfaceHeight } from "../../shared/world/park-layout.js";
import { buildConstruction } from "./construction.js";
import { buildPlayground } from "./playground.js";
import { buildCity } from "./city.js";
import { createLaunchPad } from "./launch-pad.js";
import { createNeonGate, createRaceGuide, gateFrameParts } from "./race-course.js";
export function buildEnvironment(scene, world, RAPIER, map, { bakedCollisions } = {}) {
  const root = new THREE.Group();
  scene.add(root);
  let park, construction, playground, city, circuit;
  const staticWorld = bakedCollisions ? null : world;
  if (map.kind === "park") park = buildPark(scene, staticWorld, RAPIER, { ...map, gates: [], spawn: map.baseSpawn ?? map.spawn });
  else if(map.kind==="playground")playground=buildPlayground(scene,staticWorld,RAPIER,map);
  else if(map.kind==="city")city=buildCity(scene,staticWorld,RAPIER,map);
  else if(map.kind==="circuit")circuit=buildCircuit(scene,staticWorld,RAPIER,map);
  else construction = buildConstruction(scene, staticWorld, RAPIER, map);
  const environment=park??construction??playground??city??circuit;
  const backdrop=createWorldBackdrop(scene,map,environment.root);
  const traffic=map.kind==="circuit"?new CircuitTraffic(scene,world,RAPIER):null;
  const gateGroups = [], gateColliders = [];
  const guide=createRaceGuide(map.gates.length ? map.guide : undefined);root.add(guide);
  let gatesEnabled = true, highlighted=-1;
  map.gates.forEach((gate,i)=>{
    const group=createNeonGate(gate,i,{active:i===0});root.add(group);gateGroups.push(group);group.updateMatrixWorld(true);
    for(const [size,p]of gateFrameParts(gate)){
      const wp=new THREE.Vector3(...p).applyMatrix4(group.matrixWorld),q=group.getWorldQuaternion(new THREE.Quaternion());
      gateColliders.push(world.createCollider(RAPIER.ColliderDesc.cuboid(...size.map(v=>v/2)).setTranslation(wp.x,wp.y,wp.z).setRotation(q)));
    }
  });
  const pad = createLaunchPad(map.spawn, park
    ? (x,z) => parkSurfaceHeight(x,z)+.065
    : (x,z) => environment.heightAt(x,z));
  root.add(pad);
  return {
    root, traffic, dynamicTraffic: !!traffic,
    stepTraffic: traffic ? (time,seed) => traffic.step(time,seed) : undefined,
    renderTraffic: traffic ? (time,seed) => traffic.render(time,seed) : undefined,
    update: (position, velocity, observerPosition) => {
      environment?.update(position, velocity, observerPosition);
      bakedCollisions?.update(position, velocity);
    },
    heightAt: (x, z) => park ? parkSurfaceHeight(x, z) : environment.heightAt(x, z),
    highlight: (next, enabled) => {
      if (gatesEnabled !== enabled) {
        gatesEnabled = enabled;
        for (const group of gateGroups) group.visible = enabled;
        for (const collider of gateColliders) collider.setEnabled(enabled);
      }
      guide.visible=enabled;
      if(highlighted!==next){highlighted=next;gateGroups.forEach((group,i)=>group.userData.setState(i===next));guide.userData.highlight(next);}
    },
    dispose: () => {
      backdrop.dispose();traffic?.dispose();circuit?.dispose();park?.dispose();construction?.dispose();playground?.dispose();city?.dispose();bakedCollisions?.dispose();
      for(const collider of gateColliders)if(world.getCollider(collider.handle))world.removeCollider(collider,true);
      const geometries=new Set(),materials=new Set();
      root.traverse(o=>{if(o.geometry&&!o.isSprite)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);});
      for(const geometry of geometries)geometry.dispose();
      for(const material of materials){material.map?.dispose();material.dispose();}
      scene.remove(root);
    },
  };
}
