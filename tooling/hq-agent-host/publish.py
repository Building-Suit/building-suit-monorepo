#!/usr/bin/python3
"""CI-only publisher: verify complete draft assets before public publication.
No clobber, deletion, partial-release success or real release writes in tests.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from release import MAX_BYTES, REPO, REPO_ID, SHA, decode, require, validate, verify_provenance

NAMES = {'worker.json', 'worker.sigstore.json'}


def command(argv, env=None):
    return subprocess.check_output(argv, env=env, text=True, stderr=subprocess.PIPE, timeout=120)


class Publisher:
    def __init__(self, gh, run=command, verify=verify_provenance):
        self.gh, self.run, self.verify = gh, run, verify

    def find(self, tag):
        # Authenticated listing includes drafts, unlike relying on a successful
        # public-release lookup. Pagination must not hide an older partial draft.
        pages = json.loads(self.run([self.gh, 'api', '--paginate', '--slurp', f'repos/{REPO}/releases?per_page=100']))
        matches = [item for page in pages for item in page if item['tag_name'] == tag]
        require(len(matches) <= 1, 'ambiguous-existing-release')
        return matches[0] if matches else None

    def tag_target(self, tag):
        try:
            ref = json.loads(self.run([self.gh, 'api', f'repos/{REPO}/git/ref/tags/{tag}']))
        except subprocess.CalledProcessError as error:
            # A transport/auth failure is never evidence of absence.
            if '(HTTP 404)' in (error.stderr or ''):
                return None
            raise RuntimeError('release-tag-query-failed') from None
        require(ref['object']['type'] == 'commit', 'unexpected-release-tag-type')
        return ref['object']['sha']

    def check(self, release, tag, sha, expected, roots):
        require(release and release['tag_name'] == tag and release['target_commitish'] == sha, 'existing-release-target-conflict')
        require(release.get('prerelease') is True, 'existing-release-not-staging-prerelease')
        require(type(release['draft']) is bool, 'invalid-release-state')
        assets = release['assets']
        require(len(assets) == 2 and {asset['name'] for asset in assets} == NAMES, 'existing-release-incomplete-or-conflicting-assets')
        require(all(type(asset['size']) is int and 0 < asset['size'] <= MAX_BYTES for asset in assets), 'invalid-release-asset-size')
        target = self.tag_target(tag)
        require(target == sha or target is None and release['draft'], 'existing-release-tag-conflict')
        with tempfile.TemporaryDirectory(prefix='hq-publish-readback-') as temporary:
            directory = Path(temporary)
            self.run([self.gh, 'release', 'download', tag, '--repo', REPO, '--dir', str(directory),
                      '--pattern', 'worker.json', '--pattern', 'worker.sigstore.json'])
            artifact, bundle = directory / 'worker.json', directory / 'worker.sigstore.json'
            require(artifact.read_bytes() == expected, 'existing-release-package-conflict')
            require(0 < bundle.stat().st_size <= MAX_BYTES, 'invalid-release-bundle-size')
            self.verify(artifact, bundle, sha, gh=self.gh, trusted_root=str(roots), command=self.run)

    def publish(self, sha, artifact, bundle):
        require(isinstance(sha, str) and SHA.fullmatch(sha), 'invalid-sha')
        artifact, bundle = Path(artifact), Path(bundle)
        require(artifact.name == 'worker.json' and bundle.name == 'worker.sigstore.json', 'fixed-release-assets-required')
        expected = artifact.read_bytes()
        validate(decode(expected), sha)
        require(0 < bundle.stat().st_size <= MAX_BYTES, 'invalid-release-bundle-size')
        tag = 'hq-worker-stg-' + sha
        with tempfile.TemporaryDirectory(prefix='hq-publication-trust-') as temporary:
            # Obtain public roots independently of either uploaded bundle.
            roots = Path(temporary) / 'trusted-root.jsonl'
            roots.write_text(self.run([self.gh, 'attestation', 'trusted-root']))
            self.verify(artifact, bundle, sha, gh=self.gh, trusted_root=str(roots), command=self.run)
            release = self.find(tag)
            if release is None:
                require(self.tag_target(tag) in (None, sha), 'existing-release-tag-conflict')
                self.run([self.gh, 'release', 'create', tag, '--repo', REPO, '--target', sha, '--draft',
                          '--prerelease', '--latest=false', '--title', 'HQ staging worker ' + sha,
                          '--notes', 'Code-only staging worker; no configuration, credentials or schema deployment. Exact source and package digest are attested.'])
                # Failed/uncertain upload leaves a draft. Reruns validate it or
                # fail clearly; they never silently skip or replace an asset.
                self.run([self.gh, 'release', 'upload', tag, str(artifact), str(bundle), '--repo', REPO])
                release = self.find(tag)
            self.check(release, tag, sha, expected, roots)
            if not release['draft']:
                return 'verified-existing'
            self.run([self.gh, 'release', 'edit', tag, '--repo', REPO, '--draft=false', '--latest=false'])
            published = self.find(tag)
            require(published and published['draft'] is False, 'release-publication-unconfirmed')
            self.check(published, tag, sha, expected, roots)
            return 'published'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sha', required=True)
    parser.add_argument('--artifact', required=True)
    parser.add_argument('--bundle', required=True)
    args = parser.parse_args()
    require(os.environ.get('GITHUB_REPOSITORY') == REPO and os.environ.get('GITHUB_REPOSITORY_ID') == REPO_ID and os.environ.get('GITHUB_REF') == 'refs/heads/stg'
            and os.environ.get('GITHUB_EVENT_NAME') == 'push' and os.environ.get('GITHUB_SHA') == args.sha, 'staging-ci-required')
    gh = shutil.which('gh')
    require(gh and Path(gh).is_absolute(), 'github-cli-required')
    print(Publisher(gh).publish(args.sha, args.artifact, args.bundle))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if type(error) is RuntimeError and str(error).replace('-', '').isalpha() else type(error).__name__
        print('HQ release publication failed: ' + code)
        raise SystemExit(1) from None
