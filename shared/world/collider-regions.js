export const COLLISION_RADIUS = 40;
export const COLLISION_RECHECK_DISTANCE = 8;

// Visuals stay loaded. Only static collision shapes far outside the aircraft's
// reachable neighbourhood leave the physics broad phase. Large shapes use
// their full world AABB, so a long beam/slab cannot disappear by its centre.
export class ColliderRegions {
  constructor() { this.entries = new Map(); this.last = null; this.activeCount = 0; }
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
  update(position) {
    if (this.last && position.reduce((sum, v, i) => sum + (v - this.last[i]) ** 2, 0) < COLLISION_RECHECK_DISTANCE ** 2) return false;
    this.last = [...position]; this.activeCount = 0;
    for (const entry of this.entries.values()) {
      let distance = 0;
      for (let i = 0; i < 3; i++) distance += Math.max(entry.min[i] - position[i], 0, position[i] - entry.max[i]) ** 2;
      const enabled = distance <= COLLISION_RADIUS ** 2;
      if (enabled !== entry.enabled) entry.collider.setEnabled(enabled);
      entry.enabled = enabled;
      if (enabled) this.activeCount++;
    }
    return true;
  }
  clear() { this.entries.clear(); this.last = null; this.activeCount = 0; }
}
