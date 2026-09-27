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

const suite = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_supplier_payables_returns.sql', import.meta.url), 'utf8')
const suiteResult = spawnSync('docker', psqlArgs, { input: `BEGIN;\n${suite}\nROLLBACK;`, encoding: 'utf8' })
if (suiteResult.status !== 0) {
  console.error(`shop_supplier_payables_returns: failed\n${suiteResult.stdout || ''}\n${suiteResult.stderr || suiteResult.error}`)
  process.exit(1)
}
console.log('shop_supplier_payables_returns: passed; fixtures rolled back')

// Real connections race against the same locked purchase/batch. This proves
// authoritative serialization rather than only sequential retry behavior.
const ownerId = randomUUID()
let shopId
try {
  await runSql(`insert into auth.users (id,email,encrypted_password,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('${ownerId}','${ownerId}@supplier-concurrency.invalid','x','authenticated','authenticated','{}','{}',now(),now());`)
  shopId = lastLine((await runSql(authenticated(ownerId,
    `select public.create_owner_shop('Supplier concurrency fixture','pro','product'::public.business_mode);`))).stdout)
  const productId = lastLine((await runSql(authenticated(ownerId,
    `select public.save_product('${shopId}',null,'Concurrency item','PUR-CONCURRENCY',null,20);`))).stdout)
  const vendorId = lastLine((await runSql(authenticated(ownerId,
    `select public.save_vendor('${shopId}',null,'Concurrency supplier',null,null,null,null,null,null);`))).stdout)
  const purchaseId = lastLine((await runSql(authenticated(ownerId,
    `select public.create_supplier_purchase('${randomUUID()}','${shopId}','${vendorId}','PUR-CONCURRENCY',current_date,null,'[{"product_id":"${productId}","quantity":10,"unit_cost":10}]'::jsonb);`))).stdout)
  const itemId = lastLine((await runSql(`select id from public.vendor_invoice_items where vendor_invoice_id='${purchaseId}';`)).stdout)

  const paymentOne = `begin; select 1 from public.vendor_invoices where id='${purchaseId}' for update; select pg_sleep(0.4); set local role authenticated; select set_config('request.jwt.claim.sub','${ownerId}',true); select public.record_supplier_payment('${randomUUID()}','${shopId}','${vendorId}',70,now(),'cash',null,null,'[{"vendor_invoice_id":"${purchaseId}","amount":70}]'::jsonb); commit;`
  const firstPayment = runSql(paymentOne, { allowFailure: true })
  await new Promise(resolve => setTimeout(resolve, 50))
  const secondPayment = runSql(authenticated(ownerId,
    `select public.record_supplier_payment('${randomUUID()}','${shopId}','${vendorId}',60,now(),'card',null,null,'[{"vendor_invoice_id":"${purchaseId}","amount":60}]'::jsonb);`), { allowFailure: true })
  const paymentRace = await Promise.all([firstPayment, secondPayment])
  if (paymentRace.filter(result => result.code === 0).length !== 1
    || paymentRace.filter(result => result.stderr.includes('SUPPLIER_PAYMENT_OVERPAYMENT_REJECTED')).length !== 1) {
    throw new Error(`supplier payment race did not serialize safely: ${JSON.stringify(paymentRace)}`)
  }
  const paymentEvidence = lastLine((await runSql(`select count(*) || '|' || sum(amount) || '|' || shop_private.purchase_payable('${purchaseId}') from public.supplier_payment_allocations where vendor_invoice_id='${purchaseId}';`)).stdout)
  if (paymentEvidence !== '1|70.00|30.00') throw new Error(`supplier payment race reconciliation failed: ${paymentEvidence}`)

  // Reverse the successful payment so the full payable is available to both
  // competing returns; stock availability then determines the single winner.
  const paymentId = lastLine((await runSql(`select payment_id from public.supplier_payment_allocations where vendor_invoice_id='${purchaseId}';`)).stdout)
  const allocationId = lastLine((await runSql(`select id from public.supplier_payment_allocations where payment_id='${paymentId}';`)).stdout)
  await runSql(authenticated(ownerId,
    `select public.reverse_supplier_payment('${randomUUID()}','${shopId}','${paymentId}',now(),'Prepare return race',null,'[{"allocation_id":"${allocationId}","amount":70}]'::jsonb);`))

  const returnOne = `begin; select 1 from public.inventory_batches where source_id='${purchaseId}' for update; select pg_sleep(0.4); set local role authenticated; select set_config('request.jwt.claim.sub','${ownerId}',true); select public.record_purchase_return('${randomUUID()}','${shopId}','${purchaseId}',now(),'Concurrent return one',null,'[{"vendor_invoice_item_id":"${itemId}","quantity":6}]'::jsonb); commit;`
  const firstReturn = runSql(returnOne, { allowFailure: true })
  await new Promise(resolve => setTimeout(resolve, 50))
  const secondReturn = runSql(authenticated(ownerId,
    `select public.record_purchase_return('${randomUUID()}','${shopId}','${purchaseId}',now(),'Concurrent return two',null,'[{"vendor_invoice_item_id":"${itemId}","quantity":6}]'::jsonb);`), { allowFailure: true })
  const returnRace = await Promise.all([firstReturn, secondReturn])
  if (returnRace.filter(result => result.code === 0).length !== 1
    || returnRace.filter(result => result.stderr.includes('PURCHASE_RETURN_STOCK_UNAVAILABLE')).length !== 1) {
    throw new Error(`purchase return race did not serialize safely: ${JSON.stringify(returnRace)}`)
  }
  const returnEvidence = lastLine((await runSql(`select count(*) || '|' || sum(item.quantity) || '|' || min(batch.remaining_quantity) || '|' || shop_private.purchase_payable('${purchaseId}') from public.purchase_return_items item join public.inventory_batches batch on batch.id=item.inventory_batch_id where item.shop_id='${shopId}' group by item.shop_id;`)).stdout)
  if (returnEvidence !== '1|6.000|4.00|40.00') throw new Error(`purchase return race reconciliation failed: ${returnEvidence}`)
  console.log(`shop_supplier_concurrency: passed; payment ${paymentEvidence}; return ${returnEvidence}`)
}
finally {
  if (shopId) {
    await runSql(`set session_replication_role=replica; delete from public.shops where id='${shopId}'; delete from auth.users where id='${ownerId}'; set session_replication_role=origin;`, { allowFailure: true })
  }
  else await runSql(`delete from auth.users where id='${ownerId}';`, { allowFailure: true })
}
