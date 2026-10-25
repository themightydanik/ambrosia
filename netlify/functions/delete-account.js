const { HttpError,json,method,body,authenticate,request,failure } = require('./lib/backend.js');
exports.createHandler = ({env=process.env,fetcher=fetch}={}) => async event => {
  try {
    method(event,'POST');const auth=await authenticate(event,env,fetcher);const input=body(event,3000);
    if (Object.keys(input).some(k=>!['password','confirmation'].includes(k)) || input.confirmation !== 'DELETE' || typeof input.password !== 'string' || input.password.length<1 || input.password.length>1024) throw new HttpError(400,'INVALID_INPUT');
    if (!auth.cfg.serviceKey || !auth.user.email) throw new HttpError(503,'NOT_CONFIGURED');
    const reauth=await request(fetcher,auth.cfg.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json',apikey:auth.cfg.publicKey},body:JSON.stringify({email:auth.user.email,password:input.password})});
    if (reauth.status===400 || reauth.status===401 || reauth.status===403) throw new HttpError(403,'REAUTH_REQUIRED');
    if (!reauth.ok) throw new HttpError(503,'SERVICE_UNAVAILABLE');
    const verified=await reauth.json();
    if (verified.user?.id !== auth.user.id || verified.user?.factors?.some(f=>f.status==='verified')) throw new HttpError(403,'REAUTH_REQUIRED');
    const result=await request(fetcher,auth.cfg.url+'/auth/v1/admin/users/'+encodeURIComponent(auth.user.id),{method:'DELETE',headers:{'Content-Type':'application/json',apikey:auth.cfg.serviceKey,Authorization:`Bearer ${auth.cfg.serviceKey}`},body:JSON.stringify({should_soft_delete:false})});
    if (!result.ok && result.status!==404) throw new HttpError(503,'DELETE_FAILED');
    return json(200,{deleted:true});
  } catch(error){return failure(error);}
};
exports.handler=exports.createHandler();
