import * as THREE from "three";
import { constructionHeight, CONSTRUCTION_ROADS, CONSTRUCTION_EARTHWORKS, CONSTRUCTION_SPOIL } from "../../shared/world/construction-layout.js";

export function buildConstructionTerrain(parts) {
  // One continuous height field: deposits, cuts and ramps share the same
  // triangulation for rendering and collision, with no overlapping surfaces.
  const earth = new THREE.Color(), light = new THREE.Color(0xd1b28a), dark = new THREE.Color(0x82705c);
  const heights = new Map();
  const height = (x, z) => {
    const key = `${x}:${z}`;
    if (!heights.has(key)) heights.set(key, constructionHeight(x, z));
    return heights.get(key);
  };
  for (let x = -300; x < 300; x += 100) for (let z = -300; z < 300; z += 100) {
    const geometry = new THREE.PlaneGeometry(100, 100, 50, 50); geometry.rotateX(-Math.PI / 2);
    geometry.translate(x + 50, 0, z + 50);
    const position = geometry.attributes.position, normal = geometry.attributes.normal, colors = [];
    for (let i = 0; i < position.count; i++) {
      const px = position.getX(i), pz = position.getZ(i), y = height(px, pz);
      position.setY(i, y);
      // Adjacent tiles use the same neighbours, so their lighting has no seam.
      const n = new THREE.Vector3((height(px - 2, pz) - height(px + 2, pz)) / 4, 1,
        (height(px, pz - 2) - height(px, pz + 2)) / 4).normalize();
      normal.setXYZ(i, n.x, n.y, n.z);
      const exposed = CONSTRUCTION_EARTHWORKS.some(p => Math.abs(px - p.x) < p.width / 2 && Math.abs(pz - p.z) < p.depth / 2);
      const deposit = CONSTRUCTION_SPOIL.some(p => Math.hypot((px - p.x) / p.rx, (pz - p.z) / p.rz) < 1);
      const grain = Math.sin(px * 0.16 + Math.cos(pz * 0.13)) * Math.sin(pz * 0.19);
      earth.copy(dark).lerp(light, (exposed ? 0.69 : deposit ? 0.58 : 0.32) + grain * 0.13);
      colors.push(earth.r, earth.g, earth.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const mesh = parts.ground(geometry, "earthTerrain", true, true);
    mesh.name = `earthworks-${x}-${z}`; mesh.castShadow = true;
  }
  const shape = new THREE.Shape(); const extent = 18000;
  shape.moveTo(-extent, -extent); shape.lineTo(extent, -extent); shape.lineTo(extent, extent); shape.lineTo(-extent, extent); shape.closePath();
  const hole = new THREE.Path(); hole.moveTo(-300, -300); hole.lineTo(-300, 300); hole.lineTo(300, 300); hole.lineTo(300, -300); hole.closePath(); shape.holes.push(hole);
  const outside = new THREE.ShapeGeometry(shape); outside.rotateX(-Math.PI / 2);
  parts.ground(outside, "earth").name = "bare-continuous-outside-ground";

  // Conforming road ribbons are offset decals over the physical height field.
  // They subdivide at the same two-metre grid, avoiding long floating slabs.
  for (const p of [...CONSTRUCTION_ROADS,
    { x: 172, z: 175, width: 110, depth: 110 }, { x: -168, z: 239, width: 84, depth: 66 }]) {
    const geometry = new THREE.PlaneGeometry(p.width, p.depth, Math.ceil(p.width / 2), Math.ceil(p.depth / 2));
    geometry.rotateX(-Math.PI / 2); geometry.translate(p.x, 0, p.z);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, constructionHeight(pos.getX(i), pos.getZ(i)) + 0.085);
    geometry.computeVertexNormals(); parts.ground(geometry, "gravel", false).name = "graded-working-road";
  }
}

export function buildEarthworkDetails(parts) {
  const { model, box, cylinder, beam } = parts;
  for (const p of CONSTRUCTION_EARTHWORKS) {
    const floor = constructionHeight(p.x, p.z - 4);
    model(p.id + "-foundation-work", [p.x, floor, p.z - 4], 0, () => {
      const spacing = p.id === "east-basement" ? 16 : 12;
      for (const x of [-spacing, 0, spacing]) for (const z of [-8, 8]) {
        box([4.8, 0.6, 4.8], [x, 0.3, z], "concrete");
        for (const sx of [-1, 1]) for (const sz of [-1, 1])
          cylinder(0.045, 2.4, [x + sx * 0.8, 1.8, z + sz * 0.8], "rebar", false);
        if (p.id !== "west-foundations") for (const sx of [-1, 1]) {
          box([0.15, 0.85, 5.2], [x + sx * 2.55, 0.425, z], "wood");
          beam([x + sx * 2.6, 0.8, z], [x + sx * 3.5, 0, z], 0.12, "wood");
        }
      }
      // Low grade beams mark the building plan, with the ramp lane kept clear.
      for (const z of [-8, 8]) box([spacing * 2, 0.4, 0.6], [0, 0.2, z], "concreteDark");
    });
    // Shoring on the north face; the other banks expose cut soil and ramps.
    if (p.ramp) for (let x = p.x - p.width / 2 + p.slope + 2; x < p.x + p.width / 2 - p.slope; x += 3) {
      const z = p.z - p.depth / 2 + p.slope;
      const y = constructionHeight(x, z);
      box([0.24, Math.abs(p.floor) + 0.7, 0.3], [x, y + (Math.abs(p.floor) + 0.7) / 2, z], "steel");
      for (let h = 0.4; h < Math.abs(p.floor); h += 0.45)
        box([2.95, 0.42, 0.15], [x + 1.5, y + h, z - 0.13], "wood");
    }
  }
  // Stones and broken clods collect along the toes of the spoil banks.
  // Instanced detail only: the supporting earth already supplies collision.
  for (const [index, p] of CONSTRUCTION_SPOIL.entries()) {
    for (let i = 0; i < 18; i++) {
      const a = i * 2.39996 + index, radius = 0.72 + 0.2 * Math.sin(i * 7.1) ** 2;
      const x = p.x + Math.cos(a) * p.rx * radius, z = p.z + Math.sin(a) * p.rz * radius;
      const size = 0.4 + 0.8 * Math.sin(i * 13.7 + index) ** 2;
      parts.part("sphere", [size * 1.4, size * 0.65, size], [x, constructionHeight(x, z) + size * 0.18, z], "gravel", false, [0.2, a, 0.3]);
    }
  }
  // Utility installation across a formerly empty eastern work zone.
  model("utility-pipe-installation", [154, constructionHeight(154, -17), -17], 0, () => {
    for (let z = -20; z <= 20; z += 5.5) {
      cylinder(1.1, 5.2, [0, 0.6, z], "concrete", true, [Math.PI / 2, 0, 0]);
      box([2.5, 0.25, 0.7], [0, 0.1, z + 1.6], "wood");
    }
    for (const x of [-4, 4]) for (let z = -24; z <= 24; z += 6) {
      box([0.09, 1.2, 0.09], [x, 0.6, z], "wood", false);
      box([0.06, 0.16, 6], [x, 1.1, z + 3], "orange", false);
    }
  });
}
