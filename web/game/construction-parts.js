import * as THREE from "three";
import { ColliderRegions } from "../../shared/world/collider-regions.js";

export function constructionTexture(kind) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  let seed = kind === "earth" ? 391 : 615;
  const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.fillStyle = kind === "earth" ? "#b7b2a5" : "#e3e0d5"; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14000; i++) {
    const v = Math.round(80 + rng() * 145);
    ctx.fillStyle = `rgba(${v},${v},${v},${kind === "earth" ? 0.34 : 0.18})`;
    ctx.fillRect(rng() * 256, rng() * 256, 0.6 + rng() * 2.2, 0.6 + rng() * 2.2);
  }
  if (kind !== "earth") {
    ctx.strokeStyle = "#9c9b9026"; ctx.lineWidth = 1;
    for (const y of [0, 128, 255]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
    for (const x of [10, 128, 246]) for (const y of [18, 108, 148, 236]) {
      ctx.fillStyle = "#66685c44"; ctx.beginPath(); ctx.arc(x, y, 1.7, 0, Math.PI * 2); ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

export function createConstructionParts(scene, world, RAPIER, { batchSize = 96 } = {}) {
  const root = new THREE.Group(); root.name = "Betonudvar_construction_site"; scene.add(root);
  const palette = {
    concrete: new THREE.MeshStandardMaterial({ color: 0xb4b0a4, roughness: 0.95, map: constructionTexture("concrete") }),
    concreteDark: new THREE.MeshStandardMaterial({ color: 0x898f8c, roughness: 0.94, map: constructionTexture("concrete") }),
    earth: new THREE.MeshStandardMaterial({ color: 0x9a886b, roughness: 1, map: constructionTexture("earth") }),
    gravel: new THREE.MeshStandardMaterial({ color: 0x878d89, roughness: 1, map: constructionTexture("earth") }),
    steel: new THREE.MeshStandardMaterial({ color: 0x47545a, metalness: 0.65, roughness: 0.55 }),
    rebar: new THREE.MeshStandardMaterial({ color: 0x664b38, metalness: 0.55, roughness: 0.73 }),
    ochre: new THREE.MeshStandardMaterial({ color: 0xd4a339, metalness: 0.18, roughness: 0.57 }),
    red: new THREE.MeshStandardMaterial({ color: 0xac4f38, metalness: 0.18, roughness: 0.63 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xff6648, roughness: 0.6 }),
    white: new THREE.MeshStandardMaterial({ color: 0xd8d9cf, roughness: 0.78 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x202624, roughness: 0.92 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x456b7a, metalness: 0.3, roughness: 0.12, clearcoat: 1 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x496c7b, metalness: 0.3, roughness: 0.65 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x9b7950, roughness: 0.85 }),
    brick: new THREE.MeshStandardMaterial({ color: 0xa4775a, roughness: 0.96 }),
  };
  palette.earthTerrain = palette.earth.clone();
  palette.earthTerrain.vertexColors = true;
  for (const material of [palette.earth, palette.earthTerrain, palette.gravel]) {
    // Instanced road slabs have very different lengths. Sample in metres,
    // rather than stretching a unit-box UV over an entire 570 m working road.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vSitePosition;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          vec4 sitePosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            sitePosition = instanceMatrix * sitePosition;
          #endif
          vSitePosition = (modelMatrix * sitePosition).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vSitePosition;")
        .replace("#include <map_fragment>", `#ifdef USE_MAP
          diffuseColor *= texture2D(map, vSitePosition.xz * 0.25);
          #endif`);
    };
    material.customProgramCacheKey = () => "rotorift-construction-world-texture-v1";
  }
  const ring = new THREE.Shape(); ring.absarc(0, 0, 0.5, 0, Math.PI * 2, false);
  const opening = new THREE.Path(); opening.absarc(0, 0, 0.39, 0, Math.PI * 2, true); ring.holes.push(opening);
  const pipe = new THREE.ExtrudeGeometry(ring, { depth: 1, bevelEnabled: false, curveSegments: 32 });
  pipe.translate(0, 0, -0.5); pipe.rotateX(-Math.PI / 2);
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1), cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
    cone: new THREE.ConeGeometry(0.5, 1, 16), sphere: new THREE.IcosahedronGeometry(0.5, 1), pipe,
  };
  geometries.sphere.computeVertexNormals();
  const batches = new Map(), colliders = [], landmarks = [];
  const regions = new ColliderRegions();
  let anchor = new THREE.Matrix4();
  const unit = new THREE.Vector3(1, 1, 1);
  const quaternion = (rotation) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
  function part(shape, size, position, color, solid = true, rotation = [0, 0, 0], visible = true) {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position), quaternion(rotation), new THREE.Vector3(...size));
    matrix.premultiply(anchor);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), scale = new THREE.Vector3(); matrix.decompose(p, q, scale);
    const key = `${shape}:${color}:${Math.floor(p.x / batchSize)}:${Math.floor(p.z / batchSize)}`;
    if (visible) {
      if (!batches.has(key)) batches.set(key, { shape, color, matrices: [] });
      batches.get(key).matrices.push(matrix);
    }
    if (solid && world) {
      let desc;
      if (solid === "mesh") {
        const g = geometries[shape].clone().applyMatrix4(matrix);
        const indices = g.index ? new Uint32Array(g.index.array) : Uint32Array.from({ length: g.attributes.position.count }, (_, i) => i);
        desc = RAPIER.ColliderDesc.trimesh(new Float32Array(g.attributes.position.array), indices);
        g.dispose();
      } else {
        desc = shape === "cylinder"
          ? RAPIER.ColliderDesc.cylinder(scale.y / 2, scale.x / 2)
          : RAPIER.ColliderDesc.cuboid(scale.x / 2, scale.y / 2, scale.z / 2);
        desc.setTranslation(p.x, p.y, p.z).setRotation(q);
      }
      const collider = world.createCollider(desc.setFriction(0.8)); colliders.push(collider);
      const bounds = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5)).applyMatrix4(matrix);
      regions.add(collider, bounds.min.toArray(), bounds.max.toArray());
    }
  }
  const box = (size, position, color, solid = true, rotation, visible = true) => part("box", size, position, color, solid, rotation, visible);
  const cylinder = (diameter, length, position, color, solid = true, rotation) => part("cylinder", [diameter, length, diameter], position, color, solid, rotation);
  function beam(a, b, width, color, solid = true, depth = width) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), delta = bv.clone().sub(av);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
    const euler = new THREE.Euler().setFromQuaternion(q);
    box([width, delta.length(), depth], av.add(bv).multiplyScalar(0.5).toArray(), color, solid, [euler.x, euler.y, euler.z]);
  }
  function model(name, position, angle, build) {
    const previous = anchor;
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(...position), quaternion(Array.isArray(angle) ? angle : [0, angle, 0]), unit);
    anchor = previous.clone().multiply(transform);
    landmarks.push({ name, position: new THREE.Vector3().setFromMatrixPosition(anchor).toArray() });
    try { build(); } finally { anchor = previous; }
  }
  function ground(geometry, color, solid = true, regional = false) {
    const mesh = new THREE.Mesh(geometry, palette[color]); mesh.receiveShadow = true; root.add(mesh);
    if (solid && world) {
      const collider = world.createCollider(RAPIER.ColliderDesc.trimesh(
      new Float32Array(geometry.attributes.position.array), new Uint32Array(geometry.index.array),
      ).setFriction(0.9));
      colliders.push(collider);
      if (regional) {
        geometry.computeBoundingBox();
        regions.add(collider, geometry.boundingBox.min.toArray(), geometry.boundingBox.max.toArray());
      }
    }
    return mesh;
  }
  function finish() {
    let instances = 0;
    for (const [key, batch] of batches) {
      const mesh = new THREE.InstancedMesh(geometries[batch.shape], palette[batch.color], batch.matrices.length);
      mesh.name = key;
      batch.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      // Thin ground aprons receive building shadows but need not cast their
      // own near-coplanar shadow across hundreds of metres of flat ground.
      mesh.castShadow = !(batch.shape === "box" && batch.color === "gravel");
      mesh.receiveShadow = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
      instances += batch.matrices.length;
    }
    root.userData = { landmarks, instances, batches: batches.size, colliders: colliders.length };
    batches.clear();
    return {
      root, update: (position, velocity) => {
        regions.update(position, velocity);
        root.userData.activeColliders = regions.activeCount + colliders.length - regions.entries.size;
      },
      dispose: () => {
        for (const collider of colliders) if (collider.isValid()) world.removeCollider(collider, false);
        const geometrySet = new Set(Object.values(geometries));
        root.traverse(object => { if (object.isMesh) { geometrySet.add(object.geometry); object.dispose?.(); } });
        for (const geometry of geometrySet) geometry.dispose();
        for (const material of Object.values(palette)) { material.map?.dispose(); material.dispose(); }
        scene.remove(root);
        regions.clear();
      },
    };
  }
  return { root, palette, part, box, cylinder, beam, model, ground, finish };
}
