"""Disposable files and fake service only; no host, DB, job or model access."""
import base64
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('release', Path(__file__).with_name('release.py'))
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
A, B = 'a' * 40, 'b' * 40


def package(sha):
    files = {name: ('// fixture ' + sha + name).encode() for name in r.FILES}
    return {'manifest': {'format': 1, 'sha': sha, 'repositoryId': r.REPO_ID, 'ref': 'refs/heads/stg',
                         'nodeMajor': 22, 'schemaContract': 1, 'maintenanceProtocol': 1,
                         'files': {name: {'sha256': r.digest(data), 'bytes': len(data)} for name, data in files.items()}},
            'files': {name: base64.b64encode(data).decode() for name, data in files.items()}}


class Crash(BaseException):
    pass


class FakeHost:
    def __init__(self, root):
        self.root = root
        self.config = {'schemaContract': 1}
        self.running = A
        self.paused = False
        self.busy = 0
        self.fail_health = None
        self.fail_preflight = False
        self.fail_drain = False
        self.crash = None
        self.calls = []

    def control(self, action):
        self.calls.append(action)
        if action == 'drain':
            self.paused = True
        if action == 'resume':
            self.paused = False
            # Model work immediately upon admission. Recovery must not stop it.
            self.busy = 1
        return {'protocol': 1, 'release': self.running, 'ready': True, 'contract': 1, 'paused': self.paused, 'busy': self.busy, 'activeJobs': self.busy, 'uncertain': False}

    def preflight(self, sha):
        self.calls.append('preflight')
        if self.fail_preflight:
            raise RuntimeError('schema-incompatible')

    def drain(self, sha):
        if self.running is None:
            raise ConnectionRefusedError()
        self.calls.append('drain')
        self.paused = True
        if self.fail_drain:
            raise RuntimeError('drain-deferred')
        self.busy = 0

    def service(self, action):
        self.calls.append(action)
        if action == 'stop':
            if self.busy or not self.paused:
                raise AssertionError('killed-active-work')
            self.running = None
        else:
            self.running = r.current_sha(self.root)
            self.paused = True
            self.busy = 0
        if self.crash == action:
            raise Crash()

    def health(self, sha):
        self.calls.append('health:' + sha)
        if self.fail_health == sha:
            raise RuntimeError('startup-health-failed')
        if self.crash == 'health':
            raise Crash()
        assert self.paused and self.busy == 0 and self.running == sha


