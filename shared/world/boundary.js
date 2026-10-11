export function outsideMap(map, position) {
  return !!map.boundary && (Math.abs(position[0]) > map.size / 2 || Math.abs(position[2]) > map.size / 2);
}

export class MapBoundary {
  constructor(map) {
    this.map = map;
    this.reset();
  }
  reset() {
    this.outside = false;
    this.elapsed = 0;
  }
  get remainingSeconds() {
    return Math.max(0, (this.map.boundary?.returnAfterSeconds ?? 0) - this.elapsed);
  }
  update(position, dt) {
    if (!outsideMap(this.map, position)) {
      this.reset();
      return false;
    }
    this.outside = true;
    this.elapsed += Math.max(0, Number.isFinite(dt) ? dt : 0);
    return this.remainingSeconds === 0;
  }
}
