import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDrone, validateMap } from "../shared/physics/config.js";
import { loadRoutes, DATA_ROOT } from "./routes.js";
import { resolveRoute } from "../shared/race/routes.js";
export async function loadCatalog(dataRoot = DATA_ROOT) {
  const load = async (dir) =>
    Promise.all(
      (await readdir(new URL(dir + "/", dataRoot)))
        .filter((f) => f.endsWith(".json"))
        .map(async (f) =>
          JSON.parse(
            await readFile(
              new URL(dir + "/" + f, dataRoot),
              "utf8",
            ),
          ),
        ),
    );
  const drones = await load("drones"),
    maps = await load("maps");
  const droneOrder=["rift-65","rift-75","rift-c3","rift-x5"];
  drones.sort((a,b)=>droneOrder.indexOf(a.id)-droneOrder.indexOf(b.id));
  for (const d of drones) {
    validateDrone(d);
    d.configHash = createHash("sha256")
      .update(JSON.stringify(d))
      .digest("hex")
      .slice(0, 16);
  }
  for (let i = 0; i < maps.length; i++) {
    const map = maps[i];
    validateMap(map);
    map.routes = await loadRoutes(map, dataRoot);
    if (map.routes.length) maps[i] = resolveRoute(map, map.routes[0].id);
  }
  return { drones, maps };
}
