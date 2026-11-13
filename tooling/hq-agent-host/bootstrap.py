#!/usr/bin/python3
"""Operator preparation only. Never stops/starts a service, changes admission,
activates a release, installs systemd units, or enables a timer.

stage-controls consumes operator-provisioned binaries/roots and a reviewed digest
receipt. Their independent upstream provenance verification is a prerequisite,
not something a local hash or this receipt can establish.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import tempfile

CONTROL = Path('/opt/building-suit-hq-agent-control')
RUNTIME = Path('/opt/building-suit-hq-agent-host')
CONFIG = Path('/etc/building-suit-hq/updater.json')
UNIT = 'company-hq-worker.service'
SOURCE = Path(__file__).resolve().parent
PROVISIONED = ('node', 'gh', 'sigstore-trusted-root.json')
CODE = ('release.py', 'bootstrap.py')
UNITS = ('company-hq-worker.service', 'company-hq-worker-preflight.service',
         'company-hq-worker-update.service', 'company-hq-worker-update.timer')


def require(ok, code):
    if not ok:
        raise RuntimeError(code)


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def trusted(path, uid=0):
    """Check both symlink spelling and resolved target; worker-writable parents
    are unsafe even if the final file is root-owned. uid is injectable in tests.
    """
    path = Path(path)
    require(path.is_absolute(), 'absolute-path-required')
    for candidate in (path, path.resolve(strict=True)):
        for part in (candidate, *candidate.parents):
            info = part.lstat()
            require(info.st_uid == uid, 'untrusted-owner:' + str(part))
            if not stat.S_ISLNK(info.st_mode):
                require(not info.st_mode & 0o022, 'writable-trust-path:' + str(part))
    return path


def audit_config(config, uid=0, check=trusted):
    """Read-only fail-closed root trust audit; socket/state intentionally belong
    to the service identity and are not treated as privileged executable input.
    """
    check(config, uid)
    data = json.loads(Path(config).read_text())
    expected = {'root': str(RUNTIME), 'node': str(CONTROL / 'bin/node'),
                'gh': str(CONTROL / 'bin/gh'), 'systemctl': '/usr/bin/systemctl',
                'trustedRoot': '/etc/building-suit-hq/sigstore-trusted-root.json',
                'unit': UNIT, 'socket': '/home/ubuntu/.local/state/building-suit-hq-worker/maintenance.sock',
                'schemaContract': 2}
    require(all(data.get(k) == v for k, v in expected.items()), 'unexpected-updater-config')
    require(type(data.get('drainSeconds')) is int and 1 <= data['drainSeconds'] <= 900, 'drain-bound')
    require(type(data.get('healthSeconds')) is int and 1 <= data['healthSeconds'] <= 90, 'health-bound')
    for path in (RUNTIME, CONTROL, CONTROL / 'release.py', CONTROL / 'bootstrap.py',
                 Path('/usr/bin/python3'), Path(data['node']), Path(data['gh']),
                 Path(data['systemctl']), Path(data['trustedRoot'])):
        check(path, uid)
    return data


def stage_controls(provisioned, destination=CONTROL, source=SOURCE, uid=0, check=trusted):
    """Atomically prepare a NEW root-owned directory. Never overwrites old
    control code or the unknown runtime. Copies units/config only into staging.
    The receipt must be independently reviewed and root-owned, not supplied by
    the worker package or downloaded with the public package as a trust root.
    """
    provisioned, destination, source = map(Path, (provisioned, destination, source))
    check(destination.parent, uid)
    require(not destination.exists() and not destination.is_symlink(), 'control-destination-exists')
    receipt_path = provisioned / 'verified-inputs.json'
    check(receipt_path, uid)
    receipt = json.loads(receipt_path.read_text())
    require(set(receipt) == {'format', 'independentReview', 'files'} and type(receipt['format']) is int and receipt['format'] == 1
            and receipt['independentReview'] is True, 'independent-provenance-review-required')
    inputs = {name: provisioned / name for name in PROVISIONED}
    inputs.update({name: source / name for name in CODE})
    inputs.update({name + '.example': source / (name + '.example') for name in UNITS})
    inputs['updater-config.example.json'] = source / 'updater-config.example.json'
    require(set(receipt['files']) == set(inputs), 'input-inventory-mismatch')
    for name, path in inputs.items():
        check(path, uid)
        require(path.is_file() and not path.is_symlink() and sha(path) == receipt['files'][name], 'input-digest:' + name)
    temporary = Path(tempfile.mkdtemp(prefix='.hq-controls-', dir=destination.parent))
    try:
        (temporary / 'bin').mkdir(mode=0o755)
        (temporary / 'staged').mkdir(mode=0o700)
        for name, path in inputs.items():
            target = temporary / ('bin/' + name if name in ('node', 'gh') else 'staged/' + name if name.endswith('.example') or name.endswith('.json') else name)
            with path.open('rb') as incoming, target.open('xb') as outgoing:
                shutil.copyfileobj(incoming, outgoing)
                outgoing.flush()
                os.fsync(outgoing.fileno())
            target.chmod(0o755 if name in ('node', 'gh') else 0o644)
        with (temporary / 'verified-inputs.json').open('x') as stream:
            stream.write(json.dumps(receipt, sort_keys=True) + '\n')
            stream.flush()
            os.fsync(stream.fileno())
        (temporary / 'verified-inputs.json').chmod(0o600)
        # mkdir(0755) becomes 0700 under the required private umask. Only
        # public executable/traversal directories are widened at publication.
        (temporary / 'bin').chmod(0o755)
        temporary.chmod(0o755)
        for directory in (temporary / 'bin', temporary / 'staged', temporary):
            fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(fd)
            finally:
                os.close(fd)
        os.rename(temporary, destination)
        fd = os.open(destination.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)
    return destination


def check_cutover(evidence):
    """Validate the operator's reconciliation record, NOT a fresh host/DB proof.
    CLI deliberately offers no activation. A human must independently collect
    and review each observation at action time under the maintenance approval.
    """
    require(evidence.get('format') == 1 and evidence.get('projectRef') == 'dpruoncalmwicrqhqelu', 'staging-target-required')
    require(evidence.get('unit') == UNIT, 'wrong-unit')
    require(evidence.get('legacySourceReviewed') is True, 'complete-legacy-source-review-required')
    require(evidence.get('maintenanceApproved') is True, 'maintenance-boundary-required')
    require(evidence.get('unitInactive') is True and evidence.get('cgroupEmpty') is True, 'legacy-still-running')
    require(evidence.get('admissionPaused') is True and type(evidence.get('pauseGeneration')) is int
            and evidence['pauseGeneration'] > 0, 'claim-fence-required')
    require(type(evidence.get('activeJobs')) is int and evidence['activeJobs'] == 0, 'working-jobs-unsettled')
    for key in ('preGuardRequestsSettled', 'claimOutcomeReconciled', 'allJournalDeliveriesReconciled', 'rosterSyncReconciled',
                'lessonPublicationReconciled', 'presenceSettled', 'completeRuntimeBackupVerified',
                'privateStateBackupVerified', 'credentialsAndCodexPreserved', 'schemaAppCompatibilityReviewed'):
        require(evidence.get(key) is True, 'unsettled:' + key)
    require(evidence.get('legacyRollbackCompatible') is False, 'unknown-legacy-is-not-contract2-rollback')
    require(evidence.get('timerEnabled') is False and evidence.get('candidateAdmissionEnabled') is False, 'premature-admission')
    return 'record-complete; live observations and first contract-2 acceptance still required'



def summarize_records(records):
    """Only redacted boolean metadata, never IDs, paths, replies or lease tokens.
    A record classifier cannot authorize activation or retroactively prove drain.
    """
    flags = ('sourceIdentityVerified', 'preGuardRequestsSettled', 'executionCompletionProven',
             'rosterSettled', 'presenceSettled', 'unitInactive', 'cgroupEmpty')
    groups = {'claims': ('outcomeKnown', 'journalAccounted'),
              'deliveries': ('dbCommitVerified', 'journalAcknowledged', 'digestMatched'),
              'publications': ('driveReadbackMatched', 'dbReceiptVerified', 'requestSettled')}
    require(set(records) == set(flags) | set(groups), 'invalid-redacted-records')
    require(all(type(records[k]) is bool for k in flags), 'invalid-redacted-flags')
    counts = {}
    for name, fields in groups.items():
        rows = records[name]
        require(isinstance(rows, list) and len(rows) <= 10000, 'invalid-redacted-count')
        require(all(isinstance(row, dict) and set(row) == set(fields)
                    and all(type(value) is bool for value in row.values()) for row in rows), 'invalid-redacted-outcome')
        counts[name] = {'observed': len(rows), 'unsettled': sum(not all(row.values()) for row in rows)}
    return {'mayActivate': False,
            'allRecordedOutcomesSettled': all(records[k] for k in flags) and all(v['unsettled'] == 0 for v in counts.values()),
            'counts': counts,
            'requiresOperatorBoundary': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    stage = sub.add_parser('stage-controls')
    stage.add_argument('--provisioned', type=Path, required=True)
    audit = sub.add_parser('audit')
    audit.add_argument('--config', type=Path, default=CONFIG)
    summary = sub.add_parser('summarize-records')
    summary.add_argument('record', type=Path)
    cutover = sub.add_parser('check-cutover-record')
    cutover.add_argument('record', type=Path)
    args = parser.parse_args()
    if args.action == 'summarize-records':
        print(json.dumps(summarize_records(json.loads(args.record.read_text())), sort_keys=True))
    elif args.action == 'check-cutover-record':
        print(check_cutover(json.loads(args.record.read_text())))
    else:
        require(os.geteuid() == 0, 'operator-root-required')
        if args.action == 'audit':
            audit_config(args.config)
            print('root-trust-paths-verified')
        else:
            print(stage_controls(args.provisioned))


if __name__ == '__main__':
    main()
