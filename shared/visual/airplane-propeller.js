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
      for (const blade of prop.children.filter((o) => o.isMesh)) {
        const original = blade.material;
        blade.material = original.clone();
        this.blades.push({ blade, original, castShadow: blade.castShadow });
      }
      const geometry = new THREE.RingGeometry(0.018, radius, 64, 4);
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
      disc.name = "T15_propeller_exposure";
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
      blade.visible = blur < 0.999;
      blade.castShadow = blur === 0 && castShadow;
      blade.material.opacity = original.opacity * (1 - blur);
      blade.material.transparent = blur > 0 || original.transparent;
      blade.material.depthWrite = blur === 0 && original.depthWrite;
    }
    for (const disc of this.discs) {
      disc.visible = blur > 0;
      disc.material.opacity = (0.045 + speed * 0.15) * blur;
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
