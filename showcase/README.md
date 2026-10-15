# Rotorift Showcase

An extensible viewer for Rotorift's procedural drone models, maps and race routes.
Five aircraft are available, in this order: **Rift 65 → Rift 75 → Rift C3 → Rift X35 → Rift X5**.
The showcase is separate from the simulator: it lets you inspect models and edit
race gates, while flight physics, controls and multiplayer run in the main game.

## Opening the showcase

- **[GitHub Pages](https://szabolevi98.github.io/rotorift/)**. The
  `showcase-pages.yml` workflow rebuilds and publishes showcase changes pushed to
  `main`, including the map viewer and race editor.
- **Node server:** `http://localhost:3015/showcase/`.
- **XAMPP/Apache:** `http://localhost/rotorift/showcase/`.
- **Offline drone viewer:** open `index.html` directly in Chrome or Edge. It
  contains Three.js, the procedural models and their textures, so it needs no
  installation or network connection. WebGL 2 is required.

Drag to rotate and scroll to zoom. Touchscreens support one-finger rotation and
two-finger zoom. Top, front, side and rear presets are available.

Toggle the battery, propellers and action camera independently. Other controls
include exploded view, propeller animation, automatic rotation, eight plastic/TPU
colors and wireframe mode. The action-camera toggle applies to the X5 and C3.
The default is Rotorift's saturated orange; battery label accents follow the
selected aircraft color.

For maps, race JSON, floating neon gates and obstacle-aware guide generation,
see the [race editor documentation](../README.md#showcase-and-race-editor).

## Rift 65

- 65 mm diagonal motor spacing and 31 mm translucent, twisted tri-blade propellers.
- Orange polypropylene-style frame with thin propeller guards, three-spoke motor
  supports, an open center and underside battery clips. Each guard has two slender,
  rounded, open landing feet: eight in total, with matching contact heights.
- Four miniature 0702 motors with silver bells, blue upper rims, copper windings,
  open top spokes, shafts and underside mounting screws.
- A 45-degree AIO board with a 26 × 26 mm mounting pattern. The four damped mounts
  and canopy feet stay outside the propeller discs.
- FC, ESC, VTX and receiver details, motor phase pads, solder joints and wiring.
  Motor and battery leads attach underneath the board.
- A translucent, open camera canopy with curved ribs and four screw-mounted tabs.
  The micro FPV camera is tilted upward by 28 degrees, with a lens barrel and rear PCB.
- A heat-shrink-covered VTX whip and a separate receiver antenna. The short 5 mm
  ELRS radiator stands beside the canopy on its own support, outside the propeller discs.
- An underside 1S / 300 mAh battery with its own label and a paired BT2.0-style
  connector. Power leads run between the board and frame, under the canopy, then
  through a battery end panel and grommets to the connector's rear cable entries.

Visual references include user-supplied photos of the
[BETAFPV Air65](https://betafpv.com/collections/air-whoops/products/air65-brushless-whoop-quadcopter)
and the [Air65 frame specifications](https://betafpv.com/collections/accessory/products/air65-brushless-whoop-frame).
The Rift 65 uses original procedural geometry, not manufacturer CAD.

## Rift 75

- A 75-class whoop with 80.8 mm diagonal motor spacing, 45 mm tri-blade propellers
  and four 1102 motors.
- Orange frame with propeller guards and two solid landing feet per guard,
  distinct from the Rift 65's open feet.
- A rounded, white camera canopy with ventilation openings, side cutouts and
  screw-mounted feet, shaped using the supplied Meteor75 Pro reference photos.
- Detailed AIO electronics and underside motor wiring that avoids crossing the frame.
- An underside 1S / 580 mAh battery with compact top/bottom labels and a power connector.

The model is original procedural geometry inspired by the referenced whoop class;
it is not a manufacturer CAD model.

## Rift C3

- A cinewhoop silhouette based on the supplied Cinelog30 V3 photos, with Rotorift
  naming and original procedural geometry.
- 128 mm diagonal motor spacing, inverted 1404 motors and 76 mm twisted tri-blade
  pusher propellers below the frame.
- Orange, low-profile propeller guards with cutout side bridges, upper-frame supports
  and eight rounded, solid landing feet. Two broad curved side saddles and two flat
  front ribs join the guards to screw-mounted carbon contact surfaces.
- A perforated 2.5 mm carbon upper frame, lower electronics tray, contacting standoffs,
  through-bolts and reinforced front supports. Conventional 14 mm-wide carbon arms
  extend to chamfered motor mounts, keeping all mounting screws and washers over carbon.
- A vibration-isolated AIO board, soldered motor leads, a secured digital VTX,
  cooling fins, covered data connectors and a rear receiver/power board.
- A tilted digital FPV camera in an orange, open TPU cage. A carbon nose fork wraps
  around it; separate TPU feet, lower braces, rubber bushings and through-bolts
  connect the mount to the frame without crossing the lens housing.
- A top-mounted 4S / 720 mAh battery with two straps, labels, cable exits, paired
  XT30 connectors and a secured five-pin balance plug. The XT30 sits in a bolted
  rear TPU cradle; main leads run beside the VTX and through the top plate.
  A narrow band secures the balance plug to the main battery leads.
- Two omni video antennas on separate upper mounts with their own coax entries.
  The ELRS T antenna sits below and behind them, held by two enclosing clamps,
  rubber inserts and an underside carbon-mounted bracket.
- A tilting naked-action-camera-style unit with a lightweight 9 mm housing, an
  open orange mount, visible rear electronics and cooling fins. Its mount uses a
  cross-brace and bolted tilt joint; power runs from the camera connector to the BEC.

Shape and dimension references:
[GEPRC GEP-CL30 V3 frame](https://geprc.com/product/gep-cl30-v3-frame/) and
[Cinelog30 V3 O4 Pro](https://geprc.com/product/geprc-cinelog30-v3-o4-pro-quadcopter/).
The naked camera uses original simplified geometry. These are visual models,
not manufacturing dimensions or exact product reconstructions.

## Rift X35

- A compact 160 mm carbon X frame for 3.5-inch freestyle, with 1404 motors and
  smoked, translucent 88.9 mm tri-blade propellers.
- Detailed motor-base TPU guards, a dedicated FPV camera mount and a top-mounted
  4S / 650 mAh battery. There is no action camera above the frame.
- Green FC/ESC boards, camera and VTX wiring attached to connector/solder-pad
  details, a rear antenna mount and a compact balance-plug restraint.
- Three camera-mount studies are available in `x35-mount-lab.html`; the accepted
  model uses the third variant.

For configuration, measurements and implementation notes, see
[rift-x35.md](../docs/rift-x35.md).

## Rift X5

- An original carbon X frame with 230 mm diagonal motor spacing, 5 mm arms,
  mounting holes and cutouts. Standoffs contact both plates, with through-bolts
  and arm clamps. The 149 mm center body provides a separate rear electronics bay.
- Four detailed motors with copper windings and open upper bells.
- TPU motor guards with perforated bases, open protective rims, impact ribs,
  layer seams, recessed screw seats and underside landing skids.
- Four 127 mm twisted tri-blade propellers in dark, smoked translucent plastic.
- A tilted FPV camera with shaped, perforated TPU side mounts, vibration isolators,
  through-bolts and a frame-mounted nose protector.
- An original full-size action camera in a GoPro-style TPU cage, with side/shutter
  openings, retaining lips and a bolted fork-style tilt joint.
- An FC/ESC stack centered between the four motors, with real mounting holes,
  continuous rubber spacers, through-bolts, nuts and an inter-board wiring harness.
  Twelve motor phase pads sit between the ESC's corner mounts; each cable end
  connects through a separate metallic solder joint.
- A VTX on a bolted TPU tray, with a damping pad, straps, connectors and a separate
  capacitor holder. The VTX and receiver sit between the longer rear plates, with
  wiring routed inside the frame.
- A 6S / 1300 mAh battery with a contacting non-slip pad, two straps, keyed XT60
  plug/socket housings, gold contacts, cable protection and a seven-pin balance plug.
  A battery end panel provides cable exits, main-lead grommets and balance-wire
  strain relief. The XT60 sits in a bolted TPU collar behind the battery, while
  ESC power leads enter through a separate grommet-lined top opening.
- Battery leads fold back into the XT60's rear cable sleeves. The balance plug
  sits beside the main leads, restrained with a shared band; its cable entries
  remain separate from the power cable bends.
- A frame-mounted rear TPU antenna bridge, ELRS receiver and T-shaped dipole with
  its own coax lead. A bolted base, two flat braces, a lower cradle and two lined
  sleeves support the T antenna.
- A straight, rear-tilted omni video antenna with a slim black eight-sided head,
  orange side accents, chamfered edges and a flat top panel.
- Procedural carbon textures and original labels, without imported manufacturer
  models or photo textures.

Proportion references:
[GEPRC Vapor X5 frame](https://geprc.com/product/gep-vapor-x5-frame/) and
[GEPRC MARK5 frame](https://geprc.com/product/geprc-gep-mk5-frame/).
Other visual references include the
[GEPRC adjustable TPU camera mount](https://geprc.com/product/geprc-mark5-gp-5-6-7-8-9-10-adjustable-tpu-mount/),
[Momoda 2 antenna](https://geprc.com/product/geprc-momoda2-5-8g-antenna/), and
[ExpressLRS hardware guide](https://www.expresslrs.org/hardware/hardware-selection/).
The Rift X5 is original geometry, not manufacturer CAD or an exact product reconstruction.
Its dimensions describe the visual model rather than a manufacturing specification.

## GLB export

Saved models use filenames such as `rotorift-rift-65.glb`, `rotorift-rift-75.glb`,
`rotorift-rift-c3.glb`, `rotorift-rift-x35.glb` and `rotorift-rift-x5.glb`.

**Download model** exports a real GLB file with embedded textures, the selected
color and currently visible parts. Export uses the assembled state, even if
exploded view is active. Models import in metres; parts have separate names, and
propellers rotate around their own centers.

Import with Blender's **File → Import → glTF 2.0** or Three.js `GLTFLoader`.
Visual models and simplified collision shapes are separate; the simulator also
handles rendering preparation and propeller animation independently.

## Source files and rebuilding

| File | Purpose |
| --- | --- |
| `drone.js` | Parametric Rift X5 geometry and procedural textures |
| `whoop65.js` | Rift 65 geometry and whoop battery-label helper |
| `whoop75.js` | Rift 75 geometry and canopy |
| `cinewhoop3.js` | C3 guards, frame, electronics and naked camera |
| `freestyle35.js` | X35 geometry and camera-mount variants |
| `x35-mount-lab.template.html`, `x35-mount-studies.js` | X35 mount comparison; generates `x35-mount-lab.html` |
| `catalog.js` | Model selection, names, availability, specifications and export filenames |
| `viewer.js` | Camera, studio lighting, controls and GLB export |
| `map-viewer.js` | Map browsing, gate editing, route import/export and guide generation |
| `../shared/visual/drone-rendering.js` | Shared game/showcase color handling, reflections, green PCBs and optical glass |
| `sync-materials.mjs` | Update accepted GLB materials while preserving geometry and embedded textures |
| `template.html`, `style.css` | Drone showcase interface |
| `build.mjs` | Package the drone viewer as standalone HTML and bundle the map viewer |
| `vendor/` | Three.js r169, OrbitControls, GLTFExporter and TextureUtils |

From the repository root, after installing dependencies:

```sh
npm run showcase:build
```

To update materials in accepted GLBs:

```sh
node showcase/sync-materials.mjs
```

To add an aircraft, create a factory following `createRiftX5()` and assign it to
an entry's `create` field in `catalog.js`. Fill in its specifications and set its
status to `ready`. Add the source file to the packaging list in `build.mjs` and
update the catalog order as needed. The viewer builds the selector, updates the
specifications and exports the selected model automatically. `cameraScale`
controls framing and zoom limits. Entries marked `coming` create no geometry and
cannot be selected for viewing.

Three.js and its addons use the MIT license, included in `vendor/LICENSE.three.txt`.
Original project sources are covered by the [repository license](../LICENSE).
