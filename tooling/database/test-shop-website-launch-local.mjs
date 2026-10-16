import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
const container=process.env.SHOP_WEBSITE_TEST_CONTAINER??'supabase_db_building-suit-shop'
assert.ok(['supabase_db_building-suit-shop','shop_website_disposable'].includes(container),'Known disposable Shop backend required')
function run(name){const result=spawnSync(process.execPath,['tooling/database/'+name],{stdio:'inherit',env:{...process.env,SHOP_WEBSITE_TEST_CONTAINER:container}});assert.equal(result.status,0,`${name} failed`)}
// The maintained full regression includes provider-managed schemas, migrations,
// historical billing fixtures and concurrency. Run it unchanged only in full
// disposable Supabase, never pretend the thin local SQL fixture is equivalent.
if(process.env.LAUNCH_FULL_SHOP_DB==='1'){
 assert.equal(container,'supabase_db_building-suit-shop','Full maintained regression requires disposable Supabase')
 assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted','Full launch replay is CI-only')
 run('test-shop-local.mjs')
}else console.log('Full provider/Shop replay not run locally; the dedicated GitHub-hosted launch job runs it')
for(const name of ['test-shop-website-slug-local.mjs','test-shop-website-profile-local.mjs','test-shop-website-catalog-local.mjs','test-shop-website-public-local.mjs','test-shop-appointment-access-local.mjs','test-shop-customer-portal-local.mjs','test-shop-public-booking-local.mjs'])run(name)
console.log('Website launch SQL matrix passed: publication, ownership, tenant isolation, claims/takeover, assets, inquiries/abuse, capability lifecycle, history and transactional booking')
