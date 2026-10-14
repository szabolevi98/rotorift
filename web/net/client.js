import { read, write } from "../storage.js";
import { normalizeDroneColor } from "../../shared/visual/drone-colors.js";
import { simulationKey } from "../../shared/simulation/options.js";
const readResume = () => {
  try { return JSON.parse(globalThis.sessionStorage?.getItem("rotorift.room-resume") ?? "null"); }
  catch { return null; }
};
export class Network {
  constructor(receive) {
    this.receive = receive;
    this.ws = null;
    this.id = null;
    this.offset = 0;
    this.seq = 0;
    this.ready = false;
    this.room = null;
    this.pingTimer = null;
    this.retry = null;
    this.color = normalizeDroneColor(read("drone-color", "coral"));
    const saved = readResume();
    this.resumption = saved && /^[a-f0-9]{48}$/.test(saved.token) && /^[A-F0-9]{6}$/.test(saved.code) && ["free", "race", "hotlap"].includes(saved.kind) ? saved : null;
    this.cancelRestore = !!this.resumption?.cancelled;
    this.silentCancel = !!this.resumption?.silent;
    this.resumeToken = this.resumption?.token ?? null;
  }
  persistResume() {
    try {
      if (this.resumption) globalThis.sessionStorage?.setItem("rotorift.room-resume", JSON.stringify(this.resumption));
      else globalThis.sessionStorage?.removeItem("rotorift.room-resume");
    } catch {}
  }
  cancelRecovery() {
    if (!this.resumption) return;
    this.cancelRestore = true;
    this.silentCancel = true;
    this.resumption.cancelled = true;
    this.resumption.silent = true;
    this.persistResume();
    if (this.ready) this.send("leave");
  }
  connect(name) {
    clearTimeout(this.retry);
    this.name = name;
    const ws = this.ws = new WebSocket(
      (location.protocol === "https:" ? "wss://" : "ws://") +
        location.host +
        "/ws",
    );
    ws.onopen = () => {
      if (this.ws === ws) this.send("hello", { name: this.name, token: read("profile", null), color: this.color, protocol: 2, resume: this.resumption?.token });
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.type === "welcome") {
        const cancelled = this.cancelRestore;
        this.id = m.id;
        this.seq = 0;
        this.resumeToken = m.resume ?? null;
        write("profile", m.token);
        this.offset = m.now - Date.now();
        this.ready = true;
        if (m.resumeRejected) { this.resumption = null; this.cancelRestore = this.silentCancel = false; this.persistResume(); }
        if (this.cancelRestore && m.resumed) this.send("leave");
        if (cancelled) m = { ...m, resumed: false, resumeRejected: false };
        // The selection may have changed while the profile handshake awaited
        // the database. Send the current preference after authentication too.
        this.send("appearance", { color: this.color });
        this.send("ping", { at: Date.now() });
        clearInterval(this.pingTimer);
        this.pingTimer = setInterval(
          () => this.send("ping", { at: Date.now() }),
          5000,
        );
      }
      if (m.type === "pong") this.offset = m.now - (Date.now() + m.echo) / 2;
      if (m.type === "room") {
        if (this.cancelRestore) return;
        this.room = m.room;
        if (this.resumeToken) { this.resumption = { token: this.resumeToken, code: m.room.code, kind: m.room.kind }; this.persistResume(); }
      }
      if (m.type === "left") {
        const silent = this.cancelRestore && this.silentCancel;
        this.room = null; this.resumption = null; this.persistResume();
        this.cancelRestore = this.silentCancel = false;
        if (silent) { this.receive({ type: "resumeCancelled" }); return; }
      }
      this.receive(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ready = false;
      this.room = null;
      clearInterval(this.pingTimer);
      this.receive({ type: "disconnected", restoring: !!this.resumption && !this.cancelRestore });
      this.retry = setTimeout(() => this.connect(this.name), 3000);
    };
    ws.onerror = () => {};
  }
  setColor(value) {
    this.color = normalizeDroneColor(value);
    if (this.ready) this.send("appearance", { color: this.color });
  }
  send(type, data = {}) {
    if (type === "leave" && this.resumption) {
      this.cancelRestore = true; this.resumption.cancelled = true; this.persistResume();
    }
    if (this.ws?.readyState === WebSocket.OPEN)
      this.ws.send(JSON.stringify({ type, ...data }));
  }
  get now() {
    return Date.now() + this.offset;
  }
  state(pose, config, mode, interrupted, simulation, propellers, rotorSpeeds, turtleMode=false) {
    this.send("state", {
      ...pose,
      seq: this.seq++,
      t: this.now,
      configHash: config.configHash,
      mode,
      interrupted,
      simulationKey: simulationKey(simulation),
      runId: this.room?.runId,
      propellers,
      rotorSpeeds,
      turtleMode,
    });
  }
}
