import { clamp } from '../../shared/physics/math.js';

// Mode 2. Start each drag from the current input, so touching a pad never
// jumps the throttle. Normal release holds throttle; interrupted input clears it.
export class TouchSticks {
  constructor(root, hud, win = window) {
    this.hud = hud;
    this.enabled = false;
    this.values = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
    this.drags = new Map();
    this.pads = [...root.querySelectorAll('.stick-display svg')];
    this.pads.forEach((pad, side) => {
      pad.addEventListener('pointerdown', event => {
        if (!this.enabled || event.pointerType === 'mouse' || this.drags.has(side)) return;
        event.preventDefault();
        const bounds = pad.getBoundingClientRect();
        this.drags.set(side, {
          id: event.pointerId, x: event.clientX, y: event.clientY,
          travel: Math.max(1, Math.min(bounds.width, bounds.height) * .38),
          start: { ...this.values },
        });
        pad.setPointerCapture(event.pointerId);
        pad.classList.add('is-dragging');
      });
      pad.addEventListener('pointermove', event => {
        const drag = this.drags.get(side);
        if (!this.enabled || drag?.id !== event.pointerId) return;
        event.preventDefault();
        const dx = (event.clientX - drag.x) / drag.travel;
        const dy = (drag.y - event.clientY) / drag.travel;
        if (side === 0) {
          this.values.yaw = clamp(drag.start.yaw + dx, -1, 1);
          this.values.throttle = clamp(drag.start.throttle + dy / 2, 0, 1);
        } else {
          this.values.roll = clamp(drag.start.roll + dx, -1, 1);
          this.values.pitch = clamp(drag.start.pitch + dy, -1, 1);
        }
      });
      pad.addEventListener('pointerup', event => {
        if (this.drags.get(side)?.id !== event.pointerId) return;
        event.preventDefault();
        this.drags.delete(side);
        pad.classList.remove('is-dragging');
        if (side === 0) this.values.yaw = 0;
        else this.values.roll = this.values.pitch = 0;
        if (pad.hasPointerCapture(event.pointerId)) pad.releasePointerCapture(event.pointerId);
      });
      for (const name of ['pointercancel', 'lostpointercapture']) pad.addEventListener(name, event => {
        if (this.drags.get(side)?.id === event.pointerId) this.reset();
      });
      pad.addEventListener('contextmenu', event => { if (this.enabled) event.preventDefault(); });
    });
    win.addEventListener('resize', () => this.reset());
  }
  setEnabled(enabled) {
    if (enabled === this.enabled) return;
    this.reset();
    this.enabled = enabled;
    this.hud.classList.toggle('touch-controls', enabled);
  }
  reset() {
    const drags = [...this.drags];
    this.drags.clear();
    for (const [side, drag] of drags) {
      const pad = this.pads[side];
      pad.classList.remove('is-dragging');
      if (pad.hasPointerCapture(drag.id)) pad.releasePointerCapture(drag.id);
    }
    this.values = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
  }
  sample() { return { ...this.values }; }
}
