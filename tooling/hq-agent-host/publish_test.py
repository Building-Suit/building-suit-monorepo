"""Disposable publication contract: no GitHub release API is ever called."""
import copy
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from publish import Publisher
from release_test import A, B, C, package
from release import REPO


class GitHub:
    def __init__(self, sha, artifact, bundle):
        self.sha, self.artifact, self.bundle = sha, artifact, bundle
        self.tag = 'hq-worker-stg-' + sha
        self.release = None
        self.tags = {}
        self.data = {}
        self.events = []
        self.fail_upload = False
        self.fail_listing = False

    def seed(self, draft=False):
        self.release = {'id': 1, 'tag_name': self.tag, 'target_commitish': self.sha, 'draft': draft, 'prerelease': True, 'assets': []}
        self.data = {'worker.json': self.artifact.read_bytes(), 'worker.sigstore.json': self.bundle.read_bytes()}
        self.assets()
        if not draft:
            self.tags[self.tag] = self.sha

    def assets(self):
        self.release['assets'] = [{'id': index + 1, 'name': name, 'size': len(data)} for index, (name, data) in enumerate(self.data.items())]

    def verify(self, artifact, bundle, sha, **kwargs):
        self.events.append('verify')
        assert kwargs['gh'] == '/fixture/gh'
        assert Path(kwargs['trusted_root']).read_text() == 'independent-fixture-roots'
        if not bundle.read_bytes().startswith(('signed-for:' + sha).encode()):
            raise RuntimeError('invalid-fixture-signature')

    def run(self, argv, env=None):
        assert argv[0] == '/fixture/gh'
        if argv[1:3] == ['attestation', 'trusted-root']:
            return 'independent-fixture-roots'
        if argv[1] == 'api':
            if '--paginate' in argv:
                if self.fail_listing:
                    raise subprocess.CalledProcessError(1, argv, stderr='gh: upstream failed (HTTP 500)')
                # More than one page, including an unrelated older release.
                return json.dumps([[{'tag_name': 'unrelated-release'}], [self.release] if self.release else []])
            tag = argv[-1].rsplit('/', 1)[-1]
            if tag not in self.tags:
                raise subprocess.CalledProcessError(1, argv, stderr='gh: Not Found (HTTP 404)')
            return json.dumps({'object': {'type': 'commit', 'sha': self.tags[tag]}})
        assert argv[1] == 'release'
        action = argv[2]
        if action == 'create':
            self.events.append('create-draft')
            assert '--draft' in argv and '--latest=false' in argv
            self.release = {'id': 1, 'tag_name': self.tag, 'target_commitish': self.sha, 'draft': True, 'prerelease': True, 'assets': []}
        elif action == 'upload':
            self.events.append('upload')
            assert '--clobber' not in argv
            self.data['worker.json'] = Path(argv[4]).read_bytes()
            self.assets()
            if self.fail_upload:
                raise subprocess.CalledProcessError(1, argv, stderr='fixture-upload-failed')
            self.data['worker.sigstore.json'] = Path(argv[5]).read_bytes()
            self.assets()
        elif action == 'download':
            self.events.append('download')
            directory = Path(argv[argv.index('--dir') + 1])
            for name, data in self.data.items():
                (directory / name).write_bytes(data)
        elif action == 'edit':
            self.events.append('publish')
            assert '--draft=false' in argv
            self.release['draft'] = False
            self.tags[self.tag] = self.release['target_commitish']
        else:
            raise AssertionError('unexpected-release-operation')
        return ''


