import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const roots = {
  "/shared/": "shared",
  "/showcase/": "showcase",
  "/demo/": "showcase",
  "/vendor/three/": "node_modules/three",
  "/vendor/rapier/": "node_modules/@dimforge/rapier3d-compat",
};
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};
export async function serveStatic(req, res, url) {
  if (!["GET", "HEAD"].includes(req.method)) return false;
  let route;
  try {
    route = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end();
    return true;
  }
  let base = path.join(root, "web");
  for (const [prefix, folder] of Object.entries(roots))
    if (route.startsWith(prefix)) {
      base = path.join(root, folder);
      route = route.slice(prefix.length);
      break;
    }
  const full = path.resolve(
    base,
    "." + (route.startsWith("/") ? route : "/" + route),
  );
  if (!full.startsWith(base + path.sep) && full !== base) {
    res.writeHead(403).end();
    return true;
  }
  try {
    let file = full,
      s = await stat(file);
    if (s.isDirectory()) {
      file = path.join(file, "index.html");
      s = await stat(file);
    }
    if (!s.isFile()) return false;
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Content-Length": s.size,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(file).pipe(res);
    return true;
  } catch {
    return false;
  }
}
