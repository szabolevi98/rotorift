import { initLanguage, t } from "./lang.js";
import { read, write } from "./storage.js";
import { Controller } from "./input/controller.js";
import { Network } from "./net/client.js";
import { Preview } from "./game/preview.js";
import { Flight } from "./game/flight.js";
import { LoadingScreen, paintLoading } from "./loading.js";
import { FlightHelp } from "./game/flight-help.js";
import { PauseMenu } from "./game/pause-menu.js";
import { armPrompt } from "./game/arm-prompt.js";
import { FpvOsd } from "./game/fpv-osd.js";
import { PropellerHud } from "./game/propeller-hud.js";
import { CameraProfiles, DEFAULT_CAMERA_PROFILE } from './game/camera-profiles.js';
import { FrameDiagnostics } from './game/frame-diagnostics.js';
import { validPropellers } from "/shared/physics/propellers.js";
import { bindFullscreen } from "./fullscreen.js";
import { RadioGuide } from "./input/radio-guide.js";
import { RADIO_ACTIONS, availableBindings, bindingKey, parseBinding } from "./input/action-bindings.js";
import { RADIO_PRESETS } from "./input/radio-profiles.js";
import { simulationView, activeMenuTab, flightSimulationActive } from "./menu-state.js";
import { defaultRates, validRate, actualRate } from "/shared/physics/rates.js";
import { hoverThrottle } from "/shared/physics/propulsion.js";
import { newLap, advanceLap } from "/shared/race/gates.js";
import { resolveRoute } from "/shared/race/routes.js";
import { canRace, isTimedSession, withoutRaceRoute } from "/shared/race/map-modes.js";
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
const fpvOsd = new FpvOsd($("#fpv-horizon"), $("#analog-effect"), $("#game-scene"));
const propellerHud = new PropellerHud($("#damage-hud"),t);
const fpsLabel = $("#hud-fps");
let fpsSince = null, fpsFrames = 0;
function updateFps(now, rendering) {
  if (!rendering || document.hidden) {
    fpsSince = null;
    fpsFrames = 0;
    if (fpsLabel.textContent !== "— FPS") fpsLabel.textContent = "— FPS";
    return;
  }
  if (fpsSince === null) { fpsSince = now; return; }
  fpsFrames++;
  const elapsed = now - fpsSince;
  if (elapsed >= 500) {
    // Real render cadence, independent of the capped simulation timestep.
    const label = `${Math.round(fpsFrames * 1000 / elapsed)} FPS`;
    if (fpsLabel.textContent !== label) fpsLabel.textContent = label;
    fpsLabel.setAttribute('aria-label',label+' · '+t('perf.open'));
    fpsSince = now;
    fpsFrames = 0;
  }
}
document.addEventListener("visibilitychange", () => updateFps(performance.now(), false));
let fullscreen, radioGuide, pauseMenu, diagnostics, pauseRenderNeeded = false;
window.addEventListener("resize", () => { if (playing && paused) pauseRenderNeeded = true; });
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
let roomRequest = null, roomRequestTimer, launching = false;
let flightHelp;
let resultsShown = null;
let resultsSignature = "";
const roomKey = r => r ? r.code + ":" + (r.runId ?? r.startsAt) : null;
const touchInput = matchMedia("(hover: none) and (pointer: coarse)");
let roomsRefreshAt = 0;
const rateProfiles = read("rates", {}),
  cameraSettings = read("camera", { angle: 20, fov: 100, sound: true, horizon: false, analog: false });
