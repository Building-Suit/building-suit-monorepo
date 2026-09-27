import { readFile } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const container = 'supabase_db_building-suit-shop'
const psqlArgs = ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']

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

const suite = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_sale_issuance.sql', import.meta.url), 'utf8')
const suiteResult = spawnSync('docker', psqlArgs, {
  input: `BEGIN;\n${suite}\nROLLBACK;`, encoding: 'utf8',
})
if (suiteResult.status !== 0) {
  console.error(`shop_sale_issuance: failed\n${suiteResult.stdout || ''}\n${suiteResult.stderr || suiteResult.error}`)
  process.exit(1)
}
console.log('shop_sale_issuance: passed; fixtures rolled back')

const ownerId = randomUUID()
let shopId
try {
  await runSql(`insert into auth.users (id,email,encrypted_password,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('${ownerId}','${ownerId}@sale-concurrency.invalid','x','authenticated','authenticated','{}','{}',now(),now());`)
  shopId = lastLine((await runSql(authenticated(ownerId,
    `select public.create_owner_shop('Sale concurrency fixture','pro','mixed'::public.business_mode);`))).stdout)
  const customerId = lastLine((await runSql(authenticated(ownerId,
    `select public.save_customer('${shopId}',null,'Concurrency Customer',null,null,null,null);`))).stdout)
  const productId = lastLine((await runSql(authenticated(ownerId,
    `select public.save_product('${shopId}',null,'Concurrency Product',null,null,10);`))).stdout)
  const serviceId = lastLine((await runSql(authenticated(ownerId,
    `select public.save_service('${shopId}',null,'Concurrency Service',null,5,'amount',0);`))).stdout)
  await runSql(authenticated(ownerId,
    `select public.adjust_stock('${randomUUID()}','${shopId}','${productId}',5,2,'Concurrency opening stock');`))

  const productLines = JSON.stringify([{ item_type: 'product', source_id: productId, quantity: 4 }]).replaceAll("'", "''")
  const draftOne = lastLine((await runSql(authenticated(ownerId,
    `select public.save_sale_draft('${randomUUID()}','${shopId}',null,'${customerId}',null,'${productLines}'::jsonb);`))).stdout)
  const draftTwo = lastLine((await runSql(authenticated(ownerId,
    `select public.save_sale_draft('${randomUUID()}','${shopId}',null,'${customerId}',null,'${productLines}'::jsonb);`))).stdout)

  const issueOne = `begin; select 1 from public.products where id='${productId}' for update; select pg_sleep(0.4); set local role authenticated; select set_config('request.jwt.claim.sub','${ownerId}',true); select public.issue_sale('${randomUUID()}','${shopId}','${draftOne}'); commit;`
  const first = runSql(issueOne, { allowFailure: true })
  await new Promise(resolve => setTimeout(resolve, 50))
  const second = runSql(authenticated(ownerId,
    `select public.issue_sale('${randomUUID()}','${shopId}','${draftTwo}');`), { allowFailure: true })
  const stockRace = await Promise.all([first, second])
  if (stockRace.filter(result => result.code === 0).length !== 1
    || stockRace.filter(result => result.stderr.includes('INSUFFICIENT_STOCK')).length !== 1) {
    throw new Error(`stock race did not produce one issue and one rejection: ${JSON.stringify(stockRace)}`)
  }
  const stockEvidence = lastLine((await runSql(`select (select quantity_on_hand from public.product_stock where product_id='${productId}') || '|' || (select count(*) from public.invoices where id in ('${draftOne}','${draftTwo}') and status='issued') || '|' || (select count(*) from public.inventory_movements where reference_id in ('${draftOne}','${draftTwo}'));`)).stdout)
  const [endingStock, issuedCount, movementCount] = stockEvidence.split('|')
  if (Number(endingStock) !== 1 || issuedCount !== '1' || movementCount !== '1') {
    throw new Error(`stock race reconciliation failed: ${stockEvidence}`)
  }

  const serviceLines = JSON.stringify([{ item_type: 'service', source_id: serviceId, quantity: 1 }]).replaceAll("'", "''")
  const numberDraftOne = lastLine((await runSql(authenticated(ownerId,
    `select public.save_sale_draft('${randomUUID()}','${shopId}',null,'${customerId}',null,'${serviceLines}'::jsonb);`))).stdout)
  const numberDraftTwo = lastLine((await runSql(authenticated(ownerId,
    `select public.save_sale_draft('${randomUUID()}','${shopId}',null,'${customerId}',null,'${serviceLines}'::jsonb);`))).stdout)
  const numberFirst = runSql(authenticated(ownerId,
    `select pg_sleep(0.2); select public.issue_sale('${randomUUID()}','${shopId}','${numberDraftOne}');`))
  const numberSecond = runSql(authenticated(ownerId,
    `select pg_sleep(0.2); select public.issue_sale('${randomUUID()}','${shopId}','${numberDraftTwo}');`))
  await Promise.all([numberFirst, numberSecond])
  const numberEvidence = lastLine((await runSql(`select count(*) || '|' || count(distinct invoice_number) from public.invoices where id in ('${numberDraftOne}','${numberDraftTwo}') and status='issued';`)).stdout)
  if (numberEvidence !== '2|2') throw new Error(`number race reconciliation failed: ${numberEvidence}`)
  console.log(`shop_sale_concurrency: passed; stock 5 -> issued 4 -> ending 1; number race ${numberEvidence}`)
}
finally {
  if (shopId) {
    await runSql(`set session_replication_role=replica; delete from public.shops where id='${shopId}'; delete from auth.users where id='${ownerId}'; set session_replication_role=origin;`, { allowFailure: true })
  }
  else {
    await runSql(`delete from auth.users where id='${ownerId}';`, { allowFailure: true })
  }
}
