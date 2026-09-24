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

const suite = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_customer_payments.sql', import.meta.url), 'utf8')
const suiteResult = spawnSync('docker', psqlArgs, { input: `BEGIN;\n${suite}\nROLLBACK;`, encoding: 'utf8' })
if (suiteResult.status !== 0) {
  console.error(`shop_customer_payments: failed\n${suiteResult.stdout || ''}\n${suiteResult.stderr || suiteResult.error}`)
  process.exit(1)
}
console.log('shop_customer_payments: passed; fixtures rolled back')

const ownerId = randomUUID()
let shopId
try {
  await runSql(`insert into auth.users (id,email,encrypted_password,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('${ownerId}','${ownerId}@payment-concurrency.invalid','x','authenticated','authenticated','{}','{}',now(),now());`)
  shopId = lastLine((await runSql(authenticated(ownerId,
    `select public.create_owner_shop('Payment concurrency fixture','pro','service'::public.business_mode);`))).stdout)
  const customerId = lastLine((await runSql(authenticated(ownerId,
    `select public.save_customer('${shopId}',null,'Concurrency Customer',null,null,null,null);`))).stdout)
  const serviceId = lastLine((await runSql(authenticated(ownerId,
    `select public.save_service('${shopId}',null,'Concurrency Service',null,100,'amount',0);`))).stdout)
  const lines = JSON.stringify([{ item_type: 'service', source_id: serviceId, quantity: 1 }]).replaceAll("'", "''")
  const invoiceId = lastLine((await runSql(authenticated(ownerId,
    `select public.save_sale_draft('${randomUUID()}','${shopId}',null,'${customerId}',null,'${lines}'::jsonb);`))).stdout)
  await runSql(authenticated(ownerId,
    `select public.issue_sale('${randomUUID()}','${shopId}','${invoiceId}');`))

  const firstReceipt = `begin; select 1 from public.invoices where id='${invoiceId}' for update; select pg_sleep(0.4); set local role authenticated; select set_config('request.jwt.claim.sub','${ownerId}',true); select public.record_customer_receipt('${randomUUID()}','${shopId}','${customerId}',70,now(),'cash',null,null,'[{"invoice_id":"${invoiceId}","amount":70}]'::jsonb); commit;`
  const receiptOne = runSql(firstReceipt, { allowFailure: true })
  await new Promise(resolve => setTimeout(resolve, 50))
  const receiptTwo = runSql(authenticated(ownerId,
    `select public.record_customer_receipt('${randomUUID()}','${shopId}','${customerId}',60,now(),'card',null,null,'[{"invoice_id":"${invoiceId}","amount":60}]'::jsonb);`), { allowFailure: true })
  const receiptRace = await Promise.all([receiptOne, receiptTwo])
  if (receiptRace.filter(result => result.code === 0).length !== 1
    || receiptRace.filter(result => result.stderr.includes('PAYMENT_OVERPAYMENT_REJECTED')).length !== 1) {
    throw new Error(`receipt race did not serialize safely: ${JSON.stringify(receiptRace)}`)
  }
  const receiptId = lastLine((await runSql(`select payment.id from public.payments payment where payment.shop_id='${shopId}' and payment.customer_kind='receipt' order by payment.created_at desc limit 1;`)).stdout)
  const allocationId = lastLine((await runSql(`select id from public.customer_payment_allocations where payment_id='${receiptId}';`)).stdout)
  const receiptEvidence = lastLine((await runSql(`select count(*) || '|' || sum(amount) || '|' || shop_private.invoice_outstanding('${invoiceId}') from public.customer_payment_allocations where invoice_id='${invoiceId}';`)).stdout)
  if (receiptEvidence !== '1|70.00|30.00') throw new Error(`receipt race reconciliation failed: ${receiptEvidence}`)

  const firstAdjustment = `begin; select 1 from public.payments where id='${receiptId}' for update; select 1 from public.customer_payment_allocations where id='${allocationId}' for update; select pg_sleep(0.4); set local role authenticated; select set_config('request.jwt.claim.sub','${ownerId}',true); select public.reverse_customer_receipt('${randomUUID()}','${shopId}','${receiptId}',now(),'Concurrent correction','[{"allocation_id":"${allocationId}","amount":40}]'::jsonb); commit;`
  const adjustmentOne = runSql(firstAdjustment, { allowFailure: true })
  await new Promise(resolve => setTimeout(resolve, 50))
  const adjustmentTwo = runSql(authenticated(ownerId,
    `select public.refund_customer_receipt('${randomUUID()}','${shopId}','${receiptId}',now(),'cash',null,'Concurrent refund','[{"allocation_id":"${allocationId}","amount":40}]'::jsonb);`), { allowFailure: true })
  const adjustmentRace = await Promise.all([adjustmentOne, adjustmentTwo])
  if (adjustmentRace.filter(result => result.code === 0).length !== 1
    || adjustmentRace.filter(result => result.stderr.includes('PAYMENT_ADJUSTMENT_EXCEEDS_EFFECTIVE_AMOUNT')).length !== 1) {
    throw new Error(`adjustment race did not serialize safely: ${JSON.stringify(adjustmentRace)}`)
  }
  const adjustmentEvidence = lastLine((await runSql(`select coalesce(sum(amount),0) || '|' || shop_private.allocation_remaining('${allocationId}') || '|' || shop_private.invoice_outstanding('${invoiceId}') from public.customer_payment_adjustments where original_allocation_id='${allocationId}';`)).stdout)
  if (adjustmentEvidence !== '40.00|30.00|70.00') throw new Error(`adjustment race reconciliation failed: ${adjustmentEvidence}`)
  console.log(`shop_payment_concurrency: passed; receipt ${receiptEvidence}; adjustment ${adjustmentEvidence}`)
}
finally {
  if (shopId) {
    await runSql(`set session_replication_role=replica; delete from public.shops where id='${shopId}'; delete from auth.users where id='${ownerId}'; set session_replication_role=origin;`, { allowFailure: true })
  }
  else await runSql(`delete from auth.users where id='${ownerId}';`, { allowFailure: true })
}
