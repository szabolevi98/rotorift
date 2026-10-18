import { initLanguage, t } from "./lang.js";
import { CatalogSelect } from "./catalog-select.js";
import { RouteDetails } from './route-details.js';
import { SettingsTabs } from "./settings-tabs.js";
import { mapPresentation } from "/shared/catalog/maps.js";
import { read, write } from "./storage.js";
import { Controller } from "./input/controller.js";
import { TouchSticks } from "./input/touch-sticks.js";
import { AutoArm } from "./input/auto-arm.js";
import { Network } from "./net/client.js";
import { Preview } from "./game/preview.js";
import { Flight } from "./game/flight.js";
import { LoadingScreen, paintLoading } from "./loading.js";
import { FlightHelp } from "./game/flight-help.js";
import { PauseMenu } from "./game/pause-menu.js";
import { armPrompt } from "./game/arm-prompt.js";
import { FpvOsd } from "./game/fpv-osd.js";
import { PropellerHud } from "./game/propeller-hud.js";
import { SplitDeltaHud } from "./game/split-delta.js";
import { CameraProfiles, DEFAULT_CAMERA_PROFILE } from './game/camera-profiles.js';
import { FrameDiagnostics } from './game/frame-diagnostics.js';
import { GhostSelection, savePersonalGhost, ghostKey } from './game/ghost-selection.js';
import { LapGhostRecorder } from '/shared/race/ghost.js';
import { raceCategoryKey } from '/shared/race/category.js';
import { PHYSICS_DT } from '/shared/physics/drone.js';
import { validPropellers } from "/shared/physics/propellers.js";
import { bindFullscreen } from "./fullscreen.js";
import { RadioGuide } from "./input/radio-guide.js";
import { RADIO_ACTIONS, availableBindings, bindingKey, parseBinding } from "./input/action-bindings.js";
import { RADIO_PRESETS } from "./input/radio-profiles.js";
import { simulationView, activeMenuTab, flightSimulationActive } from "./menu-state.js";
import { defaultRates, validRate, actualRate } from "/shared/physics/rates.js";
import { hoverThrottle } from "/shared/physics/propulsion.js";
import { newLap, advanceLap, clearLapReference } from "/shared/race/gates.js";
import { resolveRoute } from "/shared/race/routes.js";
import { canRace, isTimedSession, withoutRaceRoute } from "/shared/race/map-modes.js";
import { DRONE_COLORS, normalizeDroneColor } from "/shared/visual/drone-colors.js";
import {isFixedWing,aircraftModes,aircraftCapabilities,aircraftSimulation,supportsMap,aircraftRoutes,routeSupportsAircraft} from '/shared/aircraft/capabilities.js';
import {allAircraft} from '/shared/catalog/aircraft.js';
import {groundLaunchAvailable} from '/shared/aircraft/launch.js';
import {routePreferenceKey,selectAircraftRoute} from './aircraft-menu.js';
import { DEFAULT_SIMULATION, WIND_LEVELS, normalizeSimulation, simulationKey } from "/shared/simulation/options.js";
const $ = (s) => document.querySelector(s),
  node = (tag, cls = "", text = "") => {
    const e = document.createElement(tag);
    e.className = cls;
    e.textContent = text;
    return e;
  };
const visible = (selector, on) => $(selector).classList.toggle("hidden", !on);
function mapName(value) {
  const item = typeof value === 'string' ? catalog?.maps.find(m => m.id === value) ?? value : value;
  return t(mapPresentation(item).nameKey);
}
const loading = new LoadingScreen(t);
const routeDetails = new RouteDetails($('#route-summary'), t);
const autoArm = new AutoArm(read("auto-arm", true) !== false);
const fpvOsd = new FpvOsd($("#fpv-horizon"));
const propellerHud = new PropellerHud($("#damage-hud"),t);
const splitDelta = new SplitDeltaHud($('#split-delta'),t);
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
let fullscreen, radioGuide, settingsTabs, pauseMenu, diagnostics, pauseRenderNeeded = false;
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
  dronePicker,
  mapPicker,
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
let ghostSelection;
let lapGhostLoad=0;
const localGhostRecorder=new LapGhostRecorder();
function menuGhostContext(){return {map,drone:config,mode:$('#flight-mode').value,simulation:aircraftSimulation(config,simulation)};}
function flightGhostContext(){return {map:flight.map,drone:flight.config,mode:flight.physics.mode,simulation:flight.physics.effects.options};}
function refreshGhostChoices(){
  if(ghostSelection&&map&&config)void ghostSelection.refresh(menuGhostContext(),($('#menu').dataset.panel??'fly')==='fly'&&isTimedSession($('#session').value)&&canRace(map));
}
async function configureLapGhost(){
  const generation=++lapGhostLoad;
  if(!(room?.kind==='hotlap'||!room&&session==='time')){await flight.setLapGhost(null);return;}
  const version=flight.loadVersion,context=flightGhostContext();
  try{const value=await ghostSelection.load(context);if(version===flight.loadVersion&&generation===lapGhostLoad){await flight.setLapGhost(value);if(version===flight.loadVersion&&generation===lapGhostLoad)splitDelta.prepare(flight.lapGhost,flight.map.gates);}}
  catch{if(version===flight.loadVersion&&generation===lapGhostLoad){await flight.setLapGhost(null);notice(t('ghost.unavailable'));}}
}
function keepPersonalGhost(ms,replay){
  const context=flightGhostContext();
  if(savePersonalGhost(ghostKey(context),ms,replay)&&ghostSelection.choice(context)==='self')void configureLapGhost();
}
let resultsShown = null;
let resultsSignature = "";
let recordsVersion=0;
const roomKey = r => r ? r.code + ":" + (r.runId ?? r.startsAt) + ':' + (r.players.find(p=>p.id===network?.id)?.droneId ?? r.droneId) : null;
const mixedAircraftSetup = () => room?.mixedAircraft || $('#menu').dataset.panel === 'multiplayer' && $('#room-kind').value === 'free';
const aircraftChoice = () => ({droneId:config.id,mode:$('#flight-mode').value,launchMethod:'air'});
const touchInput = matchMedia("(hover: none) and (pointer: coarse)");
let roomsRefreshAt = 0;
const rateProfiles = read("rates", {}),
  cameraSettings = read("camera", { angle: 20, fov: 100, sound: true, horizon: true, analog: false });
