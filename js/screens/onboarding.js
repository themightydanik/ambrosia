import { state, markOnboardingDone, saveLang } from "../state.js";
import { goTo } from "../navigation.js";
import { v } from "../wellness/copy.js";
import { el, button } from "../wellness/dom.js";
export function renderOnboarding() {
  const root = document.getElementById("screen-onboarding");
  root.replaceChildren();
  const languages = el("div", { class: "onboarding-languages" });
  for (const [lang, label] of [
    ["en", "EN"],
    ["uk", "УКР"],
    ["ru", "РУ"],
  ])
    languages.append(
      button(
        label,
        () => {
          state.lang = lang;
          saveLang();
          renderOnboarding();
        },
        { "aria-pressed": String(state.lang === lang) },
      ),
    );
  root.append(
    el(
      "div",
      { class: "onboarding-v2" },
      el(
        "div",
        { class: "brand-line" },
        el("span", { class: "brand-mark" }, "✳"),
        "AMBROSIA",
        languages,
      ),
      el(
        "div",
        { class: "welcome-art", "aria-hidden": "true" },
        el("span", {}, "◯"),
        el("span", {}, "✳"),
        el("span", {}, "◕"),
      ),
      el("p", { class: "eyebrow" }, v("privacy")),
      el("h1", {}, v("onboardTitle")),
      el("p", { class: "lead" }, v("onboardBody")),
      el(
        "div",
        { class: "onboarding-points" },
        el("p", {}, "◕  " + v("onboardHealthy")),
        el("p", {}, "⌁  " + v("onboardSymptoms")),
      ),
      el("p", { class: "privacy-note" }, v("onboardPrivacy")),
      button(v("startApp"), startApp, {
        class: "btn-primary",
        id: "ob-next-btn",
      }),
    ),
  );
}
export function obNext() {
  startApp();
}
export function startApp() {
  markOnboardingDone();
  goTo("home");
}
window.obNext = obNext;
window.startApp = startApp;
