import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
const container=process.env.SHOP_WEBSITE_TEST_CONTAINER??'supabase_db_building-suit-shop'
assert.ok(['supabase_db_building-suit-shop','shop_website_disposable'].includes(container),'Disposable local Shop required')
for(const name of ['shop_appointments.sql','ss-web-appt-access-001-obligation-4.test.sql']){
 const suite=readFileSync(new URL('../../apps/shop-suit/supabase/tests/'+name,import.meta.url),'utf8')
 const result=spawnSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],{input:`BEGIN;${suite}ROLLBACK;`,encoding:'utf8'})
 assert.equal(result.status,0,result.stderr)
}
console.log('Appointment scheduling regression and access entropy, permissions, phone matching, isolation, quotas, rotation, revocation, expiry and secret-free audit passed; fixtures rolled back')
