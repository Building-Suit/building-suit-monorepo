// Disposable synthetic rows only. This runner has no hosted connection/ref input.
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
const container = `bs-access-view-${randomUUID()}`
function command(program, args, input) {
  const result = spawnSync(program, args, { input, encoding: 'utf8', timeout: 60000 })
  if (result.status !== 0) throw new Error(`${program} failed: ${(result.stderr || '').slice(-1600)}`)
  return result.stdout.trim()
}
const sql = statement => command('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], statement)
try {
  command('docker', ['run', '-d', '--name', container, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17'])
  let ready = false
  for (let attempt = 0; attempt < 50; attempt++) {
    if (spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres'], { stdio: 'ignore' }).status === 0) { ready = true; break }
    await delay(200)
  }
  if (!ready) throw new Error('Disposable PostgreSQL did not become ready')
  sql(`CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE SCHEMA app_finance;
CREATE TYPE app_finance.network_transfer_status AS ENUM ('pending','complete');
CREATE TYPE app_finance.held_amount_direction AS ENUM ('i_owe','owed_to_me');
CREATE TABLE app_finance.accounts(id uuid PRIMARY KEY,user_id uuid);
CREATE TABLE app_finance.network_transfers(sender_source_account_id uuid,sender_user_id uuid,status app_finance.network_transfer_status,amount_minor bigint);
CREATE TABLE app_finance.held_amounts(account_id uuid,user_id uuid,settled_on date,direction app_finance.held_amount_direction,amount_minor bigint);
INSERT INTO app_finance.accounts VALUES ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000002');
INSERT INTO app_finance.network_transfers VALUES ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','pending',125),('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000002','pending',999);
INSERT INTO app_finance.held_amounts VALUES ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001',NULL,'i_owe',50);
ALTER TABLE app_finance.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_finance.network_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_finance.held_amounts ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA auth,app_finance TO authenticated,service_role;`)
  sql(await readFile(new URL('../../supabase/operations/2026-10-30/finance_view_scope.sql', import.meta.url), 'utf8'))
  sql(`GRANT SELECT ON app_finance.account_hold_totals TO authenticated,service_role;
SET ROLE authenticated;
DO $$BEGIN
 IF EXISTS(SELECT FROM app_finance.account_hold_totals) THEN RAISE EXCEPTION 'Missing identity must see no accounts'; END IF;
END$$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
DO $$BEGIN
 IF (SELECT count(*) FROM app_finance.account_hold_totals)<>1 THEN RAISE EXCEPTION 'Owner must see exactly one account'; END IF;
 IF NOT EXISTS(SELECT FROM app_finance.account_hold_totals WHERE pending_transfer_hold_minor=125 AND held_outgoing_minor=50) THEN RAISE EXCEPTION 'Own summary changed'; END IF;
 IF EXISTS(SELECT FROM app_finance.account_hold_totals WHERE user_id<>'00000000-0000-0000-0000-000000000001'::uuid) THEN RAISE EXCEPTION 'Foreign account visible'; END IF;
 BEGIN
  PERFORM * FROM app_finance.network_transfers;
  RAISE EXCEPTION 'Underlying private transfers became accessible';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
SET ROLE service_role;
DO $$BEGIN
 IF (SELECT count(*) FROM app_finance.account_hold_totals)<>2 THEN RAISE EXCEPTION 'Trusted server summary changed'; END IF;
END$$;`)
  console.log('Finance view: own totals, foreign denial, missing identity denial, private base tables and server access passed')
} finally {
  spawnSync('docker', ['rm', '-fv', container], { stdio: 'ignore' })
}
