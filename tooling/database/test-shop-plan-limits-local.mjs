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
  return `select set_config('request.jwt.claim.sub','${userId}',false); set role authenticated; ${statement}`
}

function lastLine(output) {
  return output.split('\n').filter(Boolean).at(-1)
}

function assertOneWinner(results, errorCode, label) {
  if (results.filter(result => result.code === 0).length !== 1
    || results.filter(result => result.stderr.includes(errorCode)).length !== 1) {
    throw new Error(`${label} race was not serialized: ${JSON.stringify(results)}`)
  }
}

const soloOwner = randomUUID()
const multiOwner = randomUUID()
const invitedUser = randomUUID()
let soloShop
let multiShop

try {
  await runSql(`insert into auth.users (id,email,encrypted_password,aud,role,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
    ('${soloOwner}','${soloOwner}@plan-limit-race.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now()),
    ('${multiOwner}','${multiOwner}@plan-limit-race.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now());`)
  soloShop = lastLine((await runSql(authenticated(soloOwner,
    "select public.create_owner_shop('Plan limit race Solo','solo','mixed'::public.business_mode);"))).stdout)
  multiShop = lastLine((await runSql(authenticated(multiOwner,
    "select public.create_owner_shop('Plan limit race Multi','multi','mixed'::public.business_mode);"))).stdout)

  const soloProfile = lastLine((await runSql(`select profile_id from public.shop_memberships where shop_id='${soloShop}' and role='owner';`)).stdout)
  const multiLocation = lastLine((await runSql(`select id from public.shop_locations where shop_id='${multiShop}' and is_default;`)).stdout)
  const soloLocation = lastLine((await runSql(`select id from public.shop_locations where shop_id='${soloShop}' and is_default;`)).stdout)
  const invitationCode = lastLine((await runSql(authenticated(soloOwner,
    `select public.invite_shop_member('${randomUUID()}','${soloShop}','${invitedUser}@plan-limit-race.invalid','Invited','staff',array['${soloLocation}'::uuid]) ->> 'invitationCode';`))).stdout)
  await runSql(`insert into auth.users (id,email,encrypted_password,aud,role,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
    ('${invitedUser}','${invitedUser}@plan-limit-race.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now());`)
  const staffRole = lastLine((await runSql(`select id from public.roles where shop_id='${soloShop}' and key='staff';`)).stdout)

  const memberResults = await Promise.all([
    runSql(authenticated(invitedUser,
      `select public.accept_shop_invitation('${randomUUID()}','${invitationCode}');`), { allowFailure: true }),
    runSql(`insert into public.shop_team_invitations
      (request_id,invitation_code,shop_id,email,display_name,role_id,invited_by_user_id)
      values ('${randomUUID()}','${randomUUID()}','${soloShop}',
        '${randomUUID()}@plan-limit-race.invalid','Extra','${staffRole}','${soloOwner}');`,
    { allowFailure: true }),
  ])
  assertOneWinner(memberResults, 'PLAN_RESOURCE_LIMIT_REACHED:active_members', 'member seat')

  await runSql(`insert into public.products (shop_id,name,sale_price,created_by_profile_id)
    select '${soloShop}', 'Race product ' || value, 1, '${soloProfile}' from generate_series(1,249) value;`)
  const productResults = await Promise.all([
    runSql(`insert into public.products (shop_id,name,sale_price,created_by_profile_id)
      values ('${soloShop}','Product contender A',1,'${soloProfile}');`, { allowFailure: true }),
    runSql(`insert into public.products (shop_id,name,sale_price,created_by_profile_id)
      values ('${soloShop}','Product contender B',1,'${soloProfile}');`, { allowFailure: true }),
  ])
  assertOneWinner(productResults, 'PLAN_RESOURCE_LIMIT_REACHED:active_products', 'product')

  await runSql(`insert into public.services (shop_id,name,base_sale_price,
      default_discount_type,default_discount_value,created_by_profile_id)
    select '${soloShop}', 'Race service ' || value, 1, 'amount', 0, '${soloProfile}'
    from generate_series(1,49) value;`)
  const serviceResults = await Promise.all([
    runSql(`insert into public.services (shop_id,name,base_sale_price,
      default_discount_type,default_discount_value,created_by_profile_id)
      values ('${soloShop}','Service contender A',1,'amount',0,'${soloProfile}');`, { allowFailure: true }),
    runSql(`insert into public.services (shop_id,name,base_sale_price,
      default_discount_type,default_discount_value,created_by_profile_id)
      values ('${soloShop}','Service contender B',1,'amount',0,'${soloProfile}');`, { allowFailure: true }),
  ])
  assertOneWinner(serviceResults, 'PLAN_RESOURCE_LIMIT_REACHED:active_services', 'service')

  await runSql(`insert into public.shop_locations (shop_id,name) values ('${multiShop}','Existing branch');`)
  const locationResults = await Promise.all([
    runSql(`insert into public.shop_locations (shop_id,name) values ('${multiShop}','Location contender A');`, { allowFailure: true }),
    runSql(`insert into public.shop_locations (shop_id,name) values ('${multiShop}','Location contender B');`, { allowFailure: true }),
  ])
  assertOneWinner(locationResults, 'PLAN_RESOURCE_LIMIT_REACHED:active_locations', 'location')

  const archivedLocations = (await runSql(`update public.shop_locations
    set status='archived', archived_at=now()
    where id=(select id from public.shop_locations where shop_id='${multiShop}'
      and not is_default and status='active' order by created_at limit 1);
    insert into public.shop_locations (shop_id,name,status,archived_at) values
      ('${multiShop}','Restore contender A','archived',now()),
      ('${multiShop}','Restore contender B','archived',now()) returning id;`)).stdout
    .split('\n').filter(line => /^[0-9a-f-]{36}$/.test(line))
  if (archivedLocations.length !== 2) throw new Error(`restore fixtures were not created: ${archivedLocations}`)
  const restoreResults = await Promise.all(archivedLocations.map(locationId => runSql(authenticated(multiOwner,
    `select public.restore_shop_location('${multiShop}','${locationId}');`), { allowFailure: true })))
  assertOneWinner(restoreResults, 'PLAN_RESOURCE_LIMIT_REACHED:active_locations', 'location restore')

  const counts = lastLine((await runSql(`select
    (select count(*) from public.products where shop_id='${soloShop}' and is_active),
    (select count(*) from public.services where shop_id='${soloShop}' and is_active),
    (select count(*) from public.shop_locations where shop_id='${multiShop}' and status='active'),
    (select count(*) from public.shop_locations where shop_id='${multiShop}' and id='${multiLocation}');`)).stdout)
  if (counts !== '250|50|3|1') throw new Error(`quota races exceeded a boundary: ${counts}`)
  console.log('shop_plan_limit_concurrency: passed; seat, location add/restore, product, and service last-slot races serialized')
}
finally {
  const shops = [soloShop, multiShop].filter(Boolean)
  if (shops.length) {
    await runSql(`set session_replication_role=replica;
      delete from public.shops where id in (${shops.map(id => `'${id}'`).join(',')});
      delete from auth.users where id in ('${soloOwner}','${multiOwner}','${invitedUser}');
      set session_replication_role=origin;`, { allowFailure: true })
  }
  else {
    await runSql(`delete from auth.users where id in ('${soloOwner}','${multiOwner}','${invitedUser}');`, { allowFailure: true })
  }
}
