import { read, write } from "./storage.js";
let strings = {},
  fallback = {},
  language = "en";
export const t = (key, values = {}) =>
  (strings[key] ?? fallback[key] ?? key).replace(/\{(\w+)\}/g, (_, k) =>
    String(values[k] ?? ""),
  );
export function applyLanguage() {
  document.documentElement.lang = language;
  document
    .querySelectorAll("[data-i18n]")
    .forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document
    .querySelectorAll("[data-i18n-placeholder]")
    .forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
  document.querySelector('meta[name="description"]').content =
    t("meta.description");
  document.querySelector('meta[property="og:description"]').content =
    t("meta.description");
  document
    .querySelector("#game-scene")
    .setAttribute("aria-label", t("aria.environment"));
  document
    .querySelector("#preview-scene")
    .setAttribute("aria-label", t("aria.preview"));
  document.querySelector("#language").value = language;
  window.dispatchEvent(new Event("languagechange"));
}
export async function setLanguage(next) {
  if (!["en", "hu", "de", "fr", "es"].includes(next)) next = "en";
  const response = await fetch("/lang/" + next + ".json");
  if (!response.ok) throw Error("Language unavailable");
  strings = await response.json();
  language = next;
  write("language", language);
  applyLanguage();
}
export async function initLanguage() {
  fallback = await (await fetch("/lang/en.json")).json();
  await setLanguage(read("language", navigator.language.slice(0, 2)));
}