const cameraProfiles=new CameraProfiles(read('camera-profiles',{}),cameraSettings);
function applyAircraftCamera(){
  const profile=cameraProfiles.get(flight?.config?.id??config?.id);flight?.setCameraSettings(profile.angle,profile.fov);
  if(isFixedWing(flight?.config)&&flight.physics){const saved=read('airplane-controls',{});flight.physics.controlProfile={...flight.config.controls,travel:Math.max(.2,Math.min(1,Number(saved.travel)||.7)),expo:Math.max(0,Math.min(.8,Number.isFinite(saved.expo)?saved.expo:.3))};}
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
          if (playing && !room && context === "solo") { flight.setSimulation(simulation); lap.invalid = true; clearLapReference(lap); localGhostRecorder.clear();void configureLapGhost(); }
        }
        refreshSimulationControls();refreshGhostChoices();
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
    const aircraft = id === 'lobby-simulation' && room
      ? catalog.aircraft.find(item => item.id === room.droneId) : config;
    const mixed = context === 'lobby' ? room?.mixedAircraft : context === 'host' && mixedAircraftSetup();
    for (const input of root.querySelectorAll("[data-sim-option]")) {
      const key = input.dataset.simOption;
      input.disabled = view.locked;
      if(!mixed&&['propDamage','propwash'].includes(key)&&!aircraftCapabilities(aircraft)[key]){input.disabled=true;input.parentElement.classList.add('hidden');continue;}
      input.parentElement.classList.toggle("hidden", key === "ghost" && !view.ghost);
      input.parentElement.querySelector("[data-sim-label]").textContent = t("simulation." + key);
      if (key === "wind") {
        input.value = view.options.wind;
        for (const option of input.options) option.textContent = t("wind." + option.value);
      } else input.checked = view.options[key];
    }
    const note = root.querySelector(".simulation-note");
    if (note) note.textContent = t(!mixed&&isFixedWing(aircraft)?'airplane.effects':view.note);
  }
}
function refreshColors() {
  for (const button of document.querySelectorAll("[data-drone-color]")) {
    button.setAttribute("aria-pressed", String(button.dataset.droneColor === droneColor));
    button.setAttribute("aria-label", t("color." + button.dataset.droneColor));
    button.disabled=!!room?.players.some(p=>p.id!==network.id&&p.color===button.dataset.droneColor);
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
  routeDetails.close();
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
  if(config&&map&&!supportsMap(config,map)&&!mixedAircraftSetup())selectMap('liget');
  else if(config)refreshCatalogText();
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
    `${mapName(flight.map.id)} · ${flight.config.name} · ${flightModeLabel(flight.physics.mode).toUpperCase()}` + (room ? ` · ${room.code}` : "");
}
function pause() {
  if (!playing || paused) return;
  flightHelp?.setOpen(false);
  void fullscreen?.enterMenu();
  paused = true;
  flight.active = flightSimulationActive(playing, paused, room, network.id);
  flight.physics.armed = false;
  flight.physics.setTurtleMode?.(false);
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
  autoArm.reset();
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
    if(!aircraftCapabilities(flight.config).turtle)return;
    if(flight.physics.armed){notice(t('hud.turtleDisarm'));return;}
    if(currentInput.throttle>.06){notice(t('hud.lowThrottle'));return;}
    if(room&&(room.phase!=='flying'||room.players.find(p=>p.id===network.id)?.finished))return;
    flight.physics.setTurtleMode(kind==='turtle'?!flight.physics.turtleMode:kind==='turtleOn');autoArm.cancel();flight.aircraftVisual.reset();hud();return;
  }
  if (["arm", "armOn", "armOff"].includes(kind)) {
    if(flight.physics.crashed){notice(t('airplane.crashed'));return;}
    const armed = kind === "armOn" || (kind === "arm" && !flight.physics.armed);
    if (armed && controller.usingRadio && !controller.radioReady) { notice(t("settings.radioMissing")); return; }
    if (armed && room && (room.phase !== "flying" || room.players.find((p) => p.id === network.id)?.finished)) return;
    if (armed && currentInput.throttle > 0.06) {
      notice(t("hud.lowThrottle"));
      return;
    }
    flight.physics.armed = armed;
    // A manual ARM/DISARM command takes precedence until reset or resume.
    autoArm.cancel();
    flight.startSound();
    hud();
  }
  if (kind === "hover" && aircraftCapabilities(flight.config).hover && !controller.usingRadio && !flight.physics.turtleMode)
    controller.keyboard.throttle = hoverThrottle(flight.config);
  if (kind === "view" && !flight.preparingViews && !flight.cycleView()) notice(t('hud.pilotUnavailable'));
  if (kind === "reset") resetAircraft();
  if (kind === "mode") {
    const modes=aircraftModes(flight.config),next=modes[(modes.indexOf(flight.physics.mode)+1)%modes.length];
    if (room) { if (room.phase === "flying") network.send("mode", {mode: next}); }
    else { $("#flight-mode").value = next; flight.physics.mode = next; lap.invalid = true; clearLapReference(lap); }
    if(!room){localGhostRecorder.clear();void configureLapGhost();}
  }
}
function resetAircraft() {
  localGhostRecorder.clear();
  controller.clear(); lap = newLap(lap); splitDelta.hide();
  if (room) { autoArm.cancel(); network.send("reset"); }
  else { flight.reset(); autoArm.reset(); }
}
function recordKey(
  m = flight.map,
  c = flight.config,
  mode = flight.physics.mode,
  options = flight.physics?.effects.options ?? simulation,
) {
  return raceCategoryKey(m,c,mode,options);
}
function saveLocal(ms) {
  const records = read("records", {}),
    key = recordKey();
  records[key] = Math.min(ms, records[key] ?? Infinity);
  write("records", records);
}
function flightModeLabel(mode) {
  return ['manual','stabilized'].includes(mode)?t('airplane.'+mode):mode[0].toUpperCase()+mode.slice(1);
}
async function selectDrone(id) {
  const previous = config;
  config =
    catalog.aircraft.find((d) => d.id === id) ??
    catalog.aircraft.find((d) => d.id === "rift-x5");
  write("selected-drone", config.id);
  renderKeys();
  const modes=aircraftModes(config),priorMode=$('#flight-mode').value;
  $('#flight-mode').replaceChildren(...modes.map(mode=>new Option(flightModeLabel(mode),mode)));
  if(modes.includes(priorMode))$('#flight-mode').value=priorMode;
  visible('#airplane-note',isFixedWing(config));visible('#airplane-controls',isFixedWing(config));
  if(isFixedWing(config)){const saved=read('airplane-controls',{});for(const [key,fallback]of [['travel',70],['expo',30]]){const value=Number.isFinite(saved[key])?Math.round(saved[key]*100):fallback;$('#airplane-'+key).value=value;$('#airplane-'+key+'-output').textContent=value+'%';}}
  if(isFixedWing(config)&&map?.kind==='playground'&&!mixedAircraftSetup())selectMap('liget');
  selectMap(map?.id??catalog.maps[0].id);
  const selected = config, task = loading.begin("loading.model", { name: selected.name }, { overlay: !!preview.model });
  try {
    await paintLoading();
    await preview.select(selected, task.progress);
    if(config===selected)renderCameraProfile(selected.id);
    preview.render();
    refreshGhostChoices();
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
  if(!mixedAircraftSetup()&&isFixedWing(config)&&catalog.maps.find(m=>m.id===id)?.kind==='playground')id='liget';
  const base = catalog.maps.find((m) => m.id === id) ?? catalog.maps[0];
  map = selectAircraftRoute(base,config,read(routePreferenceKey(base,config),base.routeId));
  fillRoutes($("#race-route"), base, map.routeId);
  write("selected-map", map.id);
  updateSessionOptions();
  refreshCatalogText();
}
function fillRoutes(select, base, selected = base?.routeId, allowNone = false, aircraft=config) {
  select.replaceChildren(...aircraftRoutes(base,aircraft).map(route => new Option(route.name, route.id)));
  if (allowNone) select.prepend(new Option(t("fly.noRoute"), ""));
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
  select.disabled = !select.options.length;
}
function refreshRecordRoutes() {
  const aircraft=catalog.aircraft.find(d=>d.id===$('#records-drone').value);
  fillRoutes($("#records-route"), catalog.maps.find(m => m.id === $("#records-map").value),undefined,false,aircraft);
  for(const option of $('#records-mode').options)option.disabled=option.value!=='all'&&!aircraftModes(aircraft).includes(option.value);
  if($('#records-mode').selectedOptions[0]?.disabled)$('#records-mode').value='all';
}
function updateSessionOptions() {
  const enabled = canRace(map)&&aircraftCapabilities(config).racing;
  for (const option of $("#session").options)
    option.disabled = !enabled && isTimedSession(option.value);
  if (!enabled && isTimedSession($("#session").value))
    $("#session").value = "free";
  for (const option of $("#room-kind").options) option.disabled = !enabled && option.value === "race";
  if (!enabled && $("#room-kind").value === "race") $("#room-kind").value = "free";
  const timed = $("#menu").dataset.panel === "multiplayer" ? $("#room-kind").value === "race" : isTimedSession($("#session").value);
  fillRoutes($("#race-route"), catalog.maps.find(m => m.id === map.id), timed ? map.routeId : "", true);
  visible(".race-row", true);
  visible("#map-mode-note", !enabled&&!isFixedWing(config));
  const launchVisible=aircraftCapabilities(config).launchModes.length>1&&!timed;
  visible('#aircraft-launch-label',launchVisible);
  const ground=$('#aircraft-launch option[value="ground"]');ground.disabled=!groundLaunchAvailable(config,map);
  if(ground.disabled)$('#aircraft-launch').value='air';
  refreshRouteDetails();
  refreshSimulationControls();
  refreshMenuNavigation();
  refreshGhostChoices();
}
function refreshRouteDetails() {
  const selected = $('#race-route').value;
  routeDetails.update(catalog?.maps.find(item => item.id === map?.id)?.routes.find(route => route.id === selected), catalog?.aircraft ?? []);
}
function refreshCatalogText() {
  if (map) $("#map-preview-link").href = "/showcase/?tab=maps&" + new URLSearchParams({ map: map.id, route: map.routeId });
  dronePicker.update(catalog.aircraft.map(d => ({value:d.id,label:d.name,detail:t("drone." + d.id)})), config?.id);
  mapPicker.update(catalog.maps.filter(m=>mixedAircraftSetup()||supportsMap(config,m)).map(m => ({value:m.id,label:mapName(m),detail:t(mapPresentation(m).audienceKey)})), map?.id);
  for(const option of $('#flight-mode').options)option.textContent=flightModeLabel(option.value);
  if (config) {
    $("#selected-name").textContent = config.name;
    $("#selected-description").textContent = t("drone." + config.id);
    $("#model-number").textContent = "R / " + config.name.replace("Rift ", "").replace("Aero ", "A");
    const specs = $("#drone-specs");
    specs.replaceChildren();
    for (const [value, label] of [
      [Math.round(config.massKg * 1000) + " g", "mass"],
      [
        config.battery.cells + "S / " + config.battery.capacityMah + " mAh",
        "battery",
      ],
      [Math.round((config.wingspanM??config.motorDiagonalM) * 1000) + " mm", isFixedWing(config)?"wingspan":"diagonal"],
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
    for (const o of $(s).options) o.textContent = mapName(o.value);
  const noRoute = $("#race-route").querySelector('option[value=""]');
  if (noRoute) noRoute.textContent = t("fly.noRoute");
  refreshRouteDetails();
}
function createCatalogUI() {
  dronePicker = new CatalogSelect($("#drone-picker"), "drone-picker-label", t,
    id => selectDrone(id).catch(() => notice(t("error.requestFailed"))));
  mapPicker = new CatalogSelect($("#map-picker"), "map-picker-label", t, selectMap);
  for (const [id,hex] of Object.entries(DRONE_COLORS)) {
    const button=node("button", "drone-color-swatch"); button.type="button"; button.dataset.droneColor=id;
    const dot=node("i"); dot.style.setProperty("--pilot-color",hex); dot.setAttribute("aria-hidden","true");
    button.append(dot); button.onclick=()=>setDroneColor(id); $("#drone-color-picker").append(button);
  }
  refreshColors();
  for (const d of catalog.aircraft) {
    for (const select of ["#rates-drone", "#rates-target", "#records-drone", "#camera-drone"])
      if(aircraftCapabilities(d).rateProfiles||!['#rates-drone','#rates-target'].includes(select))$(select).append(new Option(d.name, d.id));
  }
  for (const m of catalog.maps) {
    $("#records-map").append(new Option(mapName(m), m.id));
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
    config?.id,
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
    if(isFixedWing(config)&&['turtle'].includes(name))continue;
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
    if(isFixedWing(config)&&['turtle','hover'].includes(action))continue;
    const row = node("div", "key-row"),
      i = node("input");
    i.readOnly = true;
    i.value = keyName(code);
    i.setAttribute("aria-label", t("key." + action));
    i.onkeydown = (e) => {
      if (e.code === "Tab") return;
      e.preventDefault();
      e.stopPropagation();
      if (["ShiftLeft", "ShiftRight"].includes(e.code)) return;
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
    : t(controller.pad ? "input.keyboard" : touchInput.matches && !controller.pads.length ? 'input.touchAvailable' : "input.noRadio");
  $("#input-status").textContent = text;
  $("#radio-name").textContent = controller.pad?.id ?? t(touchInput.matches && !controller.pads.length ? 'input.touchAvailable' : "input.noRadio");
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
    button.onclick = () => requestRoom("join", { code: r.code, ...aircraftChoice() });
    button.disabled = !network?.ready || !!roomRequest || r.players >= 8;
    const summary = node("div", "room-summary");
    summary.append(node("strong", "", r.code), node("span", "", mapName(r.mapId) + " · " + t(r.kind === "race" ? "online.raceKind" : "session.free") + " · " + r.players + "/8"));
    summary.append(node("span", "", r.mixedAircraft ? t('online.mixedAircraft') : (catalog.aircraft.find(drone => drone.id === r.droneId)?.name ?? r.droneId) + " · " + flightModeLabel(r.mode).toUpperCase() + (r.kind === "race" && r.routeName ? " · " + r.routeName : "")));
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
    mode: $("#flight-mode").value, kind, public: $("#public-room").checked, simulation:kind==='free'?simulation:aircraftSimulation(config,simulation),launchMethod:$("#aircraft-launch").value });
}
function endFlight() {
  if (room) { network.send("leave"); return; }
  pauseMenu?.setOpen(false);
  void fullscreen?.enterMenu();
  playing = false; paused = true; flight.active = false;
  if (flight.physics) flight.physics.armed = false;
  flight.mute(); controller.clear(); lap.invalid = true;
  localGhostRecorder.clear();lapGhostLoad++;void flight.setLapGhost(null);
  visible("#hud", false); visible("#menu", true); panel("fly");
}
let lobbyAircraftSignature = '';
function renderLobbyAircraft(own) {
  visible('#lobby-aircraft-setup', !!room.mixedAircraft);
  if(!room.mixedAircraft || !own)return;
  const aircraft=catalog.aircraft.find(d=>d.id===own.droneId),select=$('#lobby-aircraft');
  const signature=[room.code,own.droneId,own.mode,own.launchMethod,room.phase,document.documentElement.lang].join('|');
  if(signature===lobbyAircraftSignature)return;
  lobbyAircraftSignature=signature;
  select.replaceChildren(...catalog.aircraft.map(d=>new Option(d.name+' · '+t('drone.'+d.id),d.id)));
  select.value=own.droneId;
  $('#lobby-mode').replaceChildren(...aircraftModes(aircraft).map(mode=>new Option(flightModeLabel(mode),mode)));
  $('#lobby-mode').value=own.mode;
  const launch=$('#lobby-launch');
  launch.value=own.launchMethod??'air';
  launch.querySelector('[value="ground"]').disabled=!groundLaunchAvailable(aircraft,catalog.maps.find(m=>m.id===room.mapId));
  visible('#lobby-launch-label',isFixedWing(aircraft));
  for(const input of [select,$('#lobby-mode'),launch])input.disabled=room.phase!=='lobby';
}
function changeLobbyAircraft() {
  const own=room?.players.find(p=>p.id===network.id);
  if(!room?.mixedAircraft || room.phase!=='lobby' || !own)return;
  const aircraft=catalog.aircraft.find(d=>d.id===$('#lobby-aircraft').value),modes=aircraftModes(aircraft);
  const mode=modes.includes($('#lobby-mode').value)?$('#lobby-mode').value:modes[0];
  const launchMethod=isFixedWing(aircraft)&&groundLaunchAvailable(aircraft,catalog.maps.find(m=>m.id===room.mapId))?$('#lobby-launch').value:'air';
  network.send('aircraft',{droneId:aircraft.id,mode,launchMethod});
}
function renderLobby() {
  if (!room) return;
  $("#lobby-code").textContent = room.code;
  $("#lobby-description").textContent =
    mapName(room.mapId) +
    " · " +
    (room.mixedAircraft ? t('online.mixedAircraft') : catalog.aircraft.find((d) => d.id === room.droneId)?.name + " · " + flightModeLabel(room.mode).toUpperCase()) + (room.kind !== "free" && room.route?.name ? " · " + room.route.name : "");
  $("#lobby-players").replaceChildren();
  for (const p of room.players) {
    const row = node("div", "player-row");
    row.append(
      pilotName(p, p.name + (p.id === room.host ? " / " + t("online.host") : "")),
      node('span','player-aircraft',(catalog.aircraft.find(d=>d.id===(p.droneId??room.droneId))?.name??'')+' · '+flightModeLabel(p.mode).toUpperCase()),
      node("span", "", p.connected === false ? t("online.pilotReconnecting") : room.phase === "lobby" ? t(p.ready ? "online.ready" : "online.notReady")
        : t(p.finished ? "results.finished" : room.phase === "finished" ? "results.dnf" : "results.racing")),
    );
    $("#lobby-players").append(row);
  }
  const own = room.players.find((p) => p.id === network.id);
  renderLobbyAircraft(own);
  $("#lobby-status").textContent = t(room.phase === "lobby" ? "online.readyHint" : room.phase === "finished" ? "online.finished" : "online.inProgress");
  $("#ready").textContent = t(own?.ready ? "online.notReady" : "online.ready");
  $("#ready").disabled = room.phase !== "lobby";
  $("#ready").classList.toggle("needs-ready", room.phase === "lobby" && !own?.ready);
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
  $("#results-code").textContent = room.code + " · " + mapName(room.mapId);
  $("#results-description").textContent = [room.route?.name, catalog.aircraft.find(d=>d.id===room.droneId)?.name].filter(Boolean).join(" · ");
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
  const task = loading.begin("loading.flight", { name: mapName(r.mapId) });
  const own = r.players.find(p=>p.id===network.id);
  const roomConfig = catalog.aircraft.find((d) => d.id === (own?.droneId ?? r.droneId));
  const baseMap = catalog.maps.find((m) => m.id === r.mapId);
  const roomMap = r.kind === "free" ? withoutRaceRoute(baseMap) : r.route ? { ...baseMap, routeId: r.route.id ?? baseMap.routeId, routeName: r.route.name,
    routeVersion: r.route.version, spawn: r.route.spawn, gates: r.route.gates, guide:r.route.guide,aircraftKinds:r.route.aircraftKinds } : resolveRoute(baseMap, r.routeId);
  session = "online-" + r.kind;
  flightHelp?.setOpen(false);
  $("#flight-mode").value = own?.mode ?? r.mode;
  try {
    if(config.id!==roomConfig.id)await selectDrone(roomConfig.id);
    await paintLoading();
    diagnostics?.reset();
    const loaded = await flight.load(roomMap, roomConfig, rates(roomConfig.id), own?.mode ?? r.mode, own?.color ?? droneColor, aircraftSimulation(roomConfig,r.simulation), task.progress,{launchMethod:own?.launchMethod ?? r.launchMethod});
    if (loaded === false) return;
    applyAircraftCamera();
    renderCameraProfile(roomConfig.id);
    await configureLapGhost();
    if (await flight.prepareViews({analog:cameraSettings.analog === true}) === false) return;
    if (roomKey(room) !== key || room.phase === "lobby" || room.phase === "finished" || room.players.find(p=>p.id===network.id)?.finished) {
      flight.active = false;
      if (!room) void fullscreen?.enterMenu();
      return;
    }
    flight.reset(
      room.players.find((p) => p.id === network.id)?.p ?? roomMap.spawn, room.players.find(p=>p.id===network.id),
    );
    autoArm.reset();
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
    refreshColors();
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
    flight.reset(m.pose.p,m.pose);
    autoArm.reset();
    controller.clear();
    if (m.reason === "boundary") notice(t("hud.boundaryReset"));
  }
  if (m.type === "lap" && (!m.runId || m.runId === room?.runId)) {
    if(m.valid&&m.replay)keepPersonalGhost(m.ms,m.replay);
    notice(
      m.valid
        ? t(m.saved ? "hud.saved" : "hud.localLap", { time: time(m.ms) })
        : t("hud.invalid"),
    );
  }
  if (m.type === "disconnected") {
    clearRoomRequest();
    flight.updateRemotes([], network.id);
    if (room) {
      pause();
      notice(t("online.disconnected"));
      room = null;
      refreshColors();
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
    const assignedColor=room.players.find(p=>p.id===network.id)?.color;
    if(assignedColor && assignedColor!==droneColor){droneColor=assignedColor;write('drone-color',droneColor);preview.setColor(droneColor);flight.setColor(droneColor);network.color=droneColor;}
    refreshColors();
    if (flight.physics && loadedRoom === roomKey(room)) {
      const options=aircraftSimulation(flight.config,room.simulation);
      if (simulationKey(flight.physics.effects.options) !== simulationKey(options)) flight.setSimulation(options);
      const own = room.players.find(p => p.id === network.id);
      if (own?.mode) { const changed=flight.physics.mode!==own.mode;flight.physics.mode = own.mode; $("#flight-mode").value = own.mode;if(changed)void configureLapGhost(); }
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
      simulation:aircraftSimulation(config,simulation),
      launchMethod:$("#aircraft-launch").value,
    });
    return;
  }
  launching = true;
  $("#launch").disabled = true;
  // Start from the launch click, before loading consumes its user activation.
  void fullscreen?.enterFlight();
  const task = loading.begin("loading.flight", { name: mapName(map.id) });
  try {
    await paintLoading();
    diagnostics?.reset();
    if (await flight.load(isTimedSession(session) ? map : withoutRaceRoute(map), config, rates(config.id), $("#flight-mode").value, droneColor, aircraftSimulation(config,simulation), task.progress,{launchMethod:$("#aircraft-launch").value}) === false) return;
    applyAircraftCamera();
    await configureLapGhost();
    if (await flight.prepareViews({analog:cameraSettings.analog === true}) === false) return;
    lap = newLap();
    localGhostRecorder.clear();
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
  const version=++recordsVersion;
  const m = resolveRoute(catalog.maps.find((v) => v.id === $("#records-map").value), $("#records-route").value || undefined),
    c = catalog.aircraft.find((v) => v.id === $("#records-drone").value),
    mode = $("#records-mode").value,
    root = $("#records-body");
  const recordSimulation=aircraftSimulation(c,simulation);
  root.replaceChildren();
  if (!canRace(m) || !routeSupportsAircraft(m,c)) {
    root.append(node("p", "muted", t("error.raceUnavailable")));
    return;
  }
  root.append(
    node("h2", "", t("records.local")),
    node("p", "muted", time(mode === 'all' ? Math.min(...aircraftModes(c).map(value=>read('records',{})[recordKey(m,c,value,recordSimulation)]??Infinity)) : read("records", {})[recordKey(m, c, mode, recordSimulation)])),
    node("p", "muted", t("simulation.recordsHint")),
  );
  root.append(node("h2", "", t("records.online")));
  try {
    const res = await fetch(
      "/api/leaderboard?" +
        new URLSearchParams({ map: m.id, route: m.routeId, drone: c.id, mode, simulation: simulationKey(recordSimulation) }),
    );
    if (!res.ok) throw Error("Leaderboard unavailable");
    const data = await res.json();
    if(version!==recordsVersion)return;
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
          node("span", "record-mode", flightModeLabel(r.mode ?? mode).toUpperCase()),
          node("b", "", time(r.ms)),
        );
        root.append(row);
        if(i<10&&r.hasGhost){
          const choose=node('button','secondary small',t('ghost.choose'));
          choose.onclick=async()=>{
            const recordMode=r.mode??mode,context={map:m,drone:c,mode:recordMode,simulation:recordSimulation};ghostSelection.choose(context,r.ghostId);
            selectMap(m.id);map=m;write(routePreferenceKey(m,c),m.routeId);
            await selectDrone(c.id);$('#flight-mode').value=recordMode;$('#session').value=network.ready?'online-hotlap':'time';
            write('solo-session',$('#session').value);panel('fly');refreshCatalogText();
          };
          row.append(choose);
        }else if(i<10)row.append(node('small','muted',t('ghost.missing')));
      });
  } catch {
    if(version!==recordsVersion)return;
    root.append(node("p", "muted", t("records.unavailable")));
  }
}
function hud() {
  if (!playing || !flight.physics) { splitDelta.update(); return; }
  const p = flight.physics.pose,
    own = room?.players.find((p) => p.id === network.id),
    currentLap = own?.lap ?? lap;
  visible('#lap-ghost-hud',!!flight.lapGhost?.replay);
  if(flight.lapGhost?.replay)$('#lap-ghost-hud').textContent=t('ghost.hud',{name:flight.lapGhost.label,time:time(flight.lapGhost.replay.frames.at(-1)[0])});
  $("#arm-state").textContent = t(
    flight.physics.armed ? "hud.disarmAction" : "hud.armAction",
  );
  $("#arm-state").classList.toggle("armed", flight.physics.armed);
  $("#arm-state").setAttribute("aria-pressed", String(flight.physics.armed));
  $("#arm-state").setAttribute("aria-label", t(flight.physics.armed ? "hud.disarmAction" : "hud.armAction"));
  $("#arm-state").disabled = flight.physics.crashed || !flight.physics.armed && !!room && (room.phase !== "flying" || own?.finished);
  $('#hud-turtle').setAttribute('aria-pressed',String(flight.physics.turtleMode));
  visible('#hud-turtle',!isFixedWing(flight.config));
  visible('#airplane-hud',isFixedWing(flight.config));
  if(isFixedWing(flight.config))$('#airplane-hud').textContent=flight.physics.crashed?t('airplane.crashed'):t('airplane.airspeed',{speed:Math.round(flight.physics.airspeed*3.6)})+(flight.physics.stall>.5?' · '+t('airplane.stall'):'');
  $('#hud-turtle').classList.toggle('selected',flight.physics.turtleMode);
  $('#hud-turtle').disabled=flight.physics.armed||!!room&&(room.phase!=='flying'||own?.finished);
  visible('#turtle-hud',flight.physics.turtleMode);
  $('#turtle-hud').textContent=t(flight.physics.armed?'hud.turtleActive':'hud.turtleReady');
  const configuredArm = controller.profile.actions?.arm;
  const armBinding = controller.usingRadio && configuredArm &&
    availableBindings(controller.pad, controller.profile).some(binding => bindingKey(binding) === bindingKey(configuredArm))
    ? configuredArm : null;
  const prompt = armPrompt({
    armed: flight.physics.armed, canArm: !flight.physics.crashed && (!room || (room.phase === "flying" && !own?.finished)),
    radio: controller.usingRadio, radioReady: controller.radioReady, mobile: touchInput.matches,
    lowThrottle: input.throttle <= 0.06, binding: armBinding,
    autoArm: autoArm.active, autoArmReady: autoArm.lowSeen,
    throttleControl: keyName(controller.keys.throttleUp),
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
  visible('#pilot-camera-tools',flight.view === 'pilot');
  $('#pilot-camera-fov').textContent = Math.round(flight.cameraRig.pilotFov)+'°';
  $('#pilot-camera-hint').textContent = t('hud.pilotHint');
  $('#pilot-zoom-in').setAttribute('aria-label',t('hud.zoomIn'));
  $('#pilot-zoom-out').setAttribute('aria-label',t('hud.zoomOut'));
  $("#hud-mode").textContent = flightModeLabel(flight.physics.mode).toUpperCase() + " ↻";
  $("#hud-mode").setAttribute("aria-label", t("hud.changeMode") + " · " + flightModeLabel(flight.physics.mode).toUpperCase());
  $("#hud-mode").title = t("hud.changeMode") + " · " + keyName(controller.keys.mode);
  $("#hud-mode").disabled = !!room && (room.phase !== "flying" || own?.finished);
  $("#hud-input").textContent = t(
    controller.usingRadio ? "settings.controller" : controller.usingTouch ? "input.touch" : "input.keyboard",
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
    mapName(flight.map.id) + " / " + flight.config.name;
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
  const ghostRequested = (room?.kind === 'hotlap' || !room && session === 'time') && ghostSelection.choice(flightGhostContext()) !== 'off';
  splitDelta.update({ lap: currentLap, gates: flight.map.gates, ghostRequested, ghost: flight.lapGhost,
    context: `${flight.loadVersion}:${roomKey(room)}:${own?.resetId ?? 0}:${flight.physics.mode}`,
    active: timed && !paused && !outside && (!room || room.phase === 'flying' && !own?.finished) });
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
          room.kind === "free" ? flightModeLabel(p.mode).toUpperCase() : p.lap.completed +
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
  const supported=action=>!isFixedWing(flight?.config)||!['turtle','hover'].includes(action);
  if (controller.usingTouch) return {
    source: t('input.touch'), note: t('hud.helpTouch'),
    rows: ['arm', 'reset', 'view', 'mode', 'turtle', 'menu'].filter(supported).map(action => [t('key.' + action), [t('hud.touchButton')]]),
  };
  const name = action => controller.keys[action] === "Space" ? t("hud.spaceKey") : keyName(controller.keys[action]);
  const rows = radio ? RADIO_ACTIONS.filter(supported).map(action => [t("key." + action),
    [controller.profile.actions?.[action] ? bindingLabel(controller.profile.actions[action]) : t("settings.unassigned")],
  ]) : [
    ...[["throttle", "throttleUp", "throttleDown"], ["pitch", "pitchForward", "pitchBack"],
      ["roll", "rollLeft", "rollRight"], ["yaw", "yawLeft", "yawRight"]]
      .map(([axis, ...actions]) => [t("axis." + axis), actions.map(name)]),
    ...["arm", "reset", "view", "mode", "turtle", "hover", "menu"].filter(supported).map(action => [t("key." + action), [name(action)]]),
    [t("hud.fineControl"), ["Shift"]],
  ];
  return { source: t(radio ? "settings.controller" : "input.keyboard"),
    note: t(isFixedWing(flight?.config)?'airplane.controlHint':radio ? "hud.helpRadio" : "hud.helpKeyboard"), rows };
}
function frame(now) {
  const frameStart=playing&&!paused?performance.now():0;
  const diagnosticSample=playing&&!paused&&!document.hidden&&flight.active&&!flight.preparingViews&&!loading.tasks.size?diagnostics?.begin(now):null;
  if(!diagnosticSample)diagnostics?.idle();
  if (!$("#menu").classList.contains("hidden") && $("#menu").dataset.panel === "multiplayer" && network.ready && !room && !roomRequest && now - roomsRefreshAt > 5000)
    refreshRooms();
  const elapsed = Math.max(0, (now - lastFrame) / 1000);
  const dt = Math.min(elapsed, 0.25);
  lastFrame = now;
  input = controller.poll(dt, { touchEnabled: touchInput.matches && playing && !paused && !document.hidden &&
    flight.active && !loading.tasks.size && (!room || room.phase === 'flying' && !room.players.find(p=>p.id===network.id)?.finished) });
  if (playing && flight.physics && autoArm.update({
    throttle: input.throttle, armed: flight.physics.armed, turtle: flight.physics.turtleMode,
    allowed: !flight.physics.crashed && !paused && !loading.tasks.size && flight.active &&
      (!room || room.phase === "flying" && !room.players.find(p=>p.id===network.id)?.finished),
    ready: !controller.range && !controller.setup && !controller.bindings.capture &&
      (!controller.usingRadio || controller.radioReady),
  })) {
    flight.physics.armed = true;
    flight.startSound();
    hud();
  }
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
        const events=advanceLap(
          lap,
          previous.p,
          current.p,
          previousTime,
          simTime,
          flight.map.gates,
        );
        const completed=localGhostRecorder.segment(previous,current,previousTime,simTime,events);
        for(const {event:e,replay}of completed)if(e.valid&&replay)keepPersonalGhost(e.ms,replay);
        for (const e of events)
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
      flight.aircraftVisual.networkState(flight.physics,paused),
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
  if(playing&&flight.lapGhost){
    const own=room?.players.find(p=>p.id===network.id),started=room?own?.lap.startedAt:lap.startedAt;
    const elapsed=started===null||started===undefined||!room&&lap.invalid?null:(room?network.now:simTime-PHYSICS_DT*1000+flight.accumulator*1000)-started;
    flight.lapGhost.update(paused?null:elapsed,flight.physics.pose.p,flight.canvas.clientWidth,flight.canvas.clientHeight);
  }
  if (!$("#settings-panel").classList.contains("hidden") && settingsTabs.selected === "radio") {
    radioGuide ??= new RadioGuide($("#radio-guide"), t);
    radioGuide.render(controller, now);
  }
  if (playing && !flight.preparingViews && (!paused || onlineLive || pauseRenderNeeded)) {
    const renderStart=diagnosticSample?performance.now():0;
    const programsBefore=diagnosticSample?flight.renderer.info.programs.length:0;
    if(diagnosticSample&&diagnostics.open)diagnostics.timer.begin(diagnosticSample);
    try { flight.render(dt, cameraSettings.analog === true && !paused && flight.fpv); } finally { if(diagnosticSample&&diagnostics.open)diagnostics.timer.end(); }
    if(diagnosticSample){
      diagnosticSample.renderMs=performance.now()-renderStart;
      diagnosticSample.newPrograms=Math.max(0,flight.renderer.info.programs.length-programsBefore);
    }
    pauseRenderNeeded = false;
  }
  pauseMenu?.update();
  fpvOsd.update(playing && !paused && flight.fpv, flight?.cameraRig.quaternion);
  updateFps(now, playing && (!paused || onlineLive));
  if(diagnosticSample){
    const pose=flight.physics.pose;
    diagnostics.record(diagnosticSample,performance.now()-frameStart,{
      map:flight.map.id,drone:flight.config.id,view:flight.view,position:[...pose.p],
      velocity:[...pose.v],rotation:{...pose.q},angularVelocity:[...pose.w],totalColliders:flight.world.colliders.len(),
    });
  }
  requestAnimationFrame(frame);
}
function bindUI() {
  settingsTabs = new SettingsTabs($("#settings-panel"), {
    selected: read("settings-tab", "controls"),
    onChange: name => {
      write("settings-tab", name);
      // A hidden calibration or button-learning session must not keep listening.
      controller.bindings.reset();
      controller.setup = null;
      controller.range = null;
      inputSignature = "";
      renderInputUI();
    },
  });
  ghostSelection=new GhostSelection($('#lap-ghost-picker'),t,time);
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
  $("#auto-arm").checked = autoArm.enabled;
  $("#auto-arm").onchange = event => {
    autoArm.setEnabled(event.target.checked);
    write("auto-arm", autoArm.enabled);
    hud();
  };
  $("#create-room").onclick = createRoom;
  $("#resume").onclick = resume;
  $("#menu-button").onclick = pause;
  pauseMenu = new PauseMenu(t, {
    resume,
    reset: () => { resetAircraft(); resume(); },
    leave: endFlight,
  }, () => ({
    online: !!room,
    description: `${mapName(flight.map.id)} · ${flight.config.name} · ${flightModeLabel(flight.physics.mode).toUpperCase()}` + (room ? ` · ${room.code}` : ""),
    canReset: !room || (room.phase === "flying" && !room.players.find(p=>p.id===network.id)?.finished),
  }));
  flightHelp = new FlightHelp(t, flightHelpContent);
  $("#hud-mode").onclick = () => { action("mode"); hud(); document.activeElement?.blur(); };
  for (const [id, kind] of [["arm-state", "arm"], ["hud-reset", "reset"], ["hud-view", "view"], ["hud-turtle", "turtle"]])
    $("#" + id).onclick = () => { action(kind); hud(); document.activeElement?.blur(); };
  for (const [id,delta] of [['pilot-zoom-in',-90],['pilot-zoom-out',90]])
    $('#'+id).onclick = () => { flight.cameraRig.zoomPilot(delta);hud();document.activeElement?.blur(); };
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
  $('#flight-mode').onchange=refreshGhostChoices;
  $("#room-kind").value = read("room-kind", "free");
  $("#room-kind").onchange = () => { write("room-kind", $("#room-kind").value); selectMap(map.id); };
  $("#public-room").checked = read("public-room", true);
  $("#public-room").onchange = () => write("public-room", $("#public-room").checked);
  $("#session").value = read("solo-session", "free");
  if (!$("#session").value) $("#session").value = "free";
  updateSessionOptions();
  $("#race-route").onchange = () => {
    const routeId = $("#race-route").value;
    if (routeId) {
      map = resolveRoute(catalog.maps.find(m => m.id === map.id), routeId);
      write(routePreferenceKey(map,config), map.routeId);
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
  $("#join-room").onclick = () => requestRoom("join", { code: $("#room-code").value.trim().toUpperCase(), ...aircraftChoice() });
  for(const id of ['#lobby-aircraft','#lobby-mode','#lobby-launch'])$(id).onchange=changeLobbyAircraft;
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
  $("#rates-all").onclick = () => saveRates(catalog.aircraft.filter(d=>aircraftCapabilities(d).rateProfiles).map((d) => d.id));
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
    cameraSettings.volume = Number($("#sound-volume").value) / 100;
    $("#volume-output").textContent = $("#sound-volume").value + '%';
    flight.soundVolume = cameraSettings.volume;
    cameraSettings.horizon = $("#fpv-horizon-toggle").checked;
    cameraSettings.analog = $("#analog-video-toggle").checked;
    $('#angle-output').textContent=$('#camera-angle').value+'°';$('#fov-output').textContent=$('#camera-fov').value+'°';
    applyAircraftCamera();
    pauseRenderNeeded = true;
    flight.soundEnabled = cameraSettings.sound;
    fpvOsd.setSettings(cameraSettings);
    $("#fpv-horizon").setAttribute("aria-label", t("settings.horizon"));
    write("camera", cameraSettings);
    if (cameraSettings.analog && flight.active && !flight.analogPrepared && !flight.preparingViews) {
      const version = flight.loadVersion;
      const task = loading.begin('loading.flight', {name:mapName(flight.map.id)}, {overlay:true});
      flight.preparingViews = true;
      void (async () => {
        try {
          await paintLoading();
          if (version === flight.loadVersion) await flight.prepareViews({analog:true});
        } catch (error) { console.error(error); notice(t('error.requestFailed')); }
        finally {
          if (version === flight.loadVersion) {flight.preparingViews=false;pauseRenderNeeded=true;}
          task.end();
        }
      })();
    }
  }
  for(const d of catalog.aircraft)cameraProfiles.set(d.id,cameraProfiles.get(d.id));
  write('camera-profiles',cameraProfiles.profiles);renderCameraProfile(config.id);
  $('#camera-drone').onchange=()=>renderCameraProfile($('#camera-drone').value);
  $('#camera-all').onclick=()=>{
    const p=cameraProfiles.get($('#camera-drone').value);for(const d of catalog.aircraft)cameraProfiles.set(d.id,p);
    write('camera-profiles',cameraProfiles.profiles);applyAircraftCamera();notice(t('settings.saved'));
  };
  $('#camera-reset').onclick=()=>{cameraProfiles.set($('#camera-drone').value,DEFAULT_CAMERA_PROFILE);write('camera-profiles',cameraProfiles.profiles);renderCameraProfile($('#camera-drone').value);applyAircraftCamera();};
  $("#sound").checked = cameraSettings.sound;
  for(const key of ['travel','expo'])$('#airplane-'+key).oninput=()=>{const values={travel:Number($('#airplane-travel').value)/100,expo:Number($('#airplane-expo').value)/100};write('airplane-controls',values);$('#airplane-'+key+'-output').textContent=$('#airplane-'+key).value+'%';applyAircraftCamera();};
  $("#sound-volume").value = Math.round((Number.isFinite(cameraSettings.volume) ? Math.max(0,Math.min(1,cameraSettings.volume)) : .7) * 100);
  $("#fpv-horizon-toggle").checked = cameraSettings.horizon === true;
  $("#analog-video-toggle").checked = cameraSettings.analog === true;
  for(const s of ['#camera-angle','#camera-fov'])$(s).oninput=()=>camera(true);
  for (const s of ["#sound", "#sound-volume", "#fpv-horizon-toggle", "#analog-video-toggle"])$(s).oninput=()=>camera();
  camera();
  for (const s of ["#records-route", "#records-mode"])
    $(s).onchange = showRecords;
  $('#records-drone').onchange=()=>{refreshRecordRoutes();showRecords();};
  $('#aircraft-launch').value=read('aircraft-launch','air');
  $('#aircraft-launch').onchange=()=>write('aircraft-launch',$('#aircraft-launch').value);
  $("#records-map").onchange = () => { refreshRecordRoutes(); showRecords(); };
  $("#records-refresh").onclick = showRecords;
  window.addEventListener("languagechange", () => {
    refreshGhostChoices();
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
  catalog.aircraft=allAircraft(catalog);
  for(const plane of catalog.airplanes??[])if(!cameraProfiles.profiles[plane.id])cameraProfiles.set(plane.id,{angle:0,fov:100});
  preview = new Preview($("#preview-scene"));
  flight = new Flight($("#game-scene"), catalog.aircraft);
  controller = new Controller(action);
  controller.touch = new TouchSticks($('#stick-hud'), $('#hud'));
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
