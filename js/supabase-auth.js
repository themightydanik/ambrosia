import { getSupabaseClient } from './supabase-client.js';
import { switchAccount, renderSyncControls } from './sync/runtime.js';
export { getSupabaseClient } from './supabase-client.js';
const copy = {
  en: { title: 'Cloud account', missing: 'Cloud login is not configured yet.', signed: 'Signed in as', email: 'Email address', password: 'Password (at least 6 characters)', signup: 'Sign up', login: 'Sign in', logout: 'Sign out', sent: 'Check your email to confirm registration.', local: 'Changes are saved on this device first. Cloud sync keeps this account separate.' },
  ru: { title: 'Облачный аккаунт', missing: 'Облачный вход пока не настроен.', signed: 'Вы вошли как', email: 'Электронная почта', password: 'Пароль (минимум 6 символов)', signup: 'Регистрация', login: 'Войти', logout: 'Выйти', sent: 'Проверьте почту для подтверждения регистрации.', local: 'Изменения сначала сохраняются на устройстве. Данные аккаунтов разделены.' },
  uk: { title: 'Хмарний акаунт', missing: 'Хмарний вхід ще не налаштований.', signed: 'Ви увійшли як', email: 'Електронна пошта', password: 'Пароль (щонайменше 6 символів)', signup: 'Реєстрація', login: 'Увійти', logout: 'Вийти', sent: 'Перевірте пошту для підтвердження реєстрації.', local: 'Зміни спочатку зберігаються на пристрої. Дані акаунтів розділено.' }
};
let renderGeneration = 0;
export async function renderCloudAccount(lang = 'en') {
  const root = document.getElementById('cloud-account');
  if (!root) return;
  const generation = ++renderGeneration;
  const t = copy[lang] || copy.en;
  root.replaceChildren();
  const title = document.createElement('div'); title.className = 'settings-section-title'; title.textContent = t.title; root.append(title);
  const status = document.createElement('div'); status.style.cssText = 'font-size:13px;line-height:1.6;margin:10px 0'; root.append(status);
  const hint = document.createElement('div'); hint.style.cssText = 'font-size:12px;opacity:.65;margin:10px 0'; hint.textContent = t.local; root.append(hint);
  let supabase;
  try { supabase = await getSupabaseClient(); } catch (e) { status.textContent = e.message; return; }
  if (!root.isConnected || generation !== renderGeneration) return;
  if (!supabase) { status.textContent = t.missing; return; }
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') { status.textContent = error.message; return; }
  if (!root.isConnected || generation !== renderGeneration) return;
  if (user) {
    status.textContent = t.signed + ' ' + user.email;
    const button = document.createElement('button'); button.className = 'btn-ghost'; button.textContent = t.logout;
    button.onclick = async () => { const { error } = await supabase.auth.signOut(); if (error) status.textContent = error.message; else { switchAccount(null); renderCloudAccount(lang); } };
    root.append(button);
    renderSyncControls(root, lang);
    return;
  }
  const form = document.createElement('form'); form.style.cssText = 'display:grid;gap:10px;margin-top:12px';
  const email = document.createElement('input'); email.type = 'email'; email.required = true; email.placeholder = t.email; email.autocomplete = 'email'; email.className = 'profile-edit-input';
  const password = document.createElement('input'); password.type = 'password'; password.required = true; password.minLength = 6; password.placeholder = t.password; password.autocomplete = 'current-password'; password.className = 'profile-edit-input';
  const login = document.createElement('button'); login.type = 'submit'; login.className = 'btn-primary'; login.textContent = t.login;
  const signup = document.createElement('button'); signup.type = 'button'; signup.className = 'btn-ghost'; signup.textContent = t.signup;
  const perform = async (mode) => {
    login.disabled = signup.disabled = true; status.textContent = '';
    try {
      const credentials = { email: email.value.trim(), password: password.value };
      const result = mode === 'signup'
        ? await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: location.origin + location.pathname } })
        : await supabase.auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      password.value = '';
      if (result.data.session) { switchAccount(result.data.session.user); await renderCloudAccount(lang); }
      else status.textContent = t.sent;
    } catch (e) { status.textContent = e.message; }
    finally { login.disabled = signup.disabled = false; }
  };
  form.onsubmit = e => { e.preventDefault(); perform('login'); };
  signup.onclick = () => { if (form.reportValidity()) perform('signup'); };
  form.append(email,password,login,signup); root.append(form);
}
