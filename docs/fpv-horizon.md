# FPV artificial horizon

The optional horizon follows the Betaflight character-grid layout: nine moving
horizontal segments, sidebars at ±7 columns with two small ticks per character,
level arrows and a fixed diamond crosshair. Each logical character is 12×18.
The shape reference is the [Betaflight OSD glyph table](https://betaflight.com/docs/development/OSD-Glyps);
the layout and motion limits follow the [OSD element reference](https://github.com/betaflight/betaflight/blob/master/src/main/osd/osd_elements.c).
Rotorift draws its own vector shapes, without a font or raster image download.

The overlay uses half the viewport width, limited to 960 px and 88% of viewport
height so it fits landscape phones. At 1920×1080 the instrument is approximately
950 px wide, rather than the previous 220 px. Black outline paths keep the white
symbols readable over sky and ground, without per-element SVG filters.

Pitch travel is bounded to ±20° and roll to ±40°. The movement is quantized to
two logical pixels; segments outside the nine-row display are hidden, rather
than clamped into a flat line. It remains optional in both FPV views and is
hidden in external view, menus, help and the initial ARM prompt.

Verification covers level flight, pitch/roll direction, yaw independence and
full rotations, plus desktop and landscape-phone placement in the actual HUD.
