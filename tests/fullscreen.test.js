import test from "node:test";
import assert from "node:assert/strict";
import { bindFullscreen } from "../web/fullscreen.js";

function fixture(mobile = false) {
  const listeners = new Map(), classes = new Set(["hidden"]), attrs = new Map(), icon = {}, label = {};
  const button = {
    classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } },
    setAttribute: (key, value) => attrs.set(key, value),
    querySelector: selector => selector === "path" ? { setAttribute: (_key, value) => { icon.path = value; } } : label,
    addEventListener: (_name, fn) => { button.click = fn; },
  };
  const errorClasses = new Set(["hidden"]), portraitError = {
    classList: { add: n => errorClasses.add(n), remove: n => errorClasses.delete(n), contains: n => errorClasses.has(n) },
  };
  const events = new Map(), errors = [];
  const doc = {
    documentElement: {}, fullscreenElement: null, fullscreenEnabled: true,
    querySelectorAll: () => [button], querySelector: () => portraitError,
    addEventListener: (name, fn) => events.set(name, fn),
    defaultView: { matchMedia: () => ({ matches: mobile }), addEventListener: (name, fn) => listeners.set(name, fn) },
    activeElement: { blur() {} },
  };
  let requestOptions;
  doc.documentElement.requestFullscreen = options => {
    requestOptions = options; doc.fullscreenElement = doc.documentElement;
    events.get("fullscreenchange")(); return Promise.resolve();
  };
  doc.exitFullscreen = () => { doc.fullscreenElement = null; events.get("fullscreenchange")(); return Promise.resolve(); };
  const bind = () => bindFullscreen(key => key, message => errors.push(message), doc);
  return { doc, button, classes, attrs, portraitError, errorClasses, events, listeners, errors, bind, get options() { return requestOptions; } };
}

test("fullscreen click requests directly, toggles off and follows the browser's own exit", async () => {
  const f = fixture(); f.bind();
  const enter = f.button.click();
  assert.deepEqual(f.options, { navigationUI: "hide" }, "request is made inside the click, before awaiting");
  await enter;
  assert.equal(f.attrs.get("aria-pressed"), "true");
  assert.equal(f.attrs.get("aria-label"), "fullscreen.exit");
  await f.button.click();
  assert.equal(f.doc.fullscreenElement, null);
  assert.equal(f.attrs.get("aria-pressed"), "false");
  await f.button.click(); f.doc.fullscreenElement = null; f.events.get("fullscreenchange")();
  assert.equal(f.attrs.get("aria-label"), "fullscreen.enter");
});

test("a denied request leaves the game usable and can be retried; unavailable fullscreen hides controls", async () => {
  const f = fixture(), successfulRequest = f.doc.documentElement.requestFullscreen;
  f.doc.documentElement.requestFullscreen = () => Promise.reject(Error("Denied")); f.bind();
  await f.button.click();
  assert.deepEqual(f.errors, ["fullscreen.failed"]);
  assert.equal(f.attrs.get("aria-pressed"), "false");
  assert.equal(f.button.disabled, false);
  assert.equal(f.errorClasses.has("hidden"), false);
  f.doc.documentElement.requestFullscreen = successfulRequest;
  await f.button.click();
  assert.equal(f.attrs.get("aria-pressed"), "true");
  const unavailable = fixture(); unavailable.doc.fullscreenEnabled = false; unavailable.bind();
  assert.equal(unavailable.classes.has("hidden"), true);
});

test("WebKit fullscreen uses its matching request, exit and change event", async () => {
  const f = fixture(); f.doc.fullscreenEnabled = false;
  let entered = 0, exited = 0;
  f.doc.documentElement.webkitRequestFullscreen = () => {
    entered++; f.doc.webkitFullscreenElement = f.doc.documentElement; f.events.get("webkitfullscreenchange")();
  };
  f.doc.webkitExitFullscreen = () => { exited++; f.doc.webkitFullscreenElement = null; f.events.get("webkitfullscreenchange")(); };
  f.bind(); await f.button.click(); assert.equal(f.attrs.get("aria-pressed"), "true");
  await f.button.click(); assert.equal(f.attrs.get("aria-pressed"), "false");
  assert.equal(entered, 1); assert.equal(exited, 1);
});

test("mobile flight requests fullscreen before loading and menu exits; desktop never enters automatically", async () => {
  const mobile = fixture(true), control = mobile.bind();
  assert.equal(mobile.doc.fullscreenElement, null, "initial menu stays windowed");
  const start = control.enterFlight();
  assert.deepEqual(mobile.options, { navigationUI: "hide" }, "request happens directly at flight start");
  await start;
  assert.equal(mobile.attrs.get("aria-pressed"), "true");
  await control.enterMenu();
  assert.equal(mobile.doc.fullscreenElement, null);
  await control.enterFlight();
  assert.equal(mobile.attrs.get("aria-pressed"), "true", "resume/new flight enters again");
  const desktop = fixture(), desktopControl = desktop.bind();
  await desktopControl.enterFlight();
  assert.equal(desktop.options, undefined);
  assert.equal(desktop.doc.fullscreenElement, null);
});

test("manual and browser fullscreen exits stay off for the rest of the flight", async () => {
  const f = fixture(true), control = f.bind(), touch = { target: { closest: () => null } };
  await control.enterFlight();
  await f.button.click();
  f.listeners.get("pointerdown")(touch);
  assert.equal(f.doc.fullscreenElement, null, "touch must not undo the manual exit");
  await control.enterFlight();
  f.doc.fullscreenElement = null; f.events.get("fullscreenchange")();
  f.listeners.get("pointerdown")(touch);
  assert.equal(f.doc.fullscreenElement, null, "browser exit is respected too");
});

test("a remote mobile start can retry on touch, but never in a menu or on fullscreen/menu controls", async () => {
  const f = fixture(true), successfulRequest = f.doc.documentElement.requestFullscreen, control = f.bind();
  f.doc.documentElement.requestFullscreen = () => Promise.reject(Error("No user activation"));
  await control.enterFlight();
  assert.deepEqual(f.errors, [], "automatic failures do not interrupt flying");
  f.doc.documentElement.requestFullscreen = successfulRequest;
  f.listeners.get("pointerdown")({ target: { closest: () => ({}) } });
  assert.equal(f.doc.fullscreenElement, null, "do not steal the toggle/menu button's gesture");
  f.listeners.get("pointerdown")({ target: { closest: () => null } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.attrs.get("aria-pressed"), "true");
  await control.enterMenu();
  f.listeners.get("pointerdown")({ target: { closest: () => null } });
  assert.equal(f.doc.fullscreenElement, null, "menu touches never request fullscreen");
});

test("returning to a menu while the fullscreen request is pending still exits when it completes", async () => {
  const f = fixture(true), control = f.bind();
  let accept;
  f.doc.documentElement.requestFullscreen = () => new Promise(resolve => {
    accept = () => { f.doc.fullscreenElement = f.doc.documentElement; f.events.get("fullscreenchange")(); resolve(); };
  });
  const start = control.enterFlight();
  control.enterMenu();
  accept(); await start;
  assert.equal(f.doc.fullscreenElement, null);
  assert.equal(f.attrs.get("aria-pressed"), "false");
  assert.equal(f.button.disabled, false);
});
