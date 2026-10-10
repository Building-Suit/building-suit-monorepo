import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { assertLocalCommands } from '../run-launch-qualification.mjs'
import test from 'node:test'

const matrix = JSON.parse(readFileSync(new URL('../launch-qualification.json', import.meta.url)))

test('qualification commands stay local and do not deploy or mutate providers', () => {
  for (const c of matrix.commands) {
    assert.ok(['node', 'pnpm', 'git'].includes(c.program))
    assert.ok(!c.args.some(a => /^(?:push|deploy|link|reset|--linked|--project-ref|--db-url)$/.test(a)), c.name)
    assert.ok(!c.args.some(a => /https:\/\//.test(a)), c.name)
    if (c.args.includes('supabase')) assert.ok(c.args.includes('--local'), c.name)
  }
})

test('local results cannot promote external or independent verification status', () => {
  assert.ok(matrix.external_gates.length >= 5)
  for (const r of matrix.requirements) {
    assert.equal(r.independently_verified, 'pending control-plane verification')
    for (const key of ['provider_configured', 'deployed', 'production_smoke_tested']) assert.equal(r[key], 'unverified')
  }
  assert.ok(matrix.excluded.includes('Egypt ETA'))
  assert.ok(matrix.excluded.includes('Offline operation'))
  assert.ok(!matrix.commands.some(c => c.args.some(a => /run-private-offers/.test(a))))
})

test('runner rejects provider mutation and hosted targets before execution', () => {
  assert.doesNotThrow(() => assertLocalCommands(matrix.commands))
  for (const args of [['exec', 'supabase', 'db', 'push'], ['exec', 'supabase', 'test', 'db'], ['exec', 'supabase', 'test', 'db', '--local', '--db-url'], ['deploy'], ['exec', 'playwright', 'test', 'https://example.com']]) {
    assert.throws(() => assertLocalCommands([{ name: 'unsafe', program: 'pnpm', args }]), /Non-local qualification/)
  }
})