class Releases(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / 'releases').mkdir()
        r.stage(self.root, package(A), A)
        r.activate(self.root, A)
        self.host = FakeHost(self.root)

    def test_download_redirect_policy_rejects_other_hosts_and_non_https(self):
        for url in ['http://github.com/file', 'https://127.0.0.1/file', 'https://example.invalid/file',
                    'https://github.com:8443/file', 'https://user:password@github.com/file']:
            with self.assertRaises(RuntimeError):
                r.allowed_url(url)
        for host in ['github.com', 'api.github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']:
            r.allowed_url('https://' + host + '/public-file')

    def test_integrity_paths_tamper_and_unknown_manifest(self):
        for mutate in [lambda p: p['files'].__setitem__('../worker.env', ''),
                       lambda p: p['files'].__setitem__('/worker.mjs', ''),
                       lambda p: p['files'].__setitem__('worker.mjs', base64.b64encode(b'tampered').decode()),
                       lambda p: p['manifest'].__setitem__('command', 'arbitrary-shell'),
                       lambda p: p['manifest'].__setitem__('sha', A),
                       lambda p: p['manifest'].__setitem__('ref', 'refs/heads/main'),
                       lambda p: p['manifest'].__setitem__('schemaContract', 2)]:
            value = package(B)
            mutate(value)
            with self.assertRaises((RuntimeError, ValueError)):
                r.validate(value, B)
        with self.assertRaises(RuntimeError):
            r.decode(b'{"files":{},"files":{}}')

    def test_stage_no_symlinks_and_immutable_baseline(self):
        path = self.root / 'releases' / A / 'worker.mjs'
        path.unlink()
        path.symlink_to('/etc/passwd')
        with self.assertRaisesRegex(RuntimeError, 'unsafe-baseline'):
            r.current_sha(self.root)

    def test_missing_baseline_never_stops_worker(self):
        (self.root / 'current').unlink()
        with self.assertRaises(OSError):
            r.install(self.host, package(B), B)
        self.assertEqual(self.host.calls, [])

    def test_success_and_no_op(self):
        self.assertEqual(r.install(self.host, package(B), B), 'installed')
        self.assertEqual(r.current_sha(self.root), B)
        self.assertEqual(self.host.calls, ['preflight', 'drain', 'stop', 'start', 'health:' + B, 'resume'])
        self.host.calls.clear()
        self.assertEqual(r.install(self.host, package(B), B), 'no-op')
        self.assertEqual(self.host.calls, ['status'])
        self.assertFalse((self.root / 'transaction.json').exists())

    def test_schema_failure_precedes_drain_and_stop(self):
        self.host.fail_preflight = True
        with self.assertRaisesRegex(RuntimeError, 'schema-incompatible'):
            r.install(self.host, package(B), B)
        self.assertEqual(self.host.calls, ['preflight'])
        self.assertEqual(r.current_sha(self.root), A)
        self.host.config['schemaContract'] = 2
        with self.assertRaisesRegex(RuntimeError, 'schema-incompatible'):
            r.install(self.host, package(B), B)

    def test_drain_timeout_defers_without_stop_and_recovers(self):
        self.host.fail_drain = True
        self.host.busy = 1
        with self.assertRaisesRegex(RuntimeError, 'drain-deferred'):
            r.install(self.host, package(B), B)
        self.assertNotIn('stop', self.host.calls)
        self.assertEqual(self.host.busy, 1)
        self.assertTrue((self.root / 'transaction.json').exists())
        self.host.fail_drain = False
        self.assertEqual(r.install(self.host, package(B), B), 'recovered')
        self.assertEqual(r.current_sha(self.root), A)
        self.assertNotIn('stop', self.host.calls)

    def test_health_failure_restores_exact_old_and_never_admits_candidate(self):
        self.host.fail_health = B
        with self.assertRaisesRegex(RuntimeError, 'startup-health-failed'):
            r.install(self.host, package(B), B)
        self.assertEqual(r.current_sha(self.root), A)
        self.assertEqual(self.host.running, A)
        self.assertEqual(self.host.calls.count('resume'), 1)
        self.assertLess(self.host.calls.index('health:' + A), self.host.calls.index('resume'))

    def test_interrupted_stop_and_candidate_start_recover(self):
        for point in ['stop', 'start', 'health']:
            with self.subTest(point=point):
                self.host = FakeHost(self.root)
                r.activate(self.root, A)
                self.host.crash = point
                with self.assertRaises(Crash):
                    r.install(self.host, package(B), B)
                self.host.crash = None
                self.assertEqual(r.install(self.host, package(B), B), 'recovered')
                self.assertEqual(r.current_sha(self.root), A)
                self.assertEqual(self.host.running, A)

    def test_accepted_crash_never_rolls_back_work_already_admitted(self):
        r.stage(self.root, package(B), B)
        r.activate(self.root, B)
        r.atomic_json(self.root / 'transaction.json', {'old': A, 'new': B, 'phase': 'accepted'})
        self.host.running = B
        self.host.busy = 1
        self.assertTrue(r.recover(self.host))
        self.assertEqual(self.host.calls, ['status'])
        self.assertEqual(r.current_sha(self.root), B)

    def test_lock_exclusive_and_released_after_context(self):
        with r.exclusive(self.root):
            with self.assertRaises(BlockingIOError):
                r.install(self.host, package(B), B)
        self.assertEqual(r.install(self.host, package(B), B), 'installed')

    def test_host_drain_busy_timeout_does_not_stop_or_resume(self):
        config = {'root': str(self.root), 'node': '/fixed/node', 'gh': '/fixed/gh', 'systemctl': '/usr/bin/systemctl',
                  'trustedRoot': '/operator/trusted-root.json', 'socket': '/private/maintenance.sock',
                  'unit': 'company-hq-worker.service', 'schemaContract': 1, 'drainSeconds': 1}
        host = r.Host(config)
        calls = []
        host.control = lambda action: calls.append(action) or {'release': A, 'paused': True, 'busy': 1, 'activeJobs': 1, 'ready': True}
        with patch.object(r.time, 'monotonic', side_effect=[0, 0, 2]), patch.object(r.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, 'drain-deferred'):
                host.drain(A)
        self.assertEqual(calls, ['drain', 'status'])

    def test_host_health_requires_matching_release_paused_idle_and_observed_readiness(self):
        config = {'root': str(self.root), 'node': '/fixed/node', 'gh': '/fixed/gh', 'systemctl': '/usr/bin/systemctl',
                  'trustedRoot': '/operator/trusted-root.json', 'socket': '/private/maintenance.sock',
                  'unit': 'company-hq-worker.service', 'schemaContract': 1, 'healthSeconds': 1}
        host = r.Host(config)
        good = {'release': B, 'ready': True, 'contract': 1, 'paused': True, 'busy': 0, 'activeJobs': 0}
        for field, value in [('release', A), ('ready', False), ('contract', None), ('paused', False), ('busy', 1), ('activeJobs', 1)]:
            host.control = lambda action, field=field, value=value: {**good, field: value}
            with patch.object(r.time, 'monotonic', side_effect=[0, 0, 2]), patch.object(r.time, 'sleep'):
                with self.assertRaisesRegex(RuntimeError, 'startup-health-failed'):
                    host.health(B)
        host.control = lambda action: good
        host.health(B)

    def test_rollback_accepted_crash_does_not_stop_old_work(self):
        r.stage(self.root, package(B), B)
        r.atomic_json(self.root / 'transaction.json', {'old': A, 'new': B, 'phase': 'rollback-accepted'})
        self.host.busy = 1
        self.assertTrue(r.recover(self.host))
        self.assertEqual(self.host.calls, ['status'])

    def test_resume_response_loss_after_admission_cannot_trigger_rollback(self):
        original = self.host.control
        def control(action):
            result = original(action)
            if action == 'resume':
                raise RuntimeError('response-lost')
            return result
        self.host.control = control
        with self.assertRaisesRegex(RuntimeError, 'response-lost'):
            r.install(self.host, package(B), B)
        self.assertEqual(r.current_sha(self.root), B)
        self.assertEqual(self.host.busy, 1)
        self.assertEqual(r.decode((self.root / 'transaction.json').read_bytes())['phase'], 'accepted')
        self.host.control = original
        self.assertTrue(r.recover(self.host))
        self.assertEqual(self.host.calls.count('stop'), 1)

    def test_process_crash_releases_kernel_lock(self):
        child = subprocess.Popen(['python3', '-c',
            'import fcntl,sys; f=open(sys.argv[1], "a"); fcntl.flock(f,fcntl.LOCK_EX); print("ready",flush=True); sys.stdin.read()',
            str(self.root / 'updater.lock')], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
        try:
            self.assertEqual(child.stdout.readline().strip(), 'ready')
            with self.assertRaises(BlockingIOError):
                with r.exclusive(self.root):
                    pass
            child.kill()
            child.wait(timeout=5)
            with r.exclusive(self.root):
                pass
        finally:
            if child.poll() is None:
                child.kill()
            child.wait(timeout=5)
            child.stdin.close()
            child.stdout.close()

    def test_provenance_flags_no_credential_and_repository_identity(self):
        config = {'root': str(self.root), 'node': '/fixed/node', 'gh': '/fixed/gh', 'systemctl': '/usr/bin/systemctl',
                  'trustedRoot': '/operator/trusted-root.json', 'socket': '/private/maintenance.sock',
                  'unit': 'company-hq-worker.service', 'schemaContract': 1}
        host = r.Host(config)
        for identity, succeeds in [('1376504404', True), ('other', False)]:
            calls = []
            def command(argv, **kwargs):
                calls.append((argv, kwargs['env']))
                return json.dumps([{'verificationResult': {'signature': {'certificate': {'sourceRepositoryIdentifier': identity}}}}])
            host.command = command
            if succeeds:
                host.verify(Path('/package'), Path('/bundle'), B)
            else:
                with self.assertRaisesRegex(RuntimeError, 'repository-identity-mismatch'):
                    host.verify(Path('/package'), Path('/bundle'), B)
            argv, env = calls[0]
            self.assertEqual(env['GH_TOKEN'], '')
            self.assertEqual(env['GITHUB_TOKEN'], '')
            for flag, value in [('--source-digest', B), ('--source-ref', 'refs/heads/stg'),
                                ('--custom-trusted-root', '/operator/trusted-root.json'),
                                ('--cert-identity', 'https://github.com/' + r.WORKFLOW + '@refs/heads/stg')]:
                self.assertEqual(argv[argv.index(flag) + 1], value)
            self.assertIn('--deny-self-hosted-runners', argv)

    def test_provenance_verification_failure_stops_before_parse_install(self):
        self.host.verify = lambda *_: (_ for _ in ()).throw(RuntimeError('bad-signature'))
        with patch.object(r, 'fetch', side_effect=[json.dumps({'object': {'sha': B}}).encode(), b'not-json', b'untrusted-bundle']):
            with self.assertRaisesRegex(RuntimeError, 'bad-signature'):
                r.update(self.host)
        self.assertEqual(self.host.calls, [])

    def test_builder_exact_git_source_no_untracked_environment_or_auth(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path = root / 'tooling/hq-agent-host'
            path.mkdir(parents=True)
            for name in r.FILES:
                (path / name).write_text('// reviewed code\n')
            subprocess.run(['git', 'init', '-q', root], check=True)
            subprocess.run(['git', '-C', root, 'add', '.'], check=True)
            subprocess.run(['git', '-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture'], check=True)
            sha = subprocess.check_output(['git', '-C', root, 'rev-parse', 'HEAD'], text=True).strip()
            (path / 'worker.mjs').write_text('uncommitted edit must not ship')
            (path / '.env').write_text('fixture-only-secret')
            output = root / 'worker.json'
            r.build(root, sha, output)
            first = output.read_bytes()
            manifest, contents = r.validate(r.decode(first), sha)
            self.assertEqual(contents['worker.mjs'], b'// reviewed code\n')
            self.assertNotIn(b'fixture-only-secret', first)
            r.build(root, sha, output)
            self.assertEqual(first, output.read_bytes())
            with self.assertRaisesRegex(RuntimeError, 'exact-head-required'):
                r.build(root, B, output)


if __name__ == '__main__':
    unittest.main()
