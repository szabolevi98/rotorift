import { propellerState } from "../../shared/physics/propellers.js";
export class PropellerHud {
  constructor(root, t) {
    this.root = root;
    this.t = t;
    this.lastKey = null;
    this.title = document.createElement("strong");
    this.title.className = "propeller-heading";
    root.append(this.title);
    this.grid = document.createElement("div");
    this.grid.className = "propeller-grid";
    root.append(this.grid);
    this.build(false);
  }
  build(airplane) {
    this.airplane = airplane;
    this.lastKey = null;
    this.grid.classList.toggle("airplane", airplane);
    this.grid.replaceChildren();
    this.cells = Array.from({ length: airplane ? 1 : 4 }, (_, index) => {
      const cell = document.createElement("div");
      cell.className = "propeller-cell";
      cell.setAttribute("role", "img");
      cell.dataset.motor = String(index);
      const count = airplane ? 2 : 3;
      cell.innerHTML =
        '<svg viewBox="0 0 40 40" aria-hidden="true">' +
        Array.from(
          { length: count },
          (_, i) =>
            `<g transform="rotate(${(i * 360) / count} 20 20)"><path class="propeller-blade" d="M20 18C22 11 28 3 33 6C36 9 30 17 22 22Z"/></g>`,
        ).join("") +
        '<circle cx="20" cy="20" r="3"/></svg><span></span>';
      this.grid.append(cell);
      return cell;
    });
  }
  update(enabled, rotors, airplane = false) {
    this.root.classList.toggle("hidden", !enabled);
    if (!enabled) return;
    if (this.airplane !== airplane) this.build(airplane);
    const key = JSON.stringify(rotors) + this.t("hud.propDamage");
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.title.textContent = this.t("hud.propDamage");
    this.root.setAttribute("aria-label", this.title.textContent);
    for (const [index, cell] of this.cells.entries()) {
      const blades = airplane ? rotors : rotors[index],
        state = propellerState(blades);
      const name = this.t(
          airplane ? "hud.prop.single" : "hud.prop.position." + index,
        ),
        status = this.t("hud.prop." + state);
      cell.dataset.state = state;
      cell.setAttribute("aria-label", name + " · " + status);
      cell.title = name + " · " + status;
      cell.querySelector("span").textContent = airplane
        ? name
        : this.t("hud.prop.short." + index);
      cell
        .querySelectorAll(".propeller-blade")
        .forEach((path, i) => (path.dataset.state = String(blades[i])));
    }
  }
}
