import assert from 'node:assert/strict'
import test from 'node:test'
import {parsePublicWebsite,publicWebsiteQuery,websitePageUrl} from '../../shared/publicWebsite.ts'
import {showcase} from '../fixtures/public-website.mjs'
test('SSR allowlist removes private fields and hidden amounts from public projections',()=>{
 const raw=showcase();raw.profile.ownerEmail='PRIVATE';raw.profile.locations[0].id='PRIVATE';raw.catalog.items[0].cost=99;raw.catalog.items[0].price=199;raw.catalog.items[0].currency='USD';raw.shopId='PRIVATE'
 const safe=parsePublicWebsite(raw,'alpha-tools')
 assert.ok(!JSON.stringify(safe).includes('PRIVATE'));assert.ok(!('price'in safe.catalog.items[0]));assert.ok(!('cost'in safe.catalog.items[0]))
 for(const patch of [null,{}, {...raw,catalog:null}])assert.throws(()=>parsePublicWebsite(patch,'alpha-tools'))
 assert.throws(()=>parsePublicWebsite(raw,'beta-tools'))
 raw.profile.logoDataUrl='data:image/svg+xml;base64,PHN2Zz4='
 assert.throws(()=>parsePublicWebsite(raw,'alpha-tools'))
})
test('bilingual canonical URLs and pagination reject ambiguous or foreign query state',()=>{
 assert.equal(websitePageUrl('alpha-tools','ar'),'https://alpha-tools.shops.building-suit.com/')
 assert.equal(websitePageUrl('alpha-tools','en',2),'https://alpha-tools.shops.building-suit.com/?lang=en&page=2')
 assert.deepEqual(publicWebsiteQuery(new URLSearchParams('lang=en&page=2')),{locale:'en',page:2})
 for(const query of ['lang=fr','lang=en&lang=ar','page=0','page=-1','page=100000','page=1&page=2','shopId=private','returnTo=https://evil.invalid'])assert.throws(()=>publicWebsiteQuery(new URLSearchParams(query)))
})
test('anonymous RPC transport rejects privileged keys and never forwards request identity',async()=>{
 const {createServer}=await import('node:http'),{once}=await import('node:events'),{publicWebsiteRpc}=await import('../../server/utils/publicWebsiteRpc.ts')
 const calls=[];let fail=false
 const api=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;calls.push({headers:req.headers,body});res.setHeader('content-type','application/json');res.statusCode=fail?400:200;res.end(fail?'{"code":"22023","message":"PRIVATE detail"}':'{"ok":true}')})
 api.listen(0,'127.0.0.1');await once(api,'listening')
 const url=`http://127.0.0.1:${api.address().port}`
 try{
  const token=role=>'eyJtest.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.test'
  await assert.rejects(publicWebsiteRpc({url,key:token('service_role')},'fixture',{}),/PUBLIC_BACKEND_UNAVAILABLE/)
  await assert.rejects(publicWebsiteRpc({url:'https://example.invalid',key:'sb_secret_fixture'},'fixture',{}),/PUBLIC_BACKEND_UNAVAILABLE/)
  assert.equal(calls.length,0)
  await publicWebsiteRpc({url,key:'sb_publishable_fixture'},'fixture',{p_slug:'alpha-tools'})
  assert.equal(calls[0].headers.authorization,undefined);assert.equal(calls[0].headers.cookie,undefined);assert.deepEqual(JSON.parse(calls[0].body),{p_slug:'alpha-tools'})
  await publicWebsiteRpc({url,key:token('anon')},'fixture',{})
  assert.equal(calls[1].headers.authorization,`Bearer ${token('anon')}`)
  fail=true;await assert.rejects(publicWebsiteRpc({url,key:'sb_publishable_fixture'},'fixture',{}),e=>e.message==='PUBLIC_BACKEND_UNAVAILABLE'&&e.code==='22023'&&!String(e).includes('PRIVATE'))
 }finally{api.closeAllConnections();api.close()}
})
