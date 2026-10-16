import assert from 'node:assert/strict'
import test from 'node:test'
import {createServer,request as httpRequest} from 'node:http'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {createWebsiteLaunchFixture,launchCodes} from '../fixtures/website-launch.mjs'
import {combinations} from '../fixtures/public-booking.mjs'
test('combined two-tenant launch journey keeps publication, inquiry, booking, session and cache boundaries isolated',async()=>{
 const fixture=createWebsiteLaunchFixture(),calls=[]
 const backend=createServer(async(req,res)=>{let body='';for await(const part of req)body+=part;const args=JSON.parse(body||'{}'),name=req.url.split('/').at(-1);calls.push({name,args,headers:req.headers});res.setHeader('content-type','application/json');res.end(JSON.stringify(fixture.rpc(name,args,req.headers)))})
 backend.listen(0,'127.0.0.1');await once(backend,'listening')
 const port=4343,child=spawn(process.execPath,['apps/shop-suit/.output/server/index.mjs'],{stdio:['ignore','ignore','pipe'],env:{...process.env,HOST:'127.0.0.1',PORT:String(port),NUXT_PUBLIC_APP_URL:'https://shop.building-suit.com',NUXT_PUBLIC_APP_ENVIRONMENT:'production',NUXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${backend.address().port}`,SUPABASE_URL:`http://127.0.0.1:${backend.address().port}`,NUXT_PUBLIC_SUPABASE_KEY:'local-fixture-publishable-key',NUXT_RELEASE_CATALOG_URL:'',NUXT_RELEASE_CATALOG_PUBLISHABLE_KEY:''}})
 let logs='';child.stderr.on('data',v=>logs+=v)
 const request=(host,path='/',body,extra={})=>new Promise((resolve,reject)=>{const req=httpRequest({hostname:'127.0.0.1',port,path,method:body===undefined?'GET':'POST',headers:{host,origin:'https://'+host,'content-type':'application/json',...extra}},res=>{let text='';res.on('data',v=>text+=v);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}))});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body))})
 const tenant=slug=>slug+'.shops.building-suit.com',secrets=/LEAK-|PRIVATE|Guest Alpha|Guest Beta|supplierCost|customerId|staffPhone|invoiceId/
 try{
  const deadline=Date.now()+30000;for(;;){try{await request(tenant('unknown-shop'));break}catch{assert.ok(Date.now()<deadline);await new Promise(r=>setTimeout(r,100))}}
  const unavailableChangelog=await request('shop.building-suit.com','/api/changelog');assert.equal(unavailableChangelog.status,503);assert.doesNotMatch(unavailableChangelog.text,/supabase|publishable|stack|PRIVATE|LEAK-/i)
  const cookies={}
  for(const [slug,name,foreign] of [['alpha-tools','Alpha Tools','Beta Services'],['beta-tools','Beta Services','Alpha Tools']]){
   const host=tenant(slug),root=await request(host,'/?lang=en',undefined,{'x-forwarded-host':tenant(slug==='alpha-tools'?'beta-tools':'alpha-tools'),authorization:'Bearer PRIVATE',cookie:'private-product-auth=PRIVATE','x-shop-id':'FOREIGN'})
   assert.equal(root.status,200);assert.ok(root.text.includes(name)&&!root.text.includes(foreign));assert.doesNotMatch(root.text,secrets);assert.equal(root.headers['cache-control'],'private, no-store');assert.ok(root.headers.vary.includes('Host'));assert.equal(root.headers['set-cookie'],undefined);assert.match(root.text,/property="og:title"/);assert.ok(root.text.includes('https://'+host+'/?lang=en'))
   assert.match((await request(host,'/robots.txt')).text,/Allow: \//);assert.ok((await request(host,'/sitemap.xml')).text.includes('https://'+host+'/?lang=en'))
   const inquiry=await request(host,'/api/website/inquiries',{name:'Visitor '+slug,contact:'visitor@example.invalid',message:'Contact this shop only',locale:'en',company:''});assert.equal(inquiry.status,202);assert.equal(fixture.inquiries.at(-1).slug,slug)
   const c=combinations(slug)[0],date=new Date(Date.now()+86400000).toISOString().slice(0,10)
   const times=JSON.parse((await request(host,'/api/website/booking/slots',{service:c.service,location:c.location,staff:c.staff,date})).text).slots
   const created=await request(host,'/api/website/booking/command',{operation:'create',requestKey:(slug==='alpha-tools'?'a':'b').repeat(64),service:c.service,location:c.location,staff:c.staff,startsAt:times[0].startsAt,name:slug==='alpha-tools'?'Guest Alpha':'Guest Beta',phone:'+201000000002'})
   assert.equal(JSON.parse(created.text).ok,true);assert.equal(JSON.parse(created.text).code,launchCodes[slug]);assert.ok(!created.text.includes('token'));assert.doesNotMatch(created.text,/PRIVATE|LEAK-/)
   cookies[slug]=created.headers['set-cookie'][0].split(';')[0];assert.ok(created.headers['set-cookie'].every(c=>c.includes('HttpOnly')&&c.includes('Secure')&&c.includes('SameSite=Strict')&&!c.includes('Domain=')))
   const own=await request(host,'/api/website/customer-portal',{bucket:'upcoming',page:1},{cookie:cookies[slug]});assert.equal(JSON.parse(own.text).scope,'appointment');assert.equal(JSON.parse(own.text).items.length,1);assert.doesNotMatch(own.text,secrets)
   for(const path of ['/my-appointments?lang=en','/book?lang=en']){const page=await request(host,path,undefined,{cookie:cookies[slug]});assert.equal(page.status,200);assert.equal(page.headers['x-robots-tag'],'noindex, nofollow');assert.equal(page.headers['cache-control'],'private, no-store');assert.doesNotMatch(page.text,secrets)}
  }
  assert.equal(fixture.inquiries.length,2);assert.notEqual(cookies['alpha-tools'],cookies['beta-tools'])
  assert.deepEqual(JSON.parse((await request(tenant('beta-tools'),'/api/website/customer-portal',{bucket:'upcoming',page:1},{cookie:cookies['alpha-tools']})).text),{authenticated:false})
  assert.equal(JSON.parse((await request(tenant('beta-tools'),'/api/website/appointment-access/verify',{code:launchCodes['alpha-tools'],phone:'+201000000002'})).text).ok,false)
  for(const body of [{bucket:'upcoming',page:1,customerId:'FOREIGN'},{bucket:'upcoming',page:1,shopId:'FOREIGN'}])assert.deepEqual(JSON.parse((await request(tenant('alpha-tools'),'/api/website/customer-portal',body,{cookie:cookies['alpha-tools']})).text),{authenticated:false})
  for(const slug of ['www','admin','xn--tenant','unknown-shop'])assert.equal((await request(tenant(slug))).status,404)
  for(const path of ['/settings','/team','/auth/login','/api/changelog','/cart','/checkout','/payments'])assert.equal((await request(tenant('alpha-tools'),path)).status,404)
  const alias=await request(tenant('alpha-alias'),'/book?lang=en');assert.equal(alias.status,308);assert.equal(alias.headers.location,'https://alpha-tools.shops.building-suit.com/book?lang=en')
  fixture.control({slug:'alpha-tools',state:'draft'})
  for(const path of ['/','/book','/my-appointments','/robots.txt','/sitemap.xml']){const denied=await request(tenant('alpha-tools'),path);assert.equal(denied.status,404);assert.equal(denied.text,'Not Found');assert.equal(denied.headers['cache-control'],'private, no-store')}
  assert.equal((await request(tenant('alpha-tools'),'/api/website/customer-portal',{bucket:'upcoming',page:1},{cookie:cookies['alpha-tools']})).status,404)
  assert.equal(JSON.parse((await request(tenant('alpha-tools'),'/api/website/appointment-access/logout',{},{cookie:cookies['alpha-tools']})).text).ok,true)
  fixture.control({slug:'alpha-tools',state:'published'})
  assert.deepEqual(JSON.parse((await request(tenant('alpha-tools'),'/api/website/customer-portal',{bucket:'upcoming',page:1},{cookie:cookies['alpha-tools']})).text),{authenticated:false})
  assert.equal(JSON.parse((await request(tenant('beta-tools'),'/api/website/customer-portal',{bucket:'upcoming',page:1},{cookie:cookies['beta-tools']})).text).items.length,1)
  fixture.control({slug:'beta-tools',state:'suspended'});assert.equal((await request(tenant('beta-tools'))).status,404)
  assert.ok(calls.every(c=>!c.headers.cookie&&!c.headers.authorization));assert.ok(!logs.includes('Guest Alpha')&&!logs.includes(cookies['alpha-tools'].split('=')[1]))
 }finally{child.kill('SIGTERM');backend.closeAllConnections();backend.close();await once(child,'exit')}
})
