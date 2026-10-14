# Rift X35

3.5-inch, 4S freestyle aircraft with a top-mounted battery and FPV camera only.
There is no action camera, action-camera mount, or propeller guard. Fleet order:
65, 75, C3, X35, X5. The five languages, solo selection, radio/rate profiles,
multiplayer rooms, individual propeller damage and eight colors use the normal
catalog/configuration path.

| Property | Initial simulation configuration |
| --- | --- |
| Takeoff mass | 215 g including the battery |
| Propellers | 88.9 mm, three blades |
| Diagonal motor spacing | 160 mm |
| Battery | 4S / 650 mAh |
| Motor appearance | 1404 class |
| Hover throttle, measured in the simulator | 28.63% |
| Sustained level full-power cruise, simulated | 153.58 km/h |
| Full roll at default rates / hover throttle | 0.571 s |
| 50–25 km/h coast distance | 16.30 m |

The source is `showcase/freestyle35.js`; the corresponding game asset is
`web/assets/models/rotorift-rift-x35.glb`. It contains approximately 34k triangles.
The battery follows the C3 pack design, with rounded shrink-protected ends,
cell seams, top and rear labels, and two straps with side buckles through deck
slots. Motor TPU skids cover the underside with screw access holes and an
outboard rim that leaves the motor wiring clear. The FPV camera uses curved,
open side cheeks, two feet secured by four bolts, and a rounded lens surround.
The pack has an XT30 pair with separated wire
entries, and a balance connector secured alongside the power leads. The rear
omni antenna is above the deck; the ELRS dipole is held in closed clamps below
the propeller plane. Motor wiring attaches beneath the AIO PCB and clears carbon.

The [GEPRC SMART35 manufacturer's specifications](https://geprc.com/product/geprc-smart-35-analog-3-5inch-micro-freestyle-drone/)
provided a size-class reference: 3.5-inch props, 4S power and 1404 motors. X35
geometry, 160 mm spacing and all-up mass are Rotorift design choices. Motor thrust,
inertia, drag and battery tuning are estimates; these measurements validate the
simulator's behavior, not an exact match to a real aircraft.

Verification covers flat conventional arms, four motor-aligned 3.5-inch rotors,
carbon/PCB clearance of all 12 motor leads, receiver antenna clearance, export
without action-camera parts, and game loading with 12 independently damageable
blades. The regular flight-envelope tests also cover all axes, throttle levels,
level modes, frame rates, and positions away from the world origin.
