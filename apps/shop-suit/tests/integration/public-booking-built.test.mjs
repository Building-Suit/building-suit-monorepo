import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {request as httpRequest} from 'node:http'
import {once} from 'node:events'
import {combinations} from '../fixtures/public-booking.mjs'
test('built public booking binds canonical Host, cookie scope and strict bodies without token/private field disclosure',async()=>{
 const child=spawn(process.execPath,['apps/shop-suit/tests/e2e/public-booking-fixture-server.mjs'],{env:{...process.env,BOOKING_TEST_PORT:'4339',BOOKING_TEST_API_PORT:'46929'},stdio:['ignore','ignore','pipe']});let logs='';child.stderr.on('data',v=>logs+=v)
 const request=(slug,path,body,headers={})=>new Promise((resolve,reject)=>{const host=slug.includes('.')?slug:slug+'.shops.building-suit.com';const req=httpRequest({hostname:'127.0.0.1',port:4339,path,method:body===undefined?'GET':'POST',headers:{host,origin:'https://'+host,'content-type':'application/json',...headers}},res=>{let text='';res.on('data',v=>text+=v);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}))});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body))})
 const api=action=>'/api/website/booking/'+action,shop='alpha-tools',c=combinations(shop)[0],date=new Date(Date.now()+86400000).toISOString().slice(0,10),query={service:c.service,location:c.location,staff:c.staff,date}
 try{
  const deadline=Date.now()+30000;for(;;){try{await request('unknown-shop','/');break}catch{assert.ok(Date.now()<deadline);await new Promise(r=>setTimeout(r,100))}}
  const page=await request(shop,'/book?lang=en');assert.equal(page.status,200);assert.equal(page.headers['cache-control'],'private, no-store');assert.equal(page.headers['x-robots-tag'],'noindex, nofollow');assert.ok(!page.text.includes('5678ABCDEFGH')&&!page.text.includes('PRIVATE'))
  assert.equal((await request('shop.building-suit.com','/book')).status,404);assert.equal((await request('unpublished-shop','/book')).status,404)
  assert.equal((await request('alpha-alias','/book?lang=en')).headers.location,'https://alpha-tools.shops.building-suit.com/book?lang=en')
  const options=await request(shop,api('options'),{});assert.equal(JSON.parse(options.text).scope,'guest');assert.ok(!options.text.includes('PRIVATE'));assert.equal(JSON.parse((await request('disabled-tools',api('options'),{})).text).enabled,false)
  const slots=JSON.parse((await request(shop,api('slots'),query)).text).slots;assert.equal(slots.length,4)
  assert.equal((await request(shop,api('options'),{},{origin:'https://beta-tools.shops.building-suit.com'})).status,403)
  const body={operation:'create',requestKey:'a'.repeat(64),...query,startsAt:slots[0].startsAt,name:'Guest visitor',phone:'+201000000002'};delete body.date
  for(const bad of [{...body,customerId:'FOREIGN'},{...body,shopId:'FOREIGN'},{...body,staffId:'FOREIGN'}])assert.equal(JSON.parse((await request(shop,api('command'),bad)).text).ok,false)
  const created=await request(shop,api('command'),body,{'x-forwarded-host':'beta-tools.shops.building-suit.com',authorization:'Bearer PRIVATE',cookie:'bs-shop-local-auth-token=PRIVATE'}),result=JSON.parse(created.text)
  assert.equal(result.ok,true);assert.equal(result.code,'0123ABCDEFGH');assert.ok(!created.text.includes('token')&&!created.text.includes('PRIVATE'))
  const cookie=created.headers['set-cookie'][0].split(';')[0];assert.ok(created.headers['set-cookie'][0].includes('HttpOnly'));assert.ok(created.headers['set-cookie'][0].includes('Secure'));assert.ok(!created.headers['set-cookie'][0].includes('Domain='));const auth={cookie}
  const managed=await request(shop,api('manage'),{page:1},auth);assert.equal(JSON.parse(managed.text).items.length,1);assert.ok(!managed.text.includes('PRIVATE')&&!managed.text.includes(cookie.split('=')[1]))
  assert.equal(JSON.parse((await request('beta-tools',api('manage'),{page:1},auth)).text).authenticated,false)
  assert.equal(JSON.parse((await request(shop,api('command'),{...body,requestKey:'b'.repeat(64)},auth)).text).ok,false)
  const cancelled=await request(shop,api('command'),{operation:'cancel',requestKey:'c'.repeat(64),reference:result.reference},auth);assert.equal(JSON.parse(cancelled.text).ok,true)
  assert.equal(JSON.parse((await request(shop,api('manage'),{page:1},auth)).text).items.length,0)
  assert.ok(!logs.includes(cookie.split('=')[1]))
 }finally{child.kill('SIGTERM');await once(child,'exit')}
})
