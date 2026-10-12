import * as THREE from "three";
import { DRONE_COLORS, normalizeDroneColor } from "../../shared/visual/drone-colors.js";

export const TRAIL_LIFETIME = 3;
export const TRAIL_CAPACITY = 128;
const INTERVAL = 1 / 30;

export class DroneTrail {
  constructor(scene, color, maxSpeed = 60) {
    this.scene = scene; this.maxSpeed = maxSpeed; this.points = []; this.resetId = null;
    const vertices = (TRAIL_CAPACITY - 1) * 4;
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("other", new THREE.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("fade", new THREE.BufferAttribute(new Float32Array(vertices), 1).setUsage(THREE.DynamicDrawUsage));
    const sides = [], directions = [], indices = [];
    for (let i = 0; i < TRAIL_CAPACITY - 1; i++) {
      const v = i * 4; sides.push(-1, 1, -1, 1); directions.push(1, 1, -1, -1);
      indices.push(v, v + 1, v + 2, v + 2, v + 1, v + 3);
    }
    this.geometry.setAttribute("side", new THREE.Float32BufferAttribute(sides, 1));
    this.geometry.setAttribute("direction", new THREE.Float32BufferAttribute(directions, 1));
    this.geometry.setIndex(indices); this.geometry.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
      uniforms: { trailColor: { value: new THREE.Color() }, resolution: { value: new THREE.Vector2(1280, 720) }, width: { value: 3 } },
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute vec3 other;
        attribute float side;
        attribute float direction;
        attribute float fade;
        uniform vec2 resolution;
        uniform float width;
        varying float vFade;
        void main() {
          vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vec4 next = projectionMatrix * modelViewMatrix * vec4(other, 1.0);
          vec2 delta = (next.xy / max(abs(next.w), 0.001) - clip.xy / max(abs(clip.w), 0.001)) * resolution * direction;
          vec2 normal = length(delta) > 0.0001 ? normalize(vec2(-delta.y, delta.x)) : vec2(1.0, 0.0);
          clip.xy += normal * side * width / resolution * clip.w;
          gl_Position = clip;
          vFade = fade;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `
        #include <logdepthbuf_pars_fragment>
        uniform vec3 trailColor;
        varying float vFade;
        void main() {
          if (vFade < 0.005) discard;
          #include <logdepthbuf_fragment>
          gl_FragColor = vec4(trailColor, vFade * 0.8);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = "Rotorift_remote_drone_trail"; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    scene.add(this.mesh); this.setColor(color);
  }
  setColor(value) { this.material.uniforms.trailColor.value.set(DRONE_COLORS[normalizeDroneColor(value)]); }
  clear() { this.points.length = 0; this.lastPosition = null; this.lastUpdate = null; this.geometry.setDrawRange(0, 0); }
  update(position, now, resetId = 0, width = 1280, height = 720) {
    this.material.uniforms.resolution.value.set(Math.max(1, width), Math.max(1, height));
    if (this.resetId !== resetId) { this.clear(); this.resetId = resetId; }
    if (this.lastPosition && (now - this.lastUpdate > 0.35 ||
      Math.hypot(...position.map((v,i)=>v-this.lastPosition[i])) > this.maxSpeed * Math.max(0,now-this.lastUpdate) + 1.5)) this.clear();
    this.lastPosition = [...position]; this.lastUpdate = now;
    const previous = this.points.at(-1);
    const distance = previous ? Math.hypot(...position.map((v, i) => v - previous.p[i])) : 0;
    const last = this.points.at(-1);
    if (!last || (now - last.t >= INTERVAL && distance >= 0.012)) this.points.push({ p: [...position], t: now });
    while (this.points.length > TRAIL_CAPACITY || (this.points.length && now - this.points[0].t > TRAIL_LIFETIME)) this.points.shift();
    const { position: positions, other, fade } = this.geometry.attributes;
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i], b = this.points[i + 1];
      for (let corner = 0; corner < 4; corner++) {
        const p = corner < 2 ? a : b, q = corner < 2 ? b : a, index = i * 4 + corner;
        positions.setXYZ(index, ...p.p); other.setXYZ(index, ...q.p);
        fade.setX(index, Math.max(0, 1 - (now - p.t) / TRAIL_LIFETIME));
      }
    }
    positions.needsUpdate = other.needsUpdate = fade.needsUpdate = true;
    this.geometry.setDrawRange(0, Math.max(0, this.points.length - 1) * 6);
  }
  dispose() { this.scene.remove(this.mesh); this.geometry.dispose(); this.material.dispose(); this.clear(); }
}
