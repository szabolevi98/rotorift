import { initLanguage, t } from "./lang.js";
import { read, write } from "./storage.js";
import { Controller } from "./input/controller.js";
import { Network } from "./net/client.js";
import { Preview } from "./game/preview.js";
import { Flight } from "./game/flight.js";
import { LoadingScreen, paintLoading } from "./loading.js";
import { bindFullscreen } from "./fullscreen.js";
import { RadioGuide } from "./input/radio-guide.js";
import { defaultRates, validRate, actualRate } from "/shared/physics/rates.js";
import { hoverThrottle } from "/shared/physics/propulsion.js";
import { newLap, advanceLap } from "/shared/race/gates.js";
import { resolveRoute } from "/shared/race/routes.js";
import { canRace, isTimedSession } from "/shared/race/map-modes.js";
import { DRONE_COLORS, normalizeDroneColor } from "/shared/visual/drone-colors.js";
import { DEFAULT_SIMULATION, FLIGHT_MODES, WIND_LEVELS, normalizeSimulation, simulationKey } from "/shared/simulation/options.js";
const $ = (s) => document.querySelector(s),
  node = (tag, cls = "", text = "") => {
    const e = document.createElement(tag);
    e.className = cls;
    e.textContent = text;
    return e;
  };
const visible = (selector, on) => $(selector).classList.toggle("hidden", !on);
const loading = new LoadingScreen(t);
let fullscreen, radioGuide;
const stickMarkers = [
  [$("#stick-left-dot"), $("#stick-left-stem")],
  [$("#stick-right-dot"), $("#stick-right-stem")],
];
function updateSticks(input) {
  // Mode 2: throttle starts at the bottom; pitch/roll/yaw are centred.
  // Draw the calibrated input that is passed to the physics, every frame.
  const clampAxis = (v) => Math.max(-1, Math.min(1, v));
  const positions = [
    [50 + clampAxis(input.yaw) * 38, 88 - Math.max(0, Math.min(1, input.throttle)) * 76],
    [50 + clampAxis(input.roll) * 38, 50 - clampAxis(input.pitch) * 38],
  ];
  positions.forEach(([x, y], i) => {
    const [dot, stem] = stickMarkers[i];
    dot.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    stem.setAttribute("d", `M50 50L${x.toFixed(2)} ${y.toFixed(2)}`);
  });
}
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
let droneColor = normalizeDroneColor(read("drone-color", "coral"));
let simulation = normalizeSimulation(read("simulation", DEFAULT_SIMULATION));
function createSimulationControls() {
  for (const id of ["flight-simulation", "lobby-simulation"]) {
    const root = $("#" + id);
    for (const key of ["battery", "propDamage", "propwash", "ghost", "wind"]) {
      const label = node("label", "simulation-row"), caption = node("span");
      caption.dataset.simLabel = key;
      const input = node(key === "wind" ? "select" : "input");
      input.dataset.simOption = key;
      input.id = `${id}-${key}`;
      if (key === "wind") for (const value of WIND_LEVELS) { const option = node("option"); option.value = value; input.append(option); }
      else input.type = "checkbox";
      input.onchange = () => {
        const next = { ...(room?.simulation ?? simulation), [key]: key === "wind" ? input.value : input.checked };
        if (room) network.send("rules", { simulation: next });
        else {
          simulation = normalizeSimulation(next); write("simulation", simulation);
          if (playing) { flight.setSimulation(simulation); lap.invalid = true; lap.bestMs = lap.lastMs = null; }
        }
        refreshSimulationControls();
      };
      label.append(caption, input); root.append(label);
    }
    root.append(node("p", "prototype-note simulation-note"));
  }
  refreshSimulationControls();
}
function refreshSimulationControls() {
  const options = normalizeSimulation(room?.simulation ?? simulation), online = !!room || $("#session").value.startsWith("online");
  for (const input of document.querySelectorAll("[data-sim-option]")) {
    const key = input.dataset.simOption;
    input.disabled = !!room && (room.host !== network.id || room.phase !== "lobby");
    input.parentElement.classList.toggle("hidden", key === "ghost" && !online);
    input.parentElement.querySelector("[data-sim-label]").textContent = t("simulation." + key);
    if (key === "wind") {
      input.value = options.wind;
      for (const option of input.options) option.textContent = t("wind." + option.value);
    } else input.checked = options[key];
  }
  for (const note of document.querySelectorAll(".simulation-note"))
    note.textContent = t(room ? (room.phase === "lobby" ? "simulation.hostHint" : "simulation.lockedHint") : "simulation.hint");
}
function refreshColors() {
  for (const button of document.querySelectorAll("[data-drone-color]")) {
    button.setAttribute("aria-pressed", String(button.dataset.droneColor === droneColor));
    button.setAttribute("aria-label", t("color." + button.dataset.droneColor));
  }
}
function setDroneColor(value) {
  droneColor = normalizeDroneColor(value); write("drone-color", droneColor);
  preview.setColor(droneColor); flight.setColor(droneColor); network.setColor(droneColor); refreshColors();
}
function pilotName(player, text = player.name) {
  const label = node("span", "pilot-name"), dot = node("i", "pilot-color");
  const color = normalizeDroneColor(player.color);
  dot.style.setProperty("--pilot-color", DRONE_COLORS[color]); dot.setAttribute("aria-label", t("color." + color));
  label.append(dot, node("strong", "", text)); return label;
}
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
  $("#menu").dataset.panel = name;
  for (const el of document.querySelectorAll(".panel"))
    el.classList.toggle("hidden", el.id !== name + "-panel");
  refreshMenuNavigation();
  if (name === "records") showRecords();
}
function refreshMenuNavigation() {
  const name = $("#menu").dataset.panel ?? "fly";
  const active = name === "lobby" || (name === "fly" && $("#session").value.startsWith("online")) ? "multiplayer" : name;
  for (const button of document.querySelectorAll("[data-tab]")) {
    button.classList.toggle("active", button.dataset.tab === active);
    if (button.dataset.tab === active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
}
function pause() {
  if (!playing) return;
  void fullscreen?.enterMenu();
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
  void fullscreen?.enterFlight();
  paused = false;
  lastFrame = performance.now();
  flight.active = !room || room.phase === "flying";
  document.activeElement?.blur();
  visible("#menu", false);
  visible("#hud", true);
  flight.startSound();
}
function action(kind) {
  if (loading.tasks.size && !["lostFocus", "radioChanged"].includes(kind)) return;
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
  if (kind === "mode") {
    const next = FLIGHT_MODES[(FLIGHT_MODES.indexOf(flight.physics.mode) + 1) % FLIGHT_MODES.length];
    if (room) { if (room.phase === "flying") network.send("mode", {mode: next}); }
    else { $("#flight-mode").value = next; flight.physics.mode = next; lap.invalid = true; lap.bestMs = lap.lastMs = null; }
  }
}
function recordKey(
  m = flight.map,
  c = flight.config,
  mode = flight.physics.mode,
  options = flight.physics?.effects.options ?? simulation,
) {
  const key = [m.id, m.routeId, m.routeVersion, c.id, c.configHash, mode].join(":");
  return simulationKey(options) === simulationKey(DEFAULT_SIMULATION) ? key : key + ":" + simulationKey(options);
}
function saveLocal(ms) {
  const records = read("records", {}),
    key = recordKey();
  records[key] = Math.min(ms, records[key] ?? Infinity);
  write("records", records);
}
async function selectDrone(id) {
  const previous = config;
  config =
    catalog.drones.find((d) => d.id === id) ??
    catalog.drones.find((d) => d.id === "rift-x5");
  write("selected-drone", config.id);
  refreshCatalogText();
  const selected = config, task = loading.begin("loading.model", { name: selected.name });
  try {
    await paintLoading();
    await preview.select(selected, task.progress);
    preview.render();
  } catch (error) {
    if (config === selected && previous) {
      config = previous;
      write("selected-drone", config.id);
      refreshCatalogText();
    }
    throw error;
  } finally { task.end(); }
}
function selectMap(id) {
  const base = catalog.maps.find((m) => m.id === id) ?? catalog.maps[0];
  map = resolveRoute(base, read("selected-race-" + base.id, base.routeId)) ?? base;
  fillRoutes($("#race-route"), base, map.routeId);
  write("selected-map", map.id);
  updateSessionOptions();
  refreshCatalogText();
}
function fillRoutes(select, base, selected = base?.routeId) {
  select.replaceChildren(...(base?.routes ?? []).map(route => new Option(route.name, route.id)));
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
  select.disabled = !select.options.length;
}
function refreshRecordRoutes() {
  fillRoutes($("#records-route"), catalog.maps.find(m => m.id === $("#records-map").value));
}
function updateSessionOptions() {
  const enabled = canRace(map);
  for (const option of $("#session").options)
    option.disabled = !enabled && isTimedSession(option.value);
  if (!enabled && isTimedSession($("#session").value))
    $("#session").value = $("#session").value.startsWith("online") ? "online-free" : "free";
  visible("#online-controls", $("#session").value.startsWith("online"));
  visible("#map-mode-note", !enabled);
  refreshSimulationControls();
  refreshMenuNavigation();
}
function refreshCatalogText() {
  if (map) $("#map-preview-link").href = "/showcase/?tab=maps&" + new URLSearchParams({ map: map.id, route: map.routeId });
  for (const d of catalog.drones) {
    const b = $(`[data-drone="${d.id}"]`);
    b.classList.toggle("selected", config?.id === d.id);
    b.setAttribute("aria-pressed", String(config?.id === d.id));
    b.querySelector("small").textContent = t("hangar.drone." + d.id);
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
  for (const [id,hex] of Object.entries(DRONE_COLORS)) {
    const button=node("button", "drone-color-swatch"); button.type="button"; button.dataset.droneColor=id;
    const dot=node("i"); dot.style.setProperty("--pilot-color",hex); dot.setAttribute("aria-hidden","true");
    button.append(dot); button.onclick=()=>setDroneColor(id); $("#drone-color-picker").append(button);
  }
  refreshColors();
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
  refreshRecordRoutes();
}
function drawRates() {
  const c = $("#rate-graph"),
    ctx = c.getContext("2d"),
    r = readRatesForm();
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#ffffff18";
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
    ctx.strokeStyle = ["#ff6648", "#73d9d0", "#a5c776"][i];
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
    row.dataset.radioAxisRow = axis;
    row.addEventListener("focusin", () => radioGuide?.setAxis(axis));
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
          (r.routeName ? r.routeName + " · " : "") + r.players +
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
    room.mode.toUpperCase() + (room.route?.name ? " · " + room.route.name : "");
  $("#lobby-players").replaceChildren();
  for (const p of room.players) {
    const row = node("div", "player-row");
    row.append(
      pilotName(p, p.name + (p.id === room.host ? " / " + t("online.host") : "")),
      node("span", "", p.ready ? t("online.ready") : t("online.notReady")),
    );
    $("#lobby-players").append(row);
  }
  const own = room.players.find((p) => p.id === network.id);
  $("#ready").textContent = t(own?.ready ? "online.notReady" : "online.ready");
  $("#ready").disabled = room.phase !== "lobby";
  $("#start-room").disabled =
    room.phase !== "lobby" || room.host !== network.id;
  refreshSimulationControls();
}
async function loadRoom(r) {
  const key = r.code + ":" + r.startsAt;
  if (loadingRoom === key) return;
  loadingRoom = key;
  void fullscreen?.enterFlight();
  const task = loading.begin("loading.flight", { name: t("map." + r.mapId) });
  const roomConfig = catalog.drones.find((d) => d.id === r.droneId);
  const baseMap = catalog.maps.find((m) => m.id === r.mapId);
  const roomMap = r.route ? { ...baseMap, routeId: r.route.id ?? baseMap.routeId, routeName: r.route.name,
    routeVersion: r.route.version, spawn: r.route.spawn, gates: r.route.gates } : resolveRoute(baseMap, r.routeId);
  session = "online-" + r.kind;
  $("#flight-mode").value = r.mode;
  try {
    const own = r.players.find(p=>p.id===network.id);
    await paintLoading();
    await flight.load(roomMap, roomConfig, rates(roomConfig.id), own?.mode ?? r.mode, own?.color ?? droneColor, r.simulation, task.progress);
    if (!room || room.code !== r.code) {
      flight.active = false;
      if (!room) void fullscreen?.enterMenu();
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
    if (!room || room.code === r.code) void fullscreen?.enterMenu();
    notice(t("error.requestFailed"));
  } finally {
    task.end();
  }
}
function receive(m) {
  if (m.type === "welcome") {
    updateStatus();
    network.send("list");
  }
  if (m.type === "error") {
    if (m.code === "notReady") void fullscreen?.enterMenu();
    notice(t("error." + m.code));
  }
  if (m.type === "rooms") {
    rooms = m.rooms;
    renderRooms();
  }
  if (m.type === "left") {
    void fullscreen?.enterMenu();
    flight.updateRemotes([], network.id);
    room = null;
    refreshSimulationControls();
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
    flight.updateRemotes([], network.id);
    if (room) {
      pause();
      notice(t("online.disconnected"));
      room = null;
      refreshSimulationControls();
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
    if (flight.physics && loadedRoom === room.code + ":" + room.startsAt) {
      if (simulationKey(flight.physics.effects.options) !== simulationKey(room.simulation)) flight.setSimulation(room.simulation);
      const own = room.players.find(p => p.id === network.id);
      if (own?.mode) { flight.physics.mode = own.mode; $("#flight-mode").value = own.mode; }
      flight.updateRemotes(room.players, network.id);
    }
    visible("#leave-flight", true);
    renderLobby();
    if (room.phase === "lobby") {
      if (previousPhase !== "lobby") void fullscreen?.enterMenu();
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
      routeId: map.routeId,
      droneId: config.id,
      mode: $("#flight-mode").value,
      kind: session.replace("online-", ""),
      public: $("#public-room").checked,
      simulation,
    });
    return;
  }
  $("#launch").disabled = true;
  // Start from the launch click, before loading consumes its user activation.
  void fullscreen?.enterFlight();
  const task = loading.begin("loading.flight", { name: t("map." + map.id) });
  try {
    await paintLoading();
    await flight.load(map, config, rates(config.id), $("#flight-mode").value, droneColor, simulation, task.progress);
    lap = newLap();
    simTime = 0;
    playing = true;
    controller.clear();
    resume();
  } catch (e) {
    console.error(e);
    void fullscreen?.enterMenu();
    notice(t("error.requestFailed"));
  } finally {
    $("#launch").disabled = false;
    task.end();
  }
}
async function showRecords() {
  if (!catalog) return;
  const m = resolveRoute(catalog.maps.find((v) => v.id === $("#records-map").value), $("#records-route").value || undefined),
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
    node("p", "muted", time(read("records", {})[recordKey(m, c, mode, simulation)])),
    node("p", "muted", t("simulation.recordsHint")),
  );
  root.append(node("h2", "", t("records.online")));
  try {
    const res = await fetch(
      "/api/leaderboard?" +
        new URLSearchParams({ map: m.id, route: m.routeId, drone: c.id, mode, simulation: simulationKey(simulation) }),
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
  $("#hud-mode").textContent = flight.physics.mode.toUpperCase() + " ↻";
  $("#hud-mode").setAttribute("aria-label", t("hud.changeMode") + " · " + flight.physics.mode.toUpperCase());
  $("#hud-mode").title = t("hud.changeMode") + " · " + keyName(controller.keys.mode);
  $("#hud-mode").disabled = !!room && (room.phase !== "flying" || own?.finished);
  $("#hud-input").textContent = t(
    controller.usingRadio ? "settings.controller" : "input.keyboard",
  );
  $("#speed").textContent = Math.round(Math.hypot(...p.v) * 3.6);
  $("#altitude").textContent = Math.max(0,
    p.p[1] - flight.environment.heightAt(p.p[0], p.p[2]),
  ).toFixed(1);
  $("#throttle").textContent = Math.round(Math.min(input.throttle, flight.physics.effects.throttleLimit) * 100);
  const effects = flight.physics.effects, state = effects.telemetry;
  visible("#battery-hud", effects.options.battery);
  $("#battery-hud").textContent = `${t("simulation.battery")} · ${state.voltage.toFixed(1)} V · ${Math.round(state.charge * 100)}%` +
    (state.batteryState !== "normal" ? " · " + t("hud.battery." + state.batteryState) : "");
  $("#battery-hud").classList.toggle("low", state.batteryState === "low");
  $("#battery-hud").classList.toggle("critical", state.batteryState === "critical");
  visible("#damage-hud", effects.options.propDamage && Math.max(...state.damage) > 0);
  $("#damage-hud").textContent = t("hud.propDamage", {damage: Math.round(Math.max(...state.damage) * 100)});
  visible("#wind-hud", effects.options.wind !== "calm");
  $("#wind-hud").textContent = t("simulation.wind") + " · " + t("wind." + effects.options.wind);
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
    mode: keyName(controller.keys.mode),
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
        pilotName(p),
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
  if (playing && !paused) updateSticks(input);
  if (
    playing &&
    !paused &&
    flight.active &&
    (!room ||
      (room.phase === "flying" &&
        !room.players.find((p) => p.id === network.id)?.finished))
  ) {
    flight.physics.effects.windTime = room ? Math.max(0, (network.now - room.startsAt) / 1000) : simTime / 1000;
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
      flight.physics.effects.options,
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
  if (!$("#settings-panel").classList.contains("hidden")) {
    radioGuide ??= new RadioGuide($("#radio-guide"), t);
    radioGuide.render(controller, now);
  }
  if (playing && !paused) flight.render(dt);
  requestAnimationFrame(frame);
}
function bindUI() {
  fullscreen = bindFullscreen(t, notice);
  for (const b of document.querySelectorAll("[data-tab]"))
    b.onclick = () => {
      if (b.dataset.tab === "multiplayer") {
        if (room) { panel("lobby"); return; }
        $("#session").value = "online-free";
        updateSessionOptions();
        panel("fly");
        network.send("list");
      } else {
        if (b.dataset.tab === "fly" && !room && $("#session").value.startsWith("online")) {
          $("#session").value = "free";
          updateSessionOptions();
        }
        panel(b.dataset.tab);
      }
    };
  $("#language").onchange = async (e) => {
    const { setLanguage } = await import("./lang.js");
    await setLanguage(e.target.value);
  };
  $("#launch").onclick = launch;
  $("#resume").onclick = resume;
  $("#menu-button").onclick = pause;
  $("#hud-mode").onclick = () => { action("mode"); document.activeElement?.blur(); };
  $("#session").onchange = () => {
    updateSessionOptions();
  };
  $("#race-route").onchange = () => {
    map = resolveRoute(catalog.maps.find(m => m.id === map.id), $("#race-route").value);
    write("selected-race-" + map.id, map.routeId);
    updateSessionOptions(); refreshCatalogText();
  };
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
  $("#start-room").onclick = () => {
    if (room?.phase === "lobby" && room.host === network.id && room.players.every(p => p.ready))
      void fullscreen?.enterFlight();
    network.send("start");
  };
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
    radioGuide?.setAxis("centres");
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
    () => {
      radioGuide?.setAxis("centres");
      $("#calibration-status").textContent = t("settings.saved");
    },
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
  for (const s of ["#records-route", "#records-drone", "#records-mode"])
    $(s).onchange = showRecords;
  $("#records-map").onchange = () => { refreshRecordRoutes(); showRecords(); };
  $("#records-refresh").onclick = showRecords;
  window.addEventListener("languagechange", () => {
    refreshColors();
    refreshSimulationControls();
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
  createSimulationControls();
}
let startupTask;
try {
  await initLanguage();
  startupTask = loading.begin("loading");
  await paintLoading();
  const response = await fetch("/api/catalog");
  if (!response.ok) throw Error("Catalog unavailable");
  catalog = await response.json();
  preview = new Preview($("#preview-scene"));
  flight = new Flight($("#game-scene"));
  controller = new Controller(action);
  network = new Network(receive);
  preview.setColor(droneColor); flight.setColor(droneColor);
  await flight.init();
  createCatalogUI();
  selectMap(read("selected-map", "liget"));
  await selectDrone(read("selected-drone", "rift-x5"));
  bindUI();
  network.connect($("#nickname").value);
  startupTask.end();
  requestAnimationFrame(frame);
} catch (e) {
  console.error(e);
  loading.fail(t("error.boot"));
}
