# Airplane propeller slipstream — 2026-10-19

All three Aero aircraft offer the existing **Propwash** simulation switch, with
a short aircraft-specific explanation below its name. The default remains off. Multiplayer
uses the host’s existing rules and simulation-key record category. Mixed rooms
apply the airplane model to planes and the unchanged quad turbulence model to drones.

`shared/physics/airplane-slipstream.js` adds only incremental tail loads to the
existing free-air aerodynamic solver. An actuator-disc estimate uses actual motor
thrust after battery, spool, airspeed and blade-damage losses, propeller diameter
and air density. The wake develops and contracts downstream, is carried sideways
by relative airflow, and has a mild rotation following motor direction. Zero
thrust produces zero additional loads. No random shake is added.

Nine samples across each horizontal and vertical tail estimate coverage. Dimensions
come from the shared airframe layout. The Aero 40/150 tractor wakes cover portions
of both tails. The Aero 75 pusher is high above the horizontal tail: in calm level
flow it reaches chiefly the upper fin, and never boosts a surface ahead of the prop.
The current ailerons lie outside the wake and receive no generic control boost.

Local angular rates enter each sample’s relative flow. Lift/side-force increments
change control authority and damping, and mild swirl produces a turning tendency.
Corresponding forces and moments are applied to the rigid body; orientation is
never changed directly. The existing servos and Manual/Stabilized modes remain in
control. Closing the throttle lets the effect decay with motor spool-down; reset
clears motor thrust, and disabling the option immediately removes the extra load.
Missing blades reduce the wash together with thrust; two missing blades remove it.
The quad-specific descent sound treatment is not used for airplanes.

This is a bounded game-physics approximation, with estimated coefficients rather
than measured RC airframe data. It does not solve fuselage wake obstruction,
propeller suction ahead of the disc, ground effect, wake history or detailed stalled
flow. Free-air aerodynamics are unchanged when disabled. The extra per-step work
is at most 18 preallocated tail samples, with no particles or collision bodies.

Focused tests cover actual three-plane geometry differences, absent/upstream wake,
control signs, swirl direction, crossflow, power/damage/reset integration, stable
servo response and 30/60/120/144 Hz frame cadence. Existing network tests cover the
shared switch and simulation category in homogeneous and mixed rooms.

Background: [FAA Airplane Flying Handbook, chapter 3](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/04_afh_ch3.pdf)
describes slipstream-related tail loads; [Aerodynamics for Naval Aviators](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/00-80T-80.pdf)
describes the directional effect of rotating slipstream. These establish the
phenomena, not numerical calibration of this model.
