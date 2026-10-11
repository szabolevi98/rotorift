import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDrone, validateMap } from "../shared/physics/config.js";
export async function loadCatalog() {
  const load = async (dir) =>
    Promise.all(
      (await readdir(new URL("../data/" + dir + "/", import.meta.url)))
        .filter((f) => f.endsWith(".json"))
        .map(async (f) =>
          JSON.parse(
            await readFile(
              new URL("../data/" + dir + "/" + f, import.meta.url),
              "utf8",
            ),
          ),
        ),
    );
  const drones = await load("drones"),
    maps = await load("maps");
  for (const d of drones) {
    validateDrone(d);
    d.configHash = createHash("sha256")
      .update(JSON.stringify(d))
      .digest("hex")
      .slice(0, 16);
  }
  for (const m of maps) validateMap(m);
  return { drones, maps };
}
