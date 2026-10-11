import "dotenv/config";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "./catalog.js";
import { Database } from "./db/index.js";
import { serveStatic } from "./static.js";
import { attachRooms } from "./net/rooms.js";
export async function createServer() {
  const catalog = await loadCatalog(),
    db = new Database();
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
      if (req.method === "GET" && url.pathname === "/api/leaderboard") {
        const map = catalog.maps.find(
            (m) => m.id === url.searchParams.get("map"),
          ),
          drone = catalog.drones.find(
            (d) => d.id === url.searchParams.get("drone"),
          ),
          mode = url.searchParams.get("mode");
        if (!map || !drone || !["acro", "angle", "horizon"].includes(mode))
          return json(res, { error: "Invalid category" }, 400);
        return json(res, await db.leaderboard(map, drone, mode));
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
