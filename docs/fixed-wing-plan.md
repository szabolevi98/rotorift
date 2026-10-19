# Fixed-wing aircraft introduction plan

Recorded: **2026-10-16**. Updated: **2026-10-19**. Status: **Aero 40, Aero 75 and Aero 150 implemented**.

The approved Aero 150 now includes separate flight/effects/visual implementations,
ground and airborne launch, eight-pilot airplane rooms, reconnect/restart,
airplane circuits, records/ghosts and shared showcase/GLB export. See
[current scope and validation](rift-t15.md). The original phased design below
is retained as the rationale, rather than an outstanding task list. Real-device
and real-network tuning remains ongoing; automated tests do not certify handling.

The smaller [Rift Aero 75](rift-s75.md) now adds an original 750 mm / 2S pusher,
with its own visual factory, structure and tuning, sharing the fixed-wing solver.
The [Rift Aero 40](rift-a40.md) adds a 400 mm / 1S micro warbird. On 2026-10-19
the fleet comprises six drones and three airplanes; this is a dated snapshot,
not a permanent fleet-size limit. See the [current summary](prototype.md).

The design below records the **2026-10-16 starting point**, when five drones
existed. Its initial scope and exclusions are historical requirements, not
unimplemented tasks or a description of the current fleet.

## Goal and first aircraft

Add conventional electric RC airplanes alongside the then-existing quadcopters,
while keeping Rotorift lightweight and playable in a browser on desktop and phone.
The airplane needs its own flight model, not a modified quadcopter motor mixer.

Start with one original, low-poly, high-wing trainer with a single electric motor,
ailerons, elevator, rudder and fixed landing gear. A conventional trainer offers
clear control surfaces and a useful baseline for take-off, glide and landing tests.
The selected Aero 150 envelope is documented in `rift-t15.md`; do not invent a claim of
matching a specific real aircraft.

The first public release should support local free flight, an airborne practice
start and a ground start at a verified runway or sufficiently clear strip. An
airborne start is enough for the internal physics prototype, not proof that ground
handling works. Keep the existing drone maps and visual identity.

Initially exclude flying wings, jets, VTOL transitions, retractable gear, flaps,
autopilot/navigation and detailed structural damage.
These can be separate additions after the trainer behaves convincingly.

## What can be reused

| System | Reuse and necessary adaptation |
| --- | --- |
| Three.js, Rapier and prepared scenery collisions | Keep the rendering/world infrastructure; give the airplane its own moving colliders. |
| Fixed simulation step | Keep the current 240 Hz stepping and display-rate independence. |
| Radio and keyboard input | Keep device detection, channel mapping, calibration and smoothing; add airplane control profiles. |
| Hangar and showcase | Keep aircraft preview, color selection and GLB export; display airplane-specific specifications. |
| Cameras and FPV effects | Keep the three views, horizon and analog effect; tune offsets and chase distance for the wingspan. |
| Battery and wind | Reuse suitable shared calculations after removing quad-only assumptions. |
| Multiplayer, gates, ghosts and delta time | Reuse infrastructure in later phases; validate aircraft compatibility and record categories first. |

Existing drone configuration IDs, physics behavior, settings, routes and records
must remain valid. Planning airplane support does not change the current game.

## Architecture and configuration

Introduce an aircraft type discriminator such as `kind: "quadrotor" | "fixedWing"`.
Treat existing drone configurations without `kind` as `quadrotor`. Keep
`data/drones/` and its existing IDs working; load new aircraft from a proposed
`data/airplanes/` directory. Avoid a repository-wide rename simply to add one type.

Before implementing the airplane, extract a small shared aircraft interface around
the operations actually used by `web/game/flight.js`: stepping, reset, arming,
flight-mode selection, pose/velocity and telemetry. Use a factory to choose
`DronePhysics` or a proposed `FixedWingPhysics`. Aircraft capabilities should
describe supported modes, launch methods, propulsion and damage features, so the
menu and HUD do not assume four motors or enable unsupported actions.

Proposed implementation boundaries:

- `shared/physics/aircraft.js`: type dispatch and common runtime contract.
- `shared/physics/fixed-wing.js`: airplane rigid-body forces and control surfaces.
- `shared/physics/aerodynamics.js`: testable aerodynamic calculations.
- Type-specific configuration validation beside `validateDrone` in
  `shared/physics/config.js`; extend `server/catalog.js` without changing old hashes.
- Type-specific collider creation beside the existing quadcopter implementation
  in `shared/physics/aircraft-colliders.js`.
