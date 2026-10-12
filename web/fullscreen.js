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
  let pending = false;
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
  const toggle = async () => {
    if (pending || !fullscreenSupported(doc)) return;
    pending = true;
    portraitError?.classList.add("hidden");
    render();
    try {
      // The request happens directly inside the user's click, before any await.
      if (fullscreenElement(doc)) {
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
      if (portraitError) {
        portraitError.textContent = translate("fullscreen.failed");
        portraitError.classList.remove("hidden");
      }
      onError(translate("fullscreen.failed"));
    } finally {
      pending = false;
      render();
      doc.activeElement?.blur();
    }
  };
  for (const button of buttons) button.addEventListener("click", toggle);
  doc.addEventListener("fullscreenchange", render);
  doc.addEventListener("webkitfullscreenchange", render);
  doc.defaultView?.addEventListener("languagechange", render);
  render();
}
