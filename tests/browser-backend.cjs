// Test transport only. Browser uses actual Netlify handlers with simulated Supabase/Groq services.
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-private',GROQ_API_KEY:'fixture-groq'};
module.exports = function backend(rows) {
  const tiers=new Map(),used=new Map(),deleted=new Set();let providerCalls=0;
  const snapshot=user=>({userId:user,tier:tiers.get(user)||'free',state:tiers.get(user)==='premium'?'active':'free',validUntil:new Date(Date.now()+86400000).toISOString(),used:used.get(user)||0,limit:tiers.get(user)==='premium'?60:3,remaining:(tiers.get(user)==='premium'?60:3)-(used.get(user)||0),renewsAt:'2027-01-01T00:00:00Z',aiEnabled:true,allowances:{free:3,premium:60}});
  const fetcher=async(url,options)=>{
    const token=options.headers.Authorization||'',user=token.replace('Bearer test-token-','');
    if(url.endsWith('/auth/v1/user'))return Response.json({id:user,email:user===A?'a@example.test':'b@example.test',email_confirmed_at:'2026-01-01'}, {status:deleted.has(user)?401:200});
    if(url.endsWith('/rpc/account_status'))return Response.json(snapshot(user));
    if(url.endsWith('/rpc/reserve_ai_request')){const v=JSON.parse(options.body);const s=snapshot(v.p_user);if(s.remaining<=0)return Response.json({allowed:false,code:'QUOTA_EXCEEDED',usage:s});used.set(v.p_user,s.used+1);return Response.json({allowed:true,usage:snapshot(v.p_user)});}
    if(url.endsWith('/rpc/finish_ai_request'))return Response.json(null);
    if(url.includes('api.groq.com')){providerCalls++;return Response.json({choices:[{message:{content:'<img src=x onerror="window.__xss=1"> Observations only'}}]});}
    if(url.includes('/auth/v1/token')){const v=JSON.parse(options.body);return Response.json({user:{id:v.email==='a@example.test'?A:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}}, {status:v.password==='correct-current-password'?200:400});}
    if(url.includes('/auth/v1/admin/users/')){const id=url.split('/').at(-1);deleted.add(id);for(const [key,row] of rows)if(row.user_id===id)rows.delete(key);return Response.json({});}
    throw Error('Unexpected fixture request');
  };
  const ai=require('../netlify/functions/ai.js').createHandler({env,fetcher});
  const status=require('../netlify/functions/account-status.js').createHandler({env,fetcher});
  const remove=require('../netlify/functions/delete-account.js').createHandler({env,fetcher});
  return {tiers,used,get providerCalls(){return providerCalls},async route(route){
    const req=route.request(),url=new URL(req.url());const handler=url.pathname.endsWith('account-status')?status:url.pathname.endsWith('delete-account')?remove:ai;
    const result=await handler({httpMethod:req.method(),headers:{...req.headers(),host:url.host},body:req.postData()});
    return route.fulfill({status:result.statusCode,headers:result.headers,body:result.body});
  }};
};