- A separate procedural airplane factory and showcase entry, plus an exported GLB.

Move the shared time-step constant out of `drone.js` if required, preserving its
value and a compatible export for existing callers. Do not duplicate the flight
loop or put aerodynamic calculations in rendering code.

Each airplane configuration should contain SI-unit values for mass, inertia,
center of mass, geometry and aerodynamic reference points; wing area/span/chord;
lift, drag and moment curves including stall behavior; tail and control-surface
geometry, deflection limits and servo response; motor/propeller response and
thrust; battery; colliders, gear contacts and friction; cameras and launch defaults.
Separate a tuning version from an asset revision. Record the source or estimation
method and validation status of physical parameters. Initial estimates are not
real-flight calibration.

## Flight behavior

Use the existing world convention, meters/seconds/newtons, Y up and local forward
along -Z. State every aerodynamic sign convention explicitly and test it.

- Compute airflow relative to the wind, in aircraft coordinates. Include the
  effect of body rotation at aerodynamic surfaces where needed.
- Apply wing/tail forces and moments using airspeed, angle of attack and sideslip.
  Smoothly handle low speed, stall and recovery without numerical discontinuities.
- Apply forces at the configured aerodynamic locations, relative to the center of
  mass. Include drag and rotational damping; prevent free energy from the model.
- Let aileron, elevator and rudder effectiveness respond to airflow and bounded
  servo movement. At low airspeed the controls must not rotate the aircraft like
  a quadcopter. Engine/propeller response must be independent of servo response.
- With the engine off, the airplane should glide and lose energy. Increasing
  throttle should produce forward thrust; it must not supply artificial hover
  lift. Battery limits affect propulsion, not gravity or the wing's lift directly.
- Normal and stalled flight, inverted flight and unusual attitudes must remain
  finite and recoverable where physically appropriate. Do not force speed to a
  preset maximum as the normal substitute for drag and power tuning.

Begin with a small number of aerodynamic surfaces or an equivalent calibrated
force/moment model. Do not add CFD, per-vertex forces or a new physics engine.
Implemented 2026-10-19: optional [propeller slipstream](airplane-slipstream.md) estimates the wake over the actual tail layout. Detailed CFD/wake history remains outside scope.

## Controls, HUD and launch

Keep Mode 2 radio input: left vertical throttle, left horizontal rudder, right
horizontal ailerons and right vertical elevator. Preserve the user's calibration
and physical stick directions: forward stick lowers the nose. Keep separate
airplane sensitivity, expo and surface-travel settings; do not label direct
surface deflection as Betaflight Actual Rates.

Start with **Manual** and an optional **Stabilized** mode once the manual model is
validated. Stabilization must command bounded surfaces, respect available control
authority and still allow a stall. Do not silently map quad Acro/Angle/Horizon
settings onto airplane modes. Support keyboard smoothing and existing action binds.

Expose airspeed separately from ground speed, throttle, battery and altitude.
Provide an approximate stall-risk indication based on the modeled flight state,
not a universal fixed-speed alarm. Hide quad-only UI such as turtle mode and the
four-prop damage diagram. Retain the motor arming/low-throttle safeguard, while
making clear that a disarmed airplane can still coast or glide.

Add type-specific launch definitions without moving existing drone spawn points.
Ground starts need a suitable surface, heading, gear clearance and obstacle-free
departure; airborne starts need altitude, heading and initial velocity. Check Grove
and Skyline first, but do not assume their paths/streets are suitable runways.
Mark Playground as unsuitable for normal trainer operation. Keep the one-minute
boundary return rule and verify that turns remain practical inside the play area.

## Collisions and performance

Build simple fuselage, wing, tail and gear colliders once when loading the aircraft.
Wing tips must hit obstacles even when the fuselage clears them. Investigate gear
contacts and rolling friction before deciding whether wheel constraints are needed.
Do not simulate wheel rotation by adding many collision bodies unnecessarily.

Reuse the prepared map assets and spatial collision queries. Ensure broad-phase
queries cover the full airplane, including high-speed motion, without testing the
whole wingspan against every scenery triangle each substep. Verify swept/CCD
behavior around thin obstacles, terrain and wingtip strikes. Start with reset after
a severe crash; do not automatically reuse the four-rotor damage format.

Preallocate aerodynamic scratch data and avoid allocations during physics ticks.
Measure the airplane against the current drone baseline in the same scene and
graphics settings. Record physics time, rendering time, collision candidates and
frame-time percentiles near buildings/ground as well as in clear air. An unexplained
performance regression blocks release; low polygon count alone is not validation.

