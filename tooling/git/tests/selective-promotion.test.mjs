import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateSelectiveProof } from '../selective-promotion.mjs'
import { checkPullRequestPolicy } from '../policy.mjs'
const proof = JSON.parse(readFileSync(new URL('../shop-usd-promotion.json', import.meta.url)))
const support = ['tooling/git/check-pr.mjs', 'tooling/git/policy.mjs', 'tooling/git/selective-promotion.mjs', 'tooling/git/tests/selective-promotion.test.mjs', 'tooling/git/shop-usd-promotion.json']
const changed = [...Object.keys(proof.files), ...support]
test('selective USD release verifies every reviewed file and rejects unrelated or changed content', () => {
  assert.doesNotThrow(() => validateSelectiveProof(proof, changed, proof.files))
  assert.throws(() => validateSelectiveProof(proof, [...changed, 'apps/doctor-suit/app.vue'], proof.files))
  const path = Object.keys(proof.files)[0]
  assert.throws(() => validateSelectiveProof(proof, changed, { ...proof.files, [path]: '0'.repeat(40) }))
  assert.throws(() => validateSelectiveProof(proof, changed.slice(1), proof.files))
  assert.throws(() => validateSelectiveProof({ ...proof, base: '0'.repeat(40) }, changed, proof.files))
})
test('isolated branch remains forbidden without independently verified proof and same repository', () => {
  const repo = { full_name: 'Building-Suit/building-suit-monorepo' }
  const pr = { number: 1, state: 'open', head: { ref: 'codex/shop-suit/usd-production', repo }, base: { ref: 'main', repo } }
  assert.ok(checkPullRequestPolicy([pr], 1).length)
  assert.deepEqual(checkPullRequestPolicy([pr], 1, { selectivePromotionVerified: true }), [])
  pr.head.repo = { full_name: 'foreign/fork' }
  assert.ok(checkPullRequestPolicy([pr], 1, { selectivePromotionVerified: true }).length)
})
