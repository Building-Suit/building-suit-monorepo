import { spawn } from 'node:child_process'
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
  return `select set_config('request.jwt.claim.sub','${userId}',false); select set_config('request.jwt.claim.role','authenticated',false); set role authenticated; ${statement}`
}

function lastLine(output) {
  return output.split('\n').filter(Boolean).at(-1)
}

const ownerId = randomUUID()
const operatorId = randomUUID()
const commandRequestId = randomUUID()
let shopId

try {
  await runSql(`insert into auth.users (id,email,encrypted_password,aud,role,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
    ('${ownerId}','${ownerId}@plan-billing-race.invalid','x','authenticated','authenticated','{}','{}',now(),now()),
    ('${operatorId}','${operatorId}@plan-billing-race.invalid','x','authenticated','authenticated','{}','{}',now(),now());
    insert into public.platform_admins (user_id,role,display_name)
    values ('${operatorId}','operator','Plan billing race operator');`)
  shopId = lastLine((await runSql(authenticated(ownerId,
    "select public.create_owner_shop('Plan billing concurrency','team','mixed'::public.business_mode);"))).stdout)
  const noticeId = lastLine((await runSql(authenticated(ownerId,
    `select public.submit_shop_billing_notice('${randomUUID()}','${shopId}','team',699,current_date,'IPN-RACE-001');`))).stdout)
  const beforeEnd = lastLine((await runSql(`select subscription.current_period_end
    from public.subscriptions subscription join public.shop_memberships membership
      on membership.profile_id=subscription.profile_id
    where membership.shop_id='${shopId}' and membership.role='owner';`)).stdout)
  const statement = `select public.platform_admin_billing_command(
    '${commandRequestId}','approve','${noticeId}','Concurrent verified transfer',
    jsonb_build_object('receivedAmount',699,'receivedReference','BANK-RACE-001','receivedDate',current_date::text));`
  const results = await Promise.all([
    runSql(authenticated(operatorId, statement)),
    runSql(authenticated(operatorId, statement)),
  ])
  const after = lastLine((await runSql(`select
    (subscription.current_period_end = '${beforeEnd}'::timestamptz + interval '1 month')::text || '|' ||
    (select count(*) from public.platform_billing_events event
      where event.request_id='${commandRequestId}') || '|' ||
    (select count(*) from public.subscription_commercial_periods period
      where period.billing_submission_id='${noticeId}')
    from public.subscriptions subscription join public.shop_memberships membership
      on membership.profile_id=subscription.profile_id
    where membership.shop_id='${shopId}' and membership.role='owner';`)).stdout)
  if (results.some(result => result.code !== 0)
    || results.filter(result => result.stdout.includes('"replayed": true')).length !== 1
    || after !== 'true|1|1') {
    throw new Error(`concurrent billing retry was not exactly-once: ${JSON.stringify({ results, after })}`)
  }
  console.log('shop_plan_billing_concurrency: passed; concurrent approval retries converged on one period and one audit event')
}
finally {
  if (shopId) {
    await runSql(`set session_replication_role=replica;
      delete from public.shops where id='${shopId}';
      delete from public.platform_admins where user_id='${operatorId}';
      delete from auth.users where id in ('${ownerId}','${operatorId}');
      set session_replication_role=origin;`, { allowFailure: true })
  }
  else {
    await runSql(`delete from public.platform_admins where user_id='${operatorId}';
      delete from auth.users where id in ('${ownerId}','${operatorId}');`, { allowFailure: true })
  }
}
