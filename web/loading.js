// Several async operations can overlap (startup, preview, online room).
// Finishing one must not dismiss another operation's loading screen.
export class LoadingScreen {
  constructor(translate) {
    this.translate = translate;
    this.root = document.querySelector("#boot");
    this.title = document.querySelector("#loading-title");
    this.detail = document.querySelector("#loading-detail");
    this.progress = document.querySelector("#loading-progress");
    this.percent = document.querySelector("#loading-percent");
    this.background = [document.querySelector("#menu"), document.querySelector("#hud")];
    this.tasks = new Map();
    window.addEventListener("languagechange", () => this.render());
  }
  begin(key, values = {}, { overlay = false } = {}) {
    const id = Symbol(), task = { key, values, phase: null, overlay };
    this.tasks.set(id, task);
    this.render();
    return {
      progress: event => {
        if (!this.tasks.has(id)) return;
        Object.assign(task, event);
        this.render();
      },
      end: () => { this.tasks.delete(id); this.render(); },
    };
  }
  render() {
    const task = [...this.tasks.values()].at(-1);
    if (!task) {
      // The initial HTML stays visible until startup begins.
      if (!this.started) return;
      this.root.classList.add("hidden");
      this.root.classList.remove("loading-overlay");
      document.documentElement.classList.remove("loading-visible");
      for (const element of this.background) element.inert = false;
      return;
    }
    this.started = true;
    this.root.classList.remove("hidden", "loading-error");
    // Startup/world loading takes priority over lightweight model swaps.
    const overlay = [...this.tasks.values()].every(task => task.overlay);
    if (overlay) this.root.classList.add("loading-overlay");
    else this.root.classList.remove("loading-overlay");
    document.documentElement.classList.add("loading-visible");
    for (const element of this.background) element.inert = true;
    this.title.textContent = this.translate(task.key, task.values);
    this.detail.textContent = task.phase ? this.translate("loading." + task.phase) : "";
    const known = ["download", "collisions"].includes(task.phase) && task.total > 0;
    const fraction = known ? Math.min(1, task.loaded / task.total) : null;
    if (known) this.progress.value = fraction;
    else this.progress.removeAttribute("value");
    this.percent.textContent = known ? Math.floor(fraction * 100) + "%" : "";
  }
  fail(message) {
    this.title.textContent = message;
    this.detail.textContent = "";
    this.percent.textContent = "";
    this.root.classList.add("loading-error");
  }
}

// Yield a paint before synchronous geometry/physics work blocks the main thread.
export const paintLoading = () => new Promise(resolve =>
  requestAnimationFrame(() => setTimeout(resolve, 0)),
);
