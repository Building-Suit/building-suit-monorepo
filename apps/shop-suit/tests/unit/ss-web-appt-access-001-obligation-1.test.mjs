import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {normalizeAppointmentAccessCode} from '../../shared/appointmentAccess.ts'
test('human-friendly codes have one canonical representation without ambiguous symbols',()=>{
 assert.equal(normalizeAppointmentAccessCode('0123-abcd-efgh'),'0123ABCDEFGH')
 assert.equal(normalizeAppointmentAccessCode(' 0123 ABCD EFGH '),'0123ABCDEFGH')
 for(const raw of [null,123,'0123ABCD','0123ABCDEFGHIJKL','0123-ABCD-EFGI','0123-ABCD-EFGO','0123-ABCD-EFGL','0123-ABCD-EFGU','0123_ABCD_EFGH','0123\nABCDEFGH'])assert.equal(normalizeAppointmentAccessCode(raw),null)
})
test('database generator uses unbiased crypto symbols with at least fifty bits and bounded collision retries',()=>{
 const sql=readFileSync(new URL('../../supabase/migrations/20261016020824_shop_appointment_access_credentials.sql',import.meta.url),'utf8')
 const alphabet=sql.match(/alphabet constant text:='([^']+)'/)[1]
 assert.equal(new Set(alphabet).size,32);assert.equal(256%alphabet.length,0);assert.ok(12*Math.log2(alphabet.length)>=50)
 assert.match(sql,/bytes bytea:=extensions.gen_random_bytes\(12\)/);assert.match(sql,/for i in 1\.\.5 loop/)
 assert.match(sql,/on conflict\(code_hash\) do nothing/)
 // Actual generation, uniqueness and collision behavior run against disposable PostgreSQL.
})
