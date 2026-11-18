import { accountsRequired } from "../auth/config.js";
import { authCopy } from "../auth/copy.js";
import { hasDeviceJournal } from "../auth/recovery.js";
import { renderGoogleControls } from "../auth/controls.js";
import { state, markOnboardingDone, saveLang } from "../state.js";
import { goTo } from "../navigation.js";
import { el } from "../wellness/dom.js";
import { action, icon, badge } from "../ui/components.js";
import { illustration } from "../ui/illustration.js";
import { currentTheme, setTheme } from "../ui/theme.js";
import { onboardingCopy } from "../onboarding/copy.js";
import { renderCloudAccount } from "../supabase-auth.js";
let slide = 0,
  mode = "slides",
  ready = false,
  pendingLanguage = null;
export function setOnboardingReady() {
  ready = true;
  if (pendingLanguage) {
    state.lang = pendingLanguage;
    pendingLanguage = null;
    saveLang();
  }
  if (state.screen === "onboarding") renderOnboarding();
}
const copy = () => onboardingCopy(state.lang);
export function showAccountChoice() {
  mode = "choice";
  goTo("onboarding");
}
window.addEventListener("google-session-committed", () => {
  // A cold-start native callback may arrive while the intro is still painting.
  mode = "choice";
  if (state.screen === "onboarding") renderOnboarding();
});
window.addEventListener("auth-required", () => {
  mode = "choice";
});
window.addEventListener("journal-changed", (event) => {
  if (
    ready &&
    event.detail?.accountChanged &&
    accountsRequired() &&
    !state.accountId &&
    !state.recoveringPassword
  )
    showAccountChoice();
});
window.addEventListener("auth-settings-changed", () => {
  if (state.screen === "onboarding") renderOnboarding();
});
function show(next, { focus = true } = {}) {
  mode = next;
  renderOnboarding();
  if (focus)
    document.getElementById("ob-title")?.focus({ preventScroll: true });
}
function setSlide(next) {
  slide = Math.max(0, Math.min(2, next));
  show("slides");
}
function header() {
  const language = el("select", {
    "aria-label": copy().language,
    class: "a3-language",
    id: "ob-language",
  });
  for (const [value, text] of [
    ["en", "EN"],
    ["uk", "УКР"],
    ["ru", "РУ"],
  ])
    language.append(
      el("option", { value, selected: state.lang === value }, text),
    );
  language.addEventListener("change", () => {
    state.lang = language.value;
    if (ready) saveLang();
    else pendingLanguage = state.lang;
    document.documentElement.lang = state.lang;
    renderOnboarding();
    document.getElementById("ob-language")?.focus({ preventScroll: true });
  });
  return el(
    "header",
    { class: "a3-header" },
    el(
      "div",
      { class: "a3-wordmark" },
      el("span", { class: "a3-brand-icon" }, icon("sparkle")),
      "AMBROSIA",
    ),
    el(
      "div",
      { class: "a3-header-actions" },
      language,
      action(
        currentTheme() === "dark" ? copy().light : copy().dark,
        () => setTheme(currentTheme() === "dark" ? "light" : "dark"),
        {
          variant: "icon",
          leading: currentTheme() === "dark" ? "sun" : "moon",
          id: "ob-theme",
          "aria-label": currentTheme() === "dark" ? copy().light : copy().dark,
        },
      ),
    ),
  );
}
function slides() {
  const t = copy(),
    s = t.slides[slide];
  const utility = el(
    "div",
    { class: "a3-utility" },
    el("span", { class: "a3-small" }, t.eyebrow),
    action(t.skip, () => show("choice"), { variant: "text", id: "ob-skip" }),
  );
  const main = el(
    "main",
    { class: "a3-onboarding-main" },
    illustration("ill-onboard-0" + (slide + 1), {
      eager: true,
      priority: "high",
    }),
    el(
      "div",
      { class: "a3-copy" },
      badge(s.tag, { accent: ["iris", "apricot", "aqua"][slide] }),
      el("h1", { id: "ob-title", tabindex: -1 }, s.title),
      el(
        "p",
        { class: "a3-lead" },
        slide === 2 && accountsRequired()
          ? authCopy(state.lang).requiredIntro
          : s.body,
      ),
    ),
  );
  const progress = el(
    "div",
    {
      class: "a3-progress",
      role: "group",
      "aria-label": t.step.replace("{current}", slide + 1),
    },
    el(
      "div",
      { class: "a3-progress-bars", "aria-hidden": "true" },
      [0, 1, 2].map((i) => el("span", { class: i === slide ? "active" : "" })),
    ),
    el(
      "span",
      { "aria-hidden": "true" },
      String(slide + 1).padStart(2, "0") + " / 03",
    ),
  );
  const buttons = el(
    "div",
    { class: "a3-onboarding-actions" },
    slide > 0
      ? action(t.back, () => setSlide(slide - 1), {
          variant: "secondary",
          leading: "arrowLeft",
          id: "ob-back",
        })
      : null,
    action(slide === 2 ? t.choose : t.next, obNext, {
      trailing: "arrowRight",
      id: "ob-next-btn",
    }),
  );
  return [
    utility,
    main,
    el(
      "footer",
      { class: "a3-footer" },
      progress,
      buttons,
      el("p", { class: "a3-footnote" }, t.footer),
    ),
  ];
}
function accountChoice() {
  const required = accountsRequired(),
    a = authCopy(state.lang);
  const t = copy(),
    signed = !!state.accountId;
  const utility = el(
    "div",
    { class: "a3-utility" },
    action(t.back, () => (mode === "email" ? show("choice") : setSlide(2)), {
      variant: "text",
      leading: "arrowLeft",
      id: "ob-back",
    }),
  );
  const main = el(
    "main",
    { class: "a3-onboarding-main a3-choice-main" },
    illustration("ill-auth-welcome", { eager: true, priority: "high" }),
    el(
      "div",
      { class: "a3-copy" },
      badge(signed ? t.savedAccount : t.choiceTag, { accent: "aqua" }),
      el(
        "h1",
        { id: "ob-title", tabindex: -1 },
        signed
          ? t.signedTitle
          : mode === "email"
            ? t.emailTitle
            : required
              ? a.requiredTitle
              : t.choiceTitle,
      ),
      el(
        "p",
        { class: "a3-lead" },
        signed
          ? t.signedBody
          : mode === "email"
            ? t.emailBody
            : required
              ? a.requiredBody
              : t.choiceBody,
      ),
    ),
  );
  if (mode === "email" && !signed) {
    const form = el("section", {
      id: "welcome-account-form",
      class: "a3-auth",
      "aria-label": t.email,
    });
    main.append(form);
    queueMicrotask(() => {
      if (form.isConnected) void renderCloudAccount(state.lang, form);
    });
  }
  if (!signed && mode === "choice") {
    const google = el("div", { class: "a3-google" });
    main.append(google);
    queueMicrotask(() => {
      if (google.isConnected) void renderGoogleControls(google, state.lang);
    });
  }
  const buttons = signed
    ? [
        action(t.continueAccount, startApp, {
          trailing: "arrowRight",
          id: "ob-continue-account",
          disabled: !ready,
        }),
      ]
    : [
        mode === "choice"
          ? action(t.email, () => show("email"), {
              leading: "mail",
              id: "ob-email",
              disabled: !ready,
            })
          : null,
        !required
          ? action(t.guest, startApp, {
              variant: "secondary",
              trailing: "arrowRight",
              id: "ob-guest",
              disabled: !ready,
            })
          : hasDeviceJournal()
            ? action(a.recover, () => goTo("device-recovery"), {
                variant: "secondary",
                id: "auth-device-recovery",
              })
            : null,
      ];
  return [
    utility,
    main,
    el(
      "footer",
      { class: "a3-footer a3-choice-footer" },
      buttons,
      !ready
        ? el("p", { class: "a3-footnote", role: "status" }, t.preparing)
        : null,
      el(
        "p",
        { class: "a3-footnote" },
        required ? a.requiredNote : t.noPressure,
      ),
      !signed
        ? el("p", { class: "a3-privacy" }, icon("shield"), t.localHint)
        : null,
    ),
  ];
}
export function renderOnboarding() {
  if (!ready && pendingLanguage) state.lang = pendingLanguage;
  const root = document.getElementById("screen-onboarding");
  if (!root) return;
  root.classList.add("a3-screen");
  root.dataset.step = mode === "slides" ? String(slide + 1) : mode;
  root.replaceChildren(
    el(
      "div",
      { class: "a3-onboarding-layout" },
      header(),
      mode === "slides" ? slides() : accountChoice(),
    ),
  );
  document.documentElement.lang = state.lang;
}
export function obNext() {
  if (mode !== "slides") return;
  if (slide < 2) setSlide(slide + 1);
  else show("choice");
}
export function startApp() {
  if (!ready || (accountsRequired() && !state.accountId)) return;
  markOnboardingDone();
  goTo("home");
}
window.obNext = obNext;
window.startApp = startApp;
window.addEventListener("a3-theme-changed", () => {
  const button = document.getElementById("ob-theme");
  if (!button) return;
  const t = copy(),
    label = currentTheme() === "dark" ? t.light : t.dark;
  button.setAttribute("aria-label", label);
  button.replaceChildren(
    icon(currentTheme() === "dark" ? "sun" : "moon"),
    el("span", {}, label),
  );
});
