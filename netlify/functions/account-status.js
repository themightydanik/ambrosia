const { json,method,authenticate,rpc,failure } = require('./lib/backend.js');
exports.createHandler = ({env=process.env,fetcher=fetch}={}) => async event => {
  try { method(event,'GET');const auth=await authenticate(event,env,fetcher);return json(200,await rpc(auth,'account_status',{},fetcher,false)); }
  catch(error){return failure(error);}
};
exports.handler=exports.createHandler();
