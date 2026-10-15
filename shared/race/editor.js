import { validateRoute } from "./routes.js";
import { validateMap } from "../physics/config.js";
export const normalFromAngles = (degrees,tilt=0) => {
  const yaw=degrees*Math.PI/180,pitch=tilt*Math.PI/180;
  return [Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
};
export const normalFromYaw = degrees => normalFromAngles(degrees);
export const yawFromNormal = normal => Math.atan2(normal[0], normal[2]) * 180 / Math.PI;
export const tiltFromNormal = normal => Math.asin(Math.max(-1,Math.min(1,normal[1])))*180/Math.PI;

export class RouteDraft {
  constructor(map, route) {
    this.map = map;
    this.route = structuredClone(route);
    this.baseVersion = route.version;
    this.undoStack = []; this.redoStack = [];
  }
  checkpoint() {
    this.undoStack.push(structuredClone(this.route));
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }
  change(fn, history = true) {
    const next = structuredClone(this.route);
    fn(next);
    if(JSON.stringify(next.gates)!==JSON.stringify(this.route.gates))delete next.guide;
    if (next.gates.length > 128) throw Error("A race can contain at most 128 gates.");
    validateMap({ ...this.map, spawn: next.spawn, routeId: next.id, routeVersion: next.version, gates: next.gates, racingEnabled: false });
    for (const gate of next.gates) {
      if (Math.abs(gate.p[0]) > this.map.size / 2 || Math.abs(gate.p[2]) > this.map.size / 2 || gate.p[1] < -20 || gate.p[1] > 200 || gate.width > 30 || gate.height > 30)
        throw Error("Place gates inside the fence; dimensions must be 0.2–30 m.");
    }
    if (history) this.checkpoint();
    next.version = Math.max(this.baseVersion + 1, next.version);
    this.route = next;
  }
  add(gate) { this.change(r => r.gates.push(structuredClone(gate))); return this.route.gates.length - 1; }
  setGate(index, changes, history = true) {
    if (!this.route.gates[index]) throw Error("Select a gate first.");
    this.change(r => Object.assign(r.gates[index], changes), history);
  }
  remove(index) { this.change(r => r.gates.splice(index, 1)); }
  move(index, offset) {
    const target = index + offset;
    if (index < 0 || target < 0 || target >= this.route.gates.length) return index;
    this.change(r => { const [gate] = r.gates.splice(index, 1); r.gates.splice(target, 0, gate); });
    return target;
  }
  undo() {
    if (!this.undoStack.length) return false;
    this.redoStack.push(this.route); this.route = this.undoStack.pop(); return true;
  }
  redo() {
    if (!this.redoStack.length) return false;
    this.undoStack.push(this.route); this.route = this.redoStack.pop(); return true;
  }
  export() { return validateRoute(this.route, this.map); }
}
