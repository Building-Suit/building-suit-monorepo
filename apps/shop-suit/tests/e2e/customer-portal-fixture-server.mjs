// Synthetic loopback fixture; never connects to a hosted product database.
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {showcase} from '../fixtures/public-website.mjs'
import {portalPayload} from '../fixtures/customer-portal.mjs'
const port=process.env.PORTAL_TEST_PORT??'4333',apiPort=Number(process.env.PORTAL_TEST_API_PORT??46923)
const sessions=new Map();let sequence=0,ttl=590000
const api=createServer(async(req,res)=>{
 let body='';for await(const part of req)body+=part
 const args=JSON.parse(body||'{}'),name=req.url.split('/').at(-1)
 res.setHeader('content-type','application/json')
 if(req.url==='/control'){sessions.clear();ttl=args.ttl??590000;res.end('{}');return}
 if(name==='shop_website_host_resolve'){res.end(JSON.stringify(['alpha-tools','beta-tools','alpha-alias'].includes(args.p_slug)?{canonicalSlug:args.p_slug==='alpha-alias'?'alpha-tools':args.p_slug,isAlias:args.p_slug==='alpha-alias'}:null));return}
 if(name==='shop_website_showcase'){res.end(JSON.stringify(showcase(args.p_slug)));return}
 if(name==='appointment_access_verify'){
  if(!['0123ABCDEFGH','WXYZABCDEFGH'].includes(args.p_code)||args.p_phone!=='201000000002'){res.end('{"ok":false}');return}
  const token=String(++sequence).padStart(43,'a'),expiresAt=new Date(Date.now()+ttl).toISOString()
  sessions.set(token,{shop:args.p_slug,scope:args.p_code==='WXYZABCDEFGH'?'appointment':'customer',expiresAt});res.end(JSON.stringify({ok:true,token,expiresAt}));return
 }
 const session=sessions.get(args.p_token),valid=session&&session.shop===args.p_slug&&Date.parse(session.expiresAt)>Date.now()
 if(name==='appointment_access_session_revoke'){if(valid)sessions.delete(args.p_token);res.end('{"ok":true}');return}
 if(name==='appointment_customer_portal'){
  const value=valid?portalPayload({shop:session.shop,scope:session.scope,expiresAt:session.expiresAt,bucket:args.p_bucket,page:args.p_page}):{authenticated:false}
  if(valid){value.notes='PRIVATE-NOTES';value.customerId='PRIVATE-ID';for(const row of value.items)row.payment='PRIVATE-FINANCE'}
  res.end(JSON.stringify(value));return
 }
 res.end(JSON.stringify(valid?{ok:true,expiresAt:session.expiresAt}:{ok:false}))
})
api.listen(apiPort,'127.0.0.1',()=>{
 const child=spawn(process.execPath,['apps/shop-suit/.output/server/index.mjs'],{stdio:'inherit',env:{...process.env,HOST:'127.0.0.1',PORT:port,NUXT_PUBLIC_APP_URL:`http://127.0.0.1:${port}`,NUXT_PUBLIC_APP_ENVIRONMENT:'production',NUXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${apiPort}`,SUPABASE_URL:`http://127.0.0.1:${apiPort}`,NUXT_PUBLIC_SUPABASE_KEY:'local-fixture-publishable-key'}})
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{child.kill(signal);api.close()})
 child.on('exit',code=>{api.close();process.exitCode=code??1})
})
