// Disposable Shop database only. No hosted connection or project argument is accepted.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'

function sql(input, allowFailure = false, admin = false) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', 'supabase_db_building-suit-shop', 'psql', '-U', admin ? 'supabase_admin' : 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'])
    let output = ''; let error = ''
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { error += chunk })
    child.on('error', reject)
    child.on('close', code => code && !allowFailure ? reject(new Error(error)) : resolve({ code, output: output.trim(), error }))
    child.stdin.end(input)
  })
}
const asUser = (user, command) => `select set_config('request.jwt.claim.sub','${user}',false); set role authenticated; ${command}`
const last = result => result.output.split('\n').at(-1)
const owner = randomUUID(); const staff = randomUUID()
let created = false; let shop
try {
  await sql(`insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
    ('${owner}','${owner}@team-race.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now()),
    ('${staff}','${staff}@team-race.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now());`)
  created = true
  shop = last(await sql(asUser(owner, "select public.create_owner_shop('Team race fixture','solo','mixed'::public.business_mode);")))
  const location = last(await sql(`select id from public.shop_locations where shop_id='${shop}' and is_default;`))
  const invite = request => asUser(owner, `select public.invite_shop_staff('${request}','${shop}','${staff}@team-race.invalid','Race colleague','Receptionist','staff',array['${location}'::uuid])->>'invitationCode';`)
  const results = await Promise.all([sql(invite(randomUUID()), true), sql(invite(randomUUID()), true)])
  assert.equal(results.filter(result => result.code === 0).length, 1, 'duplicate invitations must have one winner')
  assert.match(results.find(result => result.code !== 0).error, /INVITATION_ALREADY_EXISTS/)
  const code = last(results.find(result => result.code === 0))
  const invitation = last(await sql(`select id from public.shop_team_invitations where invitation_code='${code}';`))
  await sql(asUser(owner, `select public.revoke_shop_invitation('${randomUUID()}','${shop}','${invitation}',null);`))
  const request = randomUUID()
  const retries = await Promise.all([sql(invite(request)), sql(invite(request))])
  assert.equal(last(retries[0]), last(retries[1]), 'racing same-request retries must return the same invitation')
  const claimCode = last(retries[0]); const acceptRequest = randomUUID()
  const claim = requestId => asUser(staff, `select public.accept_shop_invitation('${requestId}','${claimCode}');`)
  const claims = await Promise.all([sql(claim(acceptRequest)), sql(claim(acceptRequest))])
  assert.equal(last(claims[0]), shop)
  assert.equal(last(claims[1]), shop)
  const replay = await sql(claim(randomUUID()), true)
  assert.notEqual(replay.code, 0)
  assert.match(replay.error, /INVITATION_UNAVAILABLE/)
  assert.equal(last(await sql(`select count(*) from public.shop_memberships m join public.profiles p on p.id=m.profile_id where m.shop_id='${shop}' and p.user_id='${staff}';`)), '1')
  console.log('Shop invitation creation, retry, acceptance and replay races passed.')
} finally {
  if (created) {
    // Remove only this run's synthetic UUIDs and their children. Business data is untouched.
    await sql(`begin; set local session_replication_role=replica;
      do $$ declare t record; begin
        delete from public.membership_roles where membership_id in(select id from public.shop_memberships where shop_id='${shop ?? owner}');
        delete from public.role_permissions where role_id in(select id from public.roles where shop_id='${shop ?? owner}');
        for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
          join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and c.relkind='r'
          and a.attname='shop_id' and not a.attisdropped loop
          execute format('delete from public.%I where shop_id=$1',t.relname) using '${shop ?? owner}'::uuid;
        end loop;
        delete from public.subscriptions where profile_id in(select id from public.profiles where user_id in('${owner}','${staff}'));
        delete from public.shops where id='${shop ?? owner}';
        delete from public.profiles where user_id in('${owner}','${staff}');
        delete from auth.users where id in('${owner}','${staff}');
      end $$; commit;`, false, true)
  }
}
