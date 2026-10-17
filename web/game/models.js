import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { tagDroneColorMaterials } from "../../shared/visual/drone-colors.js";
import { configureDronePolymer } from "../../shared/visual/drone-rendering.js";
import { paintLoading } from "../loading.js";
import {createTrainerModel} from '../../shared/visual/fixed-wing-model.js';
const cache = new Map(),
  loader = new GLTFLoader();
export async function loadModel(config, { isolateMaterials = false, onProgress } = {}) {
  if(config.kind==='fixedWing'){onProgress?.({phase:'prepare'});return createTrainerModel();}
  let entry = cache.get(config.id);
  if (!entry) {
    entry = { listeners: new Set(), progress: { phase: "download", loaded: 0, total: 0 } };
    cache.set(config.id, entry);
    const report = progress => {
      entry.progress = progress;
      for (const listener of entry.listeners) listener(progress);
    };
    entry.promise = loader.loadAsync(config.model, event => report({
      phase: "download", loaded: event.loaded, total: event.lengthComputable ? event.total : 0,
    })).then(async ({ scene }) => {
        report({ phase: "prepare" });
        await paintLoading();
        tagDroneColorMaterials(scene);
        scene.traverse(object => {
          for (const material of Array.isArray(object.material) ? object.material : [object.material])
            if (material?.userData.droneColorRole === "base") configureDronePolymer(material);
        });
        scene.updateMatrixWorld(true);
        // Place FPV just outside the actual optical surface, rather than inside
        // the camera housing. Metadata survives the static mesh batching below.
        const lens = scene.getObjectByName('FPV_multicoated_lens') ?? scene.getObjectByName('FPV_multicoated_front_lens') ?? scene.getObjectByName('FPV_coated_lens');
        const batches = new Map(),
          root = new THREE.Group(),
          props = new Map();
        if (lens) {
          const forward = new THREE.Vector3(0, -1, 0).applyQuaternion(lens.getWorldQuaternion(new THREE.Quaternion()));
          root.userData.fpvCameraOffset = lens.getWorldPosition(new THREE.Vector3()).addScaledVector(forward, .001).toArray();
        }
        scene.traverse((o) => {
          if (!o.isMesh) return;
          let ancestor = o.parent,
            prop = null;
          while (ancestor) {
            if (
              /^(Propeller_\d|(?:65|75)_04_Propeller_|C3_05_Pusher_propeller_)/.test(
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
                phaseOffset:new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().extractRotation(prop.matrixWorld)).y,
                motorIndex:config.motors.reduce((best,m,i)=>Math.hypot(g.position.x-m.positionM[0],g.position.z-m.positionM[2])<Math.hypot(g.position.x-config.motors[best].positionM[0],g.position.z-config.motors[best].positionM[2])?i:best,0),
                direction:
                  (g.position.x * g.position.z >= 0 ? 1 : -1) *
                  (config.category === "cinewhoop" ? -1 : 1),
              };
              root.add(g);
              props.set(prop, g);
            }
            parent = props.get(prop);
            pivot = parent.position;
            if (/^Twisted_.*blade/.test(o.name)) {
              const blade = new THREE.Group();
              // Count blades rather than material batches or source traversal order.
              blade.userData.bladeIndex = parent.children.filter(child=>child.userData.bladeIndex!==undefined).length;
              blade.name = `Blade_${blade.userData.bladeIndex}`;
              parent.add(blade); parent = blade;
            } else if (/^Blade_root/.test(o.name)) {
              parent = parent.children.filter(child=>child.userData.bladeIndex!==undefined).at(-1) ?? parent;
            }
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
      }).catch(error => {
        // A temporary network failure must not permanently poison the cache.
        if (cache.get(config.id) === entry) cache.delete(config.id);
        throw error;
      });
  }
  if (onProgress) { entry.listeners.add(onProgress); onProgress(entry.progress); }
  try {
    const model = (await entry.promise).clone();
    if (isolateMaterials) isolateModelMaterials(model);
    return model;
  } finally {
    if (onProgress) entry.listeners.delete(onProgress);
  }
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
  const geometries = new Set();
  model?.traverse(object => {
    if(model.userData.proceduralAircraft&&object.geometry)geometries.add(object.geometry);
    if (object.isMesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const material of materials) material.dispose();
  for(const geometry of geometries)geometry.dispose();
}
