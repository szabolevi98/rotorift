# Skyline

An original 600 × 600 m low-poly city district for X35/X5 flying. The regular
street grid has 24 m road corridors and 96 m sidewalk blocks. It includes
44 smaller/tower buildings, an open podium tower reaching 244 m with its mast,
a 48 m-high open-sided skywalk, a five-level garage with alternating ramps,
a planted civic square, rooftop water tanks/HVAC, fire escapes, parked taxis,
delivery vans, a bus, pedestrian crossings, lamps and traffic signals.

The map starts as freestyle only. Its persistent ID/code is `skyline`, its
kind is `city`, and all five dictionaries provide `map.skyline`. A future race
JSON belongs in `data/maps/skyline/`. The standalone map viewer includes nine
inspection angles and the existing route editor.

Opaque procedural facade textures supply all window grids. Facade UVs are
sampled in world metres to keep floor/window scale consistent across towers.
There are no transparent window layers, fabricated accessible interiors or
per-window meshes. The street, podium and garage have real openings.

About 5,800 visible low-poly instances share fewer than 60 geometry/material
batches. The construction parts helper retains its default spatial batching
for existing maps; Skyline explicitly combines its compact district batches.
Around 2,800 analytic collision records bake to a 50 kB compressed asset. Local
activation, velocity lookahead and CCD use the existing simulator pipeline.
One unbroken analytic floor extends far beyond the district boundary. Its
visible surface is tiled asphalt inside the 600 m square and bare green grass
outside; these surfaces meet at the boundary without overlapping. Outside
scenery stays empty, with the existing 10-minute return timer. The horizon-sized
collision box is not drawn, avoiding giant foreground triangles.

The shared launch marking is a single, terrain-following disc with explicit
depth bias for both standard and logarithmic depth rendering. All four maps
use it, with normal depth testing against aircraft and scenery.

## Verification

Source and baked Rapier tests verify the long avenues, open podium, skywalk,
garage bays, matching floor heights, walls, outer floor, local collider budget,
and an X5 settling and lifting at spawn. Network tests check city room creation,
joining, and spawn agreement. Catalog and five-language checks cover the map.

The existing `/performance.html?map=skyline&physics=prepared&hold=1` benchmark
now measures the avenue, podium, skywalk, garage and a close facade view.
At 1280 × 504 on the local test GPU, its five stationary warmed samples took
0.40–0.80 ms for render + GPU, 0.35–0.48 ms for four physics steps, with
7–24 active static colliders and 25–33 draw calls. These diagnostic samples
exclude the normal aircraft/HUD and are not a general FPS guarantee.
