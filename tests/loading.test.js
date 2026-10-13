import test from "node:test";
import assert from "node:assert/strict";
import { LoadingScreen } from "../web/loading.js";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

test("the first loading paint is localized before any module or translation download", async () => {
  const html = await readFile(new URL("../web/index.html", import.meta.url), "utf8");
  const script = html.match(/<script id="boot-language">([\s\S]*?)<\/script>/)[1];
  assert.ok(html.indexOf('id="boot-language"') < html.indexOf('src="/main.js"'));
  assert.match(html, /id="loading-title" data-i18n="loading"><\/strong>/);
  const boot = (saved, browserLanguage, blocked = false) => {
    const title = {}, select = {}, document = {
      documentElement: {},
      querySelector: selector => selector === "#loading-title" ? title : select,
    };
    runInNewContext(script, {
      document, navigator: { language: browserLanguage },
      localStorage: { getItem() { if (blocked) throw Error("Storage unavailable"); return saved; } },
      fetch() { throw Error("First paint must not wait for a network request"); },
    });
    return { language: document.documentElement.lang, loading: title.textContent, title: document.title, selected: select.value };
  };
  for (const language of ["en", "hu", "de", "fr", "es"]) {
    const dictionary = JSON.parse(await readFile(new URL(`../web/lang/${language}.json`, import.meta.url), "utf8"));
    assert.deepEqual(boot(JSON.stringify(language), "en-US"), {
      language, loading: dictionary.loading, title: dictionary["meta.title"], selected: language,
    });
    assert.equal(boot(null, language + "-XX").language, language);
  }
  assert.equal(boot(null, "hu-HU", true).language, "hu");
  assert.equal(boot("bad JSON", "hu-HU").language, "hu");
  assert.equal(boot(null, "it-IT").language, "en");
  assert.equal(boot('"unsupported"', "hu-HU").language, "en");
});

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
    const loading = new LoadingScreen(key => key), startup = loading.begin("loading"), model = loading.begin("loading.model", {}, { overlay: true });
    assert.equal(nodes["#boot"].classList.contains("loading-overlay"), false, "startup keeps its opaque screen even with an overlapping model load");
    model.progress({ phase: "download", loaded: 25, total: 100 });
    assert.equal(nodes["#loading-progress"].value, .25);
    assert.equal(nodes["#loading-percent"].textContent, "25%");
    startup.end();
    assert.equal(nodes["#boot"].classList.contains("loading-overlay"), true, "model swaps leave the scene visible through a compact overlay");
    assert.equal(nodes["#boot"].classList.contains("hidden"), false, "another load is still pending");
    assert.equal(nodes["#menu"].inert, true);
    model.progress({ phase: "prepare" });
    assert.equal(nodes["#loading-percent"].textContent, "", "preparation has no invented percentage");
    model.end();
    assert.equal(nodes["#boot"].classList.contains("loading-overlay"), false);
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
