"""Genuine concurrent PostgreSQL 17 sessions, disposable Docker only.
No hosted URL, credentials, published port, volume or live job is accepted.
The claim uses the exact applied function + proposal guard. Non-paused job
selection is covered by the full PGlite integration suite; a transaction holding
the real queue lock models an already-admitted claim in the first race.
"""
import concurrent.futures
import json
import os
from pathlib import Path
import re
import subprocess
import time
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[2]
WORKER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
REQUEST = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
IMAGE = 'postgres:17@sha256:ff87138949ad9a46f32ff23bd6852b52ce024a13dffe9b4087be98292cdd3b4f'
ENV = {k: v for k, v in os.environ.items() if k not in ('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH')}
DOCKER = ['docker', '--host=unix:///var/run/docker.sock']
LOCK = "pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0))"


class Races(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.container = 'hq-bootstrap-race-' + uuid.uuid4().hex[:12]
        subprocess.run(DOCKER + ['info', '--format', '{{.ServerVersion}}'], env=ENV, check=True, capture_output=True)
        subprocess.run(DOCKER + ['run', '-d', '--rm', '--name', cls.container, '--network', 'none',
                       '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE],
                       env=ENV, check=True, capture_output=True)
        cls.addClassCleanup(lambda: subprocess.run(DOCKER + ['rm', '-f', cls.container], env=ENV, capture_output=True))
        for _ in range(100):
            pid1 = subprocess.run(DOCKER + ['exec', cls.container, 'cat', '/proc/1/comm'], env=ENV, capture_output=True, text=True)
            ready = subprocess.run(DOCKER + ['exec', cls.container, 'pg_isready', '-U', 'postgres'], env=ENV, capture_output=True)
            if pid1.stdout.strip() == 'postgres' and ready.returncode == 0:
                break
            time.sleep(0.1)
        else:
            raise RuntimeError('disposable-postgres-not-ready')
        original = (ROOT / 'apps/company-hq/supabase/migrations/20261105235516_hq_voice_meetings.sql').read_text()
        claim = re.search(r'create function hq_private.worker_claim\(p_worker_id uuid,p_lease_seconds integer,p_meeting_protocol integer\).*?end \$\$;', original, re.S).group()
        cls.sql(f"""create role anon; create role authenticated; create role service_role;
          create schema hq_private;
          grant usage on schema hq_private to authenticated;
          create table hq_private.agent_workers(worker_id uuid primary key,enabled boolean);
          insert into hq_private.agent_workers values('{WORKER}',true);
          create table public.hq_agent_jobs(worker_id uuid,status text,lease_token uuid);
          create table public.hq_meeting_contributions(id uuid);
          create function hq_private.agent_worker_uid(uuid) returns uuid language sql as
            $$select worker_id from hq_private.agent_workers where worker_id=$1 and enabled
              and $1::text=current_setting('fixture.worker',true)$$;
          {claim}
          create function public.hq_worker_claim(uuid,integer) returns jsonb language sql as
            $$select hq_private.worker_claim($1,$2,0)$$;
          create function public.hq_worker_claim(uuid,integer,integer) returns jsonb language sql as
            $$select hq_private.worker_claim($1,$2,$3)$$;
        """)
        cls.sql((ROOT / 'tooling/hq-agent-host/bootstrap/admission-pause.sql').read_text())

    @classmethod
    def argv(cls, app='fixture'):
        return DOCKER + ['exec', '-i', '-e', 'PGAPPNAME=' + app, cls.container,
                         'psql', '-U', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1']

    @classmethod
    def sql(cls, text, app='fixture', ok=True):
        r = subprocess.run(cls.argv(app), input=text, text=True, capture_output=True, env=ENV, timeout=10)
        if ok and r.returncode:
            raise AssertionError(r.stderr)
        return r.stdout.strip() if ok else r

    def setUp(self):
        self.sql('truncate hq_private.worker_admission_pauses,public.hq_agent_jobs;')

    def pause(self, paused=True, generation=0, request=REQUEST):
        return f"select hq_private.set_worker_admission_pause('{WORKER}',{str(paused).lower()},{generation},'{request}','fixture');"

    def status(self):
        return json.loads(self.sql(f"set fixture.worker='{WORKER}'; select public.hq_worker_admission_status('{WORKER}');"))

    def holder(self, statements):
        p = subprocess.Popen(self.argv('holder'), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, text=True, env=ENV)
        self.addCleanup(lambda: p.kill() if p.poll() is None else None)
        p.stdin.write("begin;\n" + statements + "\nselect 'held';\n")
        p.stdin.flush()
        for _ in range(3):
            if p.stdout.readline().strip() == 'held':
                return p
        raise AssertionError('holder failed')

    def wait_blocked(self, app):
        for _ in range(80):
            if self.sql(f"select count(*) from pg_stat_activity where application_name='{app}' and wait_event='advisory';") == '1':
                return
            time.sleep(0.05)
        self.fail('session did not wait on actual PostgreSQL advisory lock')

    def release(self, process):
        process.stdin.write('commit;\n\\q\n')
        process.stdin.flush()
        _, err = process.communicate(timeout=5)
        self.assertEqual(process.returncode, 0, err)

    def test_claim_wins_then_pause_accounts_for_committed_work(self):
        p = self.holder(f"select {LOCK}; insert into public.hq_agent_jobs(worker_id,status) values('{WORKER}','working');")
        with concurrent.futures.ThreadPoolExecutor() as pool:
            result = pool.submit(self.sql, self.pause(), 'pause-waiter')
            self.wait_blocked('pause-waiter')
            self.release(p)
            self.assertEqual(json.loads(result.result(timeout=5)), {'paused': True, 'generation': 1})
        self.assertEqual(self.status(), {'paused': True, 'generation': 1, 'activeJobs': 1})

    def test_pause_wins_waiting_real_claim_sees_commit_before_any_cleanup(self):
        p = self.holder(self.pause())
        claim = f"set fixture.worker='{WORKER}'; select public.hq_worker_claim('{WORKER}',300,1);"
        with concurrent.futures.ThreadPoolExecutor() as pool:
            result = pool.submit(self.sql, claim, 'claim-waiter')
            self.wait_blocked('claim-waiter')
            self.release(p)
            self.assertEqual(json.loads(result.result(timeout=5)), {'job': None, 'admissionPaused': True})
        self.assertEqual(self.sql('select count(*) from public.hq_agent_jobs;'), '0')
        self.assertEqual(json.loads(self.sql(f"set fixture.worker='{WORKER}'; select public.hq_worker_claim('{WORKER}',300);"))['job'], None)

    def test_pre_install_function_body_waiting_outside_queue_cannot_bypass_new_hold(self):
        # Model a pre-install RPC paused before reaching its queue lock. The old
        # body is genuinely running in PostgreSQL while CREATE OR REPLACE changes
        # future calls. Re-enable the actual proposal trigger as installation.
        self.sql("""alter table public.hq_agent_jobs disable trigger hq_worker_admission_backstop;
          create function public.fixture_old_claim() returns jsonb language plpgsql as $$begin
            perform pg_advisory_xact_lock(73641982);
            perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
            insert into public.hq_agent_jobs(worker_id,status,lease_token)
              values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','working',gen_random_uuid());
            return '{"oldBodyAdmitted":true}'::jsonb;
          end $$;""")
        p = self.holder('select pg_advisory_xact_lock(73641982);')
        with concurrent.futures.ThreadPoolExecutor() as pool:
            result = pool.submit(self.sql, 'select public.fixture_old_claim();', 'old-body-waiter', False)
            self.wait_blocked('old-body-waiter')
            self.sql("""create or replace function public.fixture_old_claim() returns jsonb language sql as
              $$select '{"newBody":true}'::jsonb$$;
              alter table public.hq_agent_jobs enable trigger hq_worker_admission_backstop;""")
            self.sql(self.pause())
            self.assertEqual(self.status()['activeJobs'], 0)
            self.release(p)
            old = result.result(timeout=5)
            self.assertIn('HQ_ADMISSION_PAUSED', old.stderr)
            self.assertNotEqual(old.returncode, 0)
        self.assertEqual(self.sql('select count(*) from public.hq_agent_jobs;'), '0')
        self.assertEqual(json.loads(self.sql('select public.fixture_old_claim();')), {'newBody': True})

    def test_retries_are_idempotent_stale_unpause_cannot_remove_new_hold(self):
        first = self.sql(self.pause())
        self.assertEqual(self.sql(self.pause()), first)
        self.sql(self.pause(False, 1, str(uuid.uuid4())))
        self.sql(self.pause(True, 2, str(uuid.uuid4())))
        r = self.sql(self.pause(False, 1, str(uuid.uuid4())), ok=False)
        self.assertIn('HQ_ADMISSION_GENERATION', r.stderr)
        self.assertEqual(self.status()['generation'], 3)
        self.assertTrue(self.status()['paused'])

    def test_stale_snapshot_modes_and_unauthorized_mutation_fail_closed(self):
        self.sql(self.pause())
        for isolation in ('repeatable read', 'serializable'):
            for call in (self.pause(), f"set fixture.worker='{WORKER}'; select public.hq_worker_claim('{WORKER}',300,1);"):
                r = self.sql('begin isolation level ' + isolation + '; ' + call, ok=False)
                self.assertIn('HQ_ADMISSION_ISOLATION', r.stderr)
        for role in ('anon', 'authenticated', 'service_role'):
            r = self.sql('set role ' + role + '; ' + self.pause(), ok=False)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('permission denied', r.stderr)


if __name__ == '__main__':
    unittest.main(verbosity=2)
