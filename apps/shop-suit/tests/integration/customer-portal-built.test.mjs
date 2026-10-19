import assert from 'node:assert/strict'
import test from 'node:test'
import {request as httpRequest} from 'node:http'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
test('built customer portal enforces cookie-only Host scope, strict query shape, allowlists and no-cache boundaries',async()=>{
 const child=spawn(process.execPath,['apps/shop-suit/tests/e2e/customer-portal-fixture-server.mjs'],{env:{...process.env,PORTAL_TEST_PORT:'4335',PORTAL_TEST_API_PORT:'46925'},stdio:['ignore','ignore','pipe']});let logs='';child.stderr.on('data',v=>logs+=v)
 const request=(host,path,body,headers={})=>new Promise((resolve,reject)=>{const req=httpRequest({hostname:'127.0.0.1',port:4335,path,method:body===undefined?'GET':'POST',headers:{host,origin:'https://'+host,'content-type':'application/json',...headers}},res=>{let text='';res.on('data',v=>text+=v);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}))});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body))})
 const host='alpha-tools.shops.building-suit.com',api='/api/website/customer-portal',query={bucket:'upcoming',page:1}
 try{
  const deadline=Date.now()+30000;for(;;){try{await request('unknown.shops.building-suit.com','/');break}catch{assert.ok(Date.now()<deadline);await new Promise(r=>setTimeout(r,100))}}
  const ssr=await request(host,'/my-appointments?lang=en');assert.equal(ssr.status,200);assert.ok(!ssr.text.includes('Alpha haircut'));assert.equal(ssr.headers['cache-control'],'private, no-store');assert.equal(ssr.headers['x-robots-tag'],'noindex, nofollow')
  assert.equal((await request('shop.building-suit.com','/my-appointments')).status,404)
  assert.equal((await request('unpublished-shop.shops.building-suit.com','/my-appointments')).status,404)
  const alias=await request('alpha-alias.shops.building-suit.com','/my-appointments?lang=en');assert.equal(alias.headers.location,'https://alpha-tools.shops.building-suit.com/my-appointments?lang=en')
  assert.deepEqual(JSON.parse((await request(host,api,query)).text),{authenticated:false})
  const verified=await request(host,'/api/website/appointment-access/verify',{code:'0123ABCDEFGH',phone:'+201000000002'})
  assert.equal(JSON.parse(verified.text).ok,true);const cookie=verified.headers['set-cookie'][0].split(';')[0],auth={cookie}
  const history=await request(host,api,query,auth);assert.equal(history.status,200);assert.equal(JSON.parse(history.text).items.length,20);assert.ok(!history.text.includes('PRIVATE'));assert.ok(!history.text.includes(cookie.split('=')[1]));assert.equal(history.headers['cache-control'],'private, no-store')
  assert.equal(JSON.parse((await request('beta-tools.shops.building-suit.com',api,query,auth)).text).authenticated,false)
  for(const body of [{...query,shopId:'foreign'},{...query,customerId:'foreign'},{...query,appointmentId:'foreign'},{...query,page:'1'},{...query,bucket:[]},{...query,page:100001}])assert.deepEqual(JSON.parse((await request(host,api,body,auth)).text),{authenticated:false})
  assert.equal((await request(host,api,query,{...auth,origin:'https://beta-tools.shops.building-suit.com'})).status,403)
  assert.equal(JSON.parse((await request(host,api,{bucket:'past',page:1},auth)).text).items.length,3)
  await request(host,'/api/website/appointment-access/logout',{},auth)
  assert.equal(JSON.parse((await request(host,api,query,auth)).text).authenticated,false)
  assert.ok(!logs.includes(cookie.split('=')[1]))
 }finally{child.kill('SIGTERM');await once(child,'exit')}
})
