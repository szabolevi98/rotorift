import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { tagDroneColorMaterials } from "../../shared/visual/drone-colors.js";
import { configureDronePolymer } from "../../shared/visual/drone-rendering.js";
const cache = new Map(),
  loader = new GLTFLoader();
export async function loadModel(config, { isolateMaterials = false } = {}) {
  if (!cache.has(config.id))
    cache.set(
      config.id,
      loader.loadAsync(config.model).then(({ scene }) => {
        tagDroneColorMaterials(scene);
        scene.traverse(object => {
          for (const material of Array.isArray(object.material) ? object.material : [object.material])
            if (material?.userData.droneColorRole === "base") configureDronePolymer(material);
        });
        scene.updateMatrixWorld(true);
        const batches = new Map(),
          root = new THREE.Group(),
          props = new Map();
        scene.traverse((o) => {
          if (!o.isMesh) return;
          let ancestor = o.parent,
            prop = null;
          while (ancestor) {
            if (
              /^(Propeller_\d|65_04_Propeller_|C3_05_Pusher_propeller_)/.test(
                ancestor.name,
              )
            ) {
              prop = ancestor;
              break;
            }
            ancestor = ancestor.parent;
          }
          let parent = root,
            pivot = new THREE.Vector3();
          if (prop) {
            if (!props.has(prop)) {
              const g = new THREE.Group();
              g.name = prop.name;
              g.position.setFromMatrixPosition(prop.matrixWorld);
              g.userData = {
                propeller: true,
                direction:
                  (g.position.x * g.position.z >= 0 ? 1 : -1) *
                  (config.category === "cinewhoop" ? -1 : 1),
              };
              root.add(g);
              props.set(prop, g);
            }
            parent = props.get(prop);
            pivot = parent.position;
          }
          const source = o.geometry.index
            ? o.geometry.toNonIndexed()
            : o.geometry.clone();
          source.applyMatrix4(o.matrixWorld);
          source.translate(-pivot.x, -pivot.y, -pivot.z);
          for (const key of Object.keys(source.attributes))
            if (!["position", "normal", "uv"].includes(key))
              source.deleteAttribute(key);
          if (!source.attributes.normal) source.computeVertexNormals();
          if (!source.attributes.uv)
            source.setAttribute(
              "uv",
              new THREE.BufferAttribute(
                new Float32Array(source.attributes.position.count * 2),
                2,
              ),
            );
          const materials = Array.isArray(o.material)
            ? o.material
            : [o.material];
          const groups = Array.isArray(o.material)
            ? source.groups
            : [
                {
                  start: 0,
                  count: source.attributes.position.count,
                  materialIndex: 0,
                },
              ];
          if (!batches.has(parent)) batches.set(parent, new Map());
          const batch = batches.get(parent);
          for (const group of groups) {
            const mat = materials[group.materialIndex],
              g = new THREE.BufferGeometry();
            for (const [key, a] of Object.entries(source.attributes))
              g.setAttribute(
                key,
                new THREE.BufferAttribute(
                  a.array.slice(
                    group.start * a.itemSize,
                    (group.start + group.count) * a.itemSize,
                  ),
                  a.itemSize,
                ),
              );
            const list = batch.get(mat) ?? [];
            list.push(g);
            batch.set(mat, list);
          }
          source.dispose();
        });
        for (const [parent, batch] of batches)
          for (const [material, geometries] of batch) {
            const geometry = mergeGeometries(geometries, false);
            for (const g of geometries) g.dispose();
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            parent.add(mesh);
          }
        return root;
      }),
    );
  const model = (await cache.get(config.id)).clone();
  if (isolateMaterials) isolateModelMaterials(model);
  return model;
}
export function isolateModelMaterials(model) {
    // Flight lighting hooks must not change the cached menu/showcase materials.
    const copies = new Map();
    const copy = (material) => {
      if (!copies.has(material)) {
        const clone = material.clone();
        if (clone.userData.droneColorRole === "base") configureDronePolymer(clone);
        copies.set(material, clone);
      }
      return copies.get(material);
    };
    model.traverse((object) => {
      if (object.isMesh) object.material = Array.isArray(object.material)
        ? object.material.map(copy) : copy(object.material);
    });
}
export function disposeModelMaterials(model) {
  const materials = new Set();
  model?.traverse(object => {
    if (object.isMesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const material of materials) material.dispose();
}
