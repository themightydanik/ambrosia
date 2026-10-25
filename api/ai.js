import proxy from '../netlify/functions/ai.js';
export default async function handler(req,res) {
  const result=await proxy.handler({httpMethod:req.method,headers:req.headers,body:typeof req.body==='string'?req.body:JSON.stringify(req.body || {})});
  for(const [name,value] of Object.entries(result.headers)) res.setHeader(name,value);
  res.status(result.statusCode).send(result.body);
}
