// Keep the existing form nodes and their unsaved values when changing pages.
// The entire settings surface can also move into the in-flight pause dialog.
export class SettingsTabs {
  constructor(root, { selected = 'controls', onChange = () => {} } = {}) {
    this.root = root;
    this.buttons = [...root.querySelectorAll('[data-settings-tab]')];
    this.pages = [...root.querySelectorAll('[role="tabpanel"]')];
    this.onChange = onChange;
    for (const button of this.buttons) {
      button.addEventListener('click', () => this.select(button.dataset.settingsTab));
      button.addEventListener('keydown', event => {
        const index = this.buttons.indexOf(button);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? this.buttons.length - 1
          : event.key === 'ArrowRight' ? (index + 1) % this.buttons.length
          : event.key === 'ArrowLeft' ? (index + this.buttons.length - 1) % this.buttons.length : null;
        if (next === null) return;
        event.preventDefault();event.stopPropagation();
        this.select(this.buttons[next].dataset.settingsTab);
        this.buttons[next].focus({ preventScroll: true });
      });
    }
    this.select(this.buttons.some(button => button.dataset.settingsTab === selected) ? selected : 'controls', false);
  }
  select(name, notify = true) {
    const active = this.buttons.find(button => button.dataset.settingsTab === name);
    if (!active || this.selected === name) return;
    this.selected = name;
    for (const button of this.buttons) {
      const selected = button === active;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    for (const page of this.pages) page.hidden = page.id !== active.getAttribute('aria-controls');
    if (notify) this.onChange(name);
  }
}
