import assert from 'node:assert/strict'
import test from 'node:test'
import {createServer,request as httpRequest} from 'node:http'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {createWebsiteLaunchFixture} from '../fixtures/website-launch.mjs'
import {combinations} from '../fixtures/public-booking.mjs'
const prod='shops.building-suit.com',stage='stg.shops.building-suit.com'
async function runtime(port,environment,suffix=''){
 const fixture=createWebsiteLaunchFixture(),calls=[]
 const backend=createServer(async(req,res)=>{
  let raw='';for await(const part of req)raw+=part
  const args=JSON.parse(raw||'{}'),name=req.url.split('/').at(-1)
  calls.push({name,args,headers:req.headers});res.setHeader('content-type','application/json')
  res.end(JSON.stringify(fixture.rpc(name,args,req.headers)))
 })
 backend.listen(0,'127.0.0.1');await once(backend,'listening')
 const privateHost=environment==='production'?'shop.building-suit.com':'stg.shop.building-suit.com'
 const child=spawn(process.execPath,['apps/shop-suit/.output/server/index.mjs'],{stdio:['ignore','ignore','pipe'],env:{...process.env,HOST:'127.0.0.1',PORT:String(port),NUXT_PUBLIC_APP_URL:'https://'+privateHost,NUXT_PUBLIC_APP_ENVIRONMENT:environment,NUXT_PUBLIC_WEBSITE_HOSTNAME_SUFFIX:suffix,NUXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${backend.address().port}`,SUPABASE_URL:`http://127.0.0.1:${backend.address().port}`,NUXT_PUBLIC_SUPABASE_KEY:'local-fixture-publishable-key',NUXT_RELEASE_CATALOG_URL:'',NUXT_RELEASE_CATALOG_PUBLISHABLE_KEY:''}})
 const request=(host,path='/',body,headers={})=>new Promise((resolve,reject)=>{
  const req=httpRequest({hostname:'127.0.0.1',port,path,method:body===undefined?'GET':'POST',headers:{host,origin:'https://'+host,'content-type':'application/json',...headers}},res=>{let text='';res.on('data',v=>text+=v);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}))})
  req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body))
 })
 const stop=async()=>{child.kill('SIGTERM');backend.closeAllConnections();backend.close();if(child.exitCode===null)await once(child,'exit')}
 const deadline=Date.now()+30000
 try{for(;;){try{await request('unknown.invalid');break}catch{assert.ok(Date.now()<deadline,'Built server startup');await new Promise(r=>setTimeout(r,100))}}}catch(error){await stop();throw error}
 return{fixture,calls,request,stop,privateHost,environment}
}
test('built production and staging deployments bind every URL, Origin, tenant and capability to their own suffix/backend',async()=>{
 const production=await runtime(4351,'production'),staging=await runtime(4352,'staging',stage)
 try{
  const cookies=new Map()
  for(const [app,suffix,foreign] of [[production,prod,stage],[staging,stage,prod]]){
   const host='alpha-tools.'+suffix,root=await app.request(host,'/?lang=en',undefined,{'x-forwarded-host':'beta-tools.'+foreign,'x-shop-id':'FOREIGN',authorization:'Bearer PRIVATE',cookie:'private-auth=PRIVATE'})
   assert.equal(root.status,200);assert.ok(root.text.includes('Alpha Tools'));assert.doesNotMatch(root.text,/Beta Services|LEAK-|PRIVATE/)
   assert.ok(root.text.includes('https://'+host+'/?lang=en'));assert.ok(root.text.includes('https://'+host+'/book?lang=en'));assert.ok(root.text.includes('https://'+host+'/my-appointments?lang=en'))
   assert.ok(!root.text.includes('https://alpha-tools.'+foreign));assert.equal(root.headers['cache-control'],'private, no-store');assert.ok(root.headers.vary.includes('Host'))
   const beta=await app.request('beta-tools.'+suffix);assert.equal(beta.status,200);assert.ok(beta.text.includes('Beta Services'));assert.ok(!beta.text.includes('Alpha Tools'))
   assert.equal((await app.request(app.privateHost,'/auth/login')).status,200)
   const robots=await app.request(host,'/robots.txt');assert.ok(robots.text.includes('https://'+host+'/sitemap.xml'));assert.ok(robots.text.includes(suffix===prod?'Allow: /':'Disallow: /'))
   const sitemap=await app.request(host,'/sitemap.xml');assert.equal(sitemap.status,200)
   if(suffix===stage){assert.equal(root.headers['x-robots-tag'],'noindex, nofollow');assert.ok(!sitemap.text.includes('<url>'))}else assert.ok(sitemap.text.includes('https://'+host+'/?lang=en'))
   for(const path of ['/book?lang=en','/my-appointments?lang=en']){const response=await app.request(host,path);assert.equal(response.status,200);assert.ok(response.text.includes('https://'+host+path));assert.equal(response.headers['x-robots-tag'],'noindex, nofollow')}
   for(const path of ['/','/?lang=en&page=2','/book?lang=en','/my-appointments?lang=en','/settings']){
    const response=await app.request('alpha-alias.'+suffix,path);assert.equal(response.status,308)
    const expected=path==='/settings'||path==='/'?'':path
    assert.equal(response.headers.location,'https://'+host+expected)
   }
   for(const path of ['/api/website/inquiries','/api/website/booking/options','/api/website/customer-portal','/api/website/appointment-access/verify']){
    assert.equal((await app.request(host,path,{},{origin:'https://alpha-tools.'+foreign,'x-forwarded-host':'alpha-tools.'+foreign})).status,403,path)
    assert.equal((await app.request(host,path,{},{origin:'https://beta-tools.'+suffix})).status,403,path)
   }
   const body={name:'Visitor',contact:'visitor@example.invalid',message:'Contact this tenant',locale:'en',company:''}
   assert.equal((await app.request(host,'/api/website/inquiries',body)).status,202);assert.equal(app.fixture.inquiries.at(-1).slug,'alpha-tools')
   assert.equal((await app.request(host,'/api/website/inquiries',{...body,hostnameSuffix:foreign})).status,400)
   const count=app.calls.length
   for(const bad of ['alpha-tools.'+foreign,suffix,'www.'+suffix,'a.b.'+suffix,'alpha-tools.'+suffix+':443','alpha-tools.'+suffix+'.','alpha-tools.'+suffix+'.evil.test']){
    const response=await app.request(bad);assert.equal(response.status,404,bad);assert.equal(response.text,'Not Found');assert.equal(response.headers['cache-control'],'private, no-store');assert.equal(response.headers['set-cookie'],undefined)
   }
   assert.equal(app.calls.length,count,'Foreign or malformed authority never reaches any backend')
   const c=combinations('alpha-tools')[0],date=new Date(Date.now()+86400000).toISOString().slice(0,10)
   const slots=JSON.parse((await app.request(host,'/api/website/booking/slots',{...c,date})).text)
   // The production command rejects extra fixture display fields; send only its typed body.
   const times=JSON.parse((await app.request(host,'/api/website/booking/slots',{service:c.service,location:c.location,staff:c.staff,date})).text).slots
   assert.deepEqual(slots,{slots:[]})
   const booking=await app.request(host,'/api/website/booking/command',{operation:'create',requestKey:(suffix===prod?'a':'b').repeat(64),service:c.service,location:c.location,staff:c.staff,startsAt:times[0].startsAt,name:'Suffix guest',phone:'+201000000002'})
   assert.equal(JSON.parse(booking.text).ok,true)
   const cookie=booking.headers['set-cookie'][0];assert.ok(cookie.startsWith(`bs-shop-${app.environment}-appointment-access=`));assert.ok(cookie.includes('HttpOnly')&&cookie.includes('Secure')&&cookie.includes('SameSite=Strict')&&!cookie.includes('Domain='));cookies.set(app,cookie.split(';')[0])
   assert.equal(JSON.parse((await app.request(host,'/api/website/customer-portal',{bucket:'upcoming',page:1},{cookie:cookies.get(app)})).text).authenticated,true)
   assert.deepEqual(JSON.parse((await app.request('beta-tools.'+suffix,'/api/website/customer-portal',{bucket:'upcoming',page:1},{cookie:cookies.get(app)})).text),{authenticated:false})
   assert.ok(app.calls.every(call=>!call.headers.cookie&&!call.headers.authorization&&(!call.args.p_slug||!call.args.p_slug.includes('.'))))
  }
  for(const [app,other,suffix] of [[staging,production,stage],[production,staging,prod]]){
   const host='alpha-tools.'+suffix,foreignCookie=cookies.get(other)
   for(const cookie of [foreignCookie,foreignCookie.replace(`bs-shop-${other.environment}-`,`bs-shop-${app.environment}-`)])assert.deepEqual(JSON.parse((await app.request(host,'/api/website/customer-portal',{bucket:'upcoming',page:1},{cookie})).text),{authenticated:false})
  }
  staging.fixture.control({slug:'alpha-tools',state:'draft'})
  assert.equal((await staging.request('alpha-tools.'+stage)).status,404)
  assert.equal(JSON.parse((await staging.request('alpha-tools.'+stage,'/api/website/appointment-access/logout',{},{cookie:cookies.get(staging)})).text).ok,true)
  staging.fixture.control({slug:'alpha-tools',state:'published'})
  assert.deepEqual(JSON.parse((await staging.request('alpha-tools.'+stage,'/api/website/customer-portal',{bucket:'upcoming',page:1},{cookie:cookies.get(staging)})).text),{authenticated:false})
  assert.equal((await production.request('alpha-tools.'+prod)).status,200)
 }finally{await Promise.all([production.stop(),staging.stop()])}
})
test('invalid/missing/mismatched deployment config denies public and static requests before backend access while private login survives',async()=>{
 for(const [environment,suffix] of [['staging',''],['staging',prod],['staging','https://evil.test/path'],['production',stage],['null',prod]]){
  const app=await runtime(4353,environment,suffix)
  try{
   for(const host of ['alpha-tools.'+stage,'alpha-tools.'+prod])for(const path of ['/','/book','/my-appointments','/_nuxt/fake.js','/api/website/booking/options']){const response=await app.request(host,path,path.startsWith('/api/')?{}:undefined);assert.equal(response.status,404);assert.equal(response.text,'Not Found');assert.equal(response.headers['set-cookie'],undefined)}
   assert.equal(app.calls.length,0);assert.equal((await app.request(app.privateHost,'/auth/login')).status,200)
  }finally{await app.stop()}
 }
})
