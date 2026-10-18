# Eight-player multiplayer check

Run on **2026-10-17**. Result: **passed**.
Raw results: [multiplayer-check-2026-10-17.json](multiplayer-check-2026-10-17.json).

The reusable checker runs the real `attachRooms` WebSocket server on an isolated
loopback port with in-memory persistence. It does not connect to the public
server, create production profiles or write public leaderboard entries.

```sh
node scripts/check-multiplayer.mjs --seconds=30 --output=.runtime/multiplayer-check.json
```

`--seconds` is the flying duration **per map**, between 5 and 300 seconds.

## Network and race checks

- Eight independent WebSocket clients on each of Grove, Concrete Yard,
  Playground and Skyline; approximately 31 seconds of flight per map.
- Per-client one-way delays of 0/20/40/60/80/100/120/150 ms, with ±20 ms jitter.
  FIFO delivery preserves WebSocket/TCP ordering. Additionally, 2% of generated
  state updates and 3% of room snapshots are deliberately skipped at application
  level; this is not a simulation of the TCP packet retransmission algorithm.
- Eight colors, ninth-player rejection, shared start and simulation settings.
- Guest and host disconnection/recovery on every map, retaining the pilot ID and
  slot without duplication. Host ownership transfers to a connected pilot.
- Restart resets readiness and progress; the room owner changes ghost rules and
  every client receives the new common rule. Leaving releases the room.
- A separate controlled two-gate route checks race accounting under the same
  latency: eight finishers, three laps each, 24 valid lap saves and one results
  save, with eight finishing positions. This tests accounting, not autopilot or
  the flyability of the authored courses.

Observed snapshot-age p95 was **153–155 ms**, round-trip p95 **319–324 ms**.
The combined local server/test-client process used approximately **1.75–3.02 s
CPU time per map stage**; event-loop p95 was **16.8–17.1 ms**. These are local
protocol workload measurements, not browser FPS or VPS capacity claims. Recorded
snapshot counts omit the discarded socket counters before reconnect in the first
run, so they are lower bounds; timing percentiles use the retained samples.

## Collision checks

Each of the five aircraft was tested with seven real `RemoteCollisions` proxies
in Rapier, with ghost mode on and off. Ghosts had no contacts and crossed the
opposing aircraft. Solid proxies produced contact candidates and a substantial
change in forward momentum. Proxies were removed cleanly afterwards.

The initial test incorrectly required every struck aircraft to stay on the
negative X side. The X35 collided, slowed and tipped upward, finishing at X=0.029
m rather than stopping completely; this was a test assumption, not tunnelling.
The corrected check verifies contact and velocity change. Thin whoop guards can
resolve through CCD without retaining a discrete manifold impulse, so that
optional diagnostic is not required to be nonzero. All five cases pass.

Only the collision checks were rerun after this assertion correction; the
completed four-map network/race evidence is retained in the report. The checker
supports `--resume-network=<report>` to repeat collision diagnostics without
repeating a completed network run.

The existing network, reconnect, color, lifecycle and flight-effects suites also
passed: **40 tests**. The isolated run found no production multiplayer bug.

## Scope

This is an automated eight-client protocol test and separate real-physics
collision check. It does not measure eight browsers rendering simultaneously,
eight physical devices, browser background throttling, production database load
or the subjective fairness of simultaneous collisions across real internet
connections. The local kinematic collision architecture remains unchanged.


## Aero 150 extension — 2026-10-18

`tests/network.test.js` additionally runs eight protocol-3 trainer clients, shared
rules with unsupported quad effects disabled, unique colors, 1.5 m wing clearance
between launch slots, bounded engine/surface replication, malformed-state
rejection, reconnect and restart. A Manual hotlap exercises server validation and
stores a pose replay. `tests/ghost-api.test.js` checks Manual/all-mode records,
public ghosts and incompatible route/effect rejection.

The fixed-wing physics tests separately compare solid wing contacts with ghost
pass-through and remove the proxy bodies afterwards. Two actual local browser
clients also joined the same Aero 150 ground-start room and rendered the remote
colored aircraft without console errors. This is functional validation; background
browser throttling is not an FPS benchmark, and the eight-client automation is
not a test of eight rendering browsers or eight independent internet connections.


## Mixed free flight · 2026-10-18

Protocol 4 adds per-player aircraft IDs, modes, launch methods and typed visual
state. New free-flight rooms allow all drones and both airplanes together on any
map, including late joining a running flight. Races and legacy rooms retain a
common aircraft; old clients must refresh before joining mixed rooms.

The eight-client integration test uses distinct drone and airplane types, both ground and
air starts, independent modes, unique colors, rotor damage and airplane control
surfaces. It also checks lobby aircraft changes/readiness, invalid model/hash
rejection, live room discovery, late join, reconnect and restart. A plane-hosted
Playground room verifies that drone prop damage/propwash remain enabled globally
and are only masked by unsupported aircraft. Race rooms still pin their aircraft.

A Rapier test resolves the remote aircraft independently from the local aircraft,
checks the trainer wingtip and different quad prop radii, replaces a proxy after
an aircraft change, and removes proxies in ghost mode or for unknown aircraft.
These are automated software checks, not eight physical controllers/devices.
