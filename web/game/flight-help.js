// A non-modal disclosure: opening help leaves the aircraft and race running.
export class FlightHelp {
  constructor(translate, describe, doc = document, win = window) {
    this.translate = translate;
    this.describe = describe;
    this.doc = doc;
    this.root = doc.querySelector("#flight-help");
    this.button = doc.querySelector("#hud-help-button");
    this.closeButton = doc.querySelector("#flight-help-close");
    this.button.onclick = () => this.setOpen(!this.open);
    this.closeButton.onclick = () => this.setOpen(false);
    win.addEventListener("keydown", event => {
      if (!this.open || event.code !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.setOpen(false);
    }, true);
    win.addEventListener("pointerdown", event => {
      if (this.open && !this.root.contains(event.target) && !this.button.contains(event.target)) this.setOpen(false);
    });
    this.setOpen(false);
  }
  setOpen(open) {
    this.open = open;
    this.root.classList.toggle("hidden", !open);
    this.button.setAttribute("aria-expanded", String(open));
    this.button.blur();
    this.closeButton.blur();
    this.update(true);
  }
  update(force = false) {
    if (force) {
      this.button.setAttribute("aria-label", this.translate("hud.controls"));
      this.button.title = this.translate("hud.controls");
      this.closeButton.setAttribute("aria-label", this.translate("hud.closeHelp"));
    }
    if (!this.open) return;
    const content = this.describe(), signature = JSON.stringify(content);
    if (!force && signature === this.signature) return;
    this.signature = signature;
    this.doc.querySelector("#flight-help-source").textContent = content.source;
    this.doc.querySelector("#flight-help-note").textContent = content.note;
    const rows = content.rows.map(([label, keys]) => {
      const row = this.doc.createElement("div"), term = this.doc.createElement("dt"), value = this.doc.createElement("dd");
      term.textContent = label;
      for (const key of keys) {
        const badge = this.doc.createElement("kbd");
        badge.textContent = key;
        value.append(badge);
      }
      row.append(term, value);
      return row;
    });
    this.doc.querySelector("#flight-help-keys").replaceChildren(...rows);
  }
}
