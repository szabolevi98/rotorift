# World backdrops — 2026-10-21

`web/game/world-backdrop.js` provides the same scenery for flight and the map
showcase through `buildEnvironment`. Each map kind has a fixed palette, seed,
mountain height and tree count. Placements are deterministic across solo and
multiplayer and remain fixed in world space when the camera moves.

The landscape is one continuous radial mesh, with a buried inner edge beyond the
corners of the playable square. Several radial height bands create foothills,
near ridges and a more distant mountain range. Existing terrain continues below;
no new coplanar ground layers are added. Woodland clusters are seated on the
actual backdrop triangles. Surrounding trees and buildings clear the playable
square, including the small Playground.

- Grove: wooded green foothills and higher, cooler distant ridges.
- Apex Circuit: lower rural hills and woodland.
- Concrete Yard: muted earth colors, warehouses and a few industrial stacks.
- Skyline: low-rise background blocks and subdued mountain ranges.
- Playground: surrounding trees, gabled houses and distant hills.

The background has no collision bodies, shadow casters/receivers, new textures or
per-frame updates. At most six batches and 36,000 triangles are added per map;
instancing keeps repeated trees/buildings together. Objects use baked vertex shading.
The terrain clones the actual ground material, borrowing its texture and preserving
its lighting and shader hook. Soil/grass vertex colors also match the ground; fine
color variation fades out on the coarse distant mesh. Fog matches the ground at
the join and gradually softens only over the distant ranges, avoiding a bright
circular seam. Borrowed textures remain owned by the original world. Existing sky,
lighting, race gates, boundaries and return countdowns remain unchanged.

Backdrop resources are owned and disposed with the environment. Tests check
finite geometry, deterministic generation, boundary clearance, upward-facing
terrain, geometry budgets and disposal for all five map kinds. Browser checks
cover ground and elevated views with the game's atmosphere and shadow renderer.
