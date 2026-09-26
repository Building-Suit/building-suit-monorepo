import { readFile } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const migration = spawnSync('pnpm', ['db', 'shop-suit', 'migration', 'up', '--local'], { stdio: 'inherit' })
if (migration.status !== 0) process.exit(migration.status ?? 1)

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

const suite = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_stock_counts_corrections.sql', import.meta.url), 'utf8')
const suiteResult = spawnSync('docker', psqlArgs, {
  input: `BEGIN;\n${suite}\nROLLBACK;`, encoding: 'utf8',
})
if (suiteResult.status !== 0) {
  console.error(`shop_stock_counts_corrections: failed\n${suiteResult.stdout || ''}\n${suiteResult.stderr || suiteResult.error}`)
  process.exit(1)
}
console.log('shop_stock_counts_corrections: passed; fixtures rolled back')

// Two real database sessions compete on the product lock. The count completes
// first and the waiting sale must re-check the corrected balance rather than
// oversell from its earlier draft.
const ownerId = randomUUID()
let shopId
try {
  await runSql(`insert into auth.users (id,email,encrypted_password,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('${ownerId}','${ownerId}@stock-concurrency.invalid','x','authenticated','authenticated','{}','{}',now(),now());`)
  shopId = lastLine((await runSql(authenticated(ownerId,
    `select public.create_owner_shop('Stock count concurrency','pro','product'::public.business_mode);`))).stdout)
  const customerId = lastLine((await runSql(authenticated(ownerId,
    `select public.save_customer('${shopId}',null,'Count race customer',null,null,null,null);`))).stdout)
  const productId = lastLine((await runSql(authenticated(ownerId,
    `select public.save_product('${shopId}',null,'Count race product','COUNT-RACE',null,10);`))).stdout)
  await runSql(authenticated(ownerId,
    `select public.adjust_stock('${randomUUID()}','${shopId}','${productId}',5,2,'Count race opening stock');`))
  const lines = JSON.stringify([{ item_type: 'product', source_id: productId, quantity: 4 }]).replaceAll("'", "''")
  const saleId = lastLine((await runSql(authenticated(ownerId,
    `select public.save_sale_draft('${randomUUID()}','${shopId}',null,'${customerId}',null,'${lines}'::jsonb);`))).stdout)

  const countId = randomUUID()
  const countFirst = runSql(`begin; select 1 from public.products where id='${productId}' for update; select pg_sleep(0.4); set local role authenticated; select set_config('request.jwt.claim.sub','${ownerId}',true); select public.record_stock_count('${countId}','${shopId}','${productId}',3,now(),'Concurrent shelf count','COUNT-RACE-001',null); commit;`, { allowFailure: true })
  await new Promise(resolve => setTimeout(resolve, 50))
  const saleSecond = runSql(authenticated(ownerId,
    `select public.issue_sale('${randomUUID()}','${shopId}','${saleId}');`), { allowFailure: true })
  const race = await Promise.all([countFirst, saleSecond])
  if (race[0].code !== 0 || race[1].code === 0
    || !race[1].stderr.includes('INSUFFICIENT_STOCK')) {
    throw new Error(`count/sale race did not serialize safely: ${JSON.stringify(race)}`)
  }
  const evidence = lastLine((await runSql(`select (select quantity_on_hand from public.product_stock where product_id='${productId}') || '|' || (select status from public.invoices where id='${saleId}') || '|' || (select count(*) from public.stock_counts where id='${countId}') || '|' || (select inventory_value from public.product_stock where product_id='${productId}');`)).stdout)
  if (evidence !== '3.00|draft|1|6.0000') {
    throw new Error(`count/sale reconciliation failed: ${evidence}`)
  }
  console.log(`shop_stock_concurrency: passed; count 5 -> 3, sale rejected, reconciliation ${evidence}`)
}
finally {
  if (shopId) {
    await runSql(`set session_replication_role=replica; delete from public.shops where id='${shopId}'; delete from auth.users where id='${ownerId}'; set session_replication_role=origin;`, { allowFailure: true })
  }
  else await runSql(`delete from auth.users where id='${ownerId}';`, { allowFailure: true })
}
