import { read, write } from "../storage.js";
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
  }
  connect(name) {
    clearTimeout(this.retry);
    this.name = name;
    this.ws = new WebSocket(
      (location.protocol === "https:" ? "wss://" : "ws://") +
        location.host +
        "/ws",
    );
    this.ws.onopen = () =>
      this.send("hello", { name: this.name, token: read("profile", null) });
    this.ws.onmessage = (e) => {
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.type === "welcome") {
        this.id = m.id;
        write("profile", m.token);
        this.offset = m.now - Date.now();
        this.ready = true;
        this.send("ping", { at: Date.now() });
        clearInterval(this.pingTimer);
        this.pingTimer = setInterval(
          () => this.send("ping", { at: Date.now() }),
          5000,
        );
      }
      if (m.type === "pong") this.offset = m.now - (Date.now() + m.echo) / 2;
      if (m.type === "room") this.room = m.room;
      if (m.type === "left") this.room = null;
      this.receive(m);
    };
    this.ws.onclose = () => {
      this.ready = false;
      this.room = null;
      clearInterval(this.pingTimer);
      this.receive({ type: "disconnected" });
      this.retry = setTimeout(() => this.connect(this.name), 3000);
    };
    this.ws.onerror = () => {};
  }
  send(type, data = {}) {
    if (this.ws?.readyState === WebSocket.OPEN)
      this.ws.send(JSON.stringify({ type, ...data }));
  }
  get now() {
    return Date.now() + this.offset;
  }
  state(pose, config, mode, interrupted) {
    this.send("state", {
      ...pose,
      seq: this.seq++,
      t: this.now,
      configHash: config.configHash,
      mode,
      interrupted,
    });
  }
}
