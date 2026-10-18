# Rift Aero 150 — fixed-wing trainer

Display name: **Rift Aero 150**. The internal `rift-t15` ID and source/asset paths
remain stable for existing settings, rooms, records and ghosts.

Introduced 2026-10-17; ground/online/racing support added 2026-10-18. The user
accepted the airborne handling before this extension; its force model and default
control response are unchanged.

## Scope

- Local free flight on Grove, Concrete Yard and Skyline; Playground is excluded.
- Airborne practice launch at 65 m and 15 m/s, or ground launch on the Grove south
  promenade in free flight. Manual or Stabilized mode, selectable before launch and through the mode
  action during flight. Mode 2 steering: rudder on the left, elevator/ailerons
  on the right. Add power and gently pull back once airspeed builds. Ground reset
  parks the aircraft; airborne reset restores its heading and initial velocity.
- Airplane-only rooms, up to eight pilots: unique colors, wide launch slots,
  shared battery/wind/ghost rules, remote control-surface and prop animation,
  reconnect, race results and restart. Quad damage, propwash and turtle are hidden.
- Six airplane circuits: **Grove Air Circuit** (16 gates, easy), **Lakeside Figure
  Eight** (24 gates, intermediate), **Crane Air Circuit** and **Skyline Air Circuit**
  (18 gates each, easy), **Tower Alley Run** and **Boulevard Low Run** (26 gates each,
  intermediate), with 18 × 14 m gates. The latter two fly low between buildings
  with broad turns and clearance for banked wings. Drone dive routes are not
  offered to the trainer. Local/verified timing, records, ghost selection and
  checkpoint deltas reuse the common race pipeline with a separate aircraft ID.
- The showcase reuses the flight factory, with color/prop preview and GLB export.
  `scripts/export-trainer.mjs` also rebuilds `web/assets/models/rift-t15.glb`.

The airplane is an original design, not an Apprentice replica. Its medium trainer
envelope was informed by the manufacturer's [Apprentice STS manual](https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/Manuals/EFL3700-Manual-EN.pdf)
(1.5 m span, approximately 0.332 m² wing area and a 3S power system). The Aero 150 uses
estimated mass/inertia, forces and control coefficients; none are real flight-log
calibration. The current configuration is `experimental-estimate`.

| Parameter | Initial value |
| --- | --- |
| Wingspan / length | 1.50 / 1.08 m |
| Mass including battery | 1.45 kg |
| Wing reference area | 0.332 m² |
| Battery / motor | 3S 3200 mAh / one 14 N static-thrust electric motor |
| Propeller | 10-inch, two blades |
| Launch | Airborne 65 m / 15 m/s, course heading when racing; Grove ground start in free flight |
| Controls / mode | Mode 2, Manual or Stabilized surface control |

## Implementation

- `shared/physics/aircraft.js` dispatches to `DronePhysics` or `FixedWingPhysics`.
  Old quad configurations/hashes and network state remain unchanged. The server
  publishes a separate `airplanes` array; the game aircraft picker combines it through `shared/catalog/aircraft.js`.
  `shared/aircraft/capabilities.js` handles maps, modes, effects and route support.
  Time step, world stepping and wind are independent shared utilities. Airplane
  effects no longer borrow a drone prototype or carry dummy rotor damage.
- `aerodynamics.js` computes body-frame lift, drag, sideslip forces and pitch/yaw/
  roll moments from wind-relative airspeed. Positive stick pitch lowers the nose;
  positive roll/yaw turns right. Controls lose authority at low airspeed. The lift
  curve blends continuously into a post-stall flat-plate approximation.
- One Rapier rigid body, CCD, mass/inertia, simple fuselage/nose/wing/tail colliders
  and three low-friction gear contacts. Main gear sits behind the center of mass;
  ground-only lateral grip and rudder steering do not affect airborne dynamics. Wing tips collide independently of the
  fuselage. The fast prepared-world physics pipeline is shared with drone flight;
  no scene-query tree rebuild is added per tick. Aerodynamic output buffers are
  reused. Small vector helpers still allocate; no per-vertex/per-surface solver runs.
- Servo lag, engine spool response, bounded control travel and expo. Airplane
  settings live under **Settings → Controls**, independently of drone Actual Rates.
- Single-motor battery current/sag/power reduction and shared wind field. Quad
  propwash, rotor damage, turtle and hover-throttle shortcuts do not apply. A strong
  collision disarms the engine and requires reset; there is no structural damage.
- `web/game/aircraft-visual.js` selects independent quad/airplane animation adapters.
  Protocol 3 carries `{kind:"fixedWing", engine, surfaces:{pitch,roll,yaw}}`; server
  validation rejects malformed payloads and drone rotor/turtle fields. Old clients
  keep drone access but must refresh for airplane rooms.
- Original low-poly airframe, separate animated ailerons/elevator/rudder and tractor
  propeller. Preview and flight release the instance-owned procedural geometry.
- FPV, visible-airframe FPV and chase views, per-aircraft camera profile, airspeed
  display and modeled angle-of-attack stall warning. Arming controls the motor;
  disarming does not freeze the wings or prevent gliding.

## Validation and limits

`tests/fixed-wing.test.js` covers configuration/capabilities, model complexity,
control signs, no aerodynamic authority at rest, lift/drag, unusual airflow,
unpowered mechanical-energy loss, powered/extreme-input finite states, reset,
wingtip strikes, battery, disabled quad effects and identical input sequences
under 30/60/120/144 Hz display cadence. Additional checks cover independent
remote visual animation, physical wing contact versus ghost pass-through,
compatible route selection/editor preservation, eight clients with animation,
reconnect/reset and unique colors, and a valid Manual hotlap with saved replay.
`tests/aircraft-ground.test.js` uses Grove's actual prepared collision asset for
stable parking and powered takeoff, and a separate gentle touchdown test.
The full suite passed **444 tests** on 2026-10-18, including the unchanged drones.

