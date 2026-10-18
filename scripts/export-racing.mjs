import "./data-texture-export.mjs";
import { writeFile } from "node:fs/promises";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { createRacingModel } from "../shared/visual/racing-model.js";
const model = createRacingModel();
const binary = await new GLTFExporter().parseAsync(model, { binary: true });
await writeFile(
  new URL("../web/assets/models/rift-r5.glb", import.meta.url),
  Buffer.from(binary),
);
console.log(
  "Rift R5 GLB with embedded carbon and label: " +
    Math.round(binary.byteLength / 1024) +
    " KiB",
);
