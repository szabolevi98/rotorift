# Drone audio

Implemented on 2026-10-17 in `web/game/drone-sound.js`. Each aircraft has its own
tuned synthesis profile. These are acoustic approximations, not recordings or
measured manufacturer RPM specifications. Profile coverage snapshot:
**2026-10-19 — six drones and three airplanes**. Later additions use the runtime
catalog; see the [current fleet summary](prototype.md).

- Rift 65: high, light rotor buzz; Rift 75: a slightly lower and fuller whoop.
- Rift C3: lower rotor pitch and a stronger duct resonance.
- Rift X35: sharper open-prop character; Rift X5: deeper body and broader airflow.
- Rift R5: sharper 5-inch racing buzz, a higher rotor character and broader airflow than X5.
- Four independently driven oscillators follow the same motor-speed fractions as
  the visible propellers, including the flight controller's motor mixing and lag.
- Blade-pass harmonics, a small motor component, filtered airflow and slight
  independent detuning replace the former single sawtooth.
- Speed adds some airflow; descending propwash adds texture only with that
  simulation enabled. Damaged blades alter the relevant rotor's timbre and level.
- Normal zero-throttle, disarm, pause and sound-off mute the output. Chase view
  is softer. Model changes reuse one audio context and configure the new profile.
- Real gestures can resume a browser-suspended context after asynchronous loading.

There are no downloaded samples, microphone requests, AudioWorklets or
per-sample JavaScript callbacks. The native graph has four oscillator voices and
one two-second mono noise buffer; updates do not allocate more audio nodes.
The sound checkbox and a saved **0–100% volume slider** under Settings → Video &
audio control output (default 70%). The initial output was too quiet; master gain
was increased on 2026-10-17. Zero volume mutes without creating another audio graph.
The Aero 150, Aero 75 and Aero 40 each have their own single-active-voice/two-blade profile; the micro warbird has a lighter, higher character than the large trainer.

Current automated validation checks profile coverage against the runtime catalog.
Three focused tests cover drone profile differences, individual motor input,
silence, chase level, damage, propwash, graph reuse, gesture resume and disposal.
The initial 2026-10-17 Chromium OfflineAudioContext run rendered the then-existing
five drone profiles at 44.1 kHz with a zero/ramp/hover/punch/release sequence.
Peaks were 0.051–0.065 (full scale 1),
active RMS 0.010–0.012, and the final silence window was exactly zero. No audio
graph errors were reported. These levels describe the initial quiet version before
the volume correction, not the current output. Subjective character remains
adjustable by listening.

The volume-correction measurement covered five drones and Aero 150; it contains
no offline audio measurements for R5, Aero 75 or Aero 40. A native Chromium
OfflineAudioContext check at 44.1 kHz, full throttle and 100% volume measured
five-drone peaks of 0.476–0.613
and RMS 0.137–0.157; Aero 150 peak 0.241, RMS 0.115. All six measured profiles
were below full scale 1, with no graph errors. This tests clean full-throttle
level/headroom, not subjective
sound quality or every damaged-rotor transient.