Initial 30-second runs in a clear physics world, neutral surfaces, calm wind,
starting at 150 m and 15 m/s (no scenery/ground constraint):

| Throttle | Final airspeed | Vertical speed | Final altitude |
| --- | --- | --- | --- |
| 0% | 14.03 m/s | -1.81 m/s | 99.23 m |
| 45% | 14.20 m/s | +0.80 m/s | 172.66 m |
| 100% | 12.66 m/s | +6.64 m/s | 345.60 m |

These runs check consistency, not maximum-speed certification: the neutral trainer
climbs under power; lowering the nose converts thrust/height to speed. The isolated
physics sample took approximately 0.02–0.032 ms/tick on the development machine;
that is not a multi-map/mobile benchmark. The browser check on Grove exercised
airborne reset, keyboard auto-arm/power, chase view, pause and airplane settings
with no console errors. The new browser checks also cover ground launch, airplane course selection,
remote room startup, showcase animation and GLB export. Eight simulated clients
are not eight real players on separate machines. Airplane radio/mobile feedback,
latency-dependent collision tuning, exact trim and broader calibration remain
ongoing work. Mixed drone/airplane free-flight rooms are supported. There is no structural
damage, autopilot or new runway mesh. The existing accepted drone hardware tests are unaffected.


## Visual refinement — 2026-10-18

The shared procedural model now has a lofted cabin with fitted windscreens and
side windows, tapered fuselage with conformal livery, airfoil-shaped wing tips,
separate hinged control surfaces, shaped propeller blades, fitted cowl/vents,
correct-length gear braces and recessed wheel hubs. It retains the accepted
1.5 m wingspan and existing physical configuration. Static shell parts batch by
material; the complete model uses about 3.5k triangles and 15 mesh draws before
shadow passes, with independently animated propeller and four control surfaces.
The same source rebuilds the game, showcase and exported GLB.


The fit correction uses shared cowl/fuselage edges, actual glazing faces instead
of overlays through the white cabin, and aligned control-surface hinges. Aileron
axes follow the wing dihedral; the elevator includes central rudder clearance.
`tests/fixed-wing-model-fit.test.js` ray-checks every glazing triangle in original
and batched geometry and measures hinge attachment at neutral and full travel.


## Integrated cabin and propeller exposure — 2026-10-18

The cabin now forms one smooth loft with the fuselage. Shape-preserving cubic
sections join the hood, rounded shoulders, roof and rear fairing. Glazing replaces
faces of this same skin: one wrapped windshield without a center divider and
rounded side windows. Adjacent material patches share their boundary vertices
and normals, rather than overlapping a white cabin with glass overlays. The
visible prop adapter is 11 mm long (previously 34 mm); the cowl and shorter
spinner follow its compact nose profile. The roof FPV camera sits on the skin.

The static model has 9,262 triangles and 14 meshes; motion exposure adds one
small transparent disc while flying. Wingspan, collision geometry, aerodynamics
and handling are unchanged. The game, showcase and GLB share the same source.

Previously the plane reused the quad's deliberately slowed 22 rad/s shutter
animation, which looked conspicuously slow on two large blades. The plane now
uses a faster 70 rad/s visual phase and progressively fades the blades into a
radially softened swept disc as motor power rises. This is a display/shutter
representation, not a claim of measured motor RPM. Actual thrust is still driven
by the existing motor dynamics. Zero power restores stationary opaque blades;
local, remote and showcase displays use the same speed/exposure rules.

Tests check the full cabin skin for unmatched edges, all glass interiors for
occlusion, the shorter shaft, and existing control-surface attachment. Propeller
tests cover progressive 25/50/75/100% animation/exposure, stopping, remote parity,
cleanup and frame-rate-independent phase at 30/60/120/144 Hz.

The main-wing assembly and collision proxy now sit 25 mm farther forward. Paint,
ailerons, hinges, servo linkages, navigation lenses and the upper strut attachments
follow the new position; the camera and FPV viewpoint retain their forward
clearance. Version 2 separates records for this revised collision configuration.
Aerodynamic coefficients, mass and control tuning are unchanged.

## Self-level stabilization · 2026-10-18

Both airplanes now offer `stabilized` alongside `manual`. It uses the current
attitude and angular rates to drive bounded elevator/aileron servo targets.
Neutral pitch/roll commands a level attitude; full stick requests 20° pitch and
35° bank. These are target angles, not hard pose clamps: lag, momentum and low
airspeed still affect recovery. Gyro rates are projected into attitude rates so
banked turns do not produce false pitch corrections. Rudder and throttle remain
manual. There is no added recovery force, altitude hold or stall prevention.

The Manual path, old configuration hashes and saved records remain unchanged.
Keyboard/radio/touch mode actions are enabled for airplanes. Live mode switching
invalidates the current lap; server categories and pose ghosts retain the mode.
The records page can show/filter Stabilized. Five language dictionaries include
its name and control explanation. Automated tests cover neutral/inverted
recovery, bounded stick demands, zero-airflow limitations, mode continuity,
refresh-rate independence, online hotlaps and ghost-category separation.

This is an original simulator controller. Real-world references include the
manufacturer's [SAFE/AS3X description](https://www.horizonhobby.com/airplanes/rc-airplanes-by-skill-level/skill-level-2/):
AS3X damps disturbances; SAFE additionally provides self-level and attitude limits.
We do not claim to reproduce a proprietary controller or its aircraft calibration.
