import test from 'node:test'
import assert from 'node:assert/strict'
import { futureSuit, futureRegistry } from './fixtures/future-suit.ts'
import { administrationCapabilitySupported, administrationShellRegistration } from '../../ux/src/administration.ts'

const reference = { kind: 'read', id: 'overview', version: 1 }
test('future Suit registers identity, navigation and adapters without shell changes', async () => {
  const view = administrationShellRegistration(futureRegistry, 'future-suit')
  assert.equal(view.suits[0].icon, 'layers')
  assert.equal(view.suits[1].logo, '/brand/second.svg')
  assert.deepEqual(view.groups[0].items.map(item => [item.id, !!item.disabled]), [['overview', false], ['archive', true]])
  const context = { environment: 'test', portal: 'future-suit', userId: 'u', tenantId: 't', signal: new AbortController().signal }
  assert.equal(administrationCapabilitySupported(futureSuit, reference), true)
  assert.deepEqual(await futureSuit.adapters.read.overview.execute({ limit: 7 }, context), { total: 7 })
  assert.deepEqual(administrationShellRegistration([futureSuit], 'unknown').groups, [])
})
test('missing, disabled, mismatched and prototype capabilities fail closed', () => {
  for (const version of [0, 2, 1.5]) assert.equal(administrationCapabilitySupported(futureSuit, { ...reference, version }), false)
  assert.equal(administrationCapabilitySupported(futureSuit, { ...reference, id: 'toString' }), false)
  for (const change of [
    { capabilities: { read: {}, command: {} } },
    { adapters: { read: {}, command: {} } },
    { contractVersion: 2 },
    { identity: { ...futureSuit.identity, disabled: true } },
    { adapters: { ...futureSuit.adapters, read: { overview: { version: 2, execute: async () => ({}) } } } },
  ]) assert.equal(administrationCapabilitySupported({ ...futureSuit, ...change }, reference), false)
  assert.throws(() => administrationShellRegistration([futureSuit, futureSuit], 'future-suit'), /unique/)
  const duplicate = { ...futureSuit, navigation: [{ id: 'g', label: 'G', items: [{ id: 'x', label: 'X' }, { id: 'x', label: 'X' }] }] }
  assert.throws(() => administrationShellRegistration([duplicate], 'future-suit'), /unique/)
})
