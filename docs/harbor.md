# Harbor / Kikötő

Added 2026-10-24. An 800 × 800 m coastal freight port for both quadcopters and
fixed-wing aircraft. Persistent map ID and kind: `harbor`; name key: `map.harbor`.

The west side contains a container terminal, a transit warehouse with two open
ends, a cold store, offices, service vehicles and a sheltered pilot bay. Two
ship-to-shore gantry cranes reach over the quay, with a smaller portal crane on
one pier. A tapered, closed-hull feeder ship carries deck containers, an aft
bridge, funnel, navigation mast and lifeboats. Mooring lines connect it to the
two piers. Breakwaters protect the basin, with a lighthouse on the south arm.
Vessels, cranes and vehicles are stationary in this release. Harbor rooms require
protocol 8 so cached older clients refresh instead of rendering a different
environment. The other maps retain their existing compatibility rules.

Scenery revision 2 (2026-10-24) fills the piers with a covered cargo shed,
steel stock, export containers, palletized freight and forklifts. A six-tank
storage compound, warehouse racks and loading docks, freight trailers, a
fenced entrance, gatehouse, staff parking, equipment depot and timber export
yard give the landward yard distinct working areas. A small moored workboat sits
beside the quay. Container banks
are wider, while all four published routes, their guide lines and launch slots
remain unchanged. Showcase viewpoints include the new freight and tank areas.

Scenery revision 3 moves the cold store 20 m west to clear the marked service
lane. The coastal ground uses a natural, saturated grass green. Oaks and pines
are distributed across the landward hills and both flanks of the terminal,
with irregular spacing, varied density and clearings. Trees follow the actual hill surface and
avoid the background warehouses; they add four static instanced draws and no
physics shapes.

Scenery revision 4 joins the rear fence to both side boundaries, ending at the
quay while retaining the entrance. A single flat, vertex-colored land surface
replaces the adjoining oversized ground boxes, removing the long internal-face
seams beyond the yard. The asphalt outline, ground height and race routes stay
the same. Water and land use a shared 128 m grid near the port, coarsening only
in the distant scenery. This avoids giant triangles crossing the camera and
clipping through logarithmic depth. The sea starts at the shoreline instead of
overlapping the land underneath the yard.

Scenery revision 5 connects the gantry X braces to the actual sloping legs.
The portal top frame now includes crossmembers beneath all four mast feet,
so the upper crane structure no longer ends in midair. Visible steel and
prepared contact shapes share these joints; race routes remain unchanged.

| Route | Length | Gates | Aircraft | Difficulty |
| --- | --- | --- | --- | --- |
| Waterfront Flow | 1.98 km | 24 | Quads | Easy |
| Terminal Run | 2.29 km | 23 | Quads | Hard |
| Harbor Air Circuit | 2.32 km | 20 | Airplanes | Easy |
| Quayside Low Run | 1.93 km | 24 | Airplanes | Medium |

Terminal Run enters a real open freight container and the transit warehouse,
passes through a crane portal, crosses above the ship cargo and returns along
the waterfront. The open-container gates are 1.8 × 1.6 m; ordinary quad gates
are 8 × 6 m. Airplane gates are 22 × 16 m. The high circuit stays at 110 m above
the cranes, while the lower circuit varies from 19 to 31 m along the terminal
service corridor and harbor basin. Airplane bends have continuous 80/95 m radii.
The eight drone launch slots are on clear pavement in the southern service yard.
Free flight hides the gates and guide lines and supports the existing mixed fleet.

`shared/world/harbor-layout.js` defines the quay footprints, piers, breakwaters,
ship outline and surface heights. The same footprints drive the visible land,
contact shapes, water hazard checks and ground-observer placement. The sea is
at 0 m, the quay at 3 m, and the seabed at -12 m. There is no solid water-surface
collider. Touching the sea uses the existing water shutdown notice and delayed
reset for both drones and airplanes, regardless of optional propeller damage.
Pilots cannot stand on the water; the ship's bow deck is valid footing.

`web/game/harbor.js`, `harbor-details.js` and `harbor-parts.js` build batched static
visuals and the collision source. Corrugated container ribs use a shared procedural texture;
door bars, hinges, crane braces, rails and ropes use geometry. Most contact
shapes remain analytic; the ship's closed hull and solid deck use small triangle
meshes. Ocean shading animates only surface normals and fades fine ripples in
the distance. It never changes water height or multiplayer physics. Landward
industrial buildings and connected terrain hills provide a backdrop; the sea
side remains open to the horizon. The generic all-around landscape is omitted.

Run `node scripts/author-harbor-races.mjs` after intentional route edits, then
`npm run collisions:build` after scenery edits. The author checks the whole gate
frame and a 2 m approach on either side, complete ordered lap timing, saved guide
clearance, physical race rails and water hazards. Airplane guides clear a 1.25 m
radius envelope. Increment already-published route/map versions when geometry
changes, then rebuild the standalone showcase. Preserve unrelated edits in
generated study pages during a full showcase build.

`tests/harbor.test.js` checks source and prepared contact geometry, water/shore
agreement, launch slots, observer footing and an actual Rift X5 fly-through of
the open container with prop damage enabled. Both source and prepared geometry
are checked against all saved gate frames, approaches and guide segments,
including the 1.25 m airplane clearance envelope. Existing route, collision, catalogue,
language and fixed-wing tests include Harbor as well.
