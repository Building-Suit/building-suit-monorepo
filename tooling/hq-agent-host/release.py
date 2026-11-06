#!/usr/bin/python3
"""Code-only release builder and fail-closed, outbound-only host updater.
The operator installs this control program separately from untrusted downloads.
No Git, package manager, schema migration or manifest-provided command on host.
"""
import argparse
import base64
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import tempfile
import time
import urllib.request

REPO = 'Building-Suit/building-suit-monorepo'
REPO_ID = '1376504404'
WORKFLOW = REPO + '/.github/workflows/ci.yml'
FILES = ('worker.mjs', 'workforceRoster.mjs', 'brainPublisher.mjs', 'maintenance.mjs')
MAX_BYTES = 4_000_000
SHA = re.compile(r'[a-f0-9]{40}')


def require(ok, code):
    if not ok:
        raise RuntimeError(code)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'duplicate-json-key')
        result[key] = value
    return result


def decode(data):
    require(len(data) <= MAX_BYTES, 'package-too-large')
    return json.loads(data, object_pairs_hook=unique_object)


def validate(package, expected_sha):
    require(SHA.fullmatch(expected_sha), 'invalid-sha')
    require(set(package) == {'manifest', 'files'}, 'invalid-package')
    manifest = package['manifest']
    require(set(manifest) == {'format', 'sha', 'repositoryId', 'ref', 'nodeMajor', 'schemaContract', 'maintenanceProtocol', 'files'}, 'invalid-manifest')
    require(all(type(manifest[key]) is int for key in ('format', 'nodeMajor', 'schemaContract', 'maintenanceProtocol')), 'invalid-manifest-types')
    require(manifest['format'] == 1 and manifest['sha'] == expected_sha and manifest['repositoryId'] == REPO_ID
            and manifest['ref'] == 'refs/heads/stg' and manifest['nodeMajor'] == 22
            and manifest['schemaContract'] == 1 and manifest['maintenanceProtocol'] == 1, 'incompatible-manifest')
    require(set(package['files']) == set(FILES) == set(manifest['files']), 'unsafe-package-paths')
    contents = {}
    for name in FILES:
        data = base64.b64decode(package['files'][name], validate=True)
        require(len(data) <= 1_000_000 and manifest['files'][name] == {'sha256': digest(data), 'bytes': len(data)}, 'file-integrity')
        contents[name] = data
    return manifest, contents


def build(root, sha, output):
    require(SHA.fullmatch(sha), 'invalid-sha')
    require(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip() == sha, 'exact-head-required')
    files = {}
    for name in FILES:
        data = subprocess.check_output(['git', 'show', f'{sha}:tooling/hq-agent-host/{name}'], cwd=root)
        # Only committed allowlisted source, never environment/auth/journal files.
        require(not re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\r\n]|(?:sb_secret_|ghp_)[A-Za-z0-9]{20,}', data), 'secret-material')
        files[name] = data
    manifest = {'format': 1, 'sha': sha, 'repositoryId': REPO_ID, 'ref': 'refs/heads/stg', 'nodeMajor': 22,
                'schemaContract': 1, 'maintenanceProtocol': 1,
                'files': {name: {'sha256': digest(data), 'bytes': len(data)} for name, data in files.items()}}
    package = {'manifest': manifest, 'files': {name: base64.b64encode(data).decode() for name, data in files.items()}}
    data = json.dumps(package, sort_keys=True, separators=(',', ':')).encode()
    validate(decode(data), sha)
    Path(output).write_bytes(data)


def atomic_json(path, value):
    path = Path(path)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
        temporary = Path(stream.name)
        stream.write(json.dumps(value, sort_keys=True).encode())
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)
    sync_dir(path.parent)


