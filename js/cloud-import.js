import { state } from './state.js';
import { getSupabaseClient } from './supabase-auth.js';

// Deterministic IDs allow retry after a partially successful import without duplicates.
async function stableId(userId, value) {
  const bytes = new TextEncoder().encode('ambrosia-v1:' + userId + ':' + value);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hex = Array.from(digest.slice(0, 16), x => x.toString(16).padStart(2, '0'));
  hex[6] = (parseInt(hex[6], 16) & 0x0f | 0x40).toString(16);
  hex[8] = (parseInt(hex[8], 16) & 0x3f | 0x80).toString(16);
  const s = hex.join('');
  return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);
}
function recordedAt(date, time, fallback) {
  if (typeof date === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(date)) {
    const d = new Date(date + 'T' + (/^\\d{2}:\\d{2}$/.test(time || '') ? time : '12:00') + ':00');
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const d = new Date(fallback || '');
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
const messages = {
  en: { button:'Import local journal into cloud', confirm:'Upload your local journal to your Supabase account? Existing local data will remain. This sends sensitive symptom notes to your cloud database.', empty:'There are no local journal entries to import.', done:'Import completed. Your local journal remains unchanged. Cloud download/sync is not enabled yet.', existing:'Cloud already contains entries. Import is paused to avoid mixing or overwriting data.', busy:'Importing entries…', fail:'Import failed: ' },
  ru: { button:'Перенести локальный журнал в облако', confirm:'Загрузить локальный журнал в ваш аккаунт Supabase? Локальные данные сохранятся. Чувствительные заметки о симптомах будут отправлены в облачную базу.', empty:'В локальном журнале нет записей.', done:'Перенос завершён. Локальный журнал не изменён. Загрузка записей из облака пока не включена.', existing:'В облаке уже есть записи. Перенос приостановлен, чтобы избежать смешивания или перезаписи.', busy:'Переносим записи…', fail:'Ошибка переноса: ' },
  uk: { button:'Перенести локальний журнал у хмару', confirm:'Завантажити локальний журнал у ваш акаунт Supabase? Локальні дані залишаться. Чутливі нотатки про симптоми буде надіслано в хмарну базу.', empty:'У локальному журналі немає записів.', done:'Перенесення завершено. Локальний журнал не змінено. Завантаження записів із хмари ще не ввімкнено.', existing:'У хмарі вже є записи. Перенесення призупинено, щоб уникнути змішування або перезапису.', busy:'Переносимо записи…', fail:'Помилка перенесення: ' }
};
export function renderCloudImport(root, lang, user) {
  const t = messages[lang] || messages.en;
  const button = document.createElement('button'); button.className = 'btn-ghost'; button.textContent = t.button;
  const status = document.createElement('div'); status.style.cssText = 'font-size:12px;line-height:1.6;margin:8px 0';
  root.append(button, status);
  button.onclick = async () => {
    const entries = state.entries.filter(e => !e.isUpdate);
    if (!entries.length) { status.textContent = t.empty; return; }
    if (!confirm(t.confirm)) return;
    button.disabled = true; status.textContent = t.busy;
    try {
      const supabase = await getSupabaseClient();
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser || currentUser.id !== user.id) throw new Error('Session changed; sign in again.');
      const { count, error: countError } = await supabase.from('journal_entries').select('id', { count: 'exact', head: true });
      if (countError) throw countError;
      // A prior interrupted import is retryable only on this same browser.
      const marker = 'ambrosia_import_started_' + user.id;
      if (count > 0 && localStorage.getItem(marker) !== '1') { status.textContent = t.existing; return; }
      localStorage.setItem(marker, '1');
      for (const entry of entries) {
        const id = await stableId(user.id, 'entry:' + String(entry.id));
        const row = { id, user_id:user.id, recorded_at:recordedAt(entry.date,entry.time,entry.timestamp), category:entry.category || null,
          symptoms:Array.isArray(entry.symptoms) ? entry.symptoms : [], intensity:Math.min(10,Math.max(1,Number(entry.intensity)||1)),
          triggers:Array.isArray(entry.triggers) ? entry.triggers : [], notes:String(entry.notes || ''), critical_tracking:entry.criticalTracking === true };
        const { error } = await supabase.from('journal_entries').upsert(row, { onConflict:'id', ignoreDuplicates:true });
        if (error) throw error;
        const updates = Array.isArray(entry.statusUpdates) ? entry.statusUpdates : [];
        for (let i=0;i<updates.length;i++) {
          const u = updates[i];
          if (!['resolved','improved','same','worse'].includes(u.status)) continue;
          const updateId = await stableId(user.id, 'status:' + String(entry.id) + ':' + i);
          const { error: updateError } = await supabase.from('entry_status_updates').upsert({
            id:updateId, user_id:user.id, entry_id:id, status:u.status, notes:String(u.notes||''),
            recorded_at:recordedAt(u.date,u.time)
          }, { onConflict:'id', ignoreDuplicates:true });
          if (updateError) throw updateError;
        }
      }
      localStorage.removeItem(marker);
      status.textContent = t.done;
    } catch (e) { status.textContent = t.fail + e.message; }
    finally { button.disabled = false; }
  };
}
