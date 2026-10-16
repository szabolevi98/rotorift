import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { loadCatalog } from "../server/catalog.js";
import { validateDrone, validateMap } from "../shared/physics/config.js";
import { canRace } from "../shared/race/map-modes.js";
test("catalog contains five valid drone models and four maps with explicit race availability", async () => {
  const { drones, maps } = await loadCatalog();
  assert.equal(drones.length, 5);
  assert.equal(maps.length, 4);
  assert.deepEqual(maps.map(m=>m.id), ['liget','betonudvar','jatszoter','skyline']);
  assert.deepEqual(maps.map(m=>m.code), ['grove','construction-yard','playground','skyline']);
  assert.equal(new Set(drones.map((d) => d.configHash)).size, 5);
  assert.deepEqual(drones.map(d=>d.id),["rift-65","rift-75","rift-c3","rift-x35","rift-x5"]);
  for (const c of drones) {
    assert.equal(validateDrone(c), c);
    assert.ok(
      (await stat(new URL("../web" + c.model, import.meta.url))).size > 100000,
    );
  }
  for (const m of maps) {
    assert.equal(validateMap(m), m);
    assert.equal(m.boundary.returnAfterSeconds, 60, 'every map allows one minute to return');
  }
  const park = maps.find((m) => m.id === "liget");
  assert.equal(canRace(park), true);
  assert.equal(park.routeId, "race_1");
  assert.equal(park.routes.length, 3);
  assert.ok(park.gates.length >= 4);
  const construction = maps.find((m) => m.id === "betonudvar");
  assert.equal(canRace(construction), true);
  assert.equal(construction.routes.length, 3);
  assert.ok(construction.gates.length >= 4);
  assert.equal(maps.find(m=>m.id==='jatszoter').routes.length,2);
  assert.equal(maps.find(m=>m.id==='skyline').routes.length,3);
  assert.equal(canRace(maps.find(m=>m.id==='skyline')),true);
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
  const {maps}=await loadCatalog();
  for(const dictionary of dictionaries)for(const map of maps){
    assert.ok(dictionary[map.nameKey], 'Every map code needs a translated name');
    assert.ok(dictionary[map.audienceKey], 'Every map needs a translated size recommendation');
  }
  assert.equal(dictionaries[0]['map.playground'],'Playground');
  assert.equal(dictionaries[1]['map.playground'],'Játszótér');
  assert.equal(dictionaries[1]['fly.environment'],'Pálya');
});
