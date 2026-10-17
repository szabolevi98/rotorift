# Drone audio

Implemented on 2026-10-17 in `web/game/drone-sound.js`. Each aircraft has its own
tuned synthesis profile. These are acoustic approximations, not recordings or
measured manufacturer RPM specifications.

- Rift 65: high, light rotor buzz; Rift 75: a slightly lower and fuller whoop.
- Rift C3: lower rotor pitch and a stronger duct resonance.
- Rift X35: sharper open-prop character; Rift X5: deeper body and broader airflow.
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
The existing sound checkbox remains the user control.

Validation: three focused tests cover all five profiles, individual motor input,
silence, chase level, damage, propwash, graph reuse, gesture resume and disposal.
A Chromium OfflineAudioContext rendered all five profiles at 44.1 kHz with a
zero/ramp/hover/punch/release sequence. Peaks were 0.051–0.065 (full scale 1),
active RMS 0.010–0.012, and the final silence window was exactly zero. No audio
graph errors were reported. Subjective character remains adjustable by listening.
