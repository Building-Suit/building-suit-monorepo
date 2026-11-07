import copy
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('bootstrap', Path(__file__).with_name('bootstrap.py'))
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)


def receipt():
    return dict(format=1, projectRef='dpruoncalmwicrqhqelu', unit=b.UNIT,
                legacySourceReviewed=True, maintenanceApproved=True, unitInactive=True, cgroupEmpty=True,
                admissionPaused=True, pauseGeneration=1, activeJobs=0,
                preGuardRequestsSettled=True, claimOutcomeReconciled=True, allJournalDeliveriesReconciled=True,
                rosterSyncReconciled=True, lessonPublicationReconciled=True, presenceSettled=True,
                completeRuntimeBackupVerified=True, privateStateBackupVerified=True,
                credentialsAndCodexPreserved=True, schemaAppCompatibilityReviewed=True,
                legacyRollbackCompatible=False, timerEnabled=False, candidateAdmissionEnabled=False)


class Preparation(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.provisioned = self.root / 'inputs'
        self.provisioned.mkdir()
        for name in b.PROVISIONED:
            (self.provisioned / name).write_bytes(('public fixture ' + name).encode())
        files = {name: b.sha(self.provisioned / name) for name in b.PROVISIONED}
        files.update({name: b.sha(b.SOURCE / name) for name in b.CODE})
        files.update({name + '.example': b.sha(b.SOURCE / (name + '.example')) for name in b.UNITS})
        files['updater-config.example.json'] = b.sha(b.SOURCE / 'updater-config.example.json')
        self.pins = dict(format=1, independentReview=True, files=files)
        self.write_pins()
        self.destination = self.root / 'controls'
        # Fixture metadata adapter only. Production CLI has no override flag.
        self.check = lambda path, uid: Path(path).stat()

    def write_pins(self):
        (self.provisioned / 'verified-inputs.json').write_text(json.dumps(self.pins))

    def stage(self):
        return b.stage_controls(self.provisioned, self.destination, check=self.check)

    def test_complete_control_plane_stages_atomically_without_touching_runtime_or_units(self):
        runtime = self.root / 'legacy'
        runtime.mkdir()
        (runtime / 'journal').write_text('private fixture; preserve')
        self.stage()
        self.assertEqual((runtime / 'journal').read_text(), 'private fixture; preserve')
        self.assertEqual(b.sha(self.destination / 'release.py'), self.pins['files']['release.py'])
        self.assertTrue((self.destination / 'bin/node').stat().st_mode & 0o111)
        self.assertEqual((self.destination / 'staged').stat().st_mode & 0o777, 0o700)
        self.assertFalse((self.root / 'current').exists())
        with self.assertRaisesRegex(RuntimeError, 'destination-exists'):
            self.stage()

    def test_public_controls_finalize_modes_without_widening_private_inputs(self):
        self.provisioned.chmod(0o700)
        for path in self.provisioned.iterdir():
            path.chmod(0o600)
        input_modes = {path.name: path.stat().st_mode & 0o777 for path in self.provisioned.iterdir()}
        owner = (self.root.stat().st_uid, self.root.stat().st_gid)
        previous = os.umask(0o077)
        try:
            self.stage()
            self.assertEqual(os.umask(0o077), 0o077)
        finally:
            os.umask(previous)
        for directory in (self.destination, self.destination / 'bin'):
            self.assertEqual(directory.stat().st_mode & 0o777, 0o755)
            self.assertEqual((directory.stat().st_uid, directory.stat().st_gid), owner)
        for name in ('node', 'gh'):
            self.assertEqual((self.destination / 'bin' / name).stat().st_mode & 0o777, 0o755)
        self.assertEqual((self.destination / 'staged').stat().st_mode & 0o777, 0o700)
        self.assertEqual((self.destination / 'verified-inputs.json').stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.provisioned.stat().st_mode & 0o777, 0o700)
        self.assertEqual({path.name: path.stat().st_mode & 0o777 for path in self.provisioned.iterdir()}, input_modes)

    def test_disposable_service_user_can_read_public_runtime_and_execute_bins_only(self):
        # Run-owned, read-only fixture mount and no network. Never uses a host
        # service account, real binaries, credentials, state or existing login.
        image = 'postgres:17@sha256:ff87138949ad9a46f32ff23bd6852b52ce024a13dffe9b4087be98292cdd3b4f'
        docker = ['docker', '--host=unix:///var/run/docker.sock']
        environment = {k: v for k, v in os.environ.items() if k not in
                       ('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH')}
        for name in ('node', 'gh'):
            path = self.provisioned / name
            path.write_text('#!/bin/sh\nexit 0\n')
            self.pins['files'][name] = b.sha(path)
        self.write_pins()
        self.provisioned.chmod(0o700)
        for path in self.provisioned.iterdir():
            path.chmod(0o600)
        self.root.chmod(0o755)  # Public test mount traversal, not private inputs.
        runtime = self.root / 'runtime'
        runtime.mkdir(mode=0o755)
        runtime.chmod(0o755)  # One-time operator's public runtime root.
        spec = importlib.util.spec_from_file_location('permission_release', b.SOURCE / 'release.py')
        release = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(release)
        sha = 'd' * 40
        contents = {name: ('// public fixture ' + name).encode() for name in release.FILES}
        package = dict(manifest=dict(format=1, sha=sha, repositoryId=release.REPO_ID, ref='refs/heads/stg',
                       nodeMajor=22, schemaContract=2, maintenanceProtocol=1,
                       files={name: dict(sha256=release.digest(data), bytes=len(data)) for name, data in contents.items()}),
                       files={name: base64.b64encode(data).decode() for name, data in contents.items()})
        previous = os.umask(0o077)
        try:
            (runtime / 'releases').mkdir(mode=0o755)
            release.stage(runtime, package, sha)
            self.stage()
        finally:
            os.umask(previous)
        script = '\n'.join([
            'test "$(id -u)" = 65534',
            'test -r /fixture/runtime/releases/' + sha + '/worker.mjs',
            'test -r /fixture/runtime/releases/' + sha + '/manifest.json',
            'test ! -w /fixture/runtime/releases/' + sha + '/worker.mjs',
            'test ! -w /fixture/runtime/releases/' + sha,
            '/fixture/controls/bin/node', '/fixture/controls/bin/gh',
            'test ! -w /fixture/controls/bin',
            'test ! -r /fixture/controls/verified-inputs.json',
            'test ! -x /fixture/controls/staged',
            'test ! -x /fixture/inputs',
        ])
        subprocess.run(docker + ['run', '--rm', '--network', 'none', '--user', '65534:65534',
                       '--mount', 'type=bind,src=' + str(self.root) + ',dst=/fixture,readonly',
                       '--entrypoint', '/bin/sh', image, '-ceu', script],
                       env=environment, check=True, capture_output=True, timeout=30)

    def test_tampered_binary_or_missing_provenance_review_never_installs(self):
        (self.provisioned / 'gh').write_text('tampered')
        with self.assertRaisesRegex(RuntimeError, 'input-digest:gh'):
            self.stage()
        self.assertFalse(self.destination.exists())
        self.pins['independentReview'] = False
        self.write_pins()
        with self.assertRaisesRegex(RuntimeError, 'independent-provenance-review-required'):
            self.stage()

    def test_symlink_input_rejected_even_with_matching_digest(self):
        binary = self.provisioned / 'node'
        binary.rename(self.provisioned / 'other')
        binary.symlink_to(self.provisioned / 'other')
        with self.assertRaisesRegex(RuntimeError, 'input-digest:node'):
            self.stage()
        self.assertFalse(self.destination.exists())

    def test_interruption_keeps_destination_absent_and_removes_partial_stage(self):
        with patch.object(b.shutil, 'copyfileobj', side_effect=OSError('interrupted')):
            with self.assertRaises(OSError):
                self.stage()
        self.assertFalse(self.destination.exists())
        self.assertEqual(list(self.root.glob('.hq-controls-*')), [])

    def test_root_audit_rejects_user_node_paths_and_writable_parent(self):
        config = self.root / 'config.json'
        data = json.loads((b.SOURCE / 'updater-config.example.json').read_text())
        config.write_text(json.dumps(data))
        visited = []
        b.audit_config(config, check=lambda path, uid: visited.append(str(path)))
        self.assertIn('/opt/building-suit-hq-agent-control/bin/node', visited)
        data['node'] = '/home/ubuntu/.local/bin/node'
        config.write_text(json.dumps(data))
        with self.assertRaisesRegex(RuntimeError, 'unexpected-updater-config'):
            b.audit_config(config, check=self.check)
        with self.assertRaisesRegex(RuntimeError, 'untrusted-owner|writable-trust-path'):
            b.trusted(self.provisioned / 'node', uid=os.getuid())

    def test_cutover_refuses_zero_jobs_as_a_drain_proof_and_rejects_unknown_legacy_rollback(self):
        complete = receipt()
        self.assertIn('live observations', b.check_cutover(complete))
        for key in ('legacySourceReviewed', 'preGuardRequestsSettled', 'claimOutcomeReconciled', 'allJournalDeliveriesReconciled',
                    'rosterSyncReconciled', 'lessonPublicationReconciled', 'presenceSettled',
                    'privateStateBackupVerified', 'schemaAppCompatibilityReviewed', 'maintenanceApproved'):
            incomplete = copy.deepcopy(complete)
            incomplete[key] = False
            with self.assertRaises(RuntimeError, msg=key):
                b.check_cutover(incomplete)
        for key, value in [('activeJobs', 1), ('activeJobs', False), ('pauseGeneration', False),
                           ('timerEnabled', True), ('candidateAdmissionEnabled', True),
                           ('legacyRollbackCompatible', True), ('projectRef', 'production')]:
            incomplete = dict(complete, **{key: value})
            with self.assertRaises(RuntimeError, msg=key):
                b.check_cutover(incomplete)

    def observations(self):
        return dict(sourceIdentityVerified=True, preGuardRequestsSettled=True, executionCompletionProven=True,
                    rosterSettled=True, presenceSettled=True, unitInactive=True, cgroupEmpty=True,
                    claims=[], deliveries=[], publications=[])

    def test_delayed_claim_response_after_client_cancellation_stays_uncertain(self):
        observed = self.observations()
        observed['claims'] = [dict(outcomeKnown=False, journalAccounted=False)]
        result = b.summarize_records(observed)
        self.assertFalse(result['allRecordedOutcomesSettled'])
        self.assertFalse(result['mayActivate'])
        self.assertEqual(result['counts']['claims']['unsettled'], 1)

    def test_finish_commit_before_journal_ack_never_becomes_delivered_automatically(self):
        observed = self.observations()
        observed['deliveries'] = [dict(dbCommitVerified=True, journalAcknowledged=False, digestMatched=True)]
        result = b.summarize_records(observed)
        self.assertFalse(result['allRecordedOutcomesSettled'])
        self.assertEqual(result['counts']['deliveries']['unsettled'], 1)

    def test_drive_put_before_receipt_ack_requires_both_readback_and_db_receipt(self):
        observed = self.observations()
        observed['publications'] = [dict(driveReadbackMatched=True, dbReceiptVerified=False, requestSettled=True)]
        self.assertFalse(b.summarize_records(observed)['allRecordedOutcomesSettled'])
        observed['publications'][0]['dbReceiptVerified'] = True
        observed['preGuardRequestsSettled'] = False
        self.assertFalse(b.summarize_records(observed)['allRecordedOutcomesSettled'])
        observed['preGuardRequestsSettled'] = True
        result = b.summarize_records(observed)
        self.assertTrue(result['allRecordedOutcomesSettled'])
        self.assertFalse(result['mayActivate'])

    def test_redacted_summary_rejects_private_data_fields_without_echoing_them(self):
        observed = self.observations()
        observed['claims'] = [dict(outcomeKnown=True, journalAccounted=True, jobId='private-fixture-id')]
        with self.assertRaisesRegex(RuntimeError, '^invalid-redacted-outcome$'):
            b.summarize_records(observed)


if __name__ == '__main__':
    unittest.main(verbosity=2)
