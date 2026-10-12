import test from "node:test";
import assert from "node:assert/strict";
import { bindFullscreen } from "../web/fullscreen.js";

function fixture() {
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
    defaultView: { addEventListener: (name, fn) => listeners.set(name, fn) },
    activeElement: { blur() {} },
  };
  let requestOptions;
  doc.documentElement.requestFullscreen = options => {
    requestOptions = options; doc.fullscreenElement = doc.documentElement;
    events.get("fullscreenchange")(); return Promise.resolve();
  };
  doc.exitFullscreen = () => { doc.fullscreenElement = null; events.get("fullscreenchange")(); return Promise.resolve(); };
  const bind = () => bindFullscreen(key => key, message => errors.push(message), doc);
  return { doc, button, classes, attrs, portraitError, errorClasses, events, errors, bind, get options() { return requestOptions; } };
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
