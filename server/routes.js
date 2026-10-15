import { readFile, readdir, mkdir, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { validateRoute, validRouteId } from "../shared/race/routes.js";
export const DATA_ROOT = new URL("../data/", import.meta.url);

export async function loadRoutes(map, dataRoot = DATA_ROOT) {
  const folder = new URL(`maps/${map.id}/`, dataRoot);
  let files;
  try { files = await readdir(folder); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
  return Promise.all(files.filter(name => name.endsWith(".json")).sort((a,b) => a.localeCompare(b,"en",{numeric:true})).map(async name => {
    const route = validateRoute(JSON.parse(await readFile(new URL(name, folder), "utf8")), map);
    if (name !== route.id + ".json") throw Error("Race filename and ID must match.");
    return route;
  }));
}

export async function saveRoute(map, input, dataRoot = DATA_ROOT) {
  if (!validRouteId(map?.id)) throw Error("Invalid map ID.");
  const route = validateRoute(input, map), previous = (await loadRoutes(map, dataRoot)).find(r => r.id === route.id);
  if (previous) {
    const geometry = r => JSON.stringify({ name: r.name, spawn: r.spawn, gates: r.gates, guide:r.guide });
    route.version = geometry(route) === geometry(previous) ? previous.version : Math.max(route.version, previous.version + 1);
  }
  const folder = new URL(`maps/${map.id}/`, dataRoot);
  await mkdir(folder, { recursive: true });
  const temporary = new URL(`.${route.id}-${randomUUID()}.tmp`, folder);
  await writeFile(temporary, JSON.stringify(route, null, 2) + "\n", "utf8");
  await rename(temporary, new URL(route.id + ".json", folder));
  return route;
}

export function localEditorRequest(req) {
  const peer = req.socket.remoteAddress;
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(peer)) return false;
  try {
    const host = new URL("http://" + req.headers.host), origin = new URL(req.headers.origin);
    return ["localhost", "127.0.0.1", "[::1]"].includes(host.hostname) && origin.host === host.host && origin.protocol === "http:";
  } catch { return false; }
}

export async function readRouteBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 256 * 1024) throw Error("Race file is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
