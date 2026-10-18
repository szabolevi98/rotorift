# Rift S75 — small pusher parkflyer

Introduced 2026-10-18. An original 750 mm foam-style aircraft inspired by the
rounded pod, high wing and elevated pusher layout of the Mini AeroScout. This is
our own **2S brushless** design, not a scale copy or a calibrated AeroScout model.

| Parameter | Simulator configuration |
| --- | --- |
| Wingspan / length | 750 / 550 mm |
| Take-off mass | 230 g |
| Wing area / reference chord | 0.091 m² / 122 mm |
| Battery | 2S / 650 mAh |
| Motor / propeller | One brushless pusher, 2.5 N static thrust / 5-inch two-blade prop |
| Controls | Manual or Stabilized; ailerons / elevator / rudder; 60% travel and 35% expo |
| Airborne practice launch | 40 m / 9 m/s |
| Ground launch | Grove south promenade, free flight |

Mass, inertia, lift/drag, current and thrust are design estimates. At neutral
sticks, a calm-air 15-second simulation settles near 10.7 m/s: approximately 40%
throttle maintains height, 70% gives a gentle climb, and zero throttle glides.
Wind, battery sag, attitude and control settings change those results.

The front camera looks out of the rounded pod. The motor sits on a raised aft
pylon, with enough clearance for the full propeller disc above the tail boom.
Canopy and foam use one continuous skin; the colored wing and tail control
surfaces have independent hinges. Static parts batch by material. The same
procedural factory supplies the hangar, flight, ghosts, remote aircraft and
showcase. Run `node scripts/export-trainer.mjs --scout` for the standalone GLB,
and `npm run showcase:build` after changing its appearance.

Stabilized mode returns pitch and bank to level on neutral right stick, using
the real servo/aerodynamic pipeline. Full stick requests 20° pitch / 35° bank;
throttle remains manual and there is no altitude hold. Manual remains available.

Both planes share the aerodynamic solver and visual animation adapter, with
separate configurations and model factories. Structural dimensions live in
`shared/aircraft/airframe.js`, including aircraft-specific wheel positions,
ground clearance, wing/tail colliders and S75 boom/motor/fin proxies. Ground
steering torque scales with airframe mass and length; T15 response is preserved.

The S75 supports both Grove airplane circuits, local and verified records,
ghosts, battery and wind, and mixed eight-pilot free-flight rooms with drones
and the T15. Solo Playground flights remain excluded, as for the T15; mixed
online free flight permits any aircraft on every map. Quad-only prop damage,
propwash and turtle mode remain unavailable on airplanes.

Automated checks cover finite geometry, propeller/camera clearance, flight and
glide, 30/60/120/144 Hz display cadence, battery/reset, ground parking/takeoff on
the prepared Grove map, remote collision dimensions and synchronized pusher
animation. The eight-client network test includes all seven aircraft types.
These are software checks, not real-aircraft flight-log calibration or a test
of seven physical controllers and independent internet connections.
