# Rift Aero 40

Original 400 mm foam micro warbird inspired by the P-51D silhouette, with a front-mounted two-blade propeller. It appears before Aero 75 and Aero 150 in both aircraft selectors.

## Configuration

- 400 mm span, 325 mm overall length, 62 g estimated flying mass.
- 1S / 3.7 V / 400 mAh LiPo; 128 mm tractor propeller.
- Low tapered wing, mild dihedral, rounded tips, integrated bubble canopy, belly radiator and taildragger gear.
- Manual and Stabilized modes; shared fixed-wing aerodynamics, servo response, wind, battery simulation, air/ground launch, FPV/chase/ground-pilot cameras.
- All six airplane routes, mixed multiplayer free flight, typed remote animation, records and ghosts use the ordinary aircraft catalog. The physics coefficients are estimates, not a calibrated P-51 replica.

The real [Volantex P-51D 400 mm](https://exhobby.com/products/volantexrc-p51d-mustang-beginner-rc-airplanes-with-xpilot-stabilizer-rtf) provides a size/battery reference (400 mm, 3.7 V / 400 mAh). The Rotorift mesh, paint and aerodynamic tuning are original.

## Source and validation

`data/airplanes/rift-a40.json` owns tuning; `shared/visual/warbird-model.js` is the single mesh source for flight, remote pilots, ghosts and showcase. `node scripts/export-trainer.mjs --warbird` rebuilds its GLB. Static geometry is batched by material; moving controls and their paint remain separate. Glazing replaces the body skin instead of covering a second shell.

Focused tests cover real dimensions and selector order, finite geometry/draw budget, unobstructed glazing before/after batching, local/remote propeller and control animation, gliding, control signs and frame-cadence independence. Handling remains an experimental estimate.

Revision 2 halves the aileron authority to make the micro airframe's roll response manageable alongside Aero 75 and Aero 150. This applies equally to keyboard, radio and touch controls in Manual and Stabilized modes; elevator and rudder tuning are unchanged. Its physics hash changes with this tuning, so earlier records and ghosts remain separate.

Revision 3 lowers and broadens the bubble canopy and adds a small nose-mounted FPV camera. Both FPV views use the lens position; the ordinary FPV view shows the propeller ahead, while FPV clean retains its unobstructed view.

Optional tractor prop damage (2026-10-19) uses the shared simulation switch: each of the two blades can bend, chip or break, reducing thrust and causing imbalance. Reset or disabling the option repairs the prop; the existing severe crash remains separate.

Optional [airplane propeller slipstream](airplane-slipstream.md) models the tractor wake over the tail, including throttle-dependent control authority and mild swirl, without applying quad descent wobble.
