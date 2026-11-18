import { downloadBlob } from "../download.js";
import { el } from "../wellness/dom.js";
import { action } from "../ui/components.js";
import { state } from "../state.js";
import { goTo, registerScreen } from "../navigation.js";
import { authCopy } from "./copy.js";
import { deviceKeys as keys } from "./device-records.js";
export { hasDeviceJournal } from "./device-records.js";
export function deviceReview(lang) {
  const t = authCopy(lang),
    details = el("details", { class: "auth-device-review" });
  details.append(el("summary", {}, t.review));
  details.addEventListener("toggle", () => {
    if (!details.open || details.querySelector("pre")) return;
    const pre = el("pre");
    try {
      const originals = {};
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        try {
          originals[key] = JSON.parse(raw);
        } catch {
          originals[key] = raw;
        }
      }
      pre.textContent = JSON.stringify(originals, null, 2);
    } catch {
      pre.textContent = t.error;
    }
    details.append(
      pre,
      action(t.export, () =>
        exportDeviceRecovery().catch(() => alert(t.error)),
      ),
    );
  });
  return details;
}
export async function exportDeviceRecovery() {
  const originals = {};
  for (const key of keys) originals[key] = localStorage.getItem(key);
  await downloadBlob(
    new Blob(
      [
        JSON.stringify(
          {
            format: "ambrosia-device-recovery-v1",
            exportedAt: new Date().toISOString(),
            originals,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    "ambrosia-device-recovery.json",
  );
}
function render() {
  const root = document.getElementById("screen-device-recovery"),
    t = authCopy(state.lang);
  root.replaceChildren(
    el(
      "div",
      { class: "a3-onboarding-layout" },
      el("h1", {}, t.recoveryTitle),
      el("p", {}, t.recoveryBody),
      deviceReview(state.lang),
      action(t.export, () =>
        exportDeviceRecovery().catch(() => alert(t.error)),
      ),
      action(t.back, () => goTo("onboarding"), { variant: "secondary" }),
    ),
  );
}
registerScreen("device-recovery", render);
