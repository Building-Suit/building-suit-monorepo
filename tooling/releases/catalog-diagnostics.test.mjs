import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { catalogRejectionReason } from './catalog-diagnostics.mjs'
import { createCatalog } from './publisher.mjs'
const response = body => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 400 })

test('catalog rejection diagnostics allow only exact guard tokens and fixed SQLSTATE categories', async () => {
  for (const message of ['INVALID_COPY', 'UNREGISTERED_INTERNAL_CONSUMER', 'PRODUCTION_BASELINE_ACK_REQUIRED', 'DIGEST_CONFLICT']) {
    assert.equal(await catalogRejectionReason(response({code:'P0001',message,details:'secret',hint:'private'})),message)
  }
  assert.equal(await catalogRejectionReason(response({code:'42702',message:'private column name'})),'CATALOG_AMBIGUOUS_COLUMN')
  for (const body of [{code:'P0001',message:'INVALID_COPY secret'}, {code:'secret',message:'secret'}, {code:'42501 secret'}, {code:'P0001',message:{secret:true}}]) {
    assert.equal(await catalogRejectionReason(response(body)),body.code==='P0001'?'CATALOG_GUARD_UNRECOGNIZED':'CATALOG_ERROR_CODE_UNRECOGNIZED')
  }
  assert.equal(await catalogRejectionReason({body:{getReader(){throw new Error('secret')}}}),'CATALOG_ERROR_READ_FAILED')
})

test('actual publisher catalog adapter fails closed without exposing error body or credentials', async () => {
  const catalog=createCatalog('https://abcdefghijklmnopqrst.supabase.co','credential-sentinel','abcdefghijklmnopqrst',async()=>response({code:'P0001',message:'INVALID_COPY',details:'payload-sentinel',hint:'credential-sentinel'}))
  await assert.rejects(catalog('release_candidate_refresh',{p_snapshot:{private:'payload-sentinel'}}),error=>{
    assert.match(error.message,/HTTP 400; reason INVALID_COPY/)
    assert.doesNotMatch(error.stack,/credential-sentinel|payload-sentinel/)
    return true
  })
  const unknown=createCatalog('https://abcdefghijklmnopqrst.supabase.co','credential-sentinel','abcdefghijklmnopqrst',async()=>response({code:'secret',message:'payload-sentinel'}))
  await assert.rejects(unknown('release_candidate_refresh'),/reason CATALOG_ERROR_CODE_UNRECOGNIZED/)
})


test('transport and error-shape diagnostics use fixed categories only', async () => {
  for (const body of [null, [], {}, {message:'private-sentinel'}, {code:2}]) assert.equal(await catalogRejectionReason(response(body)), 'CATALOG_ERROR_CODE_MISSING')
  for (const body of ['not json', '', '<html>private-sentinel</html>']) assert.equal(await catalogRejectionReason(response(body)), 'CATALOG_ERROR_JSON_INVALID')
  assert.equal(await catalogRejectionReason(response({code:'P0001',message:'INVALID_COPY',details:'private-sentinel'.repeat(1000)})), 'CATALOG_ERROR_BODY_OVERSIZED')
  assert.equal(await catalogRejectionReason({body:null}), 'CATALOG_ERROR_BODY_MISSING')
  assert.equal(await catalogRejectionReason({body:{getReader:()=>({read:async()=>{throw new Error('private-sentinel')},cancel:async()=>{}})}}), 'CATALOG_ERROR_READ_FAILED')
  for (const [code,reason] of [['22023','CATALOG_INVALID_PARAMETER'],['54001','CATALOG_STACK_DEPTH_LIMIT'],['PGRST102','CATALOG_REQUEST_JSON_INVALID'],['PGRST202','CATALOG_RPC_NOT_IN_SCHEMA_CACHE']]) {
    assert.equal(await catalogRejectionReason(response({code,message:'private-sentinel',details:'private-sentinel'})),reason)
  }
})


test('previously unmapped official codes retain exact static identity without upstream text', async () => {
  const cases=[['42P10','CATALOG_SQLSTATE_42P10_INVALID_COLUMN_REFERENCE'],['22003','CATALOG_SQLSTATE_22003_NUMERIC_VALUE_OUT_OF_RANGE'],['P0004','CATALOG_SQLSTATE_P0004_ASSERT_FAILURE'],['PGRST100','CATALOG_POSTGREST_PGRST100']]
  for(const [code,expected] of cases) assert.equal(await catalogRejectionReason(response({code,message:'private-sentinel',hint:'credential-sentinel',details:'payload-sentinel'})),expected)
  for(const code of ['TOKEN','42P99','PGRST999','PGRST100 private-sentinel','22003\nprivate-sentinel']) assert.equal(await catalogRejectionReason(response({code})), 'CATALOG_ERROR_CODE_UNRECOGNIZED')
  for(const message of ['IMMUTABLE_CANDIDATE_HISTORY','PER_MERGE_RELEASES_RETIRED']) assert.equal(await catalogRejectionReason(response({code:'P0001',message})),message)
})


test('every current model-2 SQL guard has an exact safe diagnostic', async () => {
  const sql=readFileSync(new URL('../../apps/super-admin-suit/supabase/migrations/20261015215030_upcoming_release_candidates.sql',import.meta.url),'utf8')
  const guards=new Set([...sql.matchAll(/raise exception '([A-Z_]+)'/g)].map(match=>match[1]))
  assert.ok(guards.size>20)
  for(const message of guards) assert.equal(await catalogRejectionReason(response({code:'P0001',message,details:'private-sentinel'})),message)
})


test('cardinality location diagnostics retain SQLSTATE and exact safe tokens only', async () => {
  for(const message of ['CANDIDATE_CARDINALITY_REFRESH','CANDIDATE_CARDINALITY_BASELINE_TREE','CANDIDATE_CARDINALITY_COPY_VALIDATOR','CANDIDATE_CARDINALITY_VERSION_VALIDATOR','CANDIDATE_CARDINALITY_AUTHORITY']) {
    assert.equal(await catalogRejectionReason(response({code:'21000',message,details:'private-sentinel'})),message)
  }
  assert.equal(await catalogRejectionReason(response({code:'21000',message:'CANDIDATE_CARDINALITY_REFRESH private-sentinel'})),'CATALOG_SQLSTATE_21000_CARDINALITY_VIOLATION')
})
