import * as THREE from "three";

// A shutter representation, not an RPM claim: sharply sampled two-blade props
// alias at display refresh rates. Blend the real blades into their swept area.
export const AIRPLANE_VISUAL_ROTOR_SPEED = 70;
export class AirplanePropellerExposure {
  constructor(model, radius = 0.127) {
    this.blades = [];
    this.discs = [];
    model.traverse((prop) => {
      if (!prop.userData.propeller) return;
      for (const blade of prop.children.filter(
        (o) => o.isMesh && o.userData.bladeIndex !== undefined,
      )) {
        const original = blade.material;
        blade.material = original.clone();
        this.blades.push({ blade, original, castShadow: blade.castShadow });
      }
      const geometry = new THREE.RingGeometry(radius * 0.14, radius, 64, 4);
      const colors = [],
        positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const r = Math.hypot(positions.getX(i), positions.getY(i)) / radius;
        const alpha =
          Math.min(1, Math.max(0, (r - 0.14) / 0.16)) *
          Math.min(1, (1 - r) / 0.1);
        colors.push(1, 1, 1, Math.max(0, alpha));
      }
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 4),
      );
      const material = new THREE.MeshBasicMaterial({
        color: "#22343f",
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const disc = new THREE.Mesh(geometry, material);
      disc.name = prop.name + "_exposure";
      disc.visible = false;
      prop.add(disc);
      this.discs.push(disc);
    });
  }
  update(fraction = 0) {
    const speed = Math.max(0, Math.min(1, fraction)),
      t = Math.max(0, Math.min(1, (speed - 0.12) / 0.73));
    const blur = t * t * (3 - 2 * t);
    for (const { blade, original, castShadow } of this.blades) {
      blade.visible = blade.userData.propellerDamageState !== 3 && blur < 0.999;
      blade.castShadow = blur === 0 && castShadow;
      blade.material.opacity = original.opacity * (1 - blur);
      blade.material.transparent = blur > 0 || original.transparent;
      blade.material.depthWrite = blur === 0 && original.depthWrite;
    }
    for (const disc of this.discs) {
      const blades = this.blades.filter(
        (entry) => entry.blade.parent === disc.parent,
      );
      const states = blades.map(
        (entry) => entry.blade.userData.propellerDamageState ?? 0,
      );
      const remaining =
        states.reduce((sum, state) => sum + [1, 0.95, 0.55, 0][state], 0) / 2;
      disc.visible = blur > 0 && remaining > 0;
      disc.scale.setScalar(Math.min(...states) >= 2 ? 0.6 : 1);
      disc.material.opacity = (0.045 + speed * 0.15) * blur * remaining;
    }
  }
  dispose() {
    for (const { blade, original, castShadow } of this.blades) {
      blade.material.dispose();
      blade.material = original;
      blade.visible = true;
      blade.castShadow = castShadow;
    }
    for (const disc of this.discs) {
      disc.removeFromParent();
      disc.geometry.dispose();
      disc.material.dispose();
    }
    this.blades.length = 0;
    this.discs.length = 0;
  }
}

// Damage geometry belongs to this instance; source GLB meshes remain reusable.
export class AirplanePropellerVisual {
  constructor(model, radius) {
    this.radius = radius;
    this.blades = [];
    model.traverse((blade) => {
      if (blade.isMesh && blade.userData.bladeIndex !== undefined)
        this.blades.push({ blade, original: blade.geometry, state: 0 });
    });
  }
  update(states = [0, 0]) {
    for (const entry of this.blades) {
      const { blade, original } = entry,
        state = states[blade.userData.bladeIndex];
      if (entry.state === state) continue;
      if (blade.geometry !== original) blade.geometry.dispose();
      blade.geometry = original;
      if (state === 1 || state === 2) {
        const geometry = original.clone(),
          p = geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i),
            y = p.getY(i),
            r = Math.hypot(x, y),
            tip = r / this.radius;
          const shortened =
            state === 2 && tip > 0.55 ? (0.55 + (tip - 0.55) * 0.15) / tip : 1;
          p.setXYZ(
            i,
            x * shortened,
            y * shortened,
            p.getZ(i) + this.radius * 0.17 * tip ** 2,
          );
        }
        p.needsUpdate = true;
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        blade.geometry = geometry;
      }
      blade.visible = state !== 3;
      blade.userData.propellerDamageState = state;
      entry.state = state;
    }
  }
  dispose() {
    for (const { blade, original } of this.blades) {
      if (blade.geometry !== original) blade.geometry.dispose();
      blade.geometry = original;
      blade.visible = true;
      delete blade.userData.propellerDamageState;
    }
  }
}
