import test from "node:test";
import assert from "node:assert/strict";
import { FlightHelp } from "../web/game/flight-help.js";

function fixture() {
  const element = () => {
    const classes = new Set();
    return { attributes: {}, children: [], textContent: "",
      classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name) },
      setAttribute(name, value) { this.attributes[name] = value; }, blur() {},
      contains(target) { return target === this || this.children.some(child => child.contains(target)); },
      append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; },
    };
  };
  const nodes = Object.fromEntries(["flight-help", "hud-help-button", "flight-help-close", "flight-help-source", "flight-help-note", "flight-help-keys"].map(id => ["#" + id, element()]));
  const events = {}, doc = { querySelector: selector => nodes[selector], createElement: element };
  let content = { source: "Keyboard", note: "Keep flying", rows: [["Reset", ["R"]]] };
  const help = new FlightHelp(key => key, () => content, doc, { addEventListener(name, callback, capture) { events[name] = { callback, capture }; } });
  return { help, nodes, events, setContent: next => { content = next; } };
}

test("help stays closed by default and Escape dismisses it before the flight menu can act", () => {
  const { help, nodes, events } = fixture();
  assert.equal(nodes["#flight-help"].classList.contains("hidden"), true);
  assert.equal(nodes["#hud-help-button"].attributes["aria-expanded"], "false");
  nodes["#hud-help-button"].onclick();
  assert.equal(help.open, true);
  assert.equal(nodes["#hud-help-button"].attributes["aria-expanded"], "true");
  assert.equal(events.keydown.capture, true);
  let prevented = 0, stopped = 0;
  const escape = { code: "Escape", preventDefault() { prevented++; }, stopImmediatePropagation() { stopped++; } };
  events.keydown.callback({ ...escape, code: "KeyW" });
  assert.equal(help.open, true);
  assert.equal(stopped, 0, "flight keys keep working while help is open");
  events.keydown.callback(escape);
  assert.equal(help.open, false);
  assert.equal(prevented, 1);
  assert.equal(stopped, 1, "the same Escape must not also pause or disarm");
  events.keydown.callback(escape);
  assert.equal(stopped, 1, "closed help leaves the normal menu shortcut alone");
});

test("open help refreshes changed bindings and input sources, and outside clicks close it", () => {
  const { help, nodes, events, setContent } = fixture();
  help.setOpen(true);
  const initial = nodes["#flight-help-keys"].children[0];
  help.update();
  assert.equal(nodes["#flight-help-keys"].children[0], initial, "stable controls do not rebuild each HUD frame");
  setContent({ source: "Controller", note: "Mode 2", rows: [["Reset", ["Button 4"]]] });
  help.update();
  assert.equal(nodes["#flight-help-source"].textContent, "Controller");
  assert.equal(nodes["#flight-help-keys"].children[0].children[1].children[0].textContent, "Button 4");
  events.pointerdown.callback({ target: nodes["#flight-help"] });
  assert.equal(help.open, true);
  events.pointerdown.callback({ target: {} });
  assert.equal(help.open, false);
});