const cameraProfiles=new CameraProfiles(read('camera-profiles',{}),cameraSettings);
function applyAircraftCamera(){
  const profile=cameraProfiles.get(flight?.config?.id??config?.id);flight?.setCameraSettings(profile.angle,profile.fov);
}
function renderCameraProfile(id){
  if(!$('#camera-drone').options.length)return;
  $('#camera-drone').value=id;const p=cameraProfiles.get(id);
  $('#camera-angle').value=p.angle;$('#camera-fov').value=p.fov;$('#angle-output').textContent=p.angle+'°';$('#fov-output').textContent=p.fov+'°';
}
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
        const context = id === "lobby-simulation" ? "lobby" : $("#menu").dataset.panel === "multiplayer" ? "host" : "solo";
        const view = simulationView(context, simulation, room, network.id);
        if (view.locked) return;
        const next = { ...view.options, [key]: key === "wind" ? input.value : input.checked };
        if (context === "lobby" && room) network.send("rules", { simulation: next });
        else {
          simulation = normalizeSimulation(next); write("simulation", simulation);
          if (playing && !room && context === "solo") { flight.setSimulation(simulation); lap.invalid = true; lap.bestMs = lap.lastMs = null; }
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
  for (const id of ["flight-simulation", "lobby-simulation"]) {
    const root = $("#" + id), context = id === "lobby-simulation" ? "lobby" : $("#menu").dataset.panel === "multiplayer" ? "host" : "solo";
    const view = simulationView(context, simulation, room, network?.id);
    for (const input of root.querySelectorAll("[data-sim-option]")) {
      const key = input.dataset.simOption;
      input.disabled = view.locked;
      input.parentElement.classList.toggle("hidden", key === "ghost" && !view.ghost);
      input.parentElement.querySelector("[data-sim-label]").textContent = t("simulation." + key);
      if (key === "wind") {
        input.value = view.options.wind;
        for (const option of input.options) option.textContent = t("wind." + option.value);
      } else input.checked = view.options[key];
    }
    const note = root.querySelector(".simulation-note");
    if (note) note.textContent = t(view.note);
  }
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
  controller?.bindings.reset();
  if (controller) controller.setup = null;
  $("#menu").dataset.panel = name;
  if (name === "fly" || name === "multiplayer")
    $(name === "fly" ? "#solo-hangar-slot" : "#multiplayer-hangar-slot").append($("#hangar-setup"));
  const host = name === "multiplayer";
  for (const id of ["host-kind-label", "public-room-row", "create-room"]) visible("#" + id, host);
  for (const id of ["local-session-label", "launch"]) visible("#" + id, !host);
  for (const el of document.querySelectorAll(".panel"))
    el.classList.toggle("hidden", el.id !== name + "-panel");
  refreshMenuNavigation();
  updateSessionOptions();
  refreshSessionBanner();
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  if (name === "records") showRecords();
}
function refreshMenuNavigation() {
  const name = $("#menu").dataset.panel ?? "fly";
  const active = activeMenuTab(name, room?.kind);
  for (const button of document.querySelectorAll("[data-tab]")) {
    button.classList.toggle("active", button.dataset.tab === active);
    if (button.dataset.tab === active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
}
function refreshSessionBanner() {
  const active = playing && paused && (!room || (["countdown", "flying"].includes(room.phase) && !room.players.find(p=>p.id===network.id)?.finished));
  visible("#active-session", active);
  if (active && flight?.config) $("#active-session-description").textContent =
    `${t("map." + flight.map.id)} · ${flight.config.name} · ${flight.physics.mode.toUpperCase()}` + (room ? ` · ${room.code}` : "");
}
function pause() {
  if (!playing || paused) return;
  flightHelp?.setOpen(false);
  void fullscreen?.enterMenu();
  paused = true;
  flight.active = flightSimulationActive(playing, paused, room, network.id);
  flight.physics.armed = false;
  flight.physics.setTurtleMode(false);
  flight.mute();
  lap.invalid = true;
  controller.clear();
  visible("#menu", false);
  visible("#hud", true);
  pauseMenu?.setOpen(true);
  pauseRenderNeeded = true;
  refreshSessionBanner();
}
function resume() {
  if (!playing) return;
  if (room && (room.phase === "finished" || room.players.find(p=>p.id===network.id)?.finished)) { showResults(); return; }
  flightHelp?.setOpen(false);
  pauseMenu?.setOpen(false);
  void fullscreen?.enterFlight();
  paused = false;
  controller.bindings.reset();
  lastFrame = performance.now();
  flight.active = !room || room.phase === "flying";
  document.activeElement?.blur();
  hud();
  visible("#menu", false);
  visible("#hud", true);
  refreshSessionBanner();
  flight.startSound();
}
function action(kind, currentInput = input) {
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
  if(['turtle','turtleOn','turtleOff'].includes(kind)){
    if(flight.physics.armed){notice(t('hud.turtleDisarm'));return;}
    if(currentInput.throttle>.06){notice(t('hud.lowThrottle'));return;}
    if(room&&(room.phase!=='flying'||room.players.find(p=>p.id===network.id)?.finished))return;
    flight.physics.setTurtleMode(kind==='turtle'?!flight.physics.turtleMode:kind==='turtleOn');flight.rotorMotion.reset();hud();return;
  }
  if (["arm", "armOn", "armOff"].includes(kind)) {
    const armed = kind === "armOn" || (kind === "arm" && !flight.physics.armed);
    if (armed && controller.usingRadio && !controller.radioReady) { notice(t("settings.radioMissing")); return; }
    if (armed && room && (room.phase !== "flying" || room.players.find((p) => p.id === network.id)?.finished)) return;
    if (armed && currentInput.throttle > 0.06) {
      notice(t("hud.lowThrottle"));
      return;
    }
    flight.physics.armed = armed;
    flight.startSound();
    hud();
  }
  if (kind === "hover" && !controller.usingRadio && !flight.physics.turtleMode)
    controller.keyboard.throttle = hoverThrottle(flight.config);
  if (kind === "view") flight.cycleView();
  if (kind === "reset") resetAircraft();
  if (kind === "mode") {
    const next = FLIGHT_MODES[(FLIGHT_MODES.indexOf(flight.physics.mode) + 1) % FLIGHT_MODES.length];
    if (room) { if (room.phase === "flying") network.send("mode", {mode: next}); }
    else { $("#flight-mode").value = next; flight.physics.mode = next; lap.invalid = true; lap.bestMs = lap.lastMs = null; }
  }
}
function resetAircraft() {
  controller.clear(); lap = newLap();
  if (room) network.send("reset"); else flight.reset();
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
  const selected = config, task = loading.begin("loading.model", { name: selected.name }, { overlay: !!preview.model });
  try {
    await paintLoading();
    await preview.select(selected, task.progress);
    if(config===selected)renderCameraProfile(selected.id);
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
function fillRoutes(select, base, selected = base?.routeId, allowNone = false) {
  select.replaceChildren(...(base?.routes ?? []).map(route => new Option(route.name, route.id)));
  if (allowNone) select.prepend(new Option(t("fly.noRoute"), ""));
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
    $("#session").value = "free";
  for (const option of $("#room-kind").options) option.disabled = !enabled && option.value === "race";
  if (!enabled && $("#room-kind").value === "race") $("#room-kind").value = "free";
  const timed = $("#menu").dataset.panel === "multiplayer" ? $("#room-kind").value === "race" : isTimedSession($("#session").value);
  fillRoutes($("#race-route"), catalog.maps.find(m => m.id === map.id), timed ? map.routeId : "", true);
  visible(".race-row", true);
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
  const noRoute = $("#race-route").querySelector('option[value=""]');
  if (noRoute) noRoute.textContent = t("fly.noRoute");
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
    for (const select of ["#rates-drone", "#rates-target", "#records-drone", "#camera-drone"])
      $(select).append(new Option(d.name, d.id));
  }
  for (const m of catalog.maps) {
    const b = node("button", "map-card");
    b.dataset.map = m.id;
    b.append(node("div", "map-art " + m.kind));
    const label = node("div", "map-label");
    label.append(node("b", "", t("map." + m.id)), node("span", "", "↗"));
    b.append(label);
    b.addEventListener("click", () => selectMap(m.id));
    $("#map-picker").append(b);
    $("#records-map").append(new Option(t("map." + m.id), m.id));
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
    controller.pads.map((pad) => pad.id + ":" + pad.index).join(","),
    controller.deviceId,
    controller.raw.length,
    controller.pad?.buttons?.length,
    Object.values(controller.profile.axes).map((axis) => axis.index).join(","),
    JSON.stringify(controller.profile.actions),
    controller.bindings.capture?.action,
    controller.bindings.result,
    !!controller.range,
    controller.profile.preset,
    controller.profile.supported,
    controller.setup?.step,
    controller.setup?.error,
    document.documentElement.lang,
  ].join("|");
  if (signature === inputSignature) return;
  inputSignature = signature;
  $("#axis-settings").replaceChildren();
  $("#deadzone").value = controller.profile.deadzone;
  const devices = $("#radio-device");
  devices.replaceChildren(new Option(t("settings.radioDeviceAuto"), "auto"));
  for (const pad of controller.pads) devices.append(new Option(pad.id, pad.id));
  if (controller.deviceId !== "auto" && !controller.pads.some((pad) => pad.id === controller.deviceId))
    devices.append(new Option(controller.deviceId + " · " + t("input.noRadio"), controller.deviceId));
  devices.value = controller.deviceId;
  const presets = $("#radio-preset");
  presets.replaceChildren();
  for (const preset of RADIO_PRESETS) presets.append(new Option(t("radioPreset." + preset), preset));
  presets.value = controller.profile.preset ?? "auto";
  presets.disabled = !controller.pad || !!controller.setup;
  $("#radio-recommend").disabled = !controller.pad || !!controller.setup;
  $("#stick-setup-start").disabled = !controller.pad || !!controller.range || !!controller.setup;
  const setup = controller.setup;
  $("#calibrate-center").disabled = $("#calibrate-range").disabled = !!setup;
  visible("#stick-setup", !!setup);
  $("#stick-setup-instruction").textContent = setup ? `${setup.step + 1}/4 · ${t("stickSetup." + setup.axis)}` : "";
  $("#stick-setup-status").textContent = setup?.error ? t("stickSetup." + setup.error) : "";
  if (setup) radioGuide?.setAxis(setup.axis);
  visible("#radio-preset-warning", controller.profile.supported === false);
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
      controller.markCustom();
      controller.bindings.reset();
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
      controller.markCustom();
      controller.save();
    };
    label.append(invert, node("span", "", "↔"));
    const meter = node("meter");
    meter.min = -1;
    meter.max = 1;
    meter.dataset.meter = axis;
    select.disabled = invert.disabled = !!setup;
    row.append(select, label, meter);
    $("#axis-settings").append(row);
  }
  const bindings = $("#radio-actions");
  bindings.replaceChildren();
  const options = availableBindings(controller.pad, controller.profile);
  for (const name of RADIO_ACTIONS) {
    const row = node("div", "radio-action-row"), select = node("select");
    select.setAttribute("aria-label", t("settings.buttonBinding", { action: t("key." + name) }));
    select.append(new Option(t("settings.unassigned"), ""));
    for (const binding of options) select.append(new Option(bindingLabel(binding), bindingKey(binding)));
    select.value = bindingKey(controller.profile.actions?.[name]);
    select.disabled = !controller.pad || !!controller.range || !!setup;
    select.onchange = () => {
      controller.bindAction(name, parseBinding(select.value));
      controller.bindings.result = "saved";
    };
    const learn = node("button", "secondary", t("settings.assignButton"));
    learn.type = "button";
    learn.disabled = select.disabled;
    learn.setAttribute("aria-label", t("settings.assignAction", { action: t("key." + name) }));
    learn.onclick = () => {
      controller.bindings.listen(name, controller.pad, controller.profile);
      renderInputUI();
    };
    row.append(node("span", "", t("key." + name)), select, learn);
    bindings.append(row);
  }
  visible("#binding-cancel", !!controller.bindings.capture);
  $("#binding-status").textContent = controller.bindings.capture
    ? t("settings.bindingWait", { action: t("key." + controller.bindings.capture.action) })
    : controller.bindings.result ? t("settings.binding" + controller.bindings.result) : "";
}
function bindingLabel(binding) {
  return binding.type === "button" ? t("settings.buttonNumber", { number: binding.index + 1 })
    : `CH ${binding.index + 1} ${binding.direction > 0 ? "+" : "−"}`;
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
  if (controller.setup) {
    const signal = controller.setup.signal;
    $("#stick-setup-signal").textContent = t("stickSetup.signal" + signal.state, { axis: (signal.index ?? 0) + 1, travel: Math.round((signal.travel ?? 0) * 50) });
    $("#stick-setup-usb").textContent = t("stickSetup.usbCount", { count: controller.raw.length }) + "\n" +
      controller.raw.map((value, index) => {
        const sample = controller.setup.samples[index];
        return `A${index + 1}: ${value.toFixed(3)}   [${sample?.min.toFixed(3)} … ${sample?.max.toFixed(3)}]`;
      }).join("\n");
  }
  for (const m of document.querySelectorAll("[data-meter]"))
    m.value = input[m.dataset.meter];
  const active = availableBindings(controller.pad, controller.profile).filter((b) => b.type === "button"
    ? controller.pad.buttons[b.index].pressed || controller.pad.buttons[b.index].value > 0.5
    : controller.raw[b.index] * b.direction > 0.7);
  $("#radio-buttons-live").textContent = active.length ? t("settings.pressedButtons", { buttons: active.map(bindingLabel).join(" · ") }) : "";
}
function renderRooms() {
  const root = $("#rooms-list");
  root.replaceChildren();
  if (!rooms.length && network?.ready) root.append(node("p", "muted", t("online.empty")));
  for (const r of rooms) {
    const row = node("div", "room-row"),
      button = node("button", "secondary", t("online.join"));
    button.onclick = () => requestRoom("join", { code: r.code });
    button.disabled = !network?.ready || !!roomRequest || r.players >= 8;
    const summary = node("div", "room-summary");
    summary.append(node("strong", "", r.code), node("span", "", t("map." + r.mapId) + " · " + t(r.kind === "race" ? "online.raceKind" : "session.free") + " · " + r.players + "/8"));
    summary.append(node("span", "", (catalog.drones.find(drone => drone.id === r.droneId)?.name ?? r.droneId) + " · " + r.mode.toUpperCase() + (r.kind === "race" && r.routeName ? " · " + r.routeName : "")));
    row.append(
      summary,
      button,
    );
    root.append(row);
  }
}
function refreshRooms() {
  roomsRefreshAt = performance.now();
  network.send("list");
}
function requestRoom(type, data) {
  if (!network.ready) { notice(t("error.connectFirst")); return; }
  if (roomRequest) return;
  const pilotName = $("#nickname").value.trim().slice(0,32) || "Pilot";
  if (network.name !== pilotName) {
    network.name = pilotName; write("nickname", pilotName);
    network.send("rename", { name: pilotName });
  }
  roomRequest = type;
  clearTimeout(roomRequestTimer);
  roomRequestTimer = setTimeout(() => {
    roomRequest = null; updateStatus(); notice(t("error.requestFailed"));
  }, 10000);
  network.send(type, data);
  updateStatus();
}
function clearRoomRequest() {
  clearTimeout(roomRequestTimer); roomRequest = null;
}
function createRoom() {
  const kind = $("#room-kind").value;
  if (kind === "race" && !canRace(map)) { notice(t("error.raceUnavailable")); return; }
  requestRoom("create", { mapId: map.id, routeId: map.routeId, droneId: config.id,
    mode: $("#flight-mode").value, kind, public: $("#public-room").checked, simulation });
}
function endFlight() {
  if (room) { network.send("leave"); return; }
  pauseMenu?.setOpen(false);
  void fullscreen?.enterMenu();
  playing = false; paused = true; flight.active = false;
  if (flight.physics) flight.physics.armed = false;
  flight.mute(); controller.clear(); lap.invalid = true;
  visible("#hud", false); visible("#menu", true); panel("fly");
}
function renderLobby() {
  if (!room) return;
  $("#lobby-code").textContent = room.code;
  $("#lobby-description").textContent =
    t("map." + room.mapId) +
    " · " +
    catalog.drones.find((d) => d.id === room.droneId)?.name +
    " · " +
    room.mode.toUpperCase() + (room.kind !== "free" && room.route?.name ? " · " + room.route.name : "");
  $("#lobby-players").replaceChildren();
  for (const p of room.players) {
    const row = node("div", "player-row");
    row.append(
      pilotName(p, p.name + (p.id === room.host ? " / " + t("online.host") : "")),
      node("span", "", p.connected === false ? t("online.pilotReconnecting") : room.phase === "lobby" ? t(p.ready ? "online.ready" : "online.notReady")
        : t(p.finished ? "results.finished" : room.phase === "finished" ? "results.dnf" : "results.racing")),
    );
    $("#lobby-players").append(row);
  }
  const own = room.players.find((p) => p.id === network.id);
  $("#lobby-status").textContent = t(room.phase === "lobby" ? "online.readyHint" : room.phase === "finished" ? "online.finished" : "online.inProgress");
  $("#ready").textContent = t(own?.ready ? "online.notReady" : "online.ready");
  $("#ready").disabled = room.phase !== "lobby";
  $("#start-room").disabled =
    room.phase !== "lobby" || room.host !== network.id || !room.players.every(player => player.ready && player.connected !== false);
  visible("#ready", room.phase === "lobby");
  visible("#start-room", room.phase === "lobby" && room.host === network.id);
  visible("#finish-room", room.phase === "flying" && room.kind !== "free" && room.host === network.id);
  visible("#restart-room", room.host === network.id && (room.phase === "finished" || (room.kind === "free" && room.phase === "flying")));
  refreshSimulationControls();
}
function renderResults() {
  if (!room) return;
  const signature = [roomKey(room), room.phase, room.host, network.id, document.documentElement.lang, JSON.stringify(room.results)].join("|");
  if (signature === resultsSignature) return;
  resultsSignature = signature;
  $("#results-code").textContent = room.code + " · " + t("map." + room.mapId);
  $("#results-description").textContent = [room.route?.name, catalog.drones.find(d=>d.id===room.droneId)?.name].filter(Boolean).join(" · ");
  $("#results-status").textContent = t(room.phase === "finished" ? "results.complete" : "results.waiting");
  const head = node("tr");
  for (const key of ["place", "pilot", "laps", "best", "total", "status"]) {
    const cell = node("th", "", t("results." + key)); cell.scope = "col"; head.append(cell);
  }
  $("#results-head").replaceChildren(head);
  const rows = room.results ?? [];
  $("#results-body").replaceChildren();
  for (const p of rows) {
    const row = node("tr", "result-" + p.status); row.classList.toggle("own-pilot", p.id === network.id);
    const pilot = node("td"); pilot.append(pilotName(p));
    row.append(node("td", "", p.place ?? "—"), pilot, node("td", "", p.completed + (room.kind === "race" ? "/" + room.laps : "")),
      node("td", "", time(p.bestMs)), node("td", "", room.kind === "race" ? time(p.finishMs) : "—"), node("td", "", t("results." + p.status)));
    $("#results-body").append(row);
  }
  const own = rows.find(p=>p.id===network.id);
  $("#own-result").textContent = own ? (own.place ? t("results.yourPlace", { place: own.place }) : t("results." + own.status))
    + " · " + time(room.kind === "hotlap" ? own.bestMs : own.finishMs) : "";
  $("#results-restart").disabled = room.phase !== "finished" || room.host !== network.id;
  visible("#results-restart", room.host === network.id);
}
function showResults() {
  if (!room) return;
  pauseMenu?.setOpen(false);
  flightHelp?.setOpen(false); void fullscreen?.enterMenu();
  paused = true; flight.active = false;
  if (flight.physics) flight.physics.armed = false;
  flight.mute(); controller.clear();
  visible("#menu", true); visible("#hud", false); panel("results"); renderResults();
}
async function loadRoom(r) {
  const key = roomKey(r);
  if (loadingRoom === key) return;
  loadingRoom = key;
  pauseMenu?.setOpen(false);
  playing = false;
  paused = true;
  flight.active = false;
  flight.mute();
  void fullscreen?.enterFlight();
  const task = loading.begin("loading.flight", { name: t("map." + r.mapId) });
  const roomConfig = catalog.drones.find((d) => d.id === r.droneId);
  const baseMap = catalog.maps.find((m) => m.id === r.mapId);
  const roomMap = r.kind === "free" ? withoutRaceRoute(baseMap) : r.route ? { ...baseMap, routeId: r.route.id ?? baseMap.routeId, routeName: r.route.name,
    routeVersion: r.route.version, spawn: r.route.spawn, gates: r.route.gates } : resolveRoute(baseMap, r.routeId);
  session = "online-" + r.kind;
  flightHelp?.setOpen(false);
  $("#flight-mode").value = r.mode;
  try {
    const own = r.players.find(p=>p.id===network.id);
    await paintLoading();
    const loaded = await flight.load(roomMap, roomConfig, rates(roomConfig.id), own?.mode ?? r.mode, own?.color ?? droneColor, r.simulation, task.progress);
    if (loaded === false) return;
    applyAircraftCamera();
    renderCameraProfile(roomConfig.id);
    if (roomKey(room) !== key || room.phase === "lobby" || room.phase === "finished" || room.players.find(p=>p.id===network.id)?.finished) {
      flight.active = false;
      if (!room) void fullscreen?.enterMenu();
      return;
    }
    flight.reset(
      room.players.find((p) => p.id === network.id)?.p ?? roomMap.spawn,
    );
    const restoredProps=room.players.find(p=>p.id===network.id)?.propellers;
    if(r.simulation.propDamage && validPropellers(restoredProps))flight.physics.effects.propellers.blades=restoredProps.map(blades=>[...blades]);
    lap = newLap();
    playing = true;
    paused = false;
    loadedRoom = key;
    flight.active = room.phase === "flying";
    controller.clear();
    document.activeElement?.blur();
    hud();
    visible("#menu", false);
    visible("#hud", true);
    refreshSessionBanner();
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
    if (m.resumed) { loadingRoom = loadedRoom = null; notice(t("online.restored")); }
    else if (m.resumeRejected) notice(t("online.recoveryExpired"));
    updateStatus();
    refreshRooms();
  }
  if (m.type === "error") {
    clearRoomRequest(); updateStatus();
    if (m.code === "notReady") void fullscreen?.enterMenu();
    notice(t("error." + m.code));
  }
  if (m.type === "rooms") {
    rooms = m.rooms;
    renderRooms();
  }
  if (m.type === "left") {
    pauseMenu?.setOpen(false);
    const destination = nextLaunch || room?.kind === "hotlap" ? "fly" : "multiplayer";
    clearRoomRequest();
    void fullscreen?.enterMenu();
    flight.updateRemotes([], network.id);
    room = null;
    refreshSimulationControls();
    loadingRoom = null;
    loadedRoom = null;
    resultsShown = null;
    resultsSignature = "";
    playing = false;
    paused = true;
    flight.active = false;
    flight.mute();
    visible("#menu", true);
    visible("#hud", false);
    panel(destination); updateStatus(); refreshRooms();
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
  if (m.type === "lap" && (!m.runId || m.runId === room?.runId))
    notice(
      m.valid
        ? t(m.saved ? "hud.saved" : "hud.localLap", { time: time(m.ms) })
        : t("hud.invalid"),
    );
  if (m.type === "disconnected") {
    clearRoomRequest();
    flight.updateRemotes([], network.id);
    if (room) {
      pause();
      notice(t("online.disconnected"));
      room = null;
      refreshSimulationControls();
      playing = false;
      pauseMenu?.setOpen(false);
      visible("#menu", true); visible("#hud", false);
      loadingRoom = loadedRoom = null;
      panel("multiplayer");
    }
    nextLaunch = false;
    updateStatus();
  }
  if (m.type === "room") {
    const previousPhase = room?.phase;
    const previousCode = room?.code;
    clearRoomRequest();
    room = m.room;
    if (flight.physics && loadedRoom === roomKey(room)) {
      if (simulationKey(flight.physics.effects.options) !== simulationKey(room.simulation)) flight.setSimulation(room.simulation);
      const own = room.players.find(p => p.id === network.id);
      if (own?.mode) { flight.physics.mode = own.mode; $("#flight-mode").value = own.mode; }
      flight.updateRemotes(room.players.filter(p=>p.connected!==false), network.id);
    }
    renderLobby();
    const own = room.players.find(p=>p.id===network.id);
    const resultKey = roomKey(room) + ":" + room.phase;
    if (room.phase === "lobby") {
      if (previousPhase !== "lobby" || previousCode !== room.code) {
        pauseMenu?.setOpen(false);
        void fullscreen?.enterMenu();
        playing = false; paused = true; flight.active = false;
        if (flight.physics) flight.physics.armed = false;
        flight.mute();
        visible("#menu", true); visible("#hud", false); panel("lobby");
      }
      if (room.kind === "hotlap" && own?.ready && loadingRoom !== roomKey(room)) {
        loadingRoom = roomKey(room);
        network.send("start");
      }
    } else if (room.phase === "countdown" || room.phase === "flying") {
      if (own?.finished) {
        renderResults();
        if (resultsShown !== resultKey) { resultsShown = resultKey; showResults(); }
      } else loadRoom(room);
      if (flight.physics && loadedRoom === roomKey(room)) {
        const finished = room.players.find(
          (p) => p.id === network.id,
        )?.finished;
        flight.active = flightSimulationActive(playing, paused, room, network.id);
        if (finished) {
          flight.physics.armed = false;
          flight.mute();
        }
      }
    } else if (room.phase === "finished") {
      if (flight.physics) flight.physics.armed = false;
      flight.active = false;
      flight.mute();
      renderResults();
      if (resultsShown !== resultKey) { resultsShown = resultKey; showResults(); }
    }
    refreshSessionBanner(); updateStatus();
  }
}
function updateStatus() {
  const recovering = !!network?.resumption && !network.ready && !network.cancelRestore;
  visible("#reconnect-banner", recovering);
  if (recovering) $("#reconnect-description").textContent = t("online.recovering", { code: network.resumption.code });
  $("#server-status").textContent = t(
    network?.ready ? "status.online" : "status.offline",
  );
  $("#server-status").classList.toggle("offline", !network?.ready);
  $("#rooms-status").textContent = !network?.ready ? t("online.offlineHint") : roomRequest ? t("online.requesting") : "";
  $("#join-room").disabled = !network?.ready || !!roomRequest || $("#room-code").value.trim().length !== 6;
  $("#create-room").disabled = !network?.ready || !!roomRequest;
  $("#refresh-rooms").disabled = !network?.ready || !!roomRequest;
  $("#launch").disabled = launching || (!!roomRequest && $("#session").value === "online-hotlap");
  renderRooms();
}
async function launch() {
  if (!room) network.cancelRecovery();
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
    requestRoom("create", {
      mapId: map.id,
      routeId: map.routeId,
      droneId: config.id,
      mode: $("#flight-mode").value,
      kind: session.replace("online-", ""),
      public: false,
      simulation,
    });
    return;
  }
  launching = true;
  $("#launch").disabled = true;
  // Start from the launch click, before loading consumes its user activation.
  void fullscreen?.enterFlight();
  const task = loading.begin("loading.flight", { name: t("map." + map.id) });
  try {
    await paintLoading();
    if (await flight.load(isTimedSession(session) ? map : withoutRaceRoute(map), config, rates(config.id), $("#flight-mode").value, droneColor, simulation, task.progress) === false) return;
    applyAircraftCamera();
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
    launching = false;
    task.end();
    updateStatus();
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
    flight.physics.armed ? "hud.disarmAction" : "hud.armAction",
  );
  $("#arm-state").classList.toggle("armed", flight.physics.armed);
  $("#arm-state").setAttribute("aria-pressed", String(flight.physics.armed));
  $("#arm-state").setAttribute("aria-label", t(flight.physics.armed ? "hud.disarmAction" : "hud.armAction"));
  $("#arm-state").disabled = !flight.physics.armed && !!room && (room.phase !== "flying" || own?.finished);
  $('#hud-turtle').setAttribute('aria-pressed',String(flight.physics.turtleMode));
  $('#hud-turtle').classList.toggle('selected',flight.physics.turtleMode);
  $('#hud-turtle').disabled=flight.physics.armed||!!room&&(room.phase!=='flying'||own?.finished);
  visible('#turtle-hud',flight.physics.turtleMode);
  $('#turtle-hud').textContent=t(flight.physics.armed?'hud.turtleActive':'hud.turtleReady');
  const configuredArm = controller.profile.actions?.arm;
  const armBinding = controller.usingRadio && configuredArm &&
    availableBindings(controller.pad, controller.profile).some(binding => bindingKey(binding) === bindingKey(configuredArm))
    ? configuredArm : null;
  const prompt = armPrompt({
    armed: flight.physics.armed, canArm: !room || (room.phase === "flying" && !own?.finished),
    radio: controller.usingRadio, radioReady: controller.radioReady, mobile: touchInput.matches,
    lowThrottle: input.throttle <= 0.06, binding: armBinding,
    control: armBinding ? bindingLabel(armBinding) : controller.keys.arm === "Space" ? t("hud.spaceKey") : keyName(controller.keys.arm),
  }, t);
  visible("#arm-prompt", !!prompt && !paused && !flight.physics.turtleMode);
  if (prompt) for (const field of ["title", "detail"]) {
    const element = $("#arm-prompt-" + field);
    if (element.textContent !== prompt[field]) element.textContent = prompt[field];
  }
  $("#hud-reset").disabled = !!room && room.phase !== "flying";
  $("#hud-reset").setAttribute("aria-label", t("key.reset"));
  const viewLabel = t("hud.view." + flight.view);
  $("#hud-view").textContent = viewLabel + " ↻";
  $("#hud-view").setAttribute("aria-label", t("key.view") + " · " + viewLabel);
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
  const chargePercent = Math.round(state.charge * 100);
  $("#battery-percent").textContent = chargePercent + "%";
  $("#battery-fill").setAttribute("width", (47 * state.charge).toFixed(2));
  $("#battery-gauge").setAttribute("aria-valuenow", String(chargePercent));
  $("#battery-gauge").setAttribute("aria-label", t("hud.batteryLabel"));
  $("#battery-hud").setAttribute("aria-label", t("hud.batteryLabel"));
  $("#battery-voltage").textContent = `${state.voltage.toFixed(1)} V · ${state.cellVoltage.toFixed(2)} ${t("hud.battery.cellUnit")}`;
  const remaining = state.remainingSeconds === null ? null : Math.min(5999, Math.ceil(state.remainingSeconds));
  $("#battery-remaining").textContent = remaining === null ? "" : t("hud.battery.remaining", {time: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`});
  const batteryWarning = state.batteryState !== "normal" ? t("hud.battery." + state.batteryState) : "";
  if ($("#battery-warning").textContent !== batteryWarning) $("#battery-warning").textContent = batteryWarning;
  $("#battery-hud").classList.toggle("low", state.batteryState === "low");
  $("#battery-hud").classList.toggle("critical", state.batteryState === "critical");
  propellerHud.update(effects.options.propDamage,state.propellers);
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
  flightHelp?.update();
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
      r.classList.toggle("own-pilot", p.id === network.id);
      r.append(
        pilotName(p),
        node(
          "span",
          "",
          room.kind === "free" ? p.mode.toUpperCase() : p.lap.completed +
            " / " +
            time(p.finished ? p.finishMs : p.lap.bestMs),
        ),
      );
      board.append(r);
    }
  }
}
function flightHelpContent() {
  const radio = controller.usingRadio;
  const name = action => controller.keys[action] === "Space" ? t("hud.spaceKey") : keyName(controller.keys[action]);
  const rows = radio ? RADIO_ACTIONS.map(action => [t("key." + action),
    [controller.profile.actions?.[action] ? bindingLabel(controller.profile.actions[action]) : t("settings.unassigned")],
  ]) : [
    ...[["throttle", "throttleUp", "throttleDown"], ["pitch", "pitchForward", "pitchBack"],
      ["roll", "rollLeft", "rollRight"], ["yaw", "yawLeft", "yawRight"]]
      .map(([axis, ...actions]) => [t("axis." + axis), actions.map(name)]),
    ...["arm", "reset", "view", "mode", "turtle", "hover", "menu"].map(action => [t("key." + action), [name(action)]]),
    [t("hud.fineControl"), ["Shift"]],
  ];
  return { source: t(radio ? "settings.controller" : "input.keyboard"),
    note: t(radio ? "hud.helpRadio" : "hud.helpKeyboard"), rows };
}
function frame(now) {
  const frameStart=diagnostics?.open?performance.now():0;
  const diagnosticSample=playing&&!paused&&!document.hidden?diagnostics?.begin(now):null;
  if(!diagnosticSample)diagnostics?.idle();
  if (!$("#menu").classList.contains("hidden") && $("#menu").dataset.panel === "multiplayer" && network.ready && !room && !roomRequest && now - roomsRefreshAt > 5000)
    refreshRooms();
  const elapsed = Math.max(0, (now - lastFrame) / 1000);
  const dt = Math.min(elapsed, 0.25);
  lastFrame = now;
  input = controller.poll(dt);
  const onlineLive = !!room && flightSimulationActive(playing, paused, room, network.id);
  if (playing && !paused) updateSticks(input);
  if (
    playing &&
    (!paused || onlineLive) &&
    flight.active &&
    (!room ||
      (room.phase === "flying" &&
        !room.players.find((p) => p.id === network.id)?.finished))
  ) {
    flight.physics.effects.windTime = room ? Math.max(0, (network.now - room.startsAt) / 1000) : simTime / 1000;
    flight.step(dt, paused ? {roll:0,pitch:0,yaw:0,throttle:0} : input, (previous, current, step) => {
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
    }, diagnosticSample);
    if(diagnosticSample)diagnosticSample.droppedMs=Math.max(0,elapsed-.1)*1000;
    if (!room && flight.boundary.update(flight.physics.pose.p, elapsed)) {
      action("reset");
      notice(t("hud.boundaryReset"));
    }
  }
  if (playing && flight.physics && room?.phase === "flying" && now - sendAt >= 50) {
    network.state(
      flight.physics.pose,
      flight.config,
      flight.physics.mode,
      paused,
      flight.physics.effects.options,
      flight.physics.effects.propellers.blades,
      flight.physics.armed && !paused ? flight.rotorMotion.fraction : [0,0,0,0],
      flight.physics.turtleMode,
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
  if (playing && (!paused || onlineLive || pauseRenderNeeded)) {
    const renderStart=diagnosticSample?performance.now():0;
    if(diagnosticSample)diagnostics.timer.begin(diagnosticSample);
    try { flight.render(dt); } finally { if(diagnosticSample)diagnostics.timer.end(); }
    if(diagnosticSample)diagnosticSample.renderMs=performance.now()-renderStart;
    pauseRenderNeeded = false;
  }
  pauseMenu?.update();
  fpvOsd.update(playing && !paused && !flight.chase, flight?.cameraRig.quaternion);
  updateFps(now, playing && (!paused || onlineLive));
  if(diagnosticSample)diagnostics.record(diagnosticSample,performance.now()-frameStart,{
    map:flight.map.id,drone:flight.config.id,view:flight.view,position:[...flight.physics.pose.p],
  });
  requestAnimationFrame(frame);
}
function bindUI() {
  diagnostics=new FrameDiagnostics($('#performance-panel'),fpsLabel,flight.renderer,t);
  fullscreen = bindFullscreen(t, notice);
  for (const b of document.querySelectorAll("[data-tab]"))
    b.onclick = () => {
      if (b.dataset.tab === "multiplayer") {
        if (room) { panel(room.phase === "finished" || room.players.find(p=>p.id===network.id)?.finished ? "results" : "lobby"); return; }
        panel("multiplayer");
        refreshRooms();
      } else {
        panel(b.dataset.tab);
      }
    };
  $("#language").onchange = async (e) => {
    const { setLanguage } = await import("./lang.js");
    await setLanguage(e.target.value);
  };
  $("#launch").onclick = launch;
  $("#create-room").onclick = createRoom;
  $("#resume").onclick = resume;
  $("#menu-button").onclick = pause;
  pauseMenu = new PauseMenu(t, {
    resume,
    reset: () => { resetAircraft(); resume(); },
    leave: endFlight,
  }, () => ({
    online: !!room,
    description: `${t("map." + flight.map.id)} · ${flight.config.name} · ${flight.physics.mode.toUpperCase()}` + (room ? ` · ${room.code}` : ""),
    canReset: !room || (room.phase === "flying" && !room.players.find(p=>p.id===network.id)?.finished),
  }));
  flightHelp = new FlightHelp(t, flightHelpContent);
  $("#hud-mode").onclick = () => { action("mode"); hud(); document.activeElement?.blur(); };
  for (const [id, kind] of [["arm-state", "arm"], ["hud-reset", "reset"], ["hud-view", "view"], ["hud-turtle", "turtle"]])
    $("#" + id).onclick = () => { action(kind); hud(); document.activeElement?.blur(); };
  $("#binding-cancel").onclick = () => {
    controller.bindings.reset(); controller.bindings.result = null; renderInputUI();
  };
  $("#radio-preset").onchange = (event) => {
    controller.applyPreset(event.target.value); renderInputUI();
  };
  $("#radio-device").onchange = (event) => {
    controller.deviceId = event.target.value; controller.clear(); controller.save();
  };
  $("#radio-recommend").onclick = () => { controller.applyPreset("auto"); renderInputUI(); };
  $("#stick-setup-start").onclick = () => { controller.startStickSetup(); renderInputUI(); };
  $("#stick-setup-next").onclick = () => {
    if (controller.advanceStickSetup() && !controller.setup) $("#calibration-status").textContent = t("settings.saved");
    renderInputUI();
  };
  $("#stick-setup-cancel").onclick = () => { controller.setup = null; controller.bindings.reset(); renderInputUI(); };
  $("#session").onchange = () => {
    write("solo-session", $("#session").value);
    updateSessionOptions();
  };
  $("#room-kind").value = read("room-kind", "free");
  $("#room-kind").onchange = () => { write("room-kind", $("#room-kind").value); updateSessionOptions(); };
  $("#public-room").checked = read("public-room", true);
  $("#public-room").onchange = () => write("public-room", $("#public-room").checked);
  $("#session").value = read("solo-session", "free");
  if (!$("#session").value) $("#session").value = "free";
  updateSessionOptions();
  $("#race-route").onchange = () => {
    const routeId = $("#race-route").value;
    if (routeId) {
      map = resolveRoute(catalog.maps.find(m => m.id === map.id), routeId);
      write("selected-race-" + map.id, map.routeId);
    }
    if ($("#menu").dataset.panel === "multiplayer") {
      $("#room-kind").value = routeId ? "race" : "free";
      write("room-kind", $("#room-kind").value);
    } else {
      if (!routeId) $("#session").value = "free";
      else if (!isTimedSession($("#session").value)) $("#session").value = "time";
      write("solo-session", $("#session").value);
    }
    updateSessionOptions(); refreshCatalogText();
  };
  $("#nickname").value = read("nickname", "Pilot");
  $("#nickname").onchange = () => {
    write("nickname", $("#nickname").value);
    network.name = $("#nickname").value;
    network.send("rename", { name: network.name });
  };
  $("#refresh-rooms").onclick = refreshRooms;
  $("#room-code").oninput = () => {
    $("#room-code").value = $("#room-code").value.toUpperCase().replace(/[^A-Z0-9]/g, ""); updateStatus();
  };
  $("#join-room").onclick = () => requestRoom("join", { code: $("#room-code").value.trim().toUpperCase() });
  $("#room-code").onkeydown = (event) => {
    if (event.key === "Enter" && !$("#join-room").disabled) { event.preventDefault(); $("#join-room").click(); }
  };
  $("#ready").onclick = () =>
    network.send("ready", {
      ready: !room.players.find((p) => p.id === network.id)?.ready,
    });
  $("#start-room").onclick = () => {
    if (room?.phase === "lobby" && room.host === network.id && room.players.every(p => p.ready && p.connected !== false))
      void fullscreen?.enterFlight();
    network.send("start");
  };
  $("#leave-room").onclick = () => network.send("leave");
  $("#results-leave").onclick = () => network.send("leave");
  for (const id of ["results-restart", "restart-room"]) $("#"+id).onclick = () => network.send("restart");
  $("#finish-room").onclick = () => network.send("finish");
  $("#cancel-reconnect").onclick = () => { network.cancelRecovery(); updateStatus(); };
  $("#leave-flight").onclick = endFlight;
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
  function camera(saveProfile=false) {
    if(saveProfile){
      cameraProfiles.set($('#camera-drone').value,{angle:Number($('#camera-angle').value),fov:Number($('#camera-fov').value)});
      write('camera-profiles',cameraProfiles.profiles);
    }
    cameraSettings.sound = $("#sound").checked;
    cameraSettings.horizon = $("#fpv-horizon-toggle").checked;
    cameraSettings.analog = $("#analog-video-toggle").checked;
    $('#angle-output').textContent=$('#camera-angle').value+'°';$('#fov-output').textContent=$('#camera-fov').value+'°';
    applyAircraftCamera();
    pauseRenderNeeded = true;
    flight.soundEnabled = cameraSettings.sound;
    fpvOsd.setSettings(cameraSettings);
    $("#fpv-horizon").setAttribute("aria-label", t("settings.horizon"));
    write("camera", cameraSettings);
  }
  for(const d of catalog.drones)cameraProfiles.set(d.id,cameraProfiles.get(d.id));
  write('camera-profiles',cameraProfiles.profiles);renderCameraProfile(config.id);
  $('#camera-drone').onchange=()=>renderCameraProfile($('#camera-drone').value);
  $('#camera-all').onclick=()=>{
    const p=cameraProfiles.get($('#camera-drone').value);for(const d of catalog.drones)cameraProfiles.set(d.id,p);
    write('camera-profiles',cameraProfiles.profiles);applyAircraftCamera();notice(t('settings.saved'));
  };
  $('#camera-reset').onclick=()=>{cameraProfiles.set($('#camera-drone').value,DEFAULT_CAMERA_PROFILE);write('camera-profiles',cameraProfiles.profiles);renderCameraProfile($('#camera-drone').value);applyAircraftCamera();};
  $("#sound").checked = cameraSettings.sound;
  $("#fpv-horizon-toggle").checked = cameraSettings.horizon === true;
  $("#analog-video-toggle").checked = cameraSettings.analog === true;
  for(const s of ['#camera-angle','#camera-fov'])$(s).oninput=()=>camera(true);
  for (const s of ["#sound", "#fpv-horizon-toggle", "#analog-video-toggle"])$(s).oninput=()=>camera();
  camera();
  for (const s of ["#records-route", "#records-drone", "#records-mode"])
    $(s).onchange = showRecords;
  $("#records-map").onchange = () => { refreshRecordRoutes(); showRecords(); };
  $("#records-refresh").onclick = showRecords;
  window.addEventListener("languagechange", () => {
    $("#fpv-horizon").setAttribute("aria-label", t("settings.horizon"));
    refreshColors();
    refreshSimulationControls();
    refreshCatalogText();
    renderRates();
    renderKeys();
    renderRooms();
    renderLobby();
    renderResults();
    updateStatus();
    refreshSessionBanner();
    flightHelp?.update(true);
    pauseMenu?.update();
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
