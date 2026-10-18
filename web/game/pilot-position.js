import * as THREE from 'three';
import { PARK_LAKES, lakeDistance } from '../../shared/world/park-layout.js';
import { CITY_PLAZA } from '../../shared/world/city-layout.js';

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const EYE_HEIGHT = 1.7;

// Capture static analytic shapes before aircraft/remote bodies are created.
// Direct shape queries also see disabled regional colliders under a high-flying
// aircraft. Camera placement never enables them or advances the physics world.
export class PilotPositionPicker {
  constructor(RAPIER, world, map, heightAt) {
    this.RAPIER = RAPIER;
    this.world = world;
    this.map = map;
    this.heightAt = heightAt;
    this.entries = [];
    this.body = new RAPIER.Capsule(.55, .3);
    world.colliders.forEach(collider => {
      const shape = collider.shape, type = shape.type, types = RAPIER.ShapeType;
      let half;
      if (type === types.Cuboid) half = new THREE.Vector3(...['x','y','z'].map(k => shape.halfExtents[k]));
      else if ([types.Cylinder, types.Cone, types.Ball].includes(type))
        half = new THREE.Vector3(shape.radius, shape.halfHeight ?? shape.radius, shape.radius);
      else return; // Terrain is sampled through the map's exact height function.
      const p = collider.translation(), q = collider.rotation();
      const matrix = new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z), new THREE.Quaternion(q.x,q.y,q.z,q.w), new THREE.Vector3(1,1,1));
      const bounds = new THREE.Box3(half.clone().negate(), half).applyMatrix4(matrix);
      const vertical = [2*(q.x*q.y+q.z*q.w), 1-2*(q.x*q.x+q.z*q.z), 2*(q.y*q.z-q.x*q.w)].map(Math.abs);
      const upAxis = vertical.indexOf(Math.max(...vertical));
      const face = ['x','y','z'].filter((_,i) => i !== upAxis).map(k => (shape.halfExtents?.[k] ?? 0)*2);
      const support = type === types.Cuboid && vertical[upAxis] > .85 && Math.min(...face) >= 2.5 && face[0]*face[1] >= 24;
      this.entries.push({ collider, min: bounds.min.toArray(), max: bounds.max.toArray(), support });
    });
  }

  surfaceAt(x, z, ceiling) {
    let y = this.heightAt(x,z);
    if (!Number.isFinite(y) || y > ceiling + .3) return null;
    const ray = new this.RAPIER.Ray({ x, y: ceiling+.3, z }, { x:0, y:-1, z:0 });
    for (const entry of this.entries) {
      if (!entry.support || !entry.collider.isValid() || x < entry.min[0] || x > entry.max[0] || z < entry.min[2] || z > entry.max[2] || entry.max[1] < y) continue;
      const hit = entry.collider.castRayAndGetNormal(ray, ceiling+.3-y+.01, false);
      if (hit?.normal.y > .85) y = Math.max(y, ceiling+.3-hit.timeOfImpact);
    }
    if (this.map.kind === 'park' && PARK_LAKES.some(lake => lakeDistance(lake,x,z) <= 1.08 && y <= lake.waterY+.15)) return null;
    if (this.map.kind === 'city' && Math.abs(x-CITY_PLAZA.x) < 15.4 && Math.abs(z-CITY_PLAZA.z) < 9.4 && y < .8) return null;
    return y;
  }

  canStand(x, y, z) {
    // Check the feet as well as the eye: roof edges, small props and holes are
    // unsuitable even when the centre ray happens to hit something solid.
    for (const [dx,dz] of [[-.7,0],[.7,0],[0,-.7],[0,.7]]) {
      const floor = this.surfaceAt(x+dx,z+dz,y+.35);
      if (floor === null || Math.abs(floor-y) > .35) return false;
    }
    const p = { x, y:y+.95, z };
    for (const entry of this.entries) {
      if (!entry.collider.isValid() || x+.3 < entry.min[0] || x-.3 > entry.max[0] || z+.3 < entry.min[2] || z-.3 > entry.max[2] || y+1.8 < entry.min[1] || y+.1 > entry.max[1]) continue;
      if (entry.collider.intersectsShape(this.body,p,IDENTITY)) return false;
    }
    // Streamed park trunks may have been created after the static index.
    let blocked = false;
    this.world.intersectionsWithShape(p,IDENTITY,this.body,collider => {
      if (!collider.parent()) { blocked = true; return false; }
      return true;
    });
    return !blocked;
  }

  find(position) {
    const [x,altitude,z] = position;
    if (![x,altitude,z].every(Number.isFinite)) return null;
    const ceiling = Math.max(altitude,this.heightAt(x,z)+2);
    const preferredFloor = this.surfaceAt(x,z,ceiling);
    const tryPoint = (px,pz) => {
      const floor = this.surfaceAt(px,pz,ceiling);
      return floor !== null && this.canStand(px,floor,pz) ? new THREE.Vector3(px,floor+EYE_HEIGHT,pz) : null;
    };
    const directlyBelow = tryPoint(x,z);
    if (directlyBelow) return directlyBelow;
    // Stay nearby at roof edges. Larger rings also allow the middle of a lake
    // to resolve to dry shore rather than leaving the pilot underwater.
    let fallback = null;
    for (const radius of [2,4,8,12,20,32,48,64,96,128]) {
      for (let i=0;i<16;i++) {
        const angle = i*Math.PI/8, result = tryPoint(x+Math.cos(angle)*radius,z+Math.sin(angle)*radius);
        if (!result) continue;
        if (preferredFloor === null || Math.abs(result.y-EYE_HEIGHT-preferredFloor) < .5) return result;
        fallback ??= result;
      }
      // At an edge, try stepping inward on the same roof before dropping to
      // nearby ground. Do not jump across town to find another matching roof.
      if (radius >= 12 && fallback) return fallback;
    }
    return fallback;
  }
}
