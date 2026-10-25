const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
let base = process.env.AMBROSIA_TEST_URL;
const http = require('node:http');
const path = require('node:path');
let staticServer;
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const rows=new Map(), errors=[];
const wait = (page, fn) => page.waitForFunction(fn, null, {timeout:15000});
(async()=>{
  if (!base) {
    const root = path.resolve('.');
    staticServer=http.createServer((req,res)=>{
      const filename=path.resolve(root,'.'+new URL(req.url,'http://test').pathname.replace(/\/$/,'/index.html'));
      if(!filename.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
      fs.readFile(filename,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('content-type',filename.endsWith('.js')?'text/javascript':filename.endsWith('.css')?'text/css':'text/html');res.end(data);});
    });
    await new Promise(resolve=>staticServer.listen(0,'127.0.0.1',resolve));
    base='http://127.0.0.1:'+staticServer.address().port;
  }
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : chromium.executablePath()),args:['--no-sandbox']});
  try {
    async function device(legacy=false) {
      const ctx=await browser.newContext();
      await ctx.addInitScript(({A,legacy})=>{
        if(!localStorage.getItem('__test_initialized')) {
          localStorage.setItem('__test_initialized','1');localStorage.setItem('__test_user',JSON.stringify({id:A,email:'a@example.test'}));
          localStorage.setItem('ambrosia_onboarding_done','1');localStorage.setItem('ambrosia_last_visit',new Date().toISOString().split('T')[0]);localStorage.setItem('ambrosia_daily_streak','1');
          if(legacy) localStorage.setItem('ambrosia_entries',JSON.stringify([{id:123,date:'2026-10-20',time:'12:00',timestamp:'2026-10-20T12:00:00Z',category:'pain',symptoms:['headache'],intensity:5,triggers:[],notes:'Private legacy journal',statusUpdates:[]}]));
        }
      },{A,legacy});
      await ctx.route('**/api/supabase-config',r=>r.fulfill({json:{url:'https://test.supabase.invalid',publishableKey:'public-test-only'}}));
      await ctx.route('https://esm.sh/**',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync('tests/mock-supabase.js','utf8')}));
      await ctx.route('**/__test/**',async route=>{
        const req=route.request(),url=new URL(req.url()),user=req.headers()['x-test-user'];
        if(url.pathname.endsWith('/page')) {
          assert.equal(url.searchParams.get('user_id'),user);
          const data=[...rows.values()].filter(r=>r.user_id===user && (!url.searchParams.get('after') || r.id>url.searchParams.get('after'))).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,500);
          return route.fulfill({json:data});
        }
        const p=req.postDataJSON();assert.equal(p.p_user,user);const key=user+':'+p.p_id,old=rows.get(key);
        if(old && (old.version!==p.p_base || old.operation_id===p.p_operation)) return route.fulfill({json:old});
        const row={user_id:user,id:p.p_id,kind:p.p_kind,payload:p.p_payload,version:(old?.version||0)+1,deleted:p.p_deleted,operation_id:p.p_operation};rows.set(key,row);return route.fulfill({json:row});
      });
      const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
      page.on('dialog',d=>d.accept());
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await wait(page,()=>window.testAuth && document.querySelector('#sync-status').dataset.status==='synced');
      return {ctx,page};
    }
    const a=await device(true),b=await device();
    assert.equal(rows.size,0,'first login uploaded nothing');
    assert.equal(await a.page.evaluate(async()=> (await import('/js/state.js')).state.entries.length),0,'legacy journal hidden on login');
    await a.page.evaluate(()=>window.goTo('settings'));
    await a.page.getByRole('button',{name:'Merge device journal into this account',exact:true}).click();
    await wait(a.page,()=>document.querySelector('#sync-status').dataset.status==='synced');
    assert.equal(rows.size,2);assert.ok(await a.page.evaluate(()=>localStorage.getItem('ambrosia_entries')));
    await b.page.evaluate(async()=>{const {renderSyncControls}=await import('/js/sync/runtime.js');window.goTo('settings');});
    await b.page.getByRole('button',{name:'Sync now / retry',exact:true}).click();
    await wait(b.page,async()=> (await import('/js/state.js')).state.entries.length===1);
    console.log('PASS browser: consented migration and second-device download');
    // Exercise real log form offline, not only store helpers.
    await a.page.evaluate(()=>navigator.serviceWorker.ready);
    await wait(a.page,()=>!!navigator.serviceWorker.controller);
    await a.ctx.setOffline(true);await a.page.evaluate(()=>window.goTo('log'));
    await a.page.locator('.cat-btn').first().click();await a.page.locator('.sym-btn').first().click();
    await a.page.locator('#log-next1').click();await a.page.locator('#log-next2').click();await a.page.locator('#log-notes').fill('Offline browser entry');await a.page.locator('#log-save-btn').click();
    await wait(a.page,()=>document.querySelector('#sync-status').dataset.status==='offline');
    assert.equal(rows.size,2);
    await a.page.reload({waitUntil:'domcontentloaded'});
    await wait(a.page,async()=> (await import('/js/state.js')).state.entries.some(e=>e.notes==='Offline browser entry'));
    assert.equal(await a.page.evaluate(()=>document.querySelector('#sync-status').dataset.status),'offline');
    await a.ctx.setOffline(false);await wait(a.page,()=>document.querySelector('#sync-status').dataset.status==='synced');
    assert.equal(rows.size,3);
    console.log('PASS browser: offline form save, offline reload and automatic reconnect');
    // Download, open UUID card, append status through the actual modal, then delete on other device.
    await b.page.evaluate(()=>window.goTo('settings'));await b.page.getByRole('button',{name:'Sync now / retry',exact:true}).click();
    await wait(b.page,async()=> (await import('/js/state.js')).state.entries.length===2);
    await b.page.evaluate(()=>window.goTo('history'));
    await b.page.locator('#history-list .entry-card').filter({hasText:'Offline browser entry'}).click();
    await b.page.locator('.modal-btn--update').click();await b.page.locator('#modal-update-notes').fill('Browser status note');await b.page.locator('.modal-status-btn').first().click();
    await wait(b.page,()=>document.querySelector('#sync-status').dataset.status==='synced');
    assert.ok([...rows.values()].some(r=>r.payload.statusUpdates?.some(u=>u.notes==='Browser status note')));
    await a.page.evaluate(()=>window.goTo('settings'));await a.page.getByRole('button',{name:'Sync now / retry',exact:true}).click();
    await wait(a.page,async()=> (await import('/js/state.js')).state.entries.some(e=>e.statusUpdates.some(u=>u.notes==='Browser status note')));
    await a.page.evaluate(()=>window.goTo('history'));await a.page.locator('#history-list .entry-card').filter({hasText:'Offline browser entry'}).click();await a.page.locator('.modal-btn--delete').click();
    await wait(a.page,()=>document.querySelector('#sync-status').dataset.status==='synced');
    await b.page.evaluate(()=>window.goTo('settings'));await b.page.getByRole('button',{name:'Sync now / retry',exact:true}).click();await wait(b.page,async()=> (await import('/js/state.js')).state.entries.length===1);
    console.log('PASS browser: UUID card handlers, status update, deletion propagation');
    // Synchronize the actual profile form and language; cancel does not mutate persisted avatar.
    await a.page.evaluate(()=>window.goTo('settings'));
    await a.page.locator('.profile-edit-btn').click();
    await a.page.locator('#profile-name-input').fill('Browser profile');
    await a.page.locator('#profile-age-input').fill('31');
    await a.page.locator('#profile-occupation-input').fill('Test engineer');
    await a.page.locator('.avatar-option').nth(3).click();
    assert.equal(await a.page.locator('#profile-name-input').inputValue(),'Browser profile');
    await a.page.evaluate(()=>window.saveProfileEdit());
    await wait(a.page,()=>document.querySelector('#sync-status').dataset.status==='synced');
    await b.page.evaluate(()=>window.goTo('settings'));await b.page.getByRole('button',{name:'Sync now / retry',exact:true}).click();
    await wait(b.page,async()=> (await import('/js/state.js')).state.profile.name==='Browser profile');
    const avatar=await a.page.evaluate(async()=> (await import('/js/state.js')).state.profile.avatar);
    await a.page.locator('.profile-edit-btn').click();await a.page.locator('.avatar-option').nth(5).click();await a.page.evaluate(()=>window.cancelProfileEdit());
    assert.equal(await a.page.evaluate(async()=> (await import('/js/state.js')).state.profile.avatar),avatar);
    await a.page.evaluate(()=>window.setLang('uk'));await wait(a.page,()=>document.querySelector('#sync-status').dataset.status==='synced');
    await b.page.getByRole('button',{name:'Sync now / retry',exact:true}).click();await wait(b.page,async()=> (await import('/js/state.js')).state.lang==='uk');
    await a.page.evaluate(()=>window.setLang('en'));await wait(a.page,()=>document.querySelector('#sync-status').dataset.status==='synced');
    await b.page.locator('[data-sync-panel] button').first().click();await wait(b.page,async()=> (await import('/js/state.js')).state.lang==='en');
    console.log('PASS browser: profile form, avatar cancel and account language synchronization');
    // Concurrent status edits use the real modal and conflict-review controls.
    await b.ctx.setOffline(true);
    for (const device of [b,a]) {
      await device.page.evaluate(()=>window.goTo('history'));await device.page.locator('#history-list .entry-card').first().click();
      await device.page.locator('.modal-btn--update').click();await device.page.locator('#modal-update-notes').fill(device===a?'Concurrent A':'Concurrent B');await device.page.locator('.modal-status-btn').nth(1).click();
    }
    await wait(a.page,()=>document.querySelector('#sync-status').dataset.status==='synced');
    await b.ctx.setOffline(false);await wait(b.page,()=>document.querySelector('#sync-status').dataset.status==='conflict');
    await b.page.evaluate(()=>window.goTo('settings'));await b.page.locator('[data-sync-panel] details summary').click();
    await b.page.getByRole('button',{name:'Use cloud version',exact:true}).click();await wait(b.page,()=>document.querySelector('#sync-status').dataset.status==='synced');
    assert.ok(await b.page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('ambrosia_sync_v2:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).archives).length>0));
    console.log('PASS browser: simultaneous status updates retain both versions until explicit review');
    await b.ctx.setOffline(true);await b.page.evaluate(()=>window.goTo('settings'));
    await b.page.getByRole('button',{name:'Sign out',exact:true}).click();
    assert.equal(await b.page.evaluate(async()=> (await import('/js/state.js')).state.accountId),null);
    await b.ctx.setOffline(false);await wait(b.page,()=>!localStorage.getItem('ambrosia_sync_logout_requested'));
    assert.equal(await b.page.evaluate(async()=> (await import('/js/state.js')).state.accountId),null);
    console.log('PASS browser: offline sign-out stays signed out after reconnect');
    // Account changes erase journal, profile, modal and AI output. Guest never sees old restored keys.
    await a.page.evaluate(B=>window.testAuth.setUser({id:B,email:'b@example.test'}),B);
    await wait(a.page,()=>document.querySelector('#sync-status').dataset.status==='synced');
    assert.equal(await a.page.evaluate(async()=> (await import('/js/state.js')).state.entries.length),0);
    await a.page.evaluate(()=>window.testAuth.signOut());
    assert.equal(await a.page.evaluate(async()=> (await import('/js/state.js')).state.entries.length),0);
    await a.page.evaluate(A=>window.testAuth.setUser({id:A,email:'a@example.test'}),A);
    await wait(a.page,async()=> (await import('/js/state.js')).state.entries.length===1);
    console.log('PASS browser: logout/account switching and original-data protection');
    const readOnly=await a.ctx.newPage();readOnly.on('dialog',d=>d.accept());
    await readOnly.goto(base,{waitUntil:'domcontentloaded'});
    await wait(readOnly,()=>document.querySelector('#sync-status').textContent.includes('Another Ambrosia tab'));
    assert.equal(await readOnly.evaluate(async()=>{const {saveProfile}=await import('/js/state.js');try{saveProfile({name:'forbidden secondary-tab edit'});return false;}catch{return true;}}),true);
    await readOnly.close();
    const guest=await browser.newContext();await guest.route('**/api/supabase-config',r=>r.fulfill({json:{url:'',publishableKey:''}}));
    await guest.addInitScript(()=>{localStorage.setItem('ambrosia_onboarding_done','1');localStorage.setItem('ambrosia_premium','1');localStorage.setItem('ambrosia_last_visit',new Date().toISOString().split('T')[0]);localStorage.setItem('ambrosia_entries',JSON.stringify([{id:123,date:'2026-10-20',time:'12:00',timestamp:'2026-10-20T12:00:00Z',symptoms:['headache'],triggers:[],intensity:4,notes:'Numeric legacy record'}]));});
    const gp=await guest.newPage();gp.on('pageerror',e=>errors.push(e.message));await gp.goto(base,{waitUntil:'domcontentloaded'});
    await wait(gp,async()=> (await import('/js/state.js')).state.entries.length===1);
    await gp.evaluate(()=>window.goTo('history'));await gp.locator('#history-list .entry-card').click();
    await gp.locator('.modal-btn--update').click();await gp.locator('.modal-status-btn').first().click();
    assert.equal(await gp.evaluate(()=>JSON.parse(localStorage.getItem('ambrosia_entries'))[0].statusUpdates),undefined);
    assert.equal(await gp.evaluate(async()=> (await import('/js/state.js')).state.entries[0].statusUpdates.length),1);
    await guest.close();
    assert.deepEqual(errors,[]);
    console.log('PASS browser: secondary tab read-only, legacy numeric modal compatibility, immutable original keys; no JS errors');
  } finally { await browser.close(); if(staticServer) await new Promise(resolve=>staticServer.close(resolve)); }
})().catch(e=>{console.error(e);process.exit(1)});
