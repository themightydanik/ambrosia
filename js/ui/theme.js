const key = "ambrosia_theme_v3";
let preference = null;
try {
  const saved = localStorage.getItem(key);
  if (["light", "dark"].includes(saved)) preference = saved;
} catch {}
const media = matchMedia("(prefers-color-scheme: dark)");
function initial() {
  if (preference) return preference;
  // Respect the previous dark experience for returning users; new installs follow the OS.
  try {
    if (localStorage.getItem("ambrosia_onboarding_done") === "1") return "dark";
  } catch {}
  return media.matches ? "dark" : "light";
}
export const currentTheme = () =>
  document.documentElement.dataset.a3Theme || initial();
export function applyTheme(value = initial()) {
  document.documentElement.dataset.a3Theme = value;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", value === "dark" ? "#19152D" : "#F5F4FF");
}
export function setTheme(value) {
  if (!["light", "dark"].includes(value)) return;
  preference = value;
  try {
    localStorage.setItem(key, value);
  } catch {}
  applyTheme(value);
  window.dispatchEvent(new Event("a3-theme-changed"));
}
applyTheme();
media.addEventListener("change", () => {
  if (!preference) {
    applyTheme();
    window.dispatchEvent(new Event("a3-theme-changed"));
  }
});
