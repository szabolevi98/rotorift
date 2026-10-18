# Rift R5

Original compact true-X 5-inch racing quad, visually inspired by classic fin-equipped racing frames. It is not an exact GEPRC replica. The configuration is an initial estimate.

## Airframe and configuration

- 218 mm motor diagonal, 127 mm tri-blade propellers, 2207-style vented motors.
- 485 g estimated flying mass including an underslung 6S / 1050 mAh pack.
- A short slotted carbon chassis, replaceable tapered arms, curved upper fin, tilted micro FPV camera, FC/4-in-1 ESC stack, VTX/coax and rear antenna.
- Two bottom straps, soft power-lead bends into an XT60, twelve motor solder joints and separate camera conductors terminating at the FC.
- Shared Acro/Angle/Horizon control, battery/wind/propwash simulation, individual blade damage, turtle mode, remote animation, mixed multiplayer, timed records and ghosts.
- The battery and fin have extra massless collision shapes. Previous aircraft configurations and record hashes are unchanged.

## Measured envelope

Calm air, nominal voltage, default Actual Rates, battery/damage/propwash disabled; the 240 Hz measurement is in `flight-measurements.json`.

| Measurement | R5 | X5 |
| --- | --- | --- |
| Sustainable approximately level full-power cruise | 218.1 km/h | 196.7 km/h |
| Time to 100 km/h | 0.267 s | 0.508 s |
| Hover command | 27.5% | 27.6% |

These are simulator measurements, not manufacturer specifications. Terminal speed follows thrust/drag rather than a velocity clamp. The stronger propulsion retains a progressive throttle curve and damped stick release.

## Source and validation

`data/drones/rift-r5.json` owns tuning. `shared/visual/racing-model.js` builds the same mesh for flight, previews, remote pilots, ghosts and showcase; `node scripts/export-racing.mjs` exports a GLB with its embedded carbon-weave and battery-label textures. No image/network requests or native canvas dependency are needed for the export.

Focused checks cover dimensional/mesh budgets, swept propeller clearance, solder endpoints, FPV lens clearance, actual obstacle damage, exposure/remote animation, independent color materials and texture disposal. Standard fleet measurements cover all directions, low/full throttle, reset, hover, control modes, refresh-rate independence and terminal cruise. The mixed eight-client lifecycle test includes both new aircraft.
