import { PHYSICS_DT } from './drone.js';

// Display cadence supplies elapsed seconds, never the number of physics ticks.
// The small tolerance prevents a floating-point remainder losing a tick at
// display rates that do not divide 240 (e.g. 144 Hz).
export function advanceFixedSteps(state, elapsed, update) {
  state.accumulator += Math.min(Math.max(0, elapsed), .1);
  let steps = 0;
  while (state.accumulator + 1e-12 >= PHYSICS_DT) {
    update(PHYSICS_DT);
    state.accumulator = Math.max(0, state.accumulator - PHYSICS_DT);
    steps++;
  }
  return steps;
}
