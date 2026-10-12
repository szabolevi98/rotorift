import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { loadCatalog } from "../server/catalog.js";
import { validateDrone, validateMap } from "../shared/physics/config.js";
import { canRace } from "../shared/race/map-modes.js";
test("catalog contains three valid drone models and two maps with explicit race availability", async () => {
  const { drones, maps } = await loadCatalog();
  assert.equal(drones.length, 3);
  assert.equal(maps.length, 2);
  assert.equal(new Set(drones.map((d) => d.configHash)).size, 3);
  for (const c of drones) {
    assert.equal(validateDrone(c), c);
    assert.ok(
      (await stat(new URL("../web" + c.model, import.meta.url))).size > 100000,
    );
  }
  for (const m of maps) assert.equal(validateMap(m), m);
  const park = maps.find((m) => m.id === "liget");
  assert.equal(canRace(park), true);
  assert.equal(park.routeId, "race_1");
  assert.equal(park.routes.length, 1);
  assert.ok(park.gates.length >= 4);
  const construction = maps.find((m) => m.id === "betonudvar");
  assert.equal(canRace(construction), true);
  assert.equal(construction.routes.length, 1);
  assert.ok(construction.gates.length >= 4);
  assert.throws(() => validateMap({ ...park, gates: [], racingEnabled: true }));
  const bad = structuredClone(maps[0]);
  bad.gates = [{ p: [0, 2, 0], n: [0, 0, 2], width: 4, height: 3 }];
  assert.throws(() => validateMap(bad));
});
test("five languages have identical nonempty keys and cover the HTML", async () => {
  const dictionaries = await Promise.all(
    ["en", "hu", "de", "fr", "es"].map(async (lang) =>
      JSON.parse(
        await readFile(
          new URL("../web/lang/" + lang + ".json", import.meta.url),
          "utf8",
        ),
      ),
    ),
  );
  const keys = Object.keys(dictionaries[0]).sort();
  for (const d of dictionaries) {
    assert.deepEqual(Object.keys(d).sort(), keys);
    assert.ok(Object.values(d).every((v) => typeof v === "string" && v.trim()));
  }
  const html = await readFile(
    new URL("../web/index.html", import.meta.url),
    "utf8",
  );
  for (const m of html.matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g))
    assert.ok(keys.includes(m[1]), "Missing translation " + m[1]);
});
