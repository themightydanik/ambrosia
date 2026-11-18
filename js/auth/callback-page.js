// Capture and scrub BEFORE constructing a Supabase client (email defaults remain unchanged).
const callback = location.href;
history.replaceState({}, "", location.pathname);
const messages = {
  en: {
    wait: "Confirming your Google sign-in…",
    done: "Signed in. Returning to Ambrosia…",
    failed:
      "Sign-in could not be confirmed. Return to Ambrosia and start again.",
    back: "Return to Ambrosia",
  },
  uk: {
    wait: "Підтверджуємо вхід через Google…",
    done: "Вхід підтверджено. Повертаємося до Ambrosia…",
    failed:
      "Не вдалося підтвердити вхід. Поверніться до Ambrosia й почніть знову.",
    back: "Повернутися до Ambrosia",
  },
  ru: {
    wait: "Подтверждаем вход через Google…",
    done: "Вход подтверждён. Возвращаемся в Ambrosia…",
    failed:
      "Не удалось подтвердить вход. Вернитесь в Ambrosia и начните заново.",
    back: "Вернуться в Ambrosia",
  },
};
const t = messages[localStorage.getItem("ambrosia_lang")] || messages.en;
document.querySelector("[role=status]").textContent = t.wait;
document.querySelector("a").textContent = t.back;
try {
  const { loadAuthSettings } = await import("./config.js");
  await loadAuthSettings();
  const { finishGoogle } = await import("./google.js");
  await finishGoogle(callback);
  sessionStorage.setItem("ambrosia_oauth_return", "1");
  document.querySelector("[role=status]").textContent = t.done;
  location.replace("/");
} catch {
  document.querySelector("[role=status]").textContent = t.failed;
}
