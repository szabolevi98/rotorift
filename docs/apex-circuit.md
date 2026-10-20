# Apex Circuit — local development, 2026-10-20

Not deployed. Source branch: `codex/apex-circuit`. No push or production update is
needed to try it at `http://localhost:3015/showcase/?tab=maps&map=apex` or in the game.

## Map and flying

An 800 × 800 m motorsport park with a 1.68 km closed asphalt circuit, red/cream
kerbs, runoff, guardrails, starting grid and timing gantry. Open pit garages,
observation terrace, control tower, three roofed grandstands, paddock transporters,
lamps and a 9 m fly-under pedestrian bridge offer low flight lines. The launch
apron is outside the live track. All current drones and airplanes can free-fly;
airplanes retain airborne launches. Ground-pilot view excludes moving car bodies
when finding stationary footing.

Routes: **GT Chase** (22 gates, easy), **Pit Lane Run** (26, medium), **Apex Air
Circuit** (18, easy) and **Infield Figure Eight** (24, medium). Saved smooth guides
and the full gate frames clear static scenery. Routes are independent of car laps:
there is no requirement to match a particular car's phase to finish a drone lap.

## Shared traffic

`shared/world/circuit-layout.js` owns the closed spline, distance/time tables,
curvature-limited corner speeds, braking/acceleration envelope and eight car phases.
Cars use four separate lanes with preserved headway within each lane. Their
trajectories depend only on absolute traffic time, car index and the room seed.
No client RNG, frame counts, aircraft input or local join time affects the route.

Protocol 5 rooms carry `traffic: {version: 1, epoch, seed}` in the existing room
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

No production service, public page, database schema or external account is changed.
