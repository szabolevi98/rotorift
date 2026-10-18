import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateDrone, validateAirplane, validateMap } from "../shared/physics/config.js";
import { loadRoutes, DATA_ROOT } from "./routes.js";
import { resolveRoute } from "../shared/race/routes.js";
import { mapPresentation, compareMaps } from "../shared/catalog/maps.js";
// These original labels are part of already-published configuration hashes.
// A display-only rename must keep existing record/ghost categories intact.
const airplaneHashNames = { "rift-t15": "Rift T15", "rift-s75": "Rift S75" };
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
  const droneOrder=["rift-65","rift-75","rift-c3","rift-x35","rift-x5"];
  drones.sort((a,b)=>droneOrder.indexOf(a.id)-droneOrder.indexOf(b.id));
  maps.sort(compareMaps);
  for (const d of drones) {
    validateDrone(d);
    d.configHash = createHash("sha256")
      .update(JSON.stringify(d))
      .digest("hex")
      .slice(0, 16);
  }
  for (let i = 0; i < maps.length; i++) {
    const map = maps[i];
    Object.assign(map, mapPresentation(map));
    validateMap(map);
    map.routes = await loadRoutes(map, dataRoot);
    if (map.routes.length) maps[i] = resolveRoute(map, map.routes[0].id);
  }
  let airplanes=[];
  try{airplanes=await load('airplanes');}catch(error){if(error.code!=='ENOENT')throw error;}
  const airplaneOrder=["rift-s75","rift-t15"];
  airplanes.sort((a,b)=>airplaneOrder.indexOf(a.id)-airplaneOrder.indexOf(b.id));
  for (const plane of airplanes) {
    validateAirplane(plane);
    const hashConfig = { ...plane, name: airplaneHashNames[plane.id] ?? plane.name };
    plane.configHash = createHash("sha256")
      .update(JSON.stringify(hashConfig))
      .digest("hex")
      .slice(0, 16);
  }
  return { drones, maps, airplanes };
}
