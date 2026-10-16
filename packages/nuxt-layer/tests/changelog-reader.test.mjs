import test from 'node:test'
import assert from 'node:assert/strict'
import {readPublicChangelog} from '../server/utils/changelogReader.ts'
const origin='https://abcdefghijklmnopqrst.supabase.co',key='public-fixture-key'
const privateValue='DO-NOT-LOG-CUSTOMER-OR-CREDENTIAL-DATA'
const empty={serverNow:'2026-10-15T12:00:00Z',suits:[],entries:[]}
const attempt=async({origin:host=origin,key:credential=key,fetchFeed=async()=>empty}={})=>{
  const diagnostics=[]
  let result,error
  try { result=await readPublicChangelog({origin:host,key:credential,fetchFeed,diagnostic:row=>diagnostics.push(row)}) }
  catch(failure){error=failure}
  assert.ok(!JSON.stringify(diagnostics).includes(privateValue))
  if(error) assert.equal(error.message,'Changelog unavailable')
  return {result,error,diagnostics}
}
test('malformed reader configuration never fetches or logs origin/key values; SSRF allowlist stays strict',async()=>{
  for(const patch of [{origin:''},{origin:'http://127.0.0.1'},{origin:'https://evil.example'},{origin:`${origin}/other`},{origin:`https://${privateValue}@abcdefghijklmnopqrst.supabase.co`},{key:''},{key:' '},{key:`${privateValue}\n`}]) {
    const result=await attempt({...patch,fetchFeed:async()=>assert.fail('Invalid configuration must not fetch')})
    assert.ok(result.error);assert.deepEqual(result.diagnostics,[{code:'CHANGELOG_CONFIGURATION_INVALID'}])
  }
})
test('upstream status and transport reason codes contain only bounded numeric status, never exception/header/payload data',async()=>{
  for(const status of [401,403,404,429,500,503]) {
    const result=await attempt({fetchFeed:async()=>{throw Object.assign(new Error(privateValue),{response:{status,headers:{authorization:privateValue},_data:{customer:privateValue}}})}})
    assert.ok(result.error);assert.equal(result.result,undefined)
    assert.deepEqual(result.diagnostics,[{code:'CHANGELOG_UPSTREAM_STATUS',status}])
  }
  for(const error of [new Error(privateValue),{statusCode:privateValue},{response:{status:9999}},null]) {
    const result=await attempt({fetchFeed:async()=>{throw error}})
    assert.ok(result.error);assert.equal(result.result,undefined)
    assert.deepEqual(result.diagnostics,[{code:'CHANGELOG_UPSTREAM_TRANSPORT'}])
  }
})
test('invalid feed emits a static schema reason without the payload; genuine validated empty feed succeeds without diagnostics',async()=>{
  const invalid=await attempt({fetchFeed:async()=>({serverNow:privateValue,entries:[{customer:privateValue}]})})
  assert.ok(invalid.error);assert.equal(invalid.result,undefined)
  assert.deepEqual(invalid.diagnostics,[{code:'CHANGELOG_FEED_INVALID'}])
  const valid=await attempt()
  assert.equal(valid.error,undefined);assert.deepEqual(valid.result,empty);assert.deepEqual(valid.diagnostics,[])
})
test('actual Nuxt handler keeps public 503 generic and logs no key, headers or upstream payload',async()=>{
  const names=['defineEventHandler','setHeader','useRuntimeConfig','$fetch','createError']
  const saved=names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)])
  const warn=console.warn, logs=[], requests=[],headers=[]
  try {
    globalThis.defineEventHandler=handler=>handler
    globalThis.setHeader=(_event,name,value)=>headers.push([name,value])
    globalThis.useRuntimeConfig=()=>({releaseCatalogUrl:origin,releaseCatalogPublishableKey:privateValue})
    globalThis.$fetch=async(url,options)=>{requests.push([url,options]);throw {response:{status:403,_data:{secret:privateValue}},message:privateValue}}
    globalThis.createError=options=>Object.assign(new Error(options.statusMessage),options)
    console.warn=(...values)=>logs.push(values)
    const {default:handler}=await import('../server/api/changelog.get.ts')
    await assert.rejects(()=>handler({}),error=>error.statusCode===503&&error.statusMessage==='Changelog unavailable'&&!String(error).includes(privateValue))
    assert.deepEqual(logs,[['[changelog-reader]',{code:'CHANGELOG_UPSTREAM_STATUS',status:403}]])
    assert.ok(!JSON.stringify(logs).includes(privateValue))
    assert.equal(requests[0][0],`${origin}/rest/v1/rpc/release_public_feed`)
    assert.equal(requests[0][1].redirect,'error');assert.equal(requests[0][1].timeout,10000)
    assert.deepEqual(headers,[['Cache-Control','no-store']])
  } finally {
    console.warn=warn
    for(const[name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name]
  }
})
