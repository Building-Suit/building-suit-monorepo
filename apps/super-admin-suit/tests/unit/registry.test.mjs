import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parseRegistry, selectRegistry, localized, safeAsset } from '../../app/utils/registry.ts'

const item = (key, module = 'overview') => ({ key, module, label: { en: key, ar: `ع ${key}` } })
const suit = (key, items = []) => ({ key, label: { en: key }, items })

test('multiple future Suits preserve database ordering and sanitized metadata without a product map', () => {
  const result = parseRegistry({ suits: [suit('future-suit', [item('overview')]), suit('second-suit', [item('context', 'capabilities')])] })
  assert.deepEqual(result.suits.map(row => row.key), ['future-suit', 'second-suit'])
  assert.equal(selectRegistry(result).suit.key, 'future-suit')
  assert.equal(selectRegistry(result, 'second-suit', 'context').item.module, 'capabilities')
  const changed = parseRegistry({ suits: [suit('second-suit'), { ...suit('future-suit'), label: { en: 'Renamed' } }] })
  assert.equal(selectRegistry(changed).suit.key, 'second-suit')
  assert.equal(changed.suits[1].label.en, 'Renamed')
})
test('unknown modules, malformed rows, duplicate keys and unsafe assets fail closed', () => {
  const result = parseRegistry({ suits: [{ ...suit('future-suit', [item('unknown', 'javascript'), { ...item('disabled'), enabled: false }, item('overview'), item('overview')]), asset: 'https://unsafe.invalid/logo.svg', endpoint: 'hidden' }, suit('future-suit'), { ...suit('retired-suit'), status: 'retired' }, { ...suit('disabled-suit'), enabled: false }, { key: '../../escape' }] })
  assert.equal(result.suits.length, 1)
  assert.equal(result.suits[0].items.length, 1)
  assert.equal(result.suits[0].asset, null)
  assert.equal('endpoint' in result.suits[0], false)
  assert.throws(() => parseRegistry(null))
  for (const value of ['//evil.invalid/icon.svg', '/brand/../evil.svg', 'javascript:alert(1)', '/brand/a.svg?secret=x']) assert.equal(safeAsset(value), null)
  assert.equal(safeAsset('/brand/shared/logo.svg'), '/brand/shared/logo.svg')
})
test('explicit missing, disabled, removed or malformed deep links never fall back to another Suit', () => {
  const registry = parseRegistry({ suits: [suit('allowed-suit', [item('allowed-item')])] })
  for (const [suitKey, itemKey] of [['disabled-suit', undefined], ['allowed-suit', 'removed-item'], [['allowed-suit'], undefined], [undefined, 'allowed-item'], ['', undefined]]) {
    const result = selectRegistry(registry, suitKey, itemKey)
    if (suitKey === undefined) assert.equal(result.denied, false)
    else assert.equal(result.denied, true)
  }
  assert.equal(selectRegistry({ suits: [] }).denied, false)
  assert.equal(localized({ en: 'English', ar: 'عربي' }, 'ar'), 'عربي')
  assert.equal(localized({ en: 'English' }, 'ar'), 'English')
})
test('server projection owns enabled/capability filtering, environment availability and manifest freshness', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
  const migration = read('../../supabase/migrations/20261006210000_registry_navigation.sql')
  for (const evidence of ["item.enabled", "suit.status = 'active'", "policy.enabled", "binding.admin_environment_id = administrator.authority_environment_id", "manifest.expires_at > statement_timestamp()", "manifest.verification_outcome = 'verified'", "item.required_capability_key = 'adapter.capabilities.read'", "item.required_capability_version = '1.0'", "any(policy.query_scopes)", "manifest.verified_capabilities @>", "order by suit.sort_order, suit.stable_key", "sort_order = coalesce((p_payload->>'sortOrder')::integer, sort_order)"]) assert.ok(migration.includes(evidence), evidence)
  const api = read('../../server/api/registry.get.ts')
  assert.match(api, /authorizeAdmin\(client\)/)
  assert.match(api, /private, no-store/)
  const runtime = read('../../app/layouts/default.vue') + read('../../app/pages/index.vue') + read('../../app/utils/registry.ts')
  assert.doesNotMatch(runtime, /shop-suit|Shop Suit|ledger-suit|inventory-suit|service_role|adapter_base_url/)
})
