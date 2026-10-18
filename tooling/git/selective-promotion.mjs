import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', timeout: 45000 }).trimEnd()
export const selectiveBranch = 'codex/shop-suit/usd-production'
const support = ['tooling/git/check-pr.mjs', 'tooling/git/policy.mjs', 'tooling/git/selective-promotion.mjs', 'tooling/git/tests/selective-promotion.test.mjs', 'tooling/git/shop-usd-promotion.json']
export function validateSelectiveProof(proof, changed, actualHashes) {
  assert.equal(proof.base, '5fb461fe8d74c8aee6bd1bc37962c05080204034')
  assert.equal(proof.source, '0360b0669684057fa72e375c0c61701119ae6cae')
  assert.deepEqual([...changed].sort(), [...Object.keys(proof.files), ...support].sort(), 'Selective promotion contains unreviewed files')
  for (const [path, hash] of Object.entries(proof.files)) {
    assert.match(path, /^(apps\/(shop-suit|building-suit-docs)\/|packages\/(ui|ux)\/|tooling\/database\/)/)
    assert.match(hash, /^[a-f0-9]{40}$/)
    assert.equal(actualHashes[path], hash, `Selective promotion changed reviewed content: ${path}`)
  }
}
export function verifySelectivePromotion(pr) {
  assert.equal(pr.base.ref, 'main'); assert.equal(pr.head.ref, selectiveBranch)
  assert.equal(pr.head.repo?.full_name, pr.base.repo?.full_name)
  const proof = JSON.parse(readFileSync(new URL('./shop-usd-promotion.json', import.meta.url)))
  assert.equal(pr.base.sha, proof.base, 'Main advanced: rebuild and review the isolated candidate')
  git('merge-base', '--is-ancestor', proof.source, 'origin/stg')
  assert.equal(git('merge-base', proof.base, pr.head.sha), proof.base)
  assert.equal(git('rev-list', '--merges', `${proof.base}..${pr.head.sha}`), '', 'Selective promotion must not import staging merges')
  const changed = git('diff', '--name-only', proof.base, pr.head.sha).split('\n').filter(Boolean)
  const hashes = Object.fromEntries(Object.keys(proof.files).map(path => [path, git('rev-parse', `${pr.head.sha}:${path}`)]))
  validateSelectiveProof(proof, changed, hashes)
}
