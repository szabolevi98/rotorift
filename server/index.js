import "dotenv/config";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "./catalog.js";
import { Database } from "./db/index.js";
import { serveStatic } from "./static.js";
import { attachRooms } from "./net/rooms.js";
import { DEFAULT_SIMULATION, WIND_LEVELS, simulationKey } from "../shared/simulation/options.js";
import { saveRoute, readRouteBody, localEditorRequest } from "./routes.js";
import { resolveRoute } from "../shared/race/routes.js";
import { raceCategoryKey } from '../shared/race/category.js';
import {findAircraft} from '../shared/catalog/aircraft.js';
import {aircraftModes,routeSupportsAircraft,aircraftSimulation} from '../shared/aircraft/capabilities.js';
export async function createServer({database}={}) {
  const catalog = await loadCatalog(),
    db = database ?? new Database();
  await db.init();
  let network;
  const json = (res, body, status = 200) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
  };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "POST" && url.pathname === "/api/routes") {
        if (!localEditorRequest(req)) return json(res, { error: "Project saving is available on localhost only." }, 403);
        try {
          const body = await readRouteBody(req), map = catalog.maps.find(m => m.id === body.mapId);
          if (!map) return json(res, { error: "Unknown map." }, 400);
          const route = await saveRoute(map, body.route);
          const fresh = await loadCatalog();
          catalog.maps = fresh.maps;
          return json(res, { route, catalog });
        } catch (error) { return json(res, { error: error.message }, 400); }
      }
      if (req.method === "GET" && url.pathname === "/api/catalog")
        return json(res, catalog);
      if (req.method === "GET" && url.pathname === "/api/status")
        return json(res, {
          ok: true,
          database: db.available,
          ...network.stats(),
        });
      if (req.method === "GET" && url.pathname === "/api/rooms")
        return json(res, { rooms: network.list() });
      if (req.method === "GET" && ['/api/leaderboard','/api/ghost'].includes(url.pathname)) {
          const map = resolveRoute(catalog.maps.find(
            (m) => m.id === url.searchParams.get("map"),
          ), url.searchParams.get("route") ?? undefined),
          drone = findAircraft(catalog,url.searchParams.get("drone")),
          mode = url.searchParams.get("mode");
        if (!map || !drone || !routeSupportsAircraft(map,drone) || !(url.pathname==='/api/leaderboard'?["all",...aircraftModes(drone)]:aircraftModes(drone)).includes(mode))
          return json(res, { error: "Invalid category" }, 400);
        const key = url.searchParams.get("simulation") ?? "00010";
        if (!/^[01]{4}[0-7]$/.test(key)) return json(res, {error: "Invalid simulation category"}, 400);
        const simulation = { ...DEFAULT_SIMULATION, wind: WIND_LEVELS[Number(key[4])%4], airmode:Number(key[4])<4 };
        ["battery", "propDamage", "propwash", "ghost"].forEach((name, i) => simulation[name] = key[i] === "1");
        if (simulationKey(aircraftSimulation(drone,simulation)) !== key)
          return json(res, {error:"Unsupported aircraft effects"}, 400);
        if(url.pathname==='/api/ghost'){
          const id=url.searchParams.get('id');
          if(!/^[a-f0-9-]{36}$/.test(id??''))return json(res,{error:'Invalid ghost'},400);
          const ghost=await db.ghost(map,drone,mode,simulation,id);
          return ghost?json(res,{...ghost,category:raceCategoryKey(map,drone,mode,simulation)}):json(res,{error:'Ghost unavailable'},404);
        }
        return json(res, await db.leaderboard(map, drone, mode, simulation));
      }
      if (await serveStatic(req, res, url)) return;
      json(res, { error: "Not found" }, 404);
    } catch {
      if (!res.headersSent) json(res, { error: "Request failed" }, 500);
      else res.end();
    }
  });
  network = attachRooms(server, catalog, db);
  return { server, db, catalog };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server } = await createServer();
  const port = Number(process.env.PORT) || 3015,
    host = process.env.HOST || "127.0.0.1";
  server.listen(port, host, () =>
    console.log(`Rotorift: http://${host}:${port}`),
  );
}
