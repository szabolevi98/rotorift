# Apex Circuit — release, 2026-10-20

Available in the 2026-10-20 release at `https://fpv.levente.net/` and
`https://fpv.levente.net/showcase/?tab=maps&map=apex`. Development began on
`codex/apex-circuit`; local preview remains available at `http://localhost:3015/`.

## Map and flying

An 800 × 800 m motorsport park with a 2.21 km closed asphalt circuit, red/cream
kerbs, runoff, guardrails, starting grid and timing gantry. Open pit garages,
observation terrace, control tower, three roofed grandstands, paddock transporters,
lamps and a 9 m fly-under pedestrian bridge offer low flight lines. The launch
apron is outside the live track. All current drones and airplanes can free-fly;
airplanes retain airborne launches. Ground-pilot view excludes moving car bodies
when finding stationary footing.

The second revision replaces the simple perimeter lap with double S bends,
a tight infield return and a western technical section. A clubhouse with a 24 m
wide, 5.2 m high breezeway, fly-through media tower, corner-shaped gravel traps,
tyre walls, marshal stations, planted belts, visitor parking and fan/camping village
make the grounds usable at close range as well as from above. The car lanes clear
all static scenery along the complete circuit. Map version is 2.

Routes: **GT Chase** (30 gates, medium), **Pit Lane Run** (34, medium), **Apex Air
Circuit** (18, easy) and **Infield Figure Eight** (24, medium). Saved smooth guides
and the full gate frames clear static scenery. Routes are independent of car laps:
there is no requirement to match a particular car's phase to finish a drone lap.
The 2.62 km Pit Lane Run also flies through the clubhouse and under the media tower.
Both drone route versions are 2; the unchanged airplane routes retain version 1.

## Shared traffic

`shared/world/circuit-layout.js` owns the closed spline, distance/time tables,
curvature-limited corner speeds, braking/acceleration envelope and eight car phases.
Cars use four separate lanes with preserved headway within each lane. Their
trajectories depend only on absolute traffic time, car index and the room seed.
No client RNG, frame counts, aircraft input or local join time affects the route.
The revised pace averages about 94 km/h for the base car, reaching about 180 km/h
on the main straight. Cornering, acceleration and braking remain distance-based;
liveries retain their individual pace factors. Version 2 traffic requires a fresh
protocol-6 client so old speed tables cannot silently diverge.

Protocol 6 rooms carry `traffic: {version: 2, epoch, seed}` in the existing room
snapshot. The server creates this metadata once. Late join and reconnect receive
the same metadata; restarting the flight leaves traffic running without teleporting
it. The existing server clock/ping offset supplies time. `TrafficClock` slews small
clock corrections and catches up after long suspension. Remaining differences
between clients depend on their clock estimates, rather than divergent car physics.
Older clients are asked to refresh before entering this new map; old maps still
support their previous protocol levels.

The renderer instances eight original GT coupes in eight draw batches, including
body, opaque glazing, splitter, rear wing, head/tail lights and separately animated
steered wheels. Actual kinematic Rapier bodies follow the same schedule at each
fixed physics step. A drone/plane can collide with them; aircraft never push cars
off schedule. Cars do not have a separate rigid-body race AI, crash/damage system,
mutual pileups or user driving. Static structures are baked separately from traffic.
A clock jump repositions cars without an enormous artificial sweep velocity.

Solo traffic follows the local simulation clock and pauses with solo flight.
Online traffic follows room time. Showcase traffic is an independent animated
preview, not a connection to a multiplayer room. Dynamic traffic invalidates cached
shadows even in clean FPV view.

## Verification and scope

Checks cover closed/seamless trajectories, on-road positions, corner speeds,
lane headway, late-join clock agreement, correction/suspension behavior, eight-client
mixed-aircraft room lifecycle, real car/drone contact, kinematic pose agreement,
resource disposal, static passages, gate/guide clearance, baked/source identity,
translations, game selection and showcase rendering. Browser checks are local;
scripted clients do not constitute a long eight-person latency/controller trial.

The release updates only Rotorift and its showcase. No database schema or unrelated
service changes are required.

Ground paint and paving receive shadows but do not cast shadows onto their own
near-coplanar top faces. The pit apron is a single authored polygon, boolean-cut
against the main circuit strips; regenerate it with
`node scripts/build-circuit-apron.mjs` after changing the track footprint.
