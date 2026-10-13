export const COLLISION_RADIUS = 18;
export const COLLISION_RECHECK_DISTANCE = 4;
export const COLLISION_LOOKAHEAD_SECONDS = 0.35;

// Visuals stay loaded. Only static collision shapes far outside the aircraft's
// reachable neighbourhood leave the physics broad phase. Large shapes use
// their full world AABB, so a long beam/slab cannot disappear by its centre.
export class ColliderRegions {
  constructor() { this.entries = new Map(); this.last = null; this.lastVelocity = null; this.activeCount = 0; }
  add(collider, min, max) {
    this.entries.set(collider.handle, { collider, min, max, enabled: true });
    this.activeCount++;
    this.last = null;
  }
  remove(collider) {
    const entry = this.entries.get(collider.handle);
    if (entry?.enabled) this.activeCount--;
    this.entries.delete(collider.handle);
  }
  update(position, velocity = [0, 0, 0]) {
    if (this.last && position.reduce((sum, v, i) => sum + (v - this.last[i]) ** 2, 0) < COLLISION_RECHECK_DISTANCE ** 2 &&
        velocity.reduce((sum, v, i) => sum + (v - this.lastVelocity[i]) ** 2, 0) < 8 ** 2) return false;
    this.last = [...position]; this.lastVelocity = [...velocity]; this.activeCount = 0;
    const end = position.map((v, i) => v + velocity[i] * COLLISION_LOOKAHEAD_SECONDS);
    const low = position.map((v, i) => Math.min(v, end[i])), high = position.map((v, i) => Math.max(v, end[i]));
    for (const entry of this.entries.values()) {
      let distance = 0;
      for (let i = 0; i < 3; i++) distance += Math.max(entry.min[i] - high[i], 0, low[i] - entry.max[i]) ** 2;
      const enabled = distance <= COLLISION_RADIUS ** 2;
      if (enabled !== entry.enabled) entry.collider.setEnabled(enabled);
      entry.enabled = enabled;
      if (enabled) this.activeCount++;
    }
    return true;
  }
  clear() { this.entries.clear(); this.last = null; this.lastVelocity = null; this.activeCount = 0; }
}
