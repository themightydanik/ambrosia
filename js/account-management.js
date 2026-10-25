import { state } from './state.js';
import { getSupabaseClient } from './supabase-client.js';
import { authenticatedFetch, accountAccess, refreshAccess } from './account-access.js';
import { securityText } from './security-copy.js';
import { eraseDeletedAccount, requestSignOut, localAccountArchive } from './sync/runtime.js';
function control(root,label,action) {
  const button=document.createElement('button');button.type='button';button.className='btn-ghost';button.textContent=label;
  button.onclick=async()=>{button.disabled=true;try{await action();}catch{alert(securityText(state.lang).error);}finally{button.disabled=false;}};root.append(button);return button;
}
export async function exportUserData() {
  const user=state.accountId,local=localAccountArchive();let cloud=null;
  if(user){
    const client=await getSupabaseClient();if(!client)throw Error('NOT_CONFIGURED');
    const {data:authData,error:authError}=await client.auth.getUser();if(authError||authData.user?.id!==user)throw Error('SESSION_EXPIRED');
    const {data,error}=await client.rpc('export_account_data');if(error)throw error;
    if(state.accountId!==user || data.userId!==user)throw Error('SESSION_EXPIRED');cloud={...data,auth:authData.user};
  }
  const blob=new Blob([JSON.stringify({format:'ambrosia-full-export-v1',exportedAt:new Date().toISOString(),cloud,local},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ambrosia-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function sendPasswordReset(email,client,redirectTo) {
  // Supabase handles rate limits and enumeration protection. Show the same result for all addresses.
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('INVALID_INPUT');
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo});if(error)throw Error('SERVICE_UNAVAILABLE');
}
export function renderAccountManagement(root,user,lang) {
  const t=securityText(lang);const section=document.createElement('div');section.className='sync-panel';section.dataset.accountPrivacy='';root.append(section);
  if(state.recoveringPassword){renderRecovery(section);return;}
  const title=document.createElement('p');title.textContent=t.title;section.append(title);
  control(section,t.restore,async()=>{await refreshAccess(true);const access=accountAccess();status.textContent=access?`${t[access.state]} · ${access.remaining} ${t.remaining} · ${t.renew}: ${new Date(access.renewsAt).toISOString()}`:t.unavailable;});
  const status=document.createElement('p');status.setAttribute('role','status');section.append(status);
  control(section,t.export,exportUserData);
  control(section,t.reset,async()=>{const client=await getSupabaseClient();await sendPasswordReset(user.email,client,location.origin+location.pathname);status.textContent=t.resetSent;});
  const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent=t.delete;details.append(summary);section.append(details);
  const warning=document.createElement('p');warning.textContent=t.deleteWarning;details.append(warning);
  const form=document.createElement('form');form.className='account-form';details.append(form);
  const password=document.createElement('input');password.type='password';password.required=true;password.maxLength=1024;password.autocomplete='current-password';password.placeholder=t.password;password.className='profile-edit-input';
  const confirmation=document.createElement('input');confirmation.required=true;confirmation.pattern='DELETE';confirmation.placeholder=t.deleteConfirm;confirmation.className='profile-edit-input';
  const label=document.createElement('label'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.required=true;label.append(checkbox,document.createTextNode(t.localConsent));
  const submit=document.createElement('button');submit.type='submit';submit.className='btn-ghost';submit.textContent=t.delete;form.append(password,confirmation,label,submit);
  form.onsubmit=async event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const userId=user.id;
    if(userId!==state.accountId){status.textContent=t.SESSION_EXPIRED;return;}
    // Only unchanged browser data explicitly covered by this confirmation may be purged after a slow response.
    const snapshot=Object.keys(localStorage).filter(k=>k.startsWith('ambrosia_')).map(k=>[k,localStorage.getItem(k)]);
    submit.disabled=true;
    try {
      const payload={password:password.value,confirmation:confirmation.value};password.value='';
      const result=await authenticatedFetch('/api/delete-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},true);
      if(result.deleted!==true)throw Error('DELETE_FAILED');
      await eraseDeletedAccount(userId,snapshot);alert(t.deleted);
    }catch(error){status.textContent=t[error.message]||t.error;}
    finally{submit.disabled=false;}
  };
}
export function renderRecovery(root) {
  const t=securityText(state.lang),form=document.createElement('form');form.className='account-form';form.dataset.passwordRecovery='';
  const password=document.createElement('input');password.type='password';password.required=true;password.minLength=12;password.maxLength=1024;password.placeholder=t.newPassword;password.autocomplete='new-password';password.className='profile-edit-input';
  const repeat=password.cloneNode();repeat.placeholder=t.repeatPassword;
  const button=document.createElement('button');button.type='submit';button.className='btn-primary';button.textContent=t.updatePassword;
  const status=document.createElement('p');status.setAttribute('role','status');form.append(password,repeat,button,status);root.append(form);
  form.onsubmit=async event=>{
    event.preventDefault();if(password.value!==repeat.value||password.value.length<12){status.textContent=t.passwordMismatch;return;}
    const user=state.accountId;button.disabled=true;
    try {
      const client=await getSupabaseClient();const {error}=await client.auth.updateUser({password:password.value});if(error)throw error;
      password.value=repeat.value='';if(user!==state.accountId)return;
      // Revoke other refresh sessions too; existing access JWTs may remain valid until their expiry.
      const {error:revokeError}=await client.auth.signOut({scope:'others'});
      state.recoveringPassword=false;await requestSignOut();alert(t.passwordDone+(revokeError?' '+t.sessionWarning:''));
    }catch{status.textContent=t.error;}finally{button.disabled=false;}
  };
}
