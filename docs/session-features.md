# Shared flying and recordings — 2026-10-23

## Invitations and spectators

The lobby copies a pilot invite link or a spectator link. Links carry only the
six-character room code and optional `watch=1`; no account/resume credentials.
The game waits for the authenticated connection, then joins. Missing/full rooms
use the existing error feedback and the code remains available for retry.
Opening an explicit invitation takes precedence over a saved room reservation.

Each room supports eight pilots and up to sixteen separate spectators. The
server keeps spectators outside the pilot/launch/collision/result roster and
ignores their state, ready, reset and host-rule messages. Spectators can enter
running races, free-flight rooms and solo hotlap rooms; they receive snapshots,
can reconnect within the existing reservation interval, and are released when
the last pilot leaves. They never hold up readiness or race completion.

The spectator HUD selects a connected pilot and either chase or clean FPV view.
It uses interpolated remote models, their own aircraft dimensions/camera offsets,
and transmitted bounded camera tilt/FOV. Motor sound follows the selected
aircraft. Pilot/camera changes do not affect that pilot's controls or physics.
Finished pilots may switch to watching other active pilots from the results.
Pilots can also switch from the in-flight pause menu when another connected
pilot remains; leaving the pilot roster invalidates that pilot's current run.

## Flight recordings

The client keeps up to the last five active minutes of its own flight in memory,
in solo and multiplayer. No recorder runs for spectators or playback. A sample
contains pose, velocity, motor/surface/damage state, camera settings, reset epoch
and circuit traffic time; traffic seed and aircraft/map metadata accompany it.
Sampling is limited to roughly 20 Hz and at most 6,002 samples.

The Replay menu and solo pause-menu button open the recording. Playback offers
pause, seeking, 0.25/0.5/1/2× speed, chase/FPV/clean FPV, and JSON export/import.
Resets jump between poses rather than interpolating through scenery. Recorded
motion is rendered directly, without physics resimulation, live state messages
or leaderboard submissions. Playback requires leaving the multiplayer room.

Recordings are tab-local and are lost on reload unless exported. Import validates
size, metadata, times, poses, motor data and camera bounds; playback requires a
matching available aircraft configuration. The map uses the current local scene,
so recordings are not historical snapshots of old map geometry. Other pilots'
flights are not part of the personal recording.

## Settings transfer

Settings export includes radio calibration/profiles, keys, rates, camera profiles,
airplane control travel/expo, simulation preferences, language and color. Identity,
resume credentials, nickname, records and ghosts are excluded. Import validates
the file, shows the number of setting groups, and requires Apply before replacing
matching preferences and reloading. It is blocked during a flight/room. Storage
write failures attempt to restore the old values instead of leaving a partial
profile. Calibration remains specific to the radio/browser/USB mapping; importing
a profile does not make incompatible hardware layouts identical.

## Air Mode

Air Mode is an optional drone simulation rule, enabled by default. Enabled keeps
the existing attitude-preserving mixer and armed idle. Disabled removes idle,
scales control authority down with throttle below 10%, and prevents the mixer
from adding collective thrust to preserve attitude at zero throttle. Motor lag
still applies when cutting throttle. Airplane aerodynamics are unaffected.
At high throttle the disabled mixer can reduce collective to fit the motor
limits, retaining the configured centre-of-mass balance instead of clipping
each motor independently. It still never boosts collective; low-throttle
corrections are reduced when the available thrust cannot accommodate them.

The switch appears with the simulation options; multiplayer shares/locks it like
other room rules. Existing record categories remain unchanged with Air Mode on.
The final digit of the existing five-character simulation key stores wind 0–3,
plus 4 for Air Mode off. Old database column widths remain valid and the two
settings have separate records/ghosts. Protocol 7 supports spectators and Air
Mode-off rooms; older clients must refresh before joining those rooms.

Animation deliberately hides armed idle with zero throttle and centered sticks,
as requested; steering displays motor demands above idle. Air Mode off disables
that physical zero-throttle authority as well, rather than just hiding it.

Validation covers settings round trips and rejection/rollback, bounded recording
playback and resets, aircraft-local follow cameras, both Air Mode physics paths,
and full-room spectator join/reconnect/authority/result isolation. Browser checks
exercise a real recorded Aero 40 flight and live drone/airplane spectator cameras.
