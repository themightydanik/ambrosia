function publicConfig(env) {
  let key=env.SUPABASE_PUBLISHABLE_KEY || '';
  if (!key.startsWith('sb_publishable_')) {
    try { if(JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role!=='anon')key=''; }
    catch { key=''; }
  }
  let url='';try {const parsed=new URL(env.SUPABASE_URL);if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&parsed.pathname==='/'&&!parsed.search&&!parsed.hash)url=parsed.origin;}catch{}
  return {url: key?url:'',publishableKey:url?key:''};
}
exports.publicConfig=publicConfig;
exports.handler=async()=>({statusCode:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(publicConfig(process.env))});
