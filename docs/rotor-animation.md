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

Multiplayer state messages carry four normalized rotor speeds at the existing
20 Hz state rate. Remote models integrate their own animation every render frame
with the same speed scale and motor directions. Each rotor follows its individual
motor; blade damage remains independent. Zero throttle, disarm and pause send
zero speeds. Reset, disconnect, race completion, or 600 ms without a fresh valid
motor update stops remote propellers. Older clients without this optional field
remain compatible and display stopped rotors rather than invented rotation.
