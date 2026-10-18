import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import RAPIER from "@dimforge/rapier3d-compat";
import { loadCatalog } from "../server/catalog.js";
import { FixedWingPhysics } from "../shared/physics/fixed-wing.js";
import { aircraftLaunch } from "../shared/aircraft/launch.js";
import { COLLISION_ASSETS } from "../shared/world/collision-assets.js";
import { decodeCollisionData } from "../shared/world/collision-data.js";
import { PrebakedCollisions } from "../web/game/prebaked-collisions.js";
import { parkSurfaceHeight } from "../shared/world/park-layout.js";
await RAPIER.init();
const { airplanes, maps } = await loadCatalog(),
  config = airplanes[0],
  map = { ...maps.find((m) => m.id === "liget"), gates: [] };
test("Grove south promenade supports stable ground parking and an actual prepared-map takeoff", async () => {
  const raw = gunzipSync(
      await readFile(
        new URL("../web" + COLLISION_ASSETS.liget.url, import.meta.url),
      ),
    ),
    records = decodeCollisionData(
      raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
      "liget",
    );
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
    baked = new PrebakedCollisions(RAPIER, world, map, records),
    pose = aircraftLaunch(config, map, { method: "ground", slot: 0 });
  const plane = new FixedWingPhysics(RAPIER, world, config, pose.p, {
    launchPose: pose,
    updateSceneQueries: false,
  });
  try {
    for (let i = 0; i < 480; i++) {
      baked.update(plane.pose.p, plane.pose.v);
      plane.step({ pitch: 0, roll: 0, yaw: 0, throttle: 0 });
    }
    assert.ok(plane.grounded);
    assert.ok(plane.pose.q.w > 0.99);
    assert.ok(Math.hypot(...plane.pose.v) < 0.1);
    plane.armed = true;
    let lifted = false;
    for (let i = 0; i < 240 * 20; i++) {
      const p = plane.pose.p,
        agl = p[1] - parkSurfaceHeight(p[0], p[2]);
      baked.update(p, plane.pose.v);
      plane.step({
        pitch: plane.airspeed > 9 && agl < 3 ? -0.4 : 0,
        roll: 0,
        yaw: 0,
        throttle: 0.8,
      });
      if (agl > 5) {
        lifted = true;
        break;
      }
    }
    assert.ok(
      lifted,
      "T15 leaves the real prepared-map pavement/terrain " +
        JSON.stringify({
          pose: plane.pose,
          crashed: plane.crashed,
          grounded: plane.grounded,
          airspeed: plane.airspeed,
        }),
    );
    assert.equal(plane.crashed, false);
  } finally {
    baked.dispose();
    world.free();
  }
});
test("gear settles after a gentle unpowered approach and all eight ground/air slots leave wing clearance", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(2000, 0.1, 2000).setTranslation(0, -0.1, 0),
  );
  const plane = new FixedWingPhysics(RAPIER, world, config, [0, 5, 0], {
    updateSceneQueries: false,
  });
  for (let i = 0; i < 240 * 35; i++)
    plane.step({ pitch: 0, roll: 0, yaw: 0, throttle: 0 });
  assert.equal(plane.crashed, false);
  assert.ok(plane.grounded);
  assert.ok(plane.pose.p[1] > 0.2 && plane.pose.p[1] < 0.4);
  world.free();
  for (const method of ["air", "ground"]) {
    const slots = Array.from({ length: 8 }, (_, slot) =>
      aircraftLaunch(config, map, { method, slot }),
    );
    for (let i = 0; i < 8; i++)
      for (let j = i + 1; j < 8; j++)
        assert.ok(
          Math.hypot(
            slots[i].p[0] - slots[j].p[0],
            slots[i].p[2] - slots[j].p[2],
          ) > config.wingspanM,
        );
  }
});
