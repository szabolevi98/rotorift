import test from "node:test";
import assert from "node:assert/strict";
import { activeMenuTab, simulationView, flightSimulationActive } from "../web/menu-state.js";

const defaults = { battery: false, propwash: true, wind: "light" };
const room = { host: "host", phase: "lobby", kind: "race", simulation: { battery: true, propwash: false, wind: "strong", ghost: false } };
test("ESC stops solo simulation but online flight continues until the race or pilot finishes",()=>{
  assert.equal(flightSimulationActive(true,true,null,"pilot"),false);
  assert.equal(flightSimulationActive(true,false,null,"pilot"),true);
  for(const phase of ["lobby","countdown","flying","finished"])
    assert.equal(flightSimulationActive(true,true,{phase,players:[{id:"pilot",finished:false}]},"pilot"),phase==="flying");
  assert.equal(flightSimulationActive(true,true,{phase:"flying",players:[{id:"pilot",finished:true}]},"pilot"),false);
  assert.equal(flightSimulationActive(false,false,{phase:"flying",players:[]},"pilot"),false);
});

test("solo and future host setup use personal preferences even while another room exists", () => {
  const solo = simulationView("solo", defaults, room, "guest");
  assert.equal(solo.options.battery, false);
  assert.equal(solo.options.propwash, true);
  assert.equal(solo.locked, false);
  assert.equal(solo.ghost, false);
  const host = simulationView("host", defaults, { ...room, phase: "flying" }, "guest");
  assert.equal(host.options.battery, false);
  assert.equal(host.locked, false);
  assert.equal(host.ghost, true);
  assert.equal(host.note, "simulation.hostSetupHint");
});

test("lobby presents server rules and only its host can edit them", () => {
  const host = simulationView("lobby", defaults, room, "host");
  const guest = simulationView("lobby", defaults, room, "guest");
  assert.equal(host.options.battery, true);
  assert.equal(host.options.propwash, false);
  assert.equal(host.options.wind, "strong");
  assert.equal(host.locked, false);
  assert.equal(guest.locked, true);
  assert.equal(guest.ghost, true);
  assert.deepEqual(guest.options, host.options);
});

test("started rooms lock host and guest controls, including during countdown and after finishing", () => {
  for (const phase of ["countdown", "flying", "finished"])
    for (const pilot of ["host", "guest"]) {
      const view = simulationView("lobby", defaults, { ...room, phase }, pilot);
      assert.equal(view.locked, true);
      assert.equal(view.note, "simulation.lockedHint");
    }
});

test("verified one-player sessions keep solo navigation and hide meaningless ghost collision controls", () => {
  assert.equal(activeMenuTab("fly"), "fly");
  assert.equal(activeMenuTab("multiplayer"), "multiplayer");
  assert.equal(activeMenuTab("lobby", "race"), "multiplayer");
  assert.equal(activeMenuTab("lobby", "hotlap"), "fly");
  assert.equal(activeMenuTab("results", "race"), "multiplayer");
  assert.equal(activeMenuTab("results", "hotlap"), "fly");
  assert.equal(activeMenuTab("settings", "race"), "settings");
  assert.equal(simulationView("lobby", defaults, { ...room, kind: "hotlap" }, "host").ghost, false);
});

test("display normalization never mutates stored preferences or the room snapshot", () => {
  const preferences = structuredClone(defaults), snapshot = structuredClone(room);
  const view = simulationView("lobby", preferences, snapshot, "host");
  view.options.battery = false;
  assert.deepEqual(preferences, defaults);
  assert.deepEqual(snapshot, room);
});
