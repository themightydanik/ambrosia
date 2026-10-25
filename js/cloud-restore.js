import { state, saveEntries } from './state.js';
import { getSupabaseClient } from './supabase-auth.js';

const labels = {
 en:{button:'Restore cloud journal on this device',busy:'Loading cloud journal…',none:'No cloud entries found.',blocked:'This device already has local entries. Restore is blocked to avoid overwriting or mixing journals.',confirm:'Restore cloud journal to this EMPTY device? This copies your private entries into local browser storage. It will not delete cloud data.',done:'Cloud journal restored locally. Reload the page to view entries.',fail:'Could not restore: '},
 ru:{button:'Восстановить журнал из облака',busy:'Загружаем журнал…',none:'В облаке нет записей.',blocked:'На устройстве уже есть записи. Восстановление заблокировано, чтобы не перезаписать и не смешать журналы.',confirm:'Восстановить журнал из облака на это ПУСТОЕ устройство? Записи будут скопированы в локальное хранилище браузера. Облачные данные не удалятся.',done:'Журнал восстановлен локально. Перезагрузите страницу, чтобы увидеть записи.',fail:'Не удалось восстановить: '},
 uk:{button:'Відновити журнал із хмари',busy:'Завантажуємо журнал…',none:'У хмарі немає записів.',blocked:'На пристрої вже є записи. Відновлення заблоковано, щоб не перезаписати чи змішати журнали.',confirm:'Відновити журнал із хмари на цей ПОРОЖНІЙ пристрій? Записи буде скопійовано в локальне сховище браузера. Хмарні дані не видаляться.',done:'Журнал відновлено локально. Перезавантажте сторінку, щоб побачити записи.',fail:'Не вдалося відновити: '}
};
function localDate(iso) {
 const d = new Date(iso);
 if (Number.isNaN(d.getTime())) throw new Error('Invalid cloud entry date');
 return {date:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),time:String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
}
async function fetchAll(query) {
 const result=[];
 for(let from=0; ; from+=500) {
   const {data,error}=await query.range(from,from+499);
   if(error) throw error;
   result.push(...data);
   if(data.length<500) return result;
   if(result.length>10000) throw new Error('Journal too large for this restore flow');
 }
}
export function renderCloudRestore(root,lang,user) {
 const t=labels[lang]||labels.en;
 const button=document.createElement('button');button.type='button';button.className='btn-ghost';button.textContent=t.button;
 const status=document.createElement('div');status.style.cssText='font-size:12px;line-height:1.6;margin:8px 0';
 root.append(button,status);
 button.onclick=async()=>{
   if(state.entries.length) {status.textContent=t.blocked;return;}
   if(!confirm(t.confirm)) return;
   button.disabled=true;status.textContent=t.busy;
   try {
     const supabase=await getSupabaseClient();
     const {data:{user:current},error:authError}=await supabase.auth.getUser();
     if(authError||!current||current.id!==user.id) throw new Error('Session changed; sign in again.');
     const entries=await fetchAll(supabase.from('journal_entries').select('*').eq('user_id',user.id).order('recorded_at',{ascending:true}));
     if(!entries.length){status.textContent=t.none;return;}
     const updates=await fetchAll(supabase.from('entry_status_updates').select('*').eq('user_id',user.id).order('recorded_at',{ascending:true}));
     const byEntry=new Map();
     for(const u of updates){const list=byEntry.get(u.entry_id)||[];const when=localDate(u.recorded_at);list.push({date:when.date,time:when.time,status:u.status,notes:u.notes||''});byEntry.set(u.entry_id,list);}
     // Use numeric IDs to remain compatible with existing inline modal handlers.
     // These IDs are local-only and never written back as cloud identifiers.
     const restored=entries.map((e,i)=>{
       const when=localDate(e.recorded_at);
       return {id:i+1,date:when.date,time:when.time,timestamp:e.recorded_at,category:e.category,
         symptoms:e.symptoms||[],intensity:e.intensity,triggers:e.triggers||[],notes:e.notes||'',
         criticalTracking:e.critical_tracking===true,statusUpdates:byEntry.get(e.id)||[]};
     });
     if(state.entries.length||localStorage.getItem('ambrosia_entries')&&JSON.parse(localStorage.getItem('ambrosia_entries')).length) {status.textContent=t.blocked;return;}
     // Persist before changing state. A storage quota failure leaves current journal untouched.
     localStorage.setItem('ambrosia_entries',JSON.stringify(restored));
     state.entries=restored;
     status.textContent=t.done;
   } catch(e){status.textContent=t.fail+e.message;}
   finally{button.disabled=false;}
 };
}
