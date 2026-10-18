import { writeFile } from "node:fs/promises";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { createTrainerModel } from "../shared/visual/fixed-wing-model.js";
import { createScoutModel } from "../shared/visual/scout-model.js";
import { createWarbirdModel } from '../shared/visual/warbird-model.js';

// The exporter uses FileReader for its binary Blob; no DOM or texture canvas is
// needed by this solid-material aircraft. Keep the browser factory as the source.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
};
const scout = process.argv.includes("--scout");
const warbird = process.argv.includes('--warbird');
const model = warbird ? createWarbirdModel() : scout ? createScoutModel() : createTrainerModel();
const binary = await new GLTFExporter().parseAsync(model, { binary: true });
await writeFile(
  new URL(
    `../web/assets/models/${warbird ? 'rift-a40' : scout ? "rift-s75" : "rift-t15"}.glb`,
    import.meta.url,
  ),
  Buffer.from(binary),
);
console.log(
  `${model.name} GLB: ${Math.round(binary.byteLength / 1024)} KiB`,
);
