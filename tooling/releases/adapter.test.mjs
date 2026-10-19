import test from 'node:test'
import assert from 'node:assert/strict'
// Exercise the actual Nuxt handler with injected runtime/transport; no HTTP or hosted state.
globalThis.defineEventHandler = handler => handler
globalThis.setHeader = () => {}
globalThis.createError = value => Object.assign(new Error(value.statusMessage),value)
const { default: readFeed } = await import('../../packages/nuxt-layer/server/api/changelog.get.ts')
const copy={en:'Published improvement',ar:'تحسين منشور'}
const entry={id:'public-entry',suit:'shop-suit',visibility:'public',status:'released',version:'2.0.1',publishedAt:'2026-10-14T12:00:00Z',releasedAt:'2026-10-14T12:00:00Z',title:copy,summary:copy,details:copy,links:[],task:'PRIVATE',sourceSha:'PRIVATE'}
const config={releaseCatalogUrl:'https://abcdefghijklmnopqrst.supabase.co',releaseCatalogPublishableKey:'public-fixture-key'}
test('read adapter fails closed before transport when environment binding is missing',async()=>{
  globalThis.useRuntimeConfig=()=>({})
  globalThis.$fetch=()=>assert.fail('Must not contact a guessed catalog')
  await assert.rejects(()=>readFeed({}),error=>error.statusCode===503)
})
test('read adapter delivers a sanitized trusted-clock projection and never internal/future provenance',async()=>{
  globalThis.useRuntimeConfig=()=>config
  globalThis.$fetch=async(url,options)=>{
    assert.equal(url,`${config.releaseCatalogUrl}/rest/v1/rpc/release_public_feed`)
    assert.equal(options.redirect,'error');assert.equal(options.headers.apikey,'public-fixture-key')
    return {serverNow:'2026-10-15T12:00:00Z',secret:'PRIVATE',suits:[{id:'shop-suit',name:copy,secret:'PRIVATE'}],entries:[entry,{...entry,id:'internal',visibility:'internal'},{...entry,id:'future',publishedAt:'2026-11-01T12:00:00Z'}]}
  }
  const feed=await readFeed({})
  assert.equal(feed.serverNow,'2026-10-15T12:00:00Z');assert.equal(feed.entries.length,1)
  assert.ok(!JSON.stringify(feed).includes('PRIVATE'));assert.equal(feed.entries[0].id,'public-entry')
})
test('read adapter hides upstream authorization errors and malformed copy',async()=>{
  globalThis.useRuntimeConfig=()=>config
  globalThis.$fetch=async()=>{throw new Error('PRIVATE backend credential')}
  await assert.rejects(()=>readFeed({}),error=>error.statusCode===503&&!error.message.includes('PRIVATE'))
  globalThis.$fetch=async()=>({serverNow:'invalid',suits:[],entries:[]})
  await assert.rejects(()=>readFeed({}),error=>error.statusCode===503)
})
