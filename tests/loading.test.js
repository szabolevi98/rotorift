import test from "node:test";
import assert from "node:assert/strict";
import { LoadingScreen } from "../web/loading.js";

test("overlapping loads keep the screen blocking until all finish, with real progress and retry recovery", () => {
  const previousDocument = globalThis.document, previousWindow = globalThis.window;
  const element = () => {
    const classes = new Set(), attributes = new Map();
    return {
      textContent: "", inert: false,
      classList: { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), contains: n => classes.has(n) },
      removeAttribute(name) { attributes.delete(name); if (name === "value") delete this.value; },
    };
  };
  const selectors = ["#boot", "#loading-title", "#loading-detail", "#loading-progress", "#loading-percent", "#menu", "#hud"];
  const nodes = Object.fromEntries(selectors.map(key => [key, element()]));
  globalThis.document = { documentElement: element(), querySelector: key => nodes[key] };
  globalThis.window = { addEventListener() {} };
  try {
    const loading = new LoadingScreen(key => key), startup = loading.begin("loading"), model = loading.begin("loading.model");
    model.progress({ phase: "download", loaded: 25, total: 100 });
    assert.equal(nodes["#loading-progress"].value, .25);
    assert.equal(nodes["#loading-percent"].textContent, "25%");
    startup.end();
    assert.equal(nodes["#boot"].classList.contains("hidden"), false, "another load is still pending");
    assert.equal(nodes["#menu"].inert, true);
    model.progress({ phase: "prepare" });
    assert.equal(nodes["#loading-percent"].textContent, "", "preparation has no invented percentage");
    model.end();
    assert.equal(nodes["#boot"].classList.contains("hidden"), true);
    assert.equal(nodes["#menu"].inert, false);
    model.progress({ phase: "download", loaded: 90, total: 100 });
    assert.equal(nodes["#boot"].classList.contains("hidden"), true, "late progress cannot reopen a completed task");
    const retry = loading.begin("loading.model");
    loading.fail("Network failure");
    assert.equal(nodes["#loading-title"].textContent, "Network failure");
    retry.end();
    const recovered = loading.begin("loading.model");
    assert.equal(nodes["#boot"].classList.contains("loading-error"), false);
    recovered.end();
    assert.equal(document.documentElement.classList.contains("loading-visible"), false);
  } finally {
    globalThis.document = previousDocument; globalThis.window = previousWindow;
  }
});
