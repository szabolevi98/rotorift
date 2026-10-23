# Water hazards — 2026-10-22

`shared/world/water-hazards.js` provides shared water-contact checks for the flight
client and multiplayer server. Both Grove lakes use their existing irregular
outline and water elevation. Skyline's fountain basin and three jets are covered
as well. Other maps have no water hazards.

Checks sweep aircraft parts between poses, including wings, gear and rotors.
The lake fountain renderer uses the same 13 jet centerlines and radii as the
hazard checks. Individual streams are tested, rather than making the whole spray
area an invisible obstacle. Dry banks, bridges, high overflight and gaps between
streams remain usable. Broad bounds reject distant water before detailed checks.

In Flight, contact disarms the aircraft, clears all motor thrust and disables
turtle mode before any lap crossing is processed. A central translated notice
identifies water or fountain contact and the stopped motor for 1.8 seconds before
the normal reset returns the aircraft to launch. Physics and lap timing remain
stopped during this interval. Server-detected impacts use the same notice before
applying the received reset pose. A manual reset or leaving flight clears it.
Online state sending pauses until the reset acknowledgement, avoiding stale
water poses after a reset request. Normal reset clears the crash state and uses
the existing low-throttle auto-arm interlock.

The server independently checks received poses. Water contact resets only that
pilot to their launch slot, stops their animation/rotors and clears their current
lap and ghost recording while retaining their best valid time. This also handles
older clients. No new network fields, database changes or solid water colliders
are needed; optional propeller-damage settings do not disable water hazards.

Checks cover both aircraft kinds, submerged parts and banked wings, swept jet
contact, safe gaps/shorelines/bridges, reset recovery, multiplayer reset and all
existing Grove/Skyline race guides. The actual Flight.step/reset methods are also
exercised locally to verify that water stops motors before lap timing advances.
