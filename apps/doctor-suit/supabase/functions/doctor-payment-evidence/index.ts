import{paymentEvidenceBackend}from'./backend.ts'
import{createPaymentEvidenceHandler}from'./handler.ts'
const url=Deno.env.get('SUPABASE_URL')||'',origin=Deno.env.get('DOCTOR_WEB_ORIGIN')||'',publicKey=Deno.env.get('SUPABASE_ANON_KEY')||'',serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
function configured(){try{const target=new URL(url),web=new URL(origin),local=Deno.env.get('DOCTOR_LOCAL_PROVIDER')==='1';return Boolean(publicKey&&serviceKey&&web.origin===origin&&!web.username&&!web.password&&!target.username&&!target.password&&((target.protocol==='https:'&&web.protocol==='https:')||(local&&target.protocol==='http:'&&['kong','127.0.0.1','localhost','host.docker.internal'].includes(target.hostname)&&['127.0.0.1','localhost'].includes(web.hostname)&&web.protocol==='http:')))}catch{return false}}
const handler=createPaymentEvidenceHandler(authorization=>paymentEvidenceBackend({url,publicKey,serviceKey},authorization),[origin])
Deno.serve(request=>configured()?handler(request):new Response(JSON.stringify({error:'unavailable'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}}))
