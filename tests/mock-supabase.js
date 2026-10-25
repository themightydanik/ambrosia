// Browser-only test fixture. Served in place of the external SDK by Playwright routes.
export function createClient() {
  let user = JSON.parse(localStorage.getItem('__test_user') || 'null');
  const listeners = [];
  const auth = {
    async getSession() { return { data:{session:user ? {user} : null} }; },
    async getUser() { return { data:{user} }; },
    onAuthStateChange(fn) { listeners.push(fn); return {data:{subscription:{unsubscribe(){}}}}; },
    async signOut() { auth.setUser(null); return {}; },
    setUser(next) { user=next; localStorage.setItem('__test_user',JSON.stringify(user)); for(const fn of listeners) fn('SIGNED_IN',user ? {user} : null); },
    async signInWithPassword({email}) { auth.setUser({id:email.startsWith('b')?'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email}); return {data:{session:{user}}}; }
  };
  window.testAuth=auth;
  async function request(path, options) {
    try {
      const response=await fetch(path,{...options,headers:{'content-type':'application/json','x-test-user':user?.id||''}});
      const data=await response.json();return response.ok ? {data} : {error:data};
    } catch(e) { return {error:e}; }
  }
  return {auth,from(table) {
    const params=new URLSearchParams({table});
    const query={select(){return query;},eq(k,v){params.set(k,v);return query;},order(){return query;},limit(n){params.set('limit',n);return query;},gt(k,v){params.set('after',v);return query;},then(ok,fail){return request('/__test/page?'+params).then(ok,fail);}};
    return query;
  },rpc(name,payload){return request('/__test/write',{method:'POST',body:JSON.stringify(payload)});}};
}
