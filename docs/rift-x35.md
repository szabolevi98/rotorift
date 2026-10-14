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
outboard rim that leaves the motor wiring clear. The FPV camera uses compact
side cheeks, two feet secured by four bolts, and a rounded rectangular bumper.
The pack has an XT30 pair with separated wire
entries, and a balance connector resting on the power leads, secured with a
thin black band and a small cushion. The rear
omni antenna is above the deck; the ELRS dipole is held in closed clamps below
the propeller plane. Motor wiring attaches beneath the AIO PCB and clears carbon.

Motor bells have a 17.9 mm outside diameter and a shorter 8.2 mm wall, with a
4 mm stator and a two-bolt T-mount propeller hub. The skids retain bolt access
with a narrower, 21.8 mm outboard rim. Each conventional arm and circular motor
seat form one extruded outline, eliminating the coplanar faces that flickered
in the rotating hangar preview. The [T-MOTOR F1404 dimensions](https://store.tmotor.com/product/f1404-fpv-motor.html)
provide the motor size reference; this visual revision preserves rotor positions
and the existing flight configuration.

The hangar shadow floor follows each selected model's lowest point with
0.5 mm clearance, rather than intersecting arms at the model origin. It does
not write to the depth buffer; a small normal shadow bias reduces self-shadow
acne at this model scale.

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

## Camera mount alternatives and rear antenna

The [X35 mount lab](../showcase/x35-mount-lab.html) compares three real model
variants: A / twin cheeks with an exposed camera, B / a short upper visor,
and C / a rounded rectangular corner bumper. All retain the same camera tilt,
four lower-frame bolts and side pivots. Option C is the selected default in
the main showcase and exported game model; A and B remain comparison options.

The upper carbon deck now has an open camera bay so it does not intersect the
tilted housing. The rear omni antenna sits behind the XT30 on its own shelf,
attached to the deck by two bolted feet and diagonal braces. The stem, radome
and base seam are black, with no colored decoration. The XT30, battery leads,
balance connector and lower receiver antenna retain their separate positions.

The mount lab renders only on view changes, resizing and dragging. The game
GLB contains only the current mount, not all three alternatives. Tests verify
the unobstructed optical axes, open carbon bay, antenna/connector separation,
rotor alignment and existing underside wiring.