class Publication(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        root = Path(self.temporary.name)
        self.artifact, self.bundle = root / 'worker.json', root / 'worker.sigstore.json'
        self.artifact.write_text(json.dumps(package(B)))
        self.bundle.write_text('signed-for:' + B + ':first-run')
        self.github = GitHub(B, self.artifact, self.bundle)
        self.publisher = Publisher('/fixture/gh', self.github.run, self.github.verify)

    def publish(self):
        return self.publisher.publish(B, self.artifact, self.bundle)

    def test_new_release_is_draft_until_asset_readback_and_provenance_succeed(self):
        self.assertEqual(self.publish(), 'published')
        events = self.github.events
        self.assertLess(events.index('create-draft'), events.index('upload'))
        self.assertLess(events.index('download'), events.index('publish'))
        self.assertGreater(events[:events.index('publish')].count('verify'), 1)
        self.assertFalse(self.github.release['draft'])
        self.assertEqual(self.github.tags[self.github.tag], B)

    def test_complete_published_release_is_verified_without_replacement(self):
        self.github.seed()
        self.bundle.write_text('signed-for:' + B + ':different-valid-rerun-bundle')
        self.assertEqual(self.publish(), 'verified-existing')
        self.assertNotIn('create-draft', self.github.events)
        self.assertNotIn('upload', self.github.events)
        self.assertNotIn('publish', self.github.events)
        self.assertTrue(self.github.data['worker.sigstore.json'].endswith(b'first-run'))

    def test_complete_existing_draft_is_verified_then_published(self):
        self.github.seed(draft=True)
        self.assertEqual(self.publish(), 'published')
        self.assertNotIn('upload', self.github.events)
        self.assertLess(self.github.events.index('download'), self.github.events.index('publish'))

    def test_failed_upload_leaves_draft_and_rerun_reports_partial_release(self):
        self.github.fail_upload = True
        with self.assertRaises(subprocess.CalledProcessError):
            self.publish()
        self.assertTrue(self.github.release['draft'])
        self.assertEqual(set(self.github.data), {'worker.json'})
        self.github.fail_upload = False
        with self.assertRaisesRegex(RuntimeError, 'incomplete-or-conflicting-assets'):
            self.publish()
        self.assertTrue(self.github.release['draft'])
        self.assertEqual(self.github.events.count('upload'), 1)
        self.assertNotIn('publish', self.github.events)

    def test_partial_published_release_and_extra_assets_fail_without_mutation(self):
        for names in [('worker.json',), ('worker.json', 'worker.sigstore.json', 'unexpected.env')]:
            with self.subTest(names=names):
                self.github.seed()
                self.github.data = {name: self.github.data.get(name, b'fixture') for name in names}
                self.github.assets()
                before = copy.deepcopy(self.github.release)
                with self.assertRaisesRegex(RuntimeError, 'incomplete-or-conflicting-assets'):
                    self.publish()
                self.assertEqual(self.github.release, before)
                self.assertNotIn('upload', self.github.events)
                self.assertNotIn('publish', self.github.events)

    def test_conflicting_target_tag_or_package_fails_without_replacement(self):
        for conflict in ['target', 'tag', 'package']:
            with self.subTest(conflict=conflict):
                self.github.seed()
                if conflict == 'target': self.github.release['target_commitish'] = C
                elif conflict == 'tag': self.github.tags[self.github.tag] = C
                else: self.github.data['worker.json'] = b'conflicting-package'; self.github.assets()
                with self.assertRaisesRegex(RuntimeError, 'conflict'):
                    self.publish()
                self.assertNotIn('upload', self.github.events)
                self.assertNotIn('publish', self.github.events)

    def test_invalid_existing_provenance_cannot_turn_a_draft_public(self):
        self.github.seed(draft=True)
        self.github.data['worker.sigstore.json'] = b'bad-fixture-signature'
        self.github.assets()
        with self.assertRaisesRegex(RuntimeError, 'invalid-fixture-signature'):
            self.publish()
        self.assertTrue(self.github.release['draft'])
        self.assertNotIn('publish', self.github.events)

    def test_network_or_auth_error_is_not_treated_as_release_absence(self):
        self.github.fail_listing = True
        with self.assertRaises(subprocess.CalledProcessError):
            self.publish()
        self.assertIsNone(self.github.release)
        self.assertNotIn('create-draft', self.github.events)

    def test_published_non_staging_release_is_not_silently_accepted(self):
        self.github.seed()
        self.github.release['prerelease'] = False
        with self.assertRaisesRegex(RuntimeError, 'not-staging-prerelease'):
            self.publish()
        self.assertNotIn('publish', self.github.events)
        self.assertNotIn('upload', self.github.events)

    def test_lost_publication_response_is_verified_on_rerun_without_republishing(self):
        original = self.github.run
        lost = [False]
        def run(argv, env=None):
            result = original(argv, env)
            if argv[1:3] == ['release', 'edit'] and not lost[0]:
                lost[0] = True
                raise subprocess.CalledProcessError(1, argv, stderr='fixture-response-lost')
            return result
        self.publisher.run = run
        with self.assertRaises(subprocess.CalledProcessError):
            self.publish()
        self.assertFalse(self.github.release['draft'])
        self.assertEqual(self.publish(), 'verified-existing')
        self.assertEqual(self.github.events.count('publish'), 1)
        self.assertEqual(self.github.events.count('upload'), 1)

    def test_existing_wrong_tag_blocks_creation_of_new_release(self):
        self.github.tags[self.github.tag] = A
        with self.assertRaisesRegex(RuntimeError, 'tag-conflict'):
            self.publish()
        self.assertNotIn('create-draft', self.github.events)


if __name__ == '__main__':
    unittest.main()
