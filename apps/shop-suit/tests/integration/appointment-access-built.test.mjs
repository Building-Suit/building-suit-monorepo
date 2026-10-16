import assert from 'node:assert/strict'
import test from 'node:test'
import {createServer,request as httpRequest} from 'node:http'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {showcase} from '../fixtures/public-website.mjs'
test('public credential transport keeps tokens in host-only HttpOnly cookies and binds every operation to Host',async()=>{
 const calls=[],tokenA='a'.repeat(43),tokenB='b'.repeat(43);let current=tokenA,published=true
 const backend=createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk
  const args=JSON.parse(body||'{}'),name=req.url.split('/').at(-1);calls.push({name,args,headers:req.headers});res.setHeader('content-type','application/json')
  const expiry=new Date(Date.now()+599000).toISOString(),good=['alpha-tools','alpha-alias'].includes(args.p_slug)
  if(name==='shop_website_host_resolve'){res.end(JSON.stringify(published&&['alpha-tools','beta-tools','alpha-alias'].includes(args.p_slug)?{canonicalSlug:args.p_slug==='alpha-alias'?'alpha-tools':args.p_slug,isAlias:args.p_slug==='alpha-alias'}:null));return}
  if(name==='shop_website_showcase'){res.end(JSON.stringify(showcase(args.p_slug)));return}
  let value={ok:false}
  if(name==='appointment_access_verify'&&good&&args.p_code==='0123ABCDEFGH'&&args.p_phone==='201000000002'){current=tokenA;value={ok:true,token:current,expiresAt:expiry,notes:'PRIVATE',customerId:'PRIVATE'}}
  if(name==='appointment_access_session_validate'&&good&&args.p_token===current)value={ok:true,expiresAt:expiry,notes:'PRIVATE'}
  if(name==='appointment_access_session_rotate'&&good&&args.p_token===current){current=tokenB;value={ok:true,token:current,expiresAt:expiry}}
  if(name==='appointment_access_session_revoke'){if(good&&args.p_token===current)current='revoked';value={ok:true}}
  res.end(JSON.stringify(value))
 });backend.listen(0,'127.0.0.1');await once(backend,'listening')
 const port=4391,child=spawn(process.execPath,['apps/shop-suit/.output/server/index.mjs'],{stdio:['ignore','ignore','pipe'],env:{...process.env,HOST:'127.0.0.1',PORT:String(port),NUXT_PUBLIC_APP_URL:'https://shop.building-suit.com',NUXT_PUBLIC_APP_ENVIRONMENT:'production',NUXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${backend.address().port}`,SUPABASE_URL:`http://127.0.0.1:${backend.address().port}`,NUXT_PUBLIC_SUPABASE_KEY:'local-fixture-publishable-key'}})
 let stderr='';child.stderr.on('data',v=>stderr+=v)
 const request=(slug,action,body={},headers={})=>new Promise((resolve,reject)=>{
  const req=httpRequest({hostname:'127.0.0.1',port,path:'/api/website/appointment-access/'+action,method:'POST',headers:{host:`${slug}.shops.building-suit.com`,origin:`https://${slug}.shops.building-suit.com`,'content-type':'application/json',...headers}},res=>{let text='';res.on('data',v=>text+=v);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}))});req.on('error',reject);req.end(JSON.stringify(body))
 })
 const cookieName='bs-shop-production-appointment-access',form={code:'0123-abcd-efgh',phone:'+٢٠ ١٠٠ ٠٠٠ ٠٠٠٢'}
 try{
  const deadline=Date.now()+30000;for(;;){try{await request('unknown-shop','verify');break}catch{assert.ok(Date.now()<deadline);await new Promise(r=>setTimeout(r,100))}}
  const response=await request('alpha-tools','verify',form,{'x-forwarded-host':'beta-tools.shops.building-suit.com','x-shop-id':'FOREIGN',cookie:'bs-shop-local-auth-token=PRIVATE'})
  assert.equal(response.status,200);assert.equal(JSON.parse(response.text).ok,true);assert.ok(!response.text.includes(tokenA)&&!response.text.includes('PRIVATE'))
  const cookies=response.headers['set-cookie']??[]
  assert.ok(cookies.some(c=>c.startsWith(cookieName+'='+tokenA)&&c.includes('HttpOnly')&&c.includes('Secure')&&c.includes('SameSite=Strict')&&c.includes('Path=/api/website')&&!c.includes('Domain=')))
  assert.ok(cookies.every(c=>c.startsWith(cookieName+'=')))
  const verify=calls.find(c=>c.name==='appointment_access_verify');assert.equal(verify.args.p_slug,'alpha-tools');assert.equal(verify.args.p_phone,'201000000002')
  assert.ok(calls.every(c=>!c.headers.cookie&&!c.headers.authorization))
  const auth={cookie:`${cookieName}=${tokenA}; bs-shop-local-auth-token=PRIVATE`}
  assert.equal(JSON.parse((await request('alpha-tools','validate',{},auth)).text).ok,true)
  assert.equal(JSON.parse((await request('beta-tools','validate',{},auth)).text).ok,false)
  const rotate=await request('alpha-tools','rotate',{},auth);assert.equal(JSON.parse(rotate.text).ok,true);assert.ok(!rotate.text.includes(tokenB))
  assert.ok((rotate.headers['set-cookie']??[]).some(c=>c.startsWith(cookieName+'='+tokenB)))
  assert.equal(JSON.parse((await request('alpha-tools','validate',{},auth)).text).ok,false)
  const newer={cookie:`${cookieName}=${tokenB}`}
  assert.equal(JSON.parse((await request('alpha-tools','validate',{},newer)).text).ok,true)
  const logout=await request('alpha-tools','logout',{},newer);assert.equal(JSON.parse(logout.text).ok,true)
  assert.equal(JSON.parse((await request('alpha-tools','validate',{},newer)).text).ok,false)
  assert.equal((await request('alpha-tools','verify',form,{origin:'https://beta-tools.shops.building-suit.com'})).status,403)
  for(const bad of [{...form,shopId:'FOREIGN'},{code:'bad',phone:'bad'},{code:form.code},{...form,phone:'x'.repeat(3000)}])assert.equal(JSON.parse((await request('alpha-tools','verify',bad)).text).ok,false)
  assert.equal(JSON.parse((await request('alpha-tools','verify',form)).text).ok,true)
  // Publication may stop reads/verification, but must never prevent giving up
  // this host's existing capability. Unknown tenants cannot revoke another shop.
  published=false
  for(const action of ['verify','validate','rotate'])assert.equal((await request('alpha-tools',action,action==='verify'?form:{},auth)).status,404)
  assert.equal((await request('alpha-tools','logout',{}, {...auth,origin:'https://beta-tools.shops.building-suit.com'})).status,403)
  assert.equal(JSON.parse((await request('alpha-tools','logout',{shopId:'beta-tools'},auth)).text).ok,false)
  assert.equal((await request('alpha-tools','logout',{}, {...auth,host:'evil.test',origin:'https://evil.test'})).status,404)
  for(const slug of ['unknown-shop','beta-tools'])assert.equal(JSON.parse((await request(slug,'logout',{},auth)).text).ok,true)
  assert.ok(current===tokenA)
  const revoked=await request('alpha-tools','logout',{}, {...auth,'x-forwarded-host':'beta-tools.shops.building-suit.com','x-shop-id':'FOREIGN'})
  assert.equal(revoked.status,200);assert.equal(JSON.parse(revoked.text).ok,true);assert.equal(current,'revoked')
  assert.equal(revoked.headers['cache-control'],'private, no-store');assert.equal(revoked.headers['x-robots-tag'],'noindex, nofollow')
  const cleared=revoked.headers['set-cookie']??[]
  assert.ok(cleared.length>0&&cleared.every(c=>c.startsWith(cookieName+'=')&&c.includes('HttpOnly')&&c.includes('Secure')&&c.includes('SameSite=Strict')&&c.includes('Path=/api/website')&&!c.includes('Domain=')))
  assert.ok(cleared.every(c=>c.includes('Max-Age=0')&&!c.startsWith(cookieName+'='+tokenA)))
  published=true
  assert.equal(JSON.parse((await request('alpha-tools','validate',{},auth)).text).ok,false)
  assert.equal(JSON.parse((await request('alpha-tools','rotate',{},auth)).text).ok,false)
  assert.equal(JSON.parse((await request('alpha-tools','verify',form)).text).ok,true)
  // Socket limit returns the same denial shape rather than a credential oracle.
  for(let i=0;i<21;i++)assert.equal(JSON.parse((await request('alpha-tools','verify',{code:'bad',phone:'bad'})).text).ok,false)
  assert.equal(JSON.parse((await request('alpha-alias','verify',form)).text).ok,false)
  assert.equal(JSON.parse((await request('alpha-tools','logout',{},auth)).text).ok,true);assert.equal(current,'revoked')
  assert.ok(calls.every(c=>!c.headers.cookie&&!c.headers.authorization))
  assert.ok(!stderr.includes(tokenA)&&!stderr.includes(tokenB)&&!stderr.includes(form.code))
 }finally{child.kill('SIGTERM');backend.closeAllConnections();backend.close();await once(child,'exit')}
})
