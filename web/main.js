import { initLanguage, t } from "./lang.js";
import { read, write } from "./storage.js";
import { Controller } from "./input/controller.js";
import { Network } from "./net/client.js";
import { Preview } from "./game/preview.js";
import { Flight } from "./game/flight.js";
import { defaultRates, validRate, actualRate } from "/shared/physics/rates.js";
import { hoverThrottle } from "/shared/physics/propulsion.js";
import { newLap, advanceLap } from "/shared/race/gates.js";
import { canRace, isTimedSession } from "/shared/race/map-modes.js";
const $ = (s) => document.querySelector(s),
  node = (tag, cls = "", text = "") => {
    const e = document.createElement(tag);
    e.className = cls;
    e.textContent = text;
    return e;
  };
const visible = (selector, on) => $(selector).classList.toggle("hidden", !on);
const time = (ms) => (ms == null ? "—" : (ms / 1000).toFixed(3) + " s");
const keyName = (key) =>
  ({
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Space: "␣",
    Escape: "Esc",
  })[key] ?? key.replace(/^Key|^Digit/, "");
let catalog,
  config,
  map,
  preview,
  flight,
  controller,
  network,
  input = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
let playing = false,
  paused = true,
  session = "free",
  lap = newLap(),
  simTime = 0,
  room = null,
  loadingRoom = null,
  loadedRoom = null,
  nextLaunch = false,
  rooms = [],
  inputSignature = "",
  noticeTimer,
  sendAt = 0,
  lastFrame = performance.now(),
  lastUi = 0;
const rateProfiles = read("rates", {}),
  cameraSettings = read("camera", { angle: 20, fov: 100, sound: true });
