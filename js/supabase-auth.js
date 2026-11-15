import { invalidateAuthIntent, authTransition } from './auth/coordination.js';
import { renderGoogleControls } from './auth/controls.js';
import {field} from './wellness/dom.js';
import {authRedirect} from './platform.js';
import { renderAccountManagement, renderRecovery, sendPasswordReset } from './account-management.js';
import { securityText } from './security-copy.js';
import { getSupabaseClient } from './supabase-client.js';
import { state } from './state.js';
import { switchAccount, requestSignOut, renderSyncControls } from './sync/runtime.js';
export { getSupabaseClient } from './supabase-client.js';
const copy = {
  en: { title: 'Cloud account', missing: 'Cloud login is not configured yet.', signed: 'Signed in as', email: 'Email address', password: 'Password (at least 12 characters)', signup: 'Sign up', login: 'Sign in', logout: 'Sign out', sent: 'Check your email to confirm registration.', local: 'Changes are saved on this device first. Cloud sync keeps this account separate.' },
  ru: { title: 'Облачный аккаунт', missing: 'Облачный вход пока не настроен.', signed: 'Вы вошли как', email: 'Электронная почта', password: 'Пароль (минимум 12 символов)', signup: 'Регистрация', login: 'Войти', logout: 'Выйти', sent: 'Проверьте почту для подтверждения регистрации.', local: 'Изменения сначала сохраняются на устройстве. Данные аккаунтов разделены.' },
  uk: { title: 'Хмарний акаунт', missing: 'Хмарний вхід ще не налаштований.', signed: 'Ви увійшли як', email: 'Електронна пошта', password: 'Пароль (щонайменше 12 символів)', signup: 'Реєстрація', login: 'Увійти', logout: 'Вийти', sent: 'Перевірте пошту для підтвердження реєстрації.', local: 'Зміни спочатку зберігаються на пристрої. Дані акаунтів розділено.' }
};
let renderGeneration = 0;
export async function renderCloudAccount(lang = 'en', root = document.getElementById('cloud-account')) {
  if (!root || !root.isConnected) return;
  const generation = ++renderGeneration;
  const t = copy[lang] || copy.en, security = securityText(lang);
  root.replaceChildren();
  const title = document.createElement('div'); title.className = 'settings-section-title'; title.textContent = t.title; root.append(title);
  const status = document.createElement('div'); status.style.cssText = 'font-size:13px;line-height:1.6;margin:10px 0'; status.setAttribute('role','status');root.append(status);
  const hint = document.createElement('div'); hint.style.cssText = 'font-size:12px;opacity:.65;margin:10px 0'; hint.textContent = t.local; root.append(hint);
  if (state.accountId) {
    renderSyncControls(root, lang);
    if (!navigator.onLine) {
      const logout = document.createElement('button'); logout.className = 'btn-ghost'; logout.textContent = t.logout;
      logout.onclick = async () => { try { await requestSignOut(); renderCloudAccount(lang, root); } catch (e) { status.textContent = security.error; } }; root.append(logout);
      return;
    }
  }
  let supabase;
  try { supabase = await getSupabaseClient(); } catch (e) { status.textContent = security.error; return; }
  if (!root.isConnected || generation !== renderGeneration) return;
  if (!supabase) { status.textContent = t.missing; return; }
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') { status.textContent = security.error; return; }
  if (!root.isConnected || generation !== renderGeneration) return;
  if (user) {
    status.textContent = t.signed + ' ' + user.email;
    const button = document.createElement('button'); button.className = 'btn-ghost'; button.textContent = t.logout;
    button.onclick = async () => { try { await requestSignOut(); renderCloudAccount(lang, root); } catch (e) { status.textContent = security.error; } };
    root.append(button);
    if (!state.accountId) renderSyncControls(root, lang);
    renderAccountManagement(root,user,lang);
    return;
  }
  const form = document.createElement('form'); form.style.cssText = 'display:grid;gap:10px;margin-top:12px';
  const email = document.createElement('input'); email.type = 'email'; email.required = true; email.placeholder = t.email; email.autocomplete = 'email'; email.setAttribute('aria-label',t.email); email.className = 'profile-edit-input';
  const password = document.createElement('input'); password.type = 'password'; password.required = true; password.minLength = 12; password.placeholder = t.password; password.autocomplete = 'current-password'; password.setAttribute('aria-label',t.password); password.className = 'profile-edit-input';
  const login = document.createElement('button'); login.type = 'submit'; login.className = 'btn-primary'; login.textContent = t.login;
  const signup = document.createElement('button'); signup.type = 'button'; signup.className = 'btn-ghost'; signup.textContent = t.signup;
  const perform = async (mode) => {
    login.disabled = signup.disabled = true; status.textContent = '';
    try {
      const credentials = { email: email.value.trim(), password: password.value };
      invalidateAuthIntent();
      const result = await authTransition(async () => mode === 'signup'
        ? await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: await authRedirect() } })
        : await supabase.auth.signInWithPassword(credentials));
      if (result.error) throw result.error;
      password.value = '';
      if (result.data.session) { switchAccount(result.data.session.user); await renderCloudAccount(lang, root); }
      else status.textContent = t.sent;
    } catch (e) { status.textContent = security.error; }
    finally { login.disabled = signup.disabled = false; }
  };
  form.onsubmit = e => { e.preventDefault(); perform('login'); };
  signup.onclick = () => { if (form.reportValidity()) perform('signup'); };
  const reset=document.createElement('button');reset.type='button';reset.className='btn-ghost';reset.textContent=security.reset;
  reset.onclick=async()=>{if(!email.reportValidity())return;reset.disabled=true;try{await sendPasswordReset(email.value.trim(),supabase,await authRedirect());status.textContent=security.resetSent;}catch{status.textContent=security.error;}finally{reset.disabled=false;}};
  form.append(field(t.email,email),field(t.password,password),login,signup,reset); root.append(form);
  void renderGoogleControls(root,lang);
}
