import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'

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

const ownerId = randomUUID()
let shopId
try {
  await runSql(`insert into auth.users (id,email,encrypted_password,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('${ownerId}','${ownerId}@cash-concurrency.invalid','x','authenticated','authenticated','{}','{}',now(),now());`)
  shopId = lastLine((await runSql(authenticated(ownerId,
    "select public.create_owner_shop('Cash concurrency fixture','pro','service'::public.business_mode);"))).stdout)
  const locationId = lastLine((await runSql(`select id from public.shop_locations where shop_id='${shopId}' and is_default;`)).stdout)

  const firstOpen = runSql(`begin; ${authenticated(ownerId,
    `select public.open_cash_shift('${randomUUID()}','${shopId}','${locationId}','main',100,null);`)} select pg_sleep(0.4); commit;`, { allowFailure: true })
  await new Promise(resolve => setTimeout(resolve, 50))
  const secondOpen = runSql(authenticated(ownerId,
    `select public.open_cash_shift('${randomUUID()}','${shopId}','${locationId}','main',100,null);`), { allowFailure: true })
  const openRace = await Promise.all([firstOpen, secondOpen])
  if (openRace.filter(result => result.code === 0).length !== 1
    || openRace.filter(result => result.stderr.includes('CASH_SHIFT_ALREADY_OPEN')).length !== 1) {
    throw new Error(`open race did not serialize safely: ${JSON.stringify(openRace)}`)
  }

  const sessionId = lastLine((await runSql(`select id from public.cash_sessions where shop_id='${shopId}' and status='open';`)).stdout)
  const firstClose = runSql(`begin; ${authenticated(ownerId,
    `select public.close_cash_shift('${randomUUID()}','${shopId}','${sessionId}',100,null);`)} select pg_sleep(0.4); commit;`, { allowFailure: true })
  await new Promise(resolve => setTimeout(resolve, 50))
  const secondClose = runSql(authenticated(ownerId,
    `select public.close_cash_shift('${randomUUID()}','${shopId}','${sessionId}',101,'Second count');`), { allowFailure: true })
  const closeRace = await Promise.all([firstClose, secondClose])
  if (closeRace.filter(result => result.code === 0).length !== 1
    || closeRace.filter(result => result.stderr.includes('CASH_SHIFT_NOT_OPEN')).length !== 1) {
    throw new Error(`close race did not serialize safely: ${JSON.stringify(closeRace)}`)
  }
  const evidence = lastLine((await runSql(`select status || '|' || closing_amount || '|' || expected_amount || '|' || variance_amount from public.cash_sessions where id='${sessionId}';`)).stdout)
  if (evidence !== 'closed|100.00|100.00|0.00') throw new Error(`close reconciliation changed during race: ${evidence}`)
  console.log(`shop_cash_concurrency: passed; ${evidence}`)
}
finally {
  if (shopId) await runSql(`set session_replication_role=replica; delete from public.shops where id='${shopId}'; delete from auth.users where id='${ownerId}'; set session_replication_role=origin;`, { allowFailure: true })
  else await runSql(`delete from auth.users where id='${ownerId}';`, { allowFailure: true })
}