def sync_dir(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


@contextlib.contextmanager
def exclusive(root):
    # Kernel releases flock after a crash; the stable file is never unlinked.
    with open(root / 'updater.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def installed(root, sha):
    require(isinstance(sha, str) and SHA.fullmatch(sha), 'invalid-installed-release')
    directory = root / 'releases' / sha
    require(directory.is_dir() and not directory.is_symlink(), 'baseline-required')
    require({p.name for p in directory.iterdir()} == {*FILES, 'manifest.json'}, 'baseline-files')
    manifest = decode((directory / 'manifest.json').read_bytes())
    payload = {}
    for name in FILES:
        target = directory / name
        require(target.is_file() and not target.is_symlink(), 'unsafe-baseline')
        payload[name] = base64.b64encode(target.read_bytes()).decode()
    validate({'manifest': manifest, 'files': payload}, sha)
    return manifest


def current_sha(root):
    target = os.readlink(root / 'current')
    require(re.fullmatch(r'releases/[a-f0-9]{40}', target), 'invalid-current-link')
    sha = target.split('/')[1]
    installed(root, sha)
    return sha


def activate(root, sha):
    installed(root, sha)
    temporary = root / 'current.next'
    temporary.unlink(missing_ok=True)
    temporary.symlink_to('releases/' + sha)
    os.replace(temporary, root / 'current')
    sync_dir(root)


def stage(root, package, sha):
    manifest, contents = validate(package, sha)
    releases = root / 'releases'
    require(releases.is_dir() and not releases.is_symlink(), 'release-directory-required')
    target = releases / sha
    if target.exists():
        require(installed(root, sha) == manifest, 'immutable-release-conflict')
        return
    with tempfile.TemporaryDirectory(prefix='.stage-', dir=releases) as temporary:
        directory = Path(temporary) / sha
        directory.mkdir(mode=0o755)
        for name, data in contents.items():
            with open(directory / name, 'xb') as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            (directory / name).chmod(0o644)
        atomic_json(directory / 'manifest.json', manifest)
        (directory / 'manifest.json').chmod(0o644)
        sync_dir(directory)
        os.rename(directory, target)
        sync_dir(releases)


class Host:
    def __init__(self, config):
        self.config = config
        self.root = Path(config['root'])
        for name in ('node', 'gh', 'systemctl', 'trustedRoot', 'socket'):
            require(Path(config[name]).is_absolute(), 'absolute-path-required')
        require(config['unit'] == 'company-hq-worker.service', 'unexpected-service')
        require(config['schemaContract'] == 1, 'operator-schema-contract-required')

    def command(self, argv, timeout=60, env=None):
        return subprocess.check_output(argv, timeout=timeout, env=env, stderr=subprocess.DEVNULL, text=True)

    def verify(self, artifact, bundle, sha):
        # Offline bundle + independently installed roots. No cached GitHub login,
        # injected GH token, extensions, or package-supplied trust root.
        with tempfile.TemporaryDirectory() as config_dir:
            env = {'PATH': '/usr/bin:/bin', 'GH_CONFIG_DIR': config_dir, 'XDG_CACHE_HOME': config_dir, 'GH_PROMPT_DISABLED': '1', 'GH_TOKEN': '', 'GITHUB_TOKEN': '', 'GH_HOST': 'github.com'}
            result = self.command([self.config['gh'], 'attestation', 'verify', str(artifact), '--bundle', str(bundle),
                                   '--custom-trusted-root', self.config['trustedRoot'], '--repo', REPO,
                                   '--source-ref', 'refs/heads/stg', '--source-digest', sha,
                                   '--cert-identity', 'https://github.com/' + WORKFLOW + '@refs/heads/stg',
                                   '--predicate-type', 'https://slsa.dev/provenance/v1', '--deny-self-hosted-runners', '--format', 'json'], env=env)
        results = decode(result.encode())
        require(isinstance(results, list) and results, 'provenance-required')
        for item in results:
            certificate = item['verificationResult']['signature']['certificate']
            require(str(certificate['sourceRepositoryIdentifier']) == REPO_ID, 'repository-identity-mismatch')

    def control(self, action):
        with socket.socket(socket.AF_UNIX) as client:
            client.settimeout(30)
            client.connect(self.config['socket'])
            client.sendall(json.dumps({'action': action}).encode() + b'\n')
            response = b''
            while not response.endswith(b'\n'):
                chunk = client.recv(4096)
                require(chunk and len(response) < 4096, 'invalid-control-response')
                response += chunk
        result = decode(response)
        require(result.get('protocol') == 1 and not result.get('uncertain') and 'error' not in result, 'worker-unsettled')
        # Bind the local socket receipt to systemd's actual worker process.
        pid = int(self.command([self.config['systemctl'], 'show', self.config['unit'], '--property=MainPID', '--value']).strip())
        require(result['pid'] == pid and pid > 0, 'worker-pid-mismatch')
        return result

    def preflight(self, sha):
        # Fixed binary and arguments; no manifest command execution. This helper
        # service uses the same private environment and OS identity as the worker.
        result = self.command([self.config['systemctl'], 'start', 'company-hq-worker-preflight.service'])
        require(result == '', 'preflight-failed')
        # ExecStart uses candidate/worker.mjs; candidate is set only after stage.

    def service(self, action):
        require(action in ('start', 'stop'), 'invalid-service-action')
        self.command([self.config['systemctl'], action, self.config['unit']], timeout=120)

    def health(self, sha):
        deadline = time.monotonic() + self.config.get('healthSeconds', 90)
        while time.monotonic() < deadline:
            try:
                status = self.control('status')
                if (status['release'] == sha and status['ready'] and status['contract'] == 1
                        and status['paused'] and status['busy'] == 0):
                    return
            except (OSError, RuntimeError, subprocess.SubprocessError, ValueError, KeyError):
                pass
            time.sleep(1)
        raise RuntimeError('startup-health-failed')

    def drain(self, sha):
        deadline = time.monotonic() + self.config.get('drainSeconds', 900)
        self.control('drain')
        while time.monotonic() < deadline:
            status = self.control('status')
            require(status['release'] == sha and status['paused'], 'drain-identity')
            if status['busy'] == 0 and status['ready']:
                return
            time.sleep(1)
        raise RuntimeError('drain-deferred')


def candidate_link(root, sha):
    target = root / 'candidate'
    temporary = root / 'candidate.next'
    temporary.unlink(missing_ok=True)
    temporary.symlink_to('releases/' + sha)
    os.replace(temporary, target)
    sync_dir(root)


def recover(host):
    root = host.root
    journal = root / 'transaction.json'
    if not journal.exists():
        return False
    transaction = decode(journal.read_bytes())
    old, new = transaction['old'], transaction['new']
    installed(root, old)
    installed(root, new)
    phase = transaction['phase']
    require(phase in ('prepared', 'stopped', 'activated', 'accepted', 'rollback-accepted'), 'invalid-transaction')
    if phase in ('accepted', 'rollback-accepted'):
        accepted_sha = new if phase == 'accepted' else old
        require(current_sha(root) == accepted_sha, 'accepted-link-mismatch')
        # Acceptance is durable before admission. A crash here may have admitted
        # work, so recovery NEVER stops this process or rolls it back.
        status = host.control('status')
        require(status['release'] == accepted_sha and status['ready'], 'accepted-release-unhealthy')
        if status['paused']:
            host.control('resume')
    elif phase == 'prepared':
        require(current_sha(root) == old, 'prepared-link-mismatch')
        # Stop may have completed before the phase write. Probe without killing
        # anything; if alive it is drained, otherwise restart old paused.
        try:
            host.drain(old)
        except (ConnectionError, FileNotFoundError):
            host.service('start')
            host.health(old)
        transaction['phase'] = 'rollback-accepted'
        atomic_json(journal, transaction)
        host.control('resume')
    else:
        # Both candidate and baseline always boot paused. No admission occurred.
        status = None
        try:
            status = host.control('status')
        except (ConnectionError, FileNotFoundError):
            pass
        if status:
            require(status['paused'] and status['busy'] == 0, 'recovery-worker-busy')
            host.service('stop')
        activate(root, old)
        host.service('start')
        host.health(old)
        transaction['phase'] = 'rollback-accepted'
        atomic_json(journal, transaction)
        host.control('resume')
    journal.unlink()
    sync_dir(root)
    return True


def install(host, package, sha):
    root = host.root
    with exclusive(root):
        if recover(host):
            return 'recovered'  # Never immediately retry a failed candidate.
        old = current_sha(root)  # Mandatory complete, verified rollback baseline.
        manifest, _ = validate(package, sha)
        require(installed(root, old)['schemaContract'] == manifest['schemaContract'] == host.config['schemaContract'], 'schema-incompatible')
        if old == sha:
            status = host.control('status')
            require(status['release'] == sha and status['ready'], 'current-unhealthy')
            if status['paused']:
                host.health(sha)
                host.control('resume')
            return 'no-op'
        stage(root, package, sha)
        candidate_link(root, sha)
        host.preflight(sha)  # Before requesting drain or stopping the old worker.
        transaction = {'old': old, 'new': sha, 'phase': 'prepared'}
        atomic_json(root / 'transaction.json', transaction)
        try:
            host.drain(old)
        except Exception:
            # Timeout/unknown claim: do not stop, cancel inference or clear poison.
            # Retain pause; operator/timer can observe completion and safely resume.
            raise
        try:
            host.service('stop')
            transaction['phase'] = 'stopped'
            atomic_json(root / 'transaction.json', transaction)
            activate(root, sha)
            transaction['phase'] = 'activated'
            atomic_json(root / 'transaction.json', transaction)
            host.service('start')
            host.health(sha)
            transaction['phase'] = 'accepted'
            atomic_json(root / 'transaction.json', transaction)
        except Exception:
            recover(host)
            raise
        # Outside rollback try: admission can launch paid work. Failures after
        # this boundary leave accepted state for non-destructive recovery.
        host.control('resume')
        (root / 'transaction.json').unlink()
        sync_dir(root)
        return 'installed'


class HttpsOnly(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        require(newurl.startswith('https://'), 'https-required')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(url):
    require(url.startswith('https://'), 'https-required')
    with urllib.request.build_opener(HttpsOnly()).open(urllib.request.Request(url, headers={'User-Agent': 'company-hq-updater/1'}), timeout=30) as response:
        data = response.read(MAX_BYTES + 1)
        require(len(data) <= MAX_BYTES, 'download-too-large')
        return data


def update(host):
    # Discover exact current stg SHA, never trust latest release tag ordering.
    ref = decode(fetch('https://api.github.com/repos/' + REPO + '/git/ref/heads/stg'))
    sha = ref['object']['sha']
    require(SHA.fullmatch(sha), 'invalid-stg-sha')
    base = 'https://github.com/' + REPO + '/releases/download/hq-worker-stg-' + sha + '/'
    with tempfile.TemporaryDirectory(prefix='hq-download-') as directory:
        artifact = Path(directory) / 'worker.json'
        bundle = Path(directory) / 'worker.sigstore.json'
        artifact.write_bytes(fetch(base + artifact.name))
        bundle.write_bytes(fetch(base + bundle.name))
        host.verify(artifact, bundle, sha)
        package = decode(artifact.read_bytes())
        return install(host, package, sha)


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    builder = sub.add_parser('build')
    builder.add_argument('--root', default='.')
    builder.add_argument('--sha', required=True)
    builder.add_argument('--output', required=True)
    updater = sub.add_parser('update')
    updater.add_argument('--config', required=True)
    args = parser.parse_args()
    if args.command == 'build':
        build(args.root, args.sha, args.output)
    else:
        host = Host(decode(Path(args.config).read_bytes()))
        # Recovery precedes network discovery; outages cannot strand a transaction.
        with exclusive(host.root):
            if recover(host):
                print('recovered')
                return
            sha = current_sha(host.root)
            status = host.control('status')
            require(status['release'] == sha and status['ready'], 'baseline-unhealthy')
            if status['paused']:
                host.health(sha)
                host.control('resume')
        print(update(host))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Never print remote diagnostics or private file contents.
        code = str(error) if type(error) is RuntimeError and re.fullmatch(r'[a-z-]{1,80}', str(error)) else type(error).__name__
        print('HQ update deferred or failed: ' + code)
        raise SystemExit(1) from None
