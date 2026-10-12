export const RADIO_ACTIONS = ["arm", "reset", "view", "mode", "menu"];
export const bindingKey = (binding) => binding
  ? `${binding.type}:${binding.index}${binding.type === "axis" ? ":" + binding.direction : ""}`
  : "";
export function parseBinding(value) {
  const match = /^(button):(\d+)$|^(axis):(\d+):(-?1)$/.exec(value);
  if (!match) return null;
  return match[1]
    ? { type: "button", index: Number(match[2]) }
    : { type: "axis", index: Number(match[4]), direction: Number(match[5]) };
}
export function availableBindings(pad, profile) {
  const used = new Set(Object.values(profile.axes).map((axis) => axis.index));
  return [
    ...Array.from(pad?.buttons ?? [], (_, index) => ({ type: "button", index })),
    ...Array.from(pad?.axes ?? [], (_, index) => index)
      .filter((index) => !used.has(index))
      .flatMap((index) => [1, -1].map((direction) => ({ type: "axis", index, direction }))),
  ];
}
function active(pad, binding, wasActive) {
  if (binding.type === "button") {
    const button = pad?.buttons?.[binding.index];
    return !!button?.pressed || (button?.value ?? 0) > 0.5;
  }
  // Hysteresis prevents noisy AUX switch values from toggling repeatedly.
  const value = (pad?.axes?.[binding.index] ?? 0) * binding.direction;
  return value > (wasActive ? 0.35 : 0.7);
}
export class ActionBindings {
  reset() { this.previous = null; this.capture = null; }
  constructor() { this.reset(); this.result = null; }
  listen(action, pad, profile, now = performance.now()) {
    if (!pad || !RADIO_ACTIONS.includes(action)) return false;
    const candidates = availableBindings(pad, profile);
    this.capture = {
      action, candidates, end: now + 12000,
      previous: new Map(candidates.map((binding) => [bindingKey(binding), active(pad, binding, false)])),
    };
    this.result = null;
    this.previous = null;
    return true;
  }
  sample(pad, profile, enabled, now = performance.now()) {
    const available = availableBindings(pad, profile);
    const valid = new Set(available.map(bindingKey));
    if (this.capture) {
      if (now >= this.capture.end) {
        this.reset(); this.result = "timeout";
        return { events: [] };
      }
      for (const binding of this.capture.candidates) {
        if (!valid.has(bindingKey(binding))) continue;
        const key = bindingKey(binding), before = this.capture.previous.get(key);
        const after = active(pad, binding, before);
        this.capture.previous.set(key, after);
        if (after && !before) {
          const assignment = { action: this.capture.action, binding };
          this.reset(); this.result = "saved";
          return { events: [], assignment };
        }
      }
      return { events: [] };
    }
    const next = new Map(), events = [];
    for (const action of RADIO_ACTIONS) {
      const binding = profile.actions?.[action];
      const key = bindingKey(binding);
      if (!valid.has(key)) continue;
      const before = this.previous?.get(key);
      const after = active(pad, binding, before);
      next.set(key, after);
      // Baseline after connection, reset or resume: a held switch never arms.
      if (!enabled || before === undefined || before === after) continue;
      if (action === "arm" && binding.type === "axis")
        events.push(after ? "armOn" : "armOff");
      else if (after) events.push(action);
    }
    this.previous = next;
    return { events };
  }
}
