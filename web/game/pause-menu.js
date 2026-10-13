// In-flight dialog. Reuse the existing settings controls without duplicating
// bindings, radio calibration or rate profiles; restore them when it closes.
export class PauseMenu {
  constructor(translate, actions, describe, doc = document, win = window) {
    this.t = translate; this.actions = actions; this.describe = describe; this.doc = doc;
    this.root = doc.querySelector('#pause-menu');
    this.settings = doc.querySelector('#settings-panel');
    this.settingsHome = this.settings.parentNode; this.settingsNext = this.settings.nextSibling;
    this.slot = doc.querySelector('#pause-settings-slot');
    this.resumeButton = doc.querySelector('#pause-resume');
    this.resetButton = doc.querySelector('#pause-reset');
    this.backButton = doc.querySelector('#pause-back');
    this.resumeButton.onclick = () => actions.resume();
    this.resetButton.onclick = () => actions.reset();
    doc.querySelector('#pause-settings').onclick = () => this.setSettings(true);
    doc.querySelector('#pause-exit').onclick = () => actions.leave();
    this.backButton.onclick = () => this.setSettings(false);
    win.addEventListener('keydown', event => {
      if (!this.open) return;
      if (event.code === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation();
        if (this.settingsOpen) this.setSettings(false); else actions.resume();
      } else if (event.code === 'Tab') {
        const items = [...this.root.querySelectorAll('button,input,select,textarea,a[href]')]
          .filter(el => !el.disabled && el.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (items.length && ((event.shiftKey && doc.activeElement === first) || (!event.shiftKey && doc.activeElement === last))) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        }
      }
    }, true);
  }
  setOpen(open) {
    this.open = open;
    if (!open) this.setSettings(false, false);
    this.root.classList.toggle('hidden', !open);
    this.doc.documentElement.classList.toggle('pause-menu-open', open);
    for (const id of ['#menu', '#hud', '#game-scene']) this.doc.querySelector(id).inert = open;
    if (open) { this.update(); this.resumeButton.focus({preventScroll:true}); }
  }
  setSettings(open, focus = true) {
    this.settingsOpen = open;
    this.root.classList.toggle('pause-settings-open', open);
    if (open) { this.slot.append(this.settings); this.settings.classList.remove('hidden'); }
    else {
      this.settings.classList.add('hidden');
      this.settingsHome.insertBefore(this.settings, this.settingsNext);
    }
    this.update();
    if (focus) (open ? this.backButton : this.resumeButton).focus({preventScroll:true});
  }
  update() {
    if (!this.open) return;
    const state = this.describe();
    this.doc.querySelector('#pause-title').textContent = this.t(this.settingsOpen ? 'nav.settings' : 'pause.title');
    this.doc.querySelector('#pause-description').textContent = state.description;
    this.doc.querySelector('#pause-note').textContent = this.t(state.online ? 'pause.online' : 'pause.solo');
    this.resetButton.disabled = !state.canReset;
  }
}
