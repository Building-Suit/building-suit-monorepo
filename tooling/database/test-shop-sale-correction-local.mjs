import { readFile } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const container = 'supabase_db_building-suit-shop'
const psqlArgs = ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']
const concurrencyOnly = process.argv.includes('--concurrency-only')

function runSql(sql, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', psqlArgs, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      const result = { code, stdout: stdout.trim(), stderr: stderr.trim() }
      if (code !== 0 && !allowFailure) reject(new Error(stderr || `psql exited ${code}`))
      else resolve(result)
    })
    child.stdin.end(sql)
  })
}

function authenticated(userId, statement) {
  return `select set_config('request.jwt.claim.sub','${userId}',false); set role authenticated; ${statement}`
}

function lastLine(output) {
  return output.split('\n').filter(Boolean).at(-1)
}

if (!concurrencyOnly) {
  const migration = spawnSync('pnpm', ['db', 'shop-suit', 'migration', 'up', '--local'], { stdio: 'inherit' })
  if (migration.status !== 0) process.exit(migration.status ?? 1)
  const suite = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_sale_corrections.sql', import.meta.url), 'utf8')
  const suiteResult = spawnSync('docker', psqlArgs, {
    input: `BEGIN;\n${suite}\nROLLBACK;`, encoding: 'utf8',
  })
  if (suiteResult.status !== 0) {
    console.error(`shop_sale_corrections: failed\n${suiteResult.stdout || ''}\n${suiteResult.stderr || suiteResult.error}`)
    process.exit(1)
  }
  console.log('shop_sale_corrections: passed; fixtures rolled back')
}

const ownerId = randomUUID()
let shopId
try {
  await runSql(`insert into auth.users (id,email,encrypted_password,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('${ownerId}','${ownerId}@sale-correction-concurrency.invalid','x','authenticated','authenticated','{}','{}',now(),now());`)
  shopId = lastLine((await runSql(authenticated(ownerId,
    "select public.create_owner_shop('Sale correction concurrency','solo','service'::public.business_mode);"))).stdout)
  const locationId = lastLine((await runSql(`select id from public.shop_locations where shop_id='${shopId}' and is_default;`)).stdout)
  const customerId = lastLine((await runSql(authenticated(ownerId,
    `select public.save_customer('${shopId}',null,'Concurrency customer',null,null,null,null);`))).stdout)
  const serviceId = lastLine((await runSql(authenticated(ownerId,
    `select public.save_service('${shopId}',null,'Concurrency service',null,10,'amount',0);`))).stdout)
  const lines = JSON.stringify([{ item_type: 'service', source_id: serviceId, quantity: 1 }]).replaceAll("'", "''")

  const createIssuedSale = async () => {
    const saleId = lastLine((await runSql(authenticated(ownerId,
      `select public.save_location_sale_draft('${randomUUID()}','${shopId}','${locationId}',null,'${customerId}',null,null,'${lines}'::jsonb);`))).stdout)
    await runSql(authenticated(ownerId,
      `select public.issue_location_sale('${randomUUID()}','${shopId}','${locationId}','${saleId}');`))
    return saleId
  }

  const idempotentSale = await createIssuedSale()
  const sameRequest = randomUUID()
  const sameEffectiveAt = new Date().toISOString()
  const first = runSql(`begin; select id from public.invoices where id='${idempotentSale}' for update; select pg_sleep(0.35); set local role authenticated; select set_config('request.jwt.claim.sub','${ownerId}',true); select 'RESULT:' || public.correct_location_sale('${sameRequest}','${shopId}','${locationId}','${idempotentSale}','${sameEffectiveAt}','Concurrent identical retry',null); commit;`)
  await new Promise(resolve => setTimeout(resolve, 50))
  const second = runSql(authenticated(ownerId,
    `select 'RESULT:' || public.correct_location_sale('${sameRequest}','${shopId}','${locationId}','${idempotentSale}','${sameEffectiveAt}','Concurrent identical retry',null);`))
  const sameResults = await Promise.all([first, second])
  const correctionIds = sameResults.map(result => result.stdout.split('\n')
    .find(line => line.startsWith('RESULT:'))?.slice('RESULT:'.length))
    .filter(value => /^[0-9a-f-]{36}$/.test(value ?? ''))
  if (sameResults.some(result => result.code !== 0) || correctionIds.length !== 2
    || new Set(correctionIds).size !== 1) {
    throw new Error(`concurrent idempotent retry did not converge: ${JSON.stringify(sameResults)}`)
  }

  const conflictSale = await createIssuedSale()
  const conflictEffectiveAt = new Date().toISOString()
  const conflictResults = await Promise.all([
    runSql(authenticated(ownerId,
      `select public.correct_location_sale('${randomUUID()}','${shopId}','${locationId}','${conflictSale}','${conflictEffectiveAt}','Concurrent request one',null);`), { allowFailure: true }),
    runSql(authenticated(ownerId,
      `select public.correct_location_sale('${randomUUID()}','${shopId}','${locationId}','${conflictSale}','${conflictEffectiveAt}','Concurrent request two',null);`), { allowFailure: true }),
  ])
  if (conflictResults.filter(result => result.code === 0).length !== 1
    || conflictResults.filter(result => result.stderr.includes('SALE_ALREADY_CORRECTED')).length !== 1
    || lastLine((await runSql(`select count(*) from public.sale_corrections where invoice_id='${conflictSale}';`)).stdout) !== '1') {
    throw new Error(`conflicting correction race was not serialized safely: ${JSON.stringify(conflictResults)}`)
  }
  console.log('shop_sale_correction_concurrency: passed; identical retries converged and conflicting requests serialized')
}
finally {
  if (shopId) {
    await runSql(`set session_replication_role=replica; delete from public.shops where id='${shopId}'; delete from auth.users where id='${ownerId}'; set session_replication_role=origin;`, { allowFailure: true })
  }
  else {
    await runSql(`delete from auth.users where id='${ownerId}';`, { allowFailure: true })
  }
}
