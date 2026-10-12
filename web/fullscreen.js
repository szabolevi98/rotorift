const ENTER_ICON = "M9 3H3V9M15 3H21V9M21 15V21H15M9 21H3V15";
const EXIT_ICON = "M3 9H9V3M15 3V9H21M21 15H15V21M9 21V15H3";

export const fullscreenElement = doc => doc.fullscreenElement || doc.webkitFullscreenElement || null;
export function fullscreenSupported(doc) {
  const root = doc.documentElement;
  return !!((root.requestFullscreen && doc.exitFullscreen && doc.fullscreenEnabled !== false) ||
    (root.webkitRequestFullscreen && doc.webkitExitFullscreen && doc.webkitFullscreenEnabled !== false));
}

export function bindFullscreen(translate, onError, doc = document) {
  const buttons = [...doc.querySelectorAll("[data-fullscreen-toggle]")];
  const portraitError = doc.querySelector("#fullscreen-error");
  const mobile = doc.defaultView?.matchMedia?.("(hover: none) and (pointer: coarse), (max-width: 600px)") ?? { matches: false };
  let pending = false, queued = null, inFlight = false, automaticWanted = false;
  const render = () => {
    const supported = fullscreenSupported(doc), active = !!fullscreenElement(doc);
    const label = translate(active ? "fullscreen.exit" : "fullscreen.enter");
    if (portraitError && !portraitError.classList.contains("hidden"))
      portraitError.textContent = translate("fullscreen.failed");
    for (const button of buttons) {
      button.classList.toggle("hidden", !supported);
      button.disabled = pending;
      button.title = label;
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-pressed", String(active));
      button.querySelector("path").setAttribute("d", active ? EXIT_ICON : ENTER_ICON);
      const text = button.querySelector("[data-fullscreen-label]");
      if (text) text.textContent = label;
    }
  };
  const change = async (active, silent = false) => {
    if (pending) { queued = { active, silent }; return; }
    if ((active && !fullscreenSupported(doc)) || active === !!fullscreenElement(doc)) return;
    pending = true;
    portraitError?.classList.add("hidden");
    render();
    try {
      // The request happens directly inside the user's click, before any await.
      if (!active) {
        if (doc.fullscreenElement && doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
        else await doc.exitFullscreen();
      } else {
        const root = doc.documentElement;
        if (root.requestFullscreen && doc.fullscreenEnabled !== false)
          await root.requestFullscreen({ navigationUI: "hide" });
        else await root.webkitRequestFullscreen();
      }
    } catch {
      if (!silent && portraitError) {
        portraitError.textContent = translate("fullscreen.failed");
        portraitError.classList.remove("hidden");
      }
      if (!silent) onError(translate("fullscreen.failed"));
    } finally {
      pending = false;
      render();
      doc.activeElement?.blur();
      // A menu can open while a fullscreen request is still being accepted.
      // Honour the newest destination once that transition finishes.
      const next = queued;
      queued = null;
      if (next) await change(next.active, next.silent);
    }
  };
  const toggle = () => {
    if (pending || !fullscreenSupported(doc)) return;
    automaticWanted = false; // A manual exit must stay off until the next flight.
    return change(!fullscreenElement(doc));
  };
  const changed = () => {
    if (inFlight && !pending && !fullscreenElement(doc)) automaticWanted = false;
    render();
  };
  for (const button of buttons) button.addEventListener("click", toggle);
  doc.addEventListener("fullscreenchange", changed);
  doc.addEventListener("webkitfullscreenchange", changed);
  doc.defaultView?.addEventListener("languagechange", render);
  // A remotely started multiplayer race may arrive outside a user gesture.
  // Like Racing, retry on the next touch without fighting a manual exit.
  doc.defaultView?.addEventListener("pointerdown", event => {
    if (!inFlight || !automaticWanted || pending || fullscreenElement(doc)) return;
    if (event.target?.closest?.("[data-fullscreen-toggle], #menu-button, #leave-flight, #leave-room")) return;
    void change(true, true);
  }, { capture: true });
  render();
  return {
    enterFlight() {
      inFlight = true;
      automaticWanted = mobile.matches;
      if (automaticWanted) return change(true, true);
    },
    enterMenu() {
      inFlight = false;
      automaticWanted = false;
      return change(false, true);
    },
  };
}
