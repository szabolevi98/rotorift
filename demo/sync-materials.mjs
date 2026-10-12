import { readFileSync, writeFileSync } from "node:fs";
import { Color } from "three";
import { DRONE_SURFACES } from "../shared/visual/drone-rendering.js";

// Update material-only revisions in the accepted GLBs without re-exporting
// their geometry, embedded textures, transforms or propeller pivots.
const lensNodes = new Set(["FPV_coated_lens", "FPV_multicoated_lens", "FPV_multicoated_front_lens", "Action_camera_lens", "Naked_camera_front_lens"]);
const pcbNodes = new Set(["Flight_controller_board", "AIO_26mm_mounting_PCB", "25_5mm_AIO_FC_ESC"]);
for (const id of ["x5", "65", "c3"]) {
  const file = new URL(`./rotorift-rift-${id}.glb`, import.meta.url);
  const source = readFileSync(file);
  if (source.readUInt32LE(0) !== 0x46546c67 || source.readUInt32LE(4) !== 2 || source.readUInt32LE(16) !== 0x4e4f534a)
    throw Error(`Invalid GLB: ${id}`);
  const jsonLength = source.readUInt32LE(12);
  const gltf = JSON.parse(source.subarray(20, 20 + jsonLength).toString("utf8"));
  for (const [names, preset] of [[lensNodes, DRONE_SURFACES.lens], [pcbNodes, DRONE_SURFACES.pcb]]) {
    const indices = new Set();
    for (const node of gltf.nodes) {
      if (!names.has(node.name)) continue;
      for (const primitive of gltf.meshes[node.mesh].primitives) indices.add(primitive.material);
    }
    if (indices.size !== 1) throw Error(`Expected one shared ${preset.name} material in ${id}`);
    const material = gltf.materials[[...indices][0]];
    material.name = preset.name;
    Object.assign(material.pbrMetallicRoughness, {
      baseColorFactor: [...new Color(preset.color).toArray(), 1],
      metallicFactor: preset.metalness, roughnessFactor: preset.roughness,
    });
    if (preset.clearcoat) {
      material.extensions ??= {};
      material.extensions.KHR_materials_clearcoat = { clearcoatFactor: preset.clearcoat, clearcoatRoughnessFactor: 0 };
    }
  }
  const json = Buffer.from(JSON.stringify(gltf));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20); json.copy(padded);
  const rest = source.subarray(20 + jsonLength);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + padded.length + rest.length, 8);
  header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const result = Buffer.concat([header, padded, rest]);
  writeFileSync(file, result);
  writeFileSync(new URL(`../web/assets/models/rotorift-rift-${id}.glb`, import.meta.url), result);
  console.log(`${id}: optical glass and green PCB synced; binary geometry/textures unchanged`);
}
