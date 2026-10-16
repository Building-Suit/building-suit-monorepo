import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogRejectionReason } from './catalog-diagnostics.mjs'
import { createCatalog } from './publisher.mjs'
const response = body => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 400 })

test('catalog rejection diagnostics allow only exact guard tokens and fixed SQLSTATE categories', async () => {
  for (const message of ['INVALID_COPY', 'UNREGISTERED_INTERNAL_CONSUMER', 'PRODUCTION_BASELINE_ACK_REQUIRED', 'DIGEST_CONFLICT']) {
    assert.equal(await catalogRejectionReason(response({code:'P0001',message,details:'secret',hint:'private'})),message)
  }
  assert.equal(await catalogRejectionReason(response({code:'42702',message:'private column name'})),'CATALOG_AMBIGUOUS_COLUMN')
  for (const body of [null, [], 'not json', {code:'P0001',message:'INVALID_COPY secret'}, {code:'secret',message:'secret'}, {code:'42501 secret'}, {code:'P0001',message:{secret:true}}, {code:'P0001',message:'INVALID_COPY',details:'x'.repeat(9000)}]) {
    assert.equal(await catalogRejectionReason(response(body)),'CATALOG_REJECTED')
  }
  assert.equal(await catalogRejectionReason({body:{getReader(){throw new Error('secret')}}}),'CATALOG_REJECTED')
})

test('actual publisher catalog adapter fails closed without exposing error body or credentials', async () => {
  const catalog=createCatalog('https://abcdefghijklmnopqrst.supabase.co','credential-sentinel','abcdefghijklmnopqrst',async()=>response({code:'P0001',message:'INVALID_COPY',details:'payload-sentinel',hint:'credential-sentinel'}))
  await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:{private:'payload-sentinel'}}),error=>{
    assert.match(error.message,/HTTP 400; reason INVALID_COPY/)
    assert.doesNotMatch(error.stack,/credential-sentinel|payload-sentinel/)
    return true
  })
  const unknown=createCatalog('https://abcdefghijklmnopqrst.supabase.co','credential-sentinel','abcdefghijklmnopqrst',async()=>response({code:'secret',message:'payload-sentinel'}))
  await assert.rejects(unknown('release_candidate_refresh'),/reason CATALOG_REJECTED/)
})
