import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
// Fixed disposable cloud/local backend; no URL, credentials or hosted target accepted.
const container = process.env.SHOP_WEBSITE_TEST_CONTAINER ?? 'supabase_db_building-suit-shop'
assert.ok(['supabase_db_building-suit-shop', 'shop_website_disposable'].includes(container), 'Disposable local Shop container required')
const args = ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq']
function sql(input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}
function asyncSql(input) {
  return new Promise(resolve => {
    const child = spawn('docker', args)
    let output = '', error = ''
    child.stdout.on('data', data => { output += data })
    child.stderr.on('data', data => { error += data })
    child.on('close', code => resolve({ code, output: output.trim(), error }))
    child.stdin.end(input)
  })
}
const suite = readFileSync(new URL('../../apps/shop-suit/supabase/tests/shop_website_slug.sql', import.meta.url), 'utf8')
sql(`BEGIN; ${suite} ROLLBACK;`)
console.log('Slug SQL authorization, aliases, rename independence, validation and fail-closed states passed; fixtures rolled back')
// Separate committed synthetic owners allow real simultaneous transactions.
// Their reserved claims intentionally persist only in this disposable backend.
const owners = [randomUUID(), randomUUID()]
const shops = owners.map(id => sql(`insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('${id}','${id}@website-race.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now()); select set_config('request.jwt.claim.sub','${id}',false); set role authenticated; select public.create_owner_shop('Concurrent website','mixed','Main','MAIN',null,null);`).split('\n').at(-1))
const slug = `race-${randomUUID().replaceAll('-', '')}`
// First transaction holds its inserted claim; second must block on that exact
// uniqueness conflict and lose after commit, rather than win a check-then-insert.
const first = spawn('docker', args)
let firstOutput = '', firstError = ''
first.stdout.on('data', value => { firstOutput += value })
first.stderr.on('data', value => { firstError += value })
const firstDone = new Promise(resolve => first.on('close', code => resolve(code)))
const command = (i, candidate) => `select set_config('request.jwt.claim.sub','${owners[i]}',false); set role authenticated; select public.shop_website_address_save('${shops[i]}','${candidate}');`
first.stdin.write(`BEGIN; ${command(0, slug)} select 'CLAIM_READY';\n`)
const deadline = Date.now() + 10000
while (!firstOutput.includes('CLAIM_READY')) {
  assert.ok(Date.now() < deadline, firstError || 'First transaction did not claim')
  await new Promise(resolve => setTimeout(resolve, 20))
}
const second = asyncSql(command(1, slug))
const waitDeadline = Date.now() + 10000
while (sql("select count(*) from pg_stat_activity where wait_event_type='Lock' and query like '%shop_website_address_save%' and pid <> pg_backend_pid();") === '0') {
  assert.ok(Date.now() < waitDeadline, 'Second transaction did not reach real uniqueness lock')
  await new Promise(resolve => setTimeout(resolve, 20))
}
first.stdin.end('COMMIT;\n')
assert.equal(await firstDone, 0, firstError)
const loser = await second
assert.notEqual(loser.code, 0)
assert.match(loser.error, /WEBSITE_SLUG_UNAVAILABLE/)
assert.equal(sql(`select count(*) from public.shop_website_slug_claims where slug='${slug}';`), '1')
assert.equal(sql(`select shop_id from public.shop_website_slug_claims where slug='${slug}';`), shops[0])
const upper = await asyncSql(command(1, slug.toUpperCase()))
assert.notEqual(upper.code, 0)
assert.match(upper.error, /INVALID_WEBSITE_SLUG/)
console.log('Two real concurrent Shop transactions: one claim, one collision; uppercase variant rejected; permanent owner retained')
