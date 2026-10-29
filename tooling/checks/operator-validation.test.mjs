import assert from 'node:assert/strict'
import test from 'node:test'
import { asOperatorJson, projectSchema, retryPolicySchema } from '../../apps/automation-suit/server/utils/operatorValidation.ts'

const project = () => ({
  slug: 'ledger-test', display_name: 'Synthetic Ledger', repository_path: '/synthetic/repository',
  github_repository: 'synthetic/repository', integration_branch: 'stg', production_branch: 'main',
  local_repository_root: '/synthetic', worktree_root: '/synthetic/worktrees',
  workstreams: [{ slug: 'ledger-suit', display_name: 'Ledger', stack_key: 'ledger-suit' }],
})
const policy = () => ({ policy_id: 'ledger-retry', display_name: 'Synthetic retry', max_attempts: 2, attempt_profiles: ['fast', 'review'] })

test('operator project parsing preserves defaults and request isolation', () => {
  const first = projectSchema.parse(project())
  const second = projectSchema.parse(project())
  assert.equal(first.active, false)
  assert.equal(first.codex_enabled, true)
  assert.equal(first.default_model_profile, 'standard')
  assert.equal(first.workstreams[0].active, true)
  assert.equal(first.workstreams[0].application_path, '')
  assert.deepEqual(first.application_paths, {})
  first.application_paths.ledger = 'synthetic'
  first.workstreams[0].metadata.test = true
  assert.deepEqual(second.application_paths, {})
  assert.deepEqual(second.workstreams[0].metadata, {})
  assert.deepEqual(first.metadata, {})
  assert.notEqual(first.metadata, first.application_paths)
  assert.deepEqual(asOperatorJson({ active: true, absent: undefined }), { active: true })
})

test('operator project validation rejects malformed identity and nested secret keys', () => {
  for (const candidate of [
    { ...project(), slug: 'INVALID' },
    { ...project(), github_repository: 'wrong' },
    { ...project(), workstreams: [] },
    { ...project(), metadata: { nested: [{ API_KEY: 'synthetic-disallowed' }] } },
    { ...project(), workstreams: [{ ...project().workstreams[0], metadata: { token: 'synthetic-disallowed' } }] },
  ]) assert.equal(projectSchema.safeParse(candidate).success, false)
  const result = projectSchema.safeParse({ ...project(), metadata: { nested: { authorization: 'synthetic' } } })
  assert.deepEqual(result.error.issues[0].path, ['metadata', 'nested', 'authorization'])
})

test('retry policies retain accepted profiles, exact cardinality and isolated metadata', () => {
  const first = retryPolicySchema.parse(policy())
  const second = retryPolicySchema.parse(policy())
  assert.equal(first.active, true)
  assert.deepEqual(first.attempt_profiles, ['fast', 'review'])
  first.metadata.test = true
  assert.deepEqual(second.metadata, {})
  assert.equal(retryPolicySchema.safeParse({ ...policy(), max_attempts: 20, attempt_profiles: Array(20).fill('deep') }).success, true)
  for (const candidate of [
    { ...policy(), max_attempts: 0 }, { ...policy(), max_attempts: 21 },
    { ...policy(), max_attempts: 1.5 }, { ...policy(), attempt_profiles: ['fast'] },
    { ...policy(), attempt_profiles: ['fast', 'no_ai'] },
  ]) assert.equal(retryPolicySchema.safeParse(candidate).success, false)
})

test('oversized retry input is rejected before visiting collection items', () => {
  let visited = 0
  const profiles = new Proxy(Array(100_000), {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^\d+$/.test(property)) {
        visited++
        throw new Error('oversized-item-visited')
      }
      return Reflect.get(target, property, receiver)
    },
  })
  const result = retryPolicySchema.safeParse({ ...policy(), attempt_profiles: profiles })
  assert.equal(result.success, false)
  assert.equal(visited, 0)
  assert.ok(result.error.issues.some(issue => issue.code === 'too_big' && issue.path[0] === 'attempt_profiles'))
})
