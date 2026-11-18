import { el } from "../wellness/dom.js";
import { action } from "../ui/components.js";
import { authCopy } from "./copy.js";
import { googleAvailable } from "./config.js";
import { startGoogle, cancelGoogle, pendingGoogle } from "./google.js";
export async function renderGoogleControls(root, lang) {
  if (!(await googleAvailable()) || !root.isConnected) return;
  const t = authCopy(lang),
    status = el("p", { role: "status", class: "a3-footnote" });
  status.dataset.googleStatus = "";
  let cancel;
  function cancelControl() {
    cancel?.remove();
    cancel = action(
      t.cancel,
      () => {
        cancelGoogle();
        status.textContent = "";
        button.disabled = false;
        cancel.remove();
      },
      { variant: "secondary" },
    );
    cancel.dataset.googleCancel = "";
    root.append(cancel);
  }
  const button = action(
    t.google,
    async () => {
      button.disabled = true;
      try {
        await startGoogle();
        if (root.isConnected) {
          status.textContent = t.pending;
          cancelControl();
        }
      } catch {
        status.textContent = t.failed;
        button.disabled = false;
      }
    },
    { id: root.id ? root.id + "-google" : "auth-google" },
  );
  button.dataset.googleLogin = "";
  root.append(button, status);
  if (pendingGoogle()) {
    status.textContent = t.pending;
    button.disabled = true;
    cancelControl();
  }
}

window.addEventListener("google-auth-failed", () => {
  for (const status of document.querySelectorAll("[data-google-status]"))
    status.textContent = authCopy(document.documentElement.lang).failed;
  for (const button of document.querySelectorAll("[data-google-login]"))
    button.disabled = false;
});
window.addEventListener("google-auth-changed", () => {
  if (!pendingGoogle()) {
    for (const status of document.querySelectorAll("[data-google-status]"))
      status.textContent = "";
    for (const control of document.querySelectorAll("[data-google-cancel]"))
      control.remove();
    for (const button of document.querySelectorAll("[data-google-login]"))
      button.disabled = false;
  }
});