## Multiplayer, races and saved data

Local free flight comes first. Subsequent online free flight should reuse the
eight-player rooms and reconnect flow, with explicit aircraft capabilities and
validated state messages. The network now accepts a bounded, typed fixed-wing animation payload alongside
the unchanged four-rotor format. Aircraft visual adapters handle the two types
without fake drone rotors.
Reject incompatible clients/aircraft cleanly; do not accept arbitrary JSON state.

Implemented 2026-10-18: protocol-4 free-flight rooms support mixed aircraft. Each
pilot has an aircraft ID, mode, launch method, validated configuration hash and typed
animation. Remote visuals and collision proxies resolve that pilot’s configuration,
including wing span and per-propeller damage. Late join, reconnect and restart
preserve personal aircraft. Legacy rooms remain homogeneous; racing still pins
one aircraft. The host controls shared simulation rules, with unsupported effects
masked per aircraft rather than removed from the room when a plane hosts.
Eight simulated clients and mixed collision geometry are covered by integration
tests; this does not replace a long real-device and latency trial.

Airplane racing needs separately authored/validated routes with enough wingtip
clearance, turn space, recovery distance and appropriate gate direction. Existing
drone dive courses are not automatically airplane routes. Add route compatibility
metadata before enabling airplane route selection or rankings.

`shared/race/category.js` already includes aircraft ID and configuration hash.
Keep old drone category keys unchanged; version airplane physics/control options
so tuning changes cannot mix incomparable records. Extend server validation and
database queries where needed. Pose-only ghost frames can remain in the existing
20 Hz format if sufficient; select the correct aircraft asset and version any
additional animation data. Reuse checkpoint delta logic after airplane routes work.

## Delivery phases and acceptance

| Phase | Deliverable | Exit condition |
| --- | --- | --- |
| 1. Compatible foundation | Aircraft dispatch, capability/config validation, unchanged drone paths. | All existing drone tests pass; old settings, hashes, records and API consumers remain valid. |
| 2. Internal flight prototype | One trainer config, simple model, Manual mode and airborne start. | Automated lift/drag/control tests and repeatable glide/stall/recovery measurements pass. |
| 3. Local usable aircraft | Final initial model, control profiles, HUD, FPV/chase cameras, ground start and landing. | Manual radio/keyboard tests, runway/wingtip collision checks and performance comparison pass. |
| 4. Online free flight | Airplane-only rooms, remote rendering, reconnect and shared options. | Two clients agree on aircraft/modes/options; eight-player load test and invalid-message tests pass. |
| 5. Races and replay | Compatible airplane courses, records, ghosts and delta display. | Complete valid laps, correct categories, replay and old-record compatibility verified. |

Phase 3 is the first candidate for a limited local/free-flight release. Later
phases are independent milestones, not implied features of the prototype.

Required physics checks include correct control directions and torque signs,
zero/low-speed stability, trim and steady flight, throttle-off energy loss, stall
onset and recovery, banked turns, crosswind behavior and finite states during
extreme inputs. Use measured runs with the selected aircraft's target envelope;
set numerical tolerances before accepting a tune. Automated checks establish
consistency, not a claim of matching real-world handling.

Run identical simulation-time input sequences at 30/60/120/144 Hz render cadence:
flight path and timing must agree within recorded tolerances. Test frame stalls
with the existing catch-up policy separately. Verify reset, auto-arm, pause/resume,
tab switching, depleted battery and radio disconnection for each aircraft type.
Before release, include actual radio flight feedback and a supported mobile-device
performance pass; record any remaining model limitations in the documentation.

## Initial decisions (2026-10-17)

1. Original high-wing Rift Aero 150: 1.5 m, 1.45 kg, 3S 3200 mAh, single electric motor.
2. First map: Grove, airborne practice start and ground start on its south promenade.
3. Initial measured checks and limitations are recorded in `rift-t15.md`.
4. The first release was local free flight. On 2026-10-18 the ground, online,
   racing/replay and showcase features were added; see current validation above.

No implementation time estimate is committed here. The main uncertainty is
handling calibration and ground contact behavior; reassess effort after phase 2.

Implemented 2026-10-19: all three airplanes support optional two-blade propeller damage, separate from severe crashes and from the drone four-rotor state. See [propeller damage](propeller-damage.md) for physics, visuals, HUD and multiplayer behavior.
