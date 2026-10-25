import { state } from '../state.js';
import { registerScreen } from '../navigation.js';
import { accountAccess, refreshAccess } from '../account-access.js';
import { securityText } from '../security-copy.js';
export function renderUpgrade() {
  const root=document.getElementById('upgrade-content');if(!root)return;
  const t=securityText(state.lang),access=accountAccess();root.replaceChildren();
  for(const text of [t.title,access ? `${t[access.state]} · ${t.usage}: ${access.used}/${access.limit} · ${access.remaining} ${t.remaining}` : t.unknown,
    access ? `${t.renew}: ${new Date(access.renewsAt).toISOString()}` : '',
    access?.validUntil ? `${t.validUntil}: ${new Date(access.validUntil).toISOString()}` : '',
    access?.allowances ? `AI / ${t.usage}: ${t.free} ${access.allowances.free} / Premium ${access.allowances.premium}` : '',t.fullHistory+' — '+t.bothPlans,t.premiumTools+' — Premium',t.attempts,t.privacy,t.billing]) {
    const p=document.createElement('p');p.textContent=text;root.append(p);
  }
  const restore=document.createElement('button');restore.className='btn-primary';restore.textContent=t.restore;
  restore.onclick=async()=>{restore.disabled=true;await refreshAccess(true);renderUpgrade();};root.append(restore);
}
export function handleUpgrade(){renderUpgrade();}
registerScreen('upgrade',renderUpgrade);
