# Rotor animation

The local aircraft's visible propellers stop at zero stick throttle or when
disarmed. Each rotor's animation speed follows the square root of its measured
motor thrust, including motor response and battery power loss. The visible
speed is scaled to 22 rad/s at full thrust, so 25/50/75/100% remain distinguishable
without display-rate aliasing making a fast propeller appear stopped or reverse.
This is a shutter-speed representation, not literal visible RPM. The physical
full-speed rotor phase and Betaflight-like armed idle/attitude authority remain
independent and unchanged. FPV exposure opacity also follows rotor speed; its
soft transparent disc avoids the terrain strobing caused by opaque fast blades.
