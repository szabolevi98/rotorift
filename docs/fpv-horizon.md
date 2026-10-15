# FPV horizon and analog video

The optional horizon has two sparse dotted side rails, small inward level marks,
a fixed circular centre reference and nine short moving horizon dashes. Own SVG
geometry, with subtle dark outlines for readability over both sky and ground.
It uses up to 48% of viewport width, bounded by 82% of viewport height and 920 px.
The rails sit inside this area so the instrument fits landscape phones too.

Body attitude comes from the interpolated quaternion, independently of yaw,
camera tilt and FOV. Pitch travel is bounded to ±20° and roll to ±40°. Segments
outside the display disappear rather than flattening against its edge. Both
FPV views support it; external view, menus, help and the ARM prompt hide it.

Analog video is a separate, saved personal option. It renders the world once
into a buffer capped at 1024×576, without upscaling smaller drawing buffers,
then applies one full-screen triangle pass. It combines reduced chroma bandwidth,
fine temporal grain, light scanlines and vignetting. Every roughly 6.5 seconds,
a 100–180 ms narrow band can suffer horizontal sync slips and black/white
dropouts. The frame stays readable; the HUD is unaffected. This is a visual
receiver treatment, not a simulation of RF range or obstacles blocking a signal.

Temporal noise updates at 30 Hz; interference uses elapsed time, independent of
monitor refresh. Reduced-motion preference freezes the grain and disables the
bursts. Disabled, chase and menu views use the original direct rendering path:
no extra render target or shader pass is created until first enabled. The buffer
is reused across maps and frames, and render diagnostics include both passes.

Verification covers pitch/roll direction, yaw independence, full rotations,
burst duration/duty cycle, reduced motion, resolution bounds, render-state
restoration and actual WebGL rendering in the game.
