import test from 'node:test';
import assert from 'node:assert/strict';
import { SettingsTabs } from '../web/settings-tabs.js';

function fixture(selected) {
  let focused;
  const names = ['controls', 'radio', 'rates', 'video'];
  const pages = names.map(name => ({ id: 'settings-' + name, hidden: false, input: { value: 'unsaved' } }));
  const buttons = names.map(name => {
    const attributes = { 'aria-controls': 'settings-' + name }, events = {};
    const button = { dataset: { settingsTab: name }, tabIndex: 0,
      addEventListener: (name, fn) => events[name] = fn,
      setAttribute: (name, value) => attributes[name] = value,
      getAttribute: name => attributes[name], focus: () => focused = name,
      click: () => events.click(), key: key => {
        let prevented = false, stopped = false;
        events.keydown({ key, preventDefault: () => prevented = true, stopPropagation: () => stopped = true });
        return { prevented, stopped };
      },
    };
    return button;
  });
  const root = { querySelectorAll: selector => selector === '[data-settings-tab]' ? buttons : pages };
  const changes = [], tabs = new SettingsTabs(root, { selected, onChange: name => changes.push(name) });
  return { tabs, buttons, pages, changes, focused: () => focused };
}

test('exactly one settings page is exposed and only its tab is in the keyboard sequence', () => {
  const { buttons, pages, changes } = fixture('radio');
  assert.deepEqual(pages.map(page => page.hidden), [true, false, true, true]);
  assert.deepEqual(buttons.map(button => button.tabIndex), [-1, 0, -1, -1]);
  assert.deepEqual(buttons.map(button => button.getAttribute('aria-selected')), ['false', 'true', 'false', 'false']);
  assert.deepEqual(changes, [], 'restoring the last page does not start or cancel input capture');
});

test('switching settings pages preserves form nodes and unsaved input', () => {
  const { tabs, buttons, pages, changes } = fixture();
  const original = pages[2].input;
  buttons[2].click();pages[2].input.value = 'custom rate';
  buttons[3].click();buttons[2].click();
  assert.equal(pages[2].input, original);assert.equal(original.value, 'custom rate');
  assert.deepEqual(pages.map(page => page.hidden), [true, true, false, true]);
  assert.deepEqual(changes, ['rates', 'video', 'rates']);
  tabs.select('rates');tabs.select('unknown');assert.equal(changes.length, 3);
});

test('arrows wrap, Home and End move focus and select the corresponding accessible page', () => {
  const f = fixture();
  assert.deepEqual(f.buttons[0].key('ArrowLeft'), { prevented: true, stopped: true });
  assert.equal(f.tabs.selected, 'video');assert.equal(f.focused(), 'video');
  f.buttons[3].key('ArrowRight');assert.equal(f.tabs.selected, 'controls');
  f.buttons[0].key('End');assert.equal(f.tabs.selected, 'video');
  f.buttons[3].key('Home');assert.equal(f.tabs.selected, 'controls');
  assert.deepEqual(f.buttons[0].key('Tab'), { prevented: false, stopped: false });
});

test('an obsolete remembered page falls back to controls', () => {
  assert.equal(fixture('retired-page').tabs.selected, 'controls');
});
