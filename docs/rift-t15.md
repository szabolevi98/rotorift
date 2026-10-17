# Rift T15 — initial fixed-wing flight prototype

Implemented 2026-10-17 following user approval. The original high-wing trainer is
available in **Singleplayer → Rift T15 → Free flight**, with an airborne practice
start at 65 m and 15 m/s. Grove is the recommended first map. Concrete Yard and
Skyline also allow free flight; Playground is omitted for this aircraft.

## Scope

This delivers the compatible foundation and first flyable prototype from
[the introduction plan](fixed-wing-plan.md). It does **not** complete the later
ground-operation, online or racing milestones. There is no runway/take-off selector
yet; reset always returns to the airborne start. The model is generated at runtime;
the separate drone showcase/GLB exporter still contains the five quadcopters.

The airplane is an original design, not an Apprentice replica. Its medium trainer
envelope was informed by the manufacturer's [Apprentice STS manual](https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/Manuals/EFL3700-Manual-EN.pdf)
(1.5 m span, approximately 0.332 m² wing area and a 3S power system). The T15 uses
estimated mass/inertia, forces and control coefficients; none are real flight-log
calibration. The current configuration is `experimental-estimate`.

| Parameter | Initial value |
| --- | --- |
| Wingspan / length | 1.50 / 1.08 m |
| Mass including battery | 1.45 kg |
| Wing reference area | 0.332 m² |
| Battery / motor | 3S 3200 mAh / one 14 N static-thrust electric motor |
| Propeller | 10-inch, two blades |
| Launch | Airborne, 65 m, 15 m/s, nose along local/world -Z |
| Controls / mode | Mode 2, Manual surface control |

## Implementation

- `shared/physics/aircraft.js` dispatches to `DronePhysics` or `FixedWingPhysics`.
  Old quad configurations/hashes and network state remain unchanged. The server
  publishes a separate `airplanes` array; only the game aircraft picker combines it.
- `aerodynamics.js` computes body-frame lift, drag, sideslip forces and pitch/yaw/
  roll moments from wind-relative airspeed. Positive stick pitch lowers the nose;
  positive roll/yaw turns right. Controls lose authority at low airspeed. The lift
  curve blends continuously into a post-stall flat-plate approximation.
- One Rapier rigid body, CCD, mass/inertia, simple fuselage/nose/wing/tail colliders
  and three low-friction gear contacts. Wing tips collide independently of the
  fuselage. The fast prepared-world physics pipeline is shared with drone flight;
  no scene-query tree rebuild is added per tick. Aerodynamic output buffers are
  reused. Small vector helpers still allocate; no per-vertex/per-surface solver runs.
- Servo lag, engine spool response, bounded control travel and expo. Airplane
  settings live under **Settings → Controls**, independently of drone Actual Rates.
- Single-motor battery current/sag/power reduction and shared wind field. Quad
  propwash, rotor damage, turtle and hover-throttle shortcuts do not apply. A strong
  collision disarms the engine and requires reset; there is no structural damage.
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
under 30/60/120/144 Hz display cadence. The full suite passed **436 tests** during
introduction, including the five unchanged drone configurations.

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
with no console errors. Radio and phone flight feedback on this new airplane,
ground handling/runways, exact trim and broader performance calibration remain
future work. The existing accepted drone hardware tests are unaffected.
