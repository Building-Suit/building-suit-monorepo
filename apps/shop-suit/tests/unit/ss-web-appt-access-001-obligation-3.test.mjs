import assert from 'node:assert/strict'
import test from 'node:test'
import {createInquiryRateLimit} from '../../server/utils/inquiryRateLimit.ts'
import {readFileSync} from 'node:fs'
test('client limiter bounds attempts, separates shops and sockets, expires and bounds memory',()=>{
 const allow=createInquiryRateLimit(20,600000,3)
 for(let i=0;i<20;i++)assert.equal(allow('shop-a:socket-a',0),true)
 assert.equal(allow('shop-a:socket-a',0),false);assert.equal(allow('shop-a:socket-b',0),true);assert.equal(allow('shop-b:socket-a',0),true);assert.equal(allow('shop-c:socket-a',0),false)
 assert.equal(allow('shop-a:socket-a',600000),true)
})
test('credential SQL never adds secret fields to existing appointment audit snapshots',()=>{
 const sql=readFileSync(new URL('../../supabase/migrations/20261016020824_shop_appointment_access_credentials.sql',import.meta.url),'utf8')
 assert.ok(!/alter table public\.appointments.*add column/s.test(sql))
 assert.ok(!/raise (log|notice|warning)|console\.(log|error)/i.test(sql))
 assert.match(sql,/token_hash bytea not null unique/);assert.match(sql,/code_hash bytea not null unique/)
 // Rotation/revocation, expiry and cross-Shop replay are verified by the DB and built HTTP suites.
})