function rates(id) {
  const r = rateProfiles[id];
  return r && ["roll", "pitch", "yaw"].every((a) => validRate(r[a]))
    ? structuredClone(r)
    : defaultRates();
}
function notice(message) {
  $("#notice").textContent = message;
  visible("#notice", true);
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => visible("#notice", false), 4200);
}
function panel(name) {
  for (const el of document.querySelectorAll(".panel"))
    el.classList.toggle("hidden", el.id !== name + "-panel");
  for (const b of document.querySelectorAll("[data-tab]"))
    b.classList.toggle("active", b.dataset.tab === name);
  if (name === "records") showRecords();
}
function pause() {
  if (!playing) return;
  paused = true;
  flight.active = false;
  flight.physics.armed = false;
  flight.mute();
  lap.invalid = true;
  controller.clear();
  visible("#menu", true);
  visible("#hud", false);
  visible("#resume", true);
  panel("fly");
  notice(t(isTimedSession(session) && canRace(flight.map) ? "hud.interrupted" : "hud.paused"));
}
function resume() {
  if (!playing) return;
  paused = false;
  lastFrame = performance.now();
  flight.active = !room || room.phase === "flying";
  document.activeElement?.blur();
  visible("#menu", false);
  visible("#hud", true);
  flight.startSound();
}
function action(kind) {
  if (kind === "lostFocus" || kind === "radioChanged") {
    if (playing && !paused) pause();
    return;
  }
  if (kind === "menu") {
    if (playing) {
      if (paused) resume();
      else pause();
    }
    return;
  }
  if (!playing || paused) return;
  if (kind === "arm") {
    if (room && room.phase !== "flying") return;
    if (!flight.physics.armed && input.throttle > 0.06) {
      notice(t("hud.lowThrottle"));
      return;
    }
    flight.physics.armed = !flight.physics.armed;
    flight.startSound();
  }
  if (kind === "hover" && !controller.usingRadio)
    controller.keyboard.throttle = hoverThrottle(flight.config);
  if (kind === "view") flight.setView(!flight.chase);
  if (kind === "reset") {
    controller.clear();
    lap = newLap();
    if (room) network.send("reset");
    else flight.reset();
  }
  if (kind === "mode" && !room) {
    const modes = ["acro", "angle", "horizon"];
    $("#flight-mode").value =
      modes[(modes.indexOf(flight.physics.mode) + 1) % 3];
    flight.physics.mode = $("#flight-mode").value;
    lap = newLap();
  }
}
function recordKey(
  m = flight.map,
  c = flight.config,
  mode = flight.physics.mode,
) {
  return [m.id, m.routeId, m.routeVersion, c.id, c.configHash, mode].join(":");
}
function saveLocal(ms) {
  const records = read("records", {}),
    key = recordKey();
  records[key] = Math.min(ms, records[key] ?? Infinity);
  write("records", records);
}
async function selectDrone(id) {
  config =
    catalog.drones.find((d) => d.id === id) ??
    catalog.drones.find((d) => d.id === "rift-x5");
  write("selected-drone", config.id);
  refreshCatalogText();
  await preview.select(config);
}
function selectMap(id) {
  map = catalog.maps.find((m) => m.id === id) ?? catalog.maps[0];
  write("selected-map", map.id);
  updateSessionOptions();
  refreshCatalogText();
}
function updateSessionOptions() {
  const enabled = canRace(map);
  for (const option of $("#session").options)
    option.disabled = !enabled && isTimedSession(option.value);
  if (!enabled && isTimedSession($("#session").value))
    $("#session").value = $("#session").value.startsWith("online") ? "online-free" : "free";
  visible("#online-controls", $("#session").value.startsWith("online"));
  visible("#map-mode-note", !enabled);
}
function refreshCatalogText() {
  for (const d of catalog.drones) {
    const b = $(`[data-drone="${d.id}"]`);
    b.classList.toggle("selected", config?.id === d.id);
    b.setAttribute("aria-pressed", String(config?.id === d.id));
    b.querySelector("small").textContent = t("drone." + d.id);
  }
  for (const m of catalog.maps) {
    const b = $(`[data-map="${m.id}"]`);
    b.classList.toggle("selected", map?.id === m.id);
    b.setAttribute("aria-pressed", String(map?.id === m.id));
    b.querySelector("b").textContent = t("map." + m.id);
  }
  if (config) {
    $("#selected-name").textContent = config.name;
    $("#selected-description").textContent = t("drone." + config.id);
    $("#model-number").textContent = "R / " + config.name.replace("Rift ", "");
    const specs = $("#drone-specs");
    specs.replaceChildren();
    for (const [value, label] of [
      [Math.round(config.massKg * 1000) + " g", "mass"],
      [
        config.battery.cells + "S / " + config.battery.capacityMah + " mAh",
        "battery",
      ],
      [Math.round(config.motorDiagonalM * 1000) + " mm", "diagonal"],
    ]) {
      const e = node("div");
      e.append(
        node("strong", "", value),
        node("small", "", t("spec." + label)),
      );
      specs.append(e);
    }
  }
  for (const s of ["#records-map"])
    for (const o of $(s).options) o.textContent = t("map." + o.value);
}
function createCatalogUI() {
  for (const d of catalog.drones) {
    const b = node("button", "drone-card");
    b.dataset.drone = d.id;
    b.append(node("strong", "", d.name.replace("Rift ", "")), node("small"));
    b.addEventListener("click", () =>
      selectDrone(d.id).catch(() => notice(t("error.requestFailed"))),
    );
    $("#drone-picker").append(b);
    for (const select of ["#rates-drone", "#rates-target", "#records-drone"])
      $(select).append(new Option(d.name, d.id));
  }
  for (const m of catalog.maps) {
    const b = node("button", "map-card");
    b.dataset.map = m.id;
    b.append(node("div", "map-art " + m.kind));
    const label = node("div", "map-label");
    label.append(node("b", "", m.name), node("span", "", "↗"));
    b.append(label);
    b.addEventListener("click", () => selectMap(m.id));
    $("#map-picker").append(b);
    $("#records-map").append(new Option(m.name, m.id));
  }
}
function drawRates() {
  const c = $("#rate-graph"),
    ctx = c.getContext("2d"),
    r = readRatesForm();
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#dce0d6";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(10, 10 + i * 32);
    ctx.lineTo(410, 10 + i * 32);
    ctx.stroke();
  }
  if (!r) return;
  const max = Math.max(...Object.values(r).map((v) => v.max));
  for (const [i, axis] of ["roll", "pitch", "yaw"].entries()) {
    ctx.strokeStyle = ["#ff6648", "#54756a", "#879553"][i];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let j = 0; j <= 100; j++) {
      const y = 145 - (actualRate(j / 100, r[axis]) / max) * 130;
      j ? ctx.lineTo(10 + j * 4, y) : ctx.moveTo(10, y);
    }
    ctx.stroke();
  }
}
function readRatesForm() {
  const r = {};
  for (const axis of ["roll", "pitch", "yaw"]) {
    r[axis] = {};
    for (const field of ["center", "max", "expo"])
      r[axis][field] = Number($(`[data-rate="${axis}-${field}"]`).value);
    if (!validRate(r[axis])) return null;
  }
  return r;
}
function renderRates() {
  const id = $("#rates-drone").value,
    r = rates(id),
    body = $("#rates-table");
  body.replaceChildren();
  for (const axis of ["roll", "pitch", "yaw"]) {
    const row = node("tr");
    row.append(node("td", "", t("axis." + axis)));
    for (const field of ["center", "max", "expo"]) {
      const td = node("td"),
        i = node("input");
      i.type = "number";
      i.value = r[axis][field];
      i.min = field === "expo" ? 0 : 10;
      i.max = field === "expo" ? 1 : field === "center" ? 1000 : 1998;
      i.step = field === "expo" ? 0.01 : 1;
      i.dataset.rate = axis + "-" + field;
      i.setAttribute("aria-label", t("axis." + axis) + " " + field);
      i.addEventListener("input", drawRates);
      td.append(i);
      row.append(td);
    }
    body.append(row);
  }
  drawRates();
}
function saveRates(ids) {
  const r = readRatesForm();
  if (!r) {
    notice(t("settings.invalidRates"));
    return;
  }
  for (const id of ids) rateProfiles[id] = structuredClone(r);
  write("rates", rateProfiles);
  if (flight.physics) flight.physics.rates = rates(flight.config.id);
  $("#rate-status").textContent = t("settings.saved");
}
function renderInputUI() {
  const signature = [
    controller.pad?.id,
    controller.raw.length,
    document.documentElement.lang,
  ].join("|");
  if (signature === inputSignature) return;
  inputSignature = signature;
  $("#axis-settings").replaceChildren();
  $("#deadzone").value = controller.profile.deadzone;
  for (const [axis, a] of Object.entries(controller.profile.axes)) {
    const row = node("div", "axis-row");
    row.append(node("span", "", t("axis." + axis)));
    const select = node("select");
    select.setAttribute("aria-label", t("axis." + axis));
    for (let i = 0; i < Math.max(4, controller.raw.length); i++)
      select.append(new Option("CH " + (i + 1), i));
    select.value = a.index;
    select.onchange = () => {
      a.index = Number(select.value);
      controller.save();
    };
    const label = node("label");
    label.title = t("settings.invert");
    const invert = node("input");
    invert.type = "checkbox";
    invert.checked = a.invert;
    invert.setAttribute(
      "aria-label",
      t("settings.invert") + " " + t("axis." + axis),
    );
    invert.onchange = () => {
      a.invert = invert.checked;
      controller.save();
    };
    label.append(invert, node("span", "", "↔"));
    const meter = node("meter");
    meter.min = -1;
    meter.max = 1;
    meter.dataset.meter = axis;
    row.append(select, label, meter);
    $("#axis-settings").append(row);
  }
}
function renderKeys() {
  const container = $("#keyboard-bindings");
  container.replaceChildren();
  for (const [action, code] of Object.entries(controller.keys)) {
    const row = node("div", "key-row"),
      i = node("input");
    i.readOnly = true;
    i.value = keyName(code);
    i.setAttribute("aria-label", t("key." + action));
    i.onkeydown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (["Tab", "ShiftLeft", "ShiftRight"].includes(e.code)) return;
      const old = controller.keys[action];
      for (const key in controller.keys)
        if (controller.keys[key] === e.code) controller.keys[key] = old;
      controller.keys[action] = e.code;
      controller.save();
      renderKeys();
    };
    row.append(node("span", "", t("key." + action)), i);
    container.append(row);
  }
}
function updateInputText() {
  const text = controller.usingRadio
    ? t("input.radio", { name: controller.pad.id })
    : t(controller.pad ? "input.keyboard" : "input.noRadio");
  $("#input-status").textContent = text;
  $("#radio-name").textContent = controller.pad?.id ?? t("input.noRadio");
  for (const m of document.querySelectorAll("[data-meter]"))
    m.value = input[m.dataset.meter];
}
function renderRooms() {
  const root = $("#rooms-list");
  root.replaceChildren();
  if (!rooms.length) root.append(node("p", "muted", t("online.empty")));
  for (const r of rooms) {
    const row = node("div", "room-row"),
      button = node("button", "secondary", t("online.join"));
    button.onclick = () => network.send("join", { code: r.code });
    row.append(
      node("strong", "", r.code),
      node(
        "span",
        "",
        t("map." + r.mapId) +
          " · " +
          r.players +
          "/8 · " +
          r.mode.toUpperCase(),
      ),
      button,
    );
    root.append(row);
  }
}
function renderLobby() {
  if (!room) return;
  $("#lobby-code").textContent = room.code;
  $("#lobby-description").textContent =
    t("map." + room.mapId) +
    " · " +
    catalog.drones.find((d) => d.id === room.droneId)?.name +
    " · " +
    room.mode.toUpperCase();
  $("#lobby-players").replaceChildren();
  for (const p of room.players) {
    const row = node("div", "player-row");
    row.append(
      node(
        "strong",
        "",
        p.name + (p.id === room.host ? " / " + t("online.host") : ""),
      ),
      node("span", "", p.ready ? t("online.ready") : t("online.notReady")),
    );
    $("#lobby-players").append(row);
  }
  const own = room.players.find((p) => p.id === network.id);
  $("#ready").textContent = t(own?.ready ? "online.notReady" : "online.ready");
  $("#ready").disabled = room.phase !== "lobby";
  $("#start-room").disabled =
    room.phase !== "lobby" || room.host !== network.id;
}
async function loadRoom(r) {
  const key = r.code + ":" + r.startsAt;
  if (loadingRoom === key) return;
  loadingRoom = key;
  visible("#boot", true);
  const roomConfig = catalog.drones.find((d) => d.id === r.droneId);
  const roomMap = catalog.maps.find((m) => m.id === r.mapId);
  session = "online-" + r.kind;
  $("#flight-mode").value = r.mode;
  try {
    await flight.load(roomMap, roomConfig, rates(roomConfig.id), r.mode);
    if (!room || room.code !== r.code) {
      flight.active = false;
      return;
    }
    flight.reset(
      room.players.find((p) => p.id === network.id)?.p ?? roomMap.spawn,
    );
    lap = newLap();
    playing = true;
    paused = false;
    loadedRoom = key;
    flight.active = room.phase === "flying";
    controller.clear();
    document.activeElement?.blur();
    visible("#menu", false);
    visible("#hud", true);
    visible("#resume", true);
    flight.startSound();
  } catch {
    loadingRoom = null;
    notice(t("error.requestFailed"));
  } finally {
    visible("#boot", false);
  }
}
function receive(m) {
  if (m.type === "welcome") {
    updateStatus();
    network.send("list");
  }
  if (m.type === "error") notice(t("error." + m.code));
  if (m.type === "rooms") {
    rooms = m.rooms;
    renderRooms();
  }
  if (m.type === "left") {
    room = null;
    loadingRoom = null;
    loadedRoom = null;
    playing = false;
    paused = true;
    flight.active = false;
    flight.mute();
    visible("#menu", true);
    visible("#hud", false);
    visible("#resume", false);
    visible("#leave-flight", false);
    panel("fly");
    if (nextLaunch) {
      nextLaunch = false;
      void launch();
    }
  }
  if (m.type === "reset") {
    flight.reset(m.pose.p);
    controller.clear();
    if (m.reason === "boundary") notice(t("hud.boundaryReset"));
  }
  if (m.type === "lap")
    notice(
      m.valid
        ? t(m.saved ? "hud.saved" : "hud.localLap", { time: time(m.ms) })
        : t("hud.invalid"),
    );
  if (m.type === "disconnected") {
    if (room) {
      pause();
      notice(t("online.disconnected"));
      room = null;
      playing = false;
      visible("#resume", false);
      visible("#leave-flight", false);
    }
    nextLaunch = false;
    updateStatus();
  }
  if (m.type === "room") {
    const previousPhase = room?.phase;
    room = m.room;
    visible("#leave-flight", true);
    renderLobby();
    if (room.phase === "lobby") {
      visible("#menu", true);
      visible("#hud", false);
      panel("lobby");
      if (room.kind === "hotlap" && loadingRoom !== room.code) {
        loadingRoom = room.code;
        network.send("start");
      }
    } else if (room.phase === "countdown" || room.phase === "flying") {
      loadRoom(room);
      if (flight.physics && loadedRoom === room.code + ":" + room.startsAt) {
        flight.updateRemotes(room.players, network.id);
        const finished = room.players.find(
          (p) => p.id === network.id,
        )?.finished;
        flight.active = room.phase === "flying" && !paused && !finished;
        if (finished) {
          flight.physics.armed = false;
          flight.mute();
        }
      }
    } else if (room.phase === "finished") {
      if (flight.physics) flight.physics.armed = false;
      flight.active = false;
      flight.mute();
      if (previousPhase !== "finished") notice(t("online.finished"));
    }
  }
}
function updateStatus() {
  $("#server-status").textContent = t(
    network?.ready ? "status.online" : "status.offline",
  );
  $("#server-status").classList.toggle("offline", !network?.ready);
}
async function launch() {
  visible("#notice", false);
  if (room) {
    nextLaunch = true;
    network.send("leave");
    return;
  }
  session = $("#session").value;
  if (isTimedSession(session) && !canRace(map)) {
    notice(t("error.raceUnavailable"));
    return;
  }
  if (session.startsWith("online")) {
    if (!network.ready) {
      notice(t("error.connectFirst"));
      return;
    }
    network.send("create", {
      mapId: map.id,
      droneId: config.id,
      mode: $("#flight-mode").value,
      kind: session.replace("online-", ""),
      public: $("#public-room").checked,
    });
    return;
  }
  $("#launch").disabled = true;
  visible("#boot", true);
  try {
    await flight.load(map, config, rates(config.id), $("#flight-mode").value);
    lap = newLap();
    simTime = 0;
    playing = true;
    controller.clear();
    resume();
  } catch (e) {
    console.error(e);
    notice(t("error.requestFailed"));
  } finally {
    $("#launch").disabled = false;
    visible("#boot", false);
  }
}
async function showRecords() {
  if (!catalog) return;
  const m = catalog.maps.find((v) => v.id === $("#records-map").value),
    c = catalog.drones.find((v) => v.id === $("#records-drone").value),
    mode = $("#records-mode").value,
    root = $("#records-body");
  root.replaceChildren();
  if (!canRace(m)) {
    root.append(node("p", "muted", t("error.raceUnavailable")));
    return;
  }
  root.append(
    node("h2", "", t("records.local")),
    node("p", "muted", time(read("records", {})[recordKey(m, c, mode)])),
  );
  root.append(node("h2", "", t("records.online")));
  try {
    const res = await fetch(
      "/api/leaderboard?" +
        new URLSearchParams({ map: m.id, drone: c.id, mode }),
    );
    if (!res.ok) throw Error("Leaderboard unavailable");
    const data = await res.json();
    if (!data.available)
      root.append(node("p", "muted", t("records.unavailable")));
    else if (!data.entries.length)
      root.append(node("p", "muted", t("records.empty")));
    else
      data.entries.forEach((r, i) => {
        const row = node("div", "record-row");
        row.append(
          node("span", "", i + 1),
          node("span", "record-name", r.name),
          node("b", "", time(r.ms)),
        );
        root.append(row);
      });
  } catch {
    root.append(node("p", "muted", t("records.unavailable")));
  }
}
function hud() {
  if (!playing || !flight.physics) return;
  const p = flight.physics.pose,
    own = room?.players.find((p) => p.id === network.id),
    currentLap = own?.lap ?? lap;
  $("#arm-state").textContent = t(
    flight.physics.armed ? "hud.armed" : "hud.disarmed",
  );
  $("#arm-state").classList.toggle("armed", flight.physics.armed);
  $("#hud-mode").textContent = flight.physics.mode.toUpperCase();
  $("#hud-input").textContent = t(
    controller.usingRadio ? "settings.controller" : "input.keyboard",
  );
  $("#speed").textContent = Math.round(Math.hypot(...p.v) * 3.6);
  $("#altitude").textContent = Math.max(0,
    p.p[1] - flight.environment.heightAt(p.p[0], p.p[2]),
  ).toFixed(1);
  $("#throttle").textContent = Math.round(input.throttle * 100);
  $("#hud-session").textContent =
    t("map." + flight.map.id) + " / " + flight.config.name;
  const boundary = room ? own?.boundary : flight.boundary;
  const outside = !!boundary?.outside;
  visible("#boundary-hud", outside);
  if (outside) {
    const seconds = Math.ceil(boundary.remainingSeconds);
    $("#boundary-hud").textContent = t("hud.boundary", {
      time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
    });
  }
  $("#key-hint").textContent = t("hud.keys", {
    arm: keyName(controller.keys.arm),
    up: keyName(controller.keys.throttleUp),
    down: keyName(controller.keys.throttleDown),
    tilt: [
      controller.keys.pitchForward,
      controller.keys.pitchBack,
      controller.keys.rollLeft,
      controller.keys.rollRight,
    ]
      .map(keyName)
      .join(""),
    left: keyName(controller.keys.yawLeft),
    right: keyName(controller.keys.yawRight),
    hover: keyName(controller.keys.hover),
    reset: keyName(controller.keys.reset),
    view: keyName(controller.keys.view),
    menu: keyName(controller.keys.menu),
  });
  const race = $("#race-hud");
  race.replaceChildren();
  const timed = canRace(flight.map) && isTimedSession(session);
  if (timed) {
    race.append(
      node(
        "div",
        "",
        t("hud.lap") +
          " " +
          (currentLap.completed + 1) +
          " · " +
          t("hud.gate") +
          " " +
          (currentLap.next + 1),
      ),
      node(
        "b",
        "",
        currentLap.startedAt == null
          ? "0.000 s"
          : time((room ? network.now : simTime) - currentLap.startedAt),
      ),
      node("div", "", t("hud.best") + " " + time(currentLap.bestMs)),
      node(
        "div",
        "",
        currentLap.invalid
          ? t("hud.invalid")
          : currentLap.startedAt == null
            ? t("hud.start")
            : "",
      ),
    );
  }
  flight.environment.highlight(currentLap.next, timed);
  $("#countdown").textContent =
    room?.phase === "countdown"
      ? Math.max(1, Math.ceil((room.startsAt - network.now) / 1000))
      : "";
  const board = $("#scoreboard");
  board.replaceChildren();
  if (room) {
    const players = [...room.players].sort(
      (a, b) =>
        Number(b.finished) - Number(a.finished) ||
        (a.finished && b.finished ? a.finishMs - b.finishMs : 0) ||
        b.lap.completed - a.lap.completed ||
        (a.lap.bestMs ?? Infinity) - (b.lap.bestMs ?? Infinity),
    );
    for (const p of players) {
      const r = node("div", "score-row");
      r.append(
        node("span", "", p.name),
        node(
          "span",
          "",
          p.lap.completed +
            " / " +
            time(p.finished ? p.finishMs : p.lap.bestMs),
        ),
      );
      board.append(r);
    }
  }
}
function frame(now) {
  const elapsed = Math.max(0, (now - lastFrame) / 1000);
  const dt = Math.min(elapsed, 0.25);
  lastFrame = now;
  input = controller.poll(dt);
  if (
    playing &&
    !paused &&
    flight.active &&
    (!room ||
      (room.phase === "flying" &&
        !room.players.find((p) => p.id === network.id)?.finished))
  ) {
    flight.step(dt, input, (previous, current, step) => {
      const previousTime = simTime;
      simTime += step * 1000;
      if (!room && session === "time" && canRace(flight.map)) {
        for (const e of advanceLap(
          lap,
          previous.p,
          current.p,
          previousTime,
          simTime,
          flight.map.gates,
        ))
          if (e.kind === "lap" && e.valid) {
            saveLocal(e.ms);
            notice(t("hud.localLap", { time: time(e.ms) }));
          }
      }
    });
    if (!room && flight.boundary.update(flight.physics.pose.p, elapsed)) {
      action("reset");
      notice(t("hud.boundaryReset"));
    }
  }
  if (playing && room?.phase === "flying" && now - sendAt >= 50) {
    network.state(
      flight.physics.pose,
      flight.config,
      flight.physics.mode,
      paused,
    );
    sendAt = now;
  }
  if (now - lastUi > 100) {
    lastUi = now;
    renderInputUI();
    updateInputText();
    hud();
  }
  preview.render();
  if (playing) flight.render(dt);
  requestAnimationFrame(frame);
}
function bindUI() {
  for (const b of document.querySelectorAll("[data-tab]"))
    b.onclick = () => panel(b.dataset.tab);
  $("#language").onchange = async (e) => {
    const { setLanguage } = await import("./lang.js");
    await setLanguage(e.target.value);
  };
  $("#launch").onclick = launch;
  $("#resume").onclick = resume;
  $("#menu-button").onclick = pause;
  $("#session").onchange = () =>
    visible("#online-controls", $("#session").value.startsWith("online"));
  $("#nickname").value = read("nickname", "Pilot");
  $("#nickname").onchange = () => {
    write("nickname", $("#nickname").value);
    network.name = $("#nickname").value;
    network.send("rename", { name: network.name });
  };
  $("#refresh-rooms").onclick = () => network.send("list");
  $("#join-room").onclick = () =>
    network.send("join", { code: $("#room-code").value.trim().toUpperCase() });
  $("#ready").onclick = () =>
    network.send("ready", {
      ready: !room.players.find((p) => p.id === network.id)?.ready,
    });
  $("#start-room").onclick = () => network.send("start");
  $("#leave-room").onclick = () => network.send("leave");
  $("#leave-flight").onclick = () => network.send("leave");
  $("#rates-drone").value = config.id;
  $("#rates-drone").onchange = renderRates;
  $("#rates-save").onclick = () => saveRates([$("#rates-drone").value]);
  $("#rates-all").onclick = () => saveRates(catalog.drones.map((d) => d.id));
  $("#rates-copy").onclick = () => saveRates([$("#rates-target").value]);
  $("#rates-reset").onclick = () => {
    rateProfiles[$("#rates-drone").value] = defaultRates();
    write("rates", rateProfiles);
    if (flight.physics) flight.physics.rates = rates(flight.config.id);
    renderRates();
  };
  $("#input-source").value = controller.source;
  $("#input-source").onchange = (e) => {
    controller.source = e.target.value;
    controller.clear();
    controller.save();
  };
  $("#deadzone").onchange = (e) => {
    controller.profile.deadzone = Math.max(
      0,
      Math.min(0.2, Number(e.target.value) || 0),
    );
    controller.save();
  };
  $("#calibrate-center").onclick = () => {
    $("#calibration-status").textContent = t(
      controller.calibrateCenter() ? "settings.saved" : "input.noRadio",
    );
  };
  $("#calibrate-range").onclick = () => {
    $("#calibration-status").textContent = t(
      controller.calibrateRange() ? "settings.calibrating" : "input.noRadio",
    );
  };
  window.addEventListener(
    "calibrationdone",
    () => ($("#calibration-status").textContent = t("settings.saved")),
  );
  function camera() {
    cameraSettings.angle = Number($("#camera-angle").value);
    cameraSettings.fov = Number($("#camera-fov").value);
    cameraSettings.sound = $("#sound").checked;
    $("#angle-output").textContent = cameraSettings.angle + "°";
    $("#fov-output").textContent = cameraSettings.fov + "°";
    flight.setCameraSettings(cameraSettings.angle, cameraSettings.fov);
    flight.soundEnabled = cameraSettings.sound;
    write("camera", cameraSettings);
  }
  $("#camera-angle").value = cameraSettings.angle;
  $("#camera-fov").value = cameraSettings.fov;
  $("#sound").checked = cameraSettings.sound;
  for (const s of ["#camera-angle", "#camera-fov", "#sound"])
    $(s).oninput = camera;
  camera();
  for (const s of ["#records-map", "#records-drone", "#records-mode"])
    $(s).onchange = showRecords;
  $("#records-refresh").onclick = showRecords;
  window.addEventListener("languagechange", () => {
    refreshCatalogText();
    renderRates();
    renderKeys();
    renderRooms();
    renderLobby();
    updateStatus();
    inputSignature = "";
    renderInputUI();
    updateInputText();
    $("#rate-status").textContent = "";
    $("#calibration-status").textContent = "";
    if (!$("#records-panel").classList.contains("hidden")) showRecords();
  });
  renderRates();
  renderKeys();
}
try {
  await initLanguage();
  const response = await fetch("/api/catalog");
  if (!response.ok) throw Error("Catalog unavailable");
  catalog = await response.json();
  preview = new Preview($("#preview-scene"));
  flight = new Flight($("#game-scene"));
  controller = new Controller(action);
  network = new Network(receive);
  await flight.init();
  createCatalogUI();
  selectMap(read("selected-map", "liget"));
  await selectDrone(read("selected-drone", "rift-x5"));
  bindUI();
  network.connect($("#nickname").value);
  visible("#boot", false);
  requestAnimationFrame(frame);
} catch (e) {
  console.error(e);
  $("#boot span").textContent = t("error.boot");
}
