import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]) }
test('runtime payment values have no source literals or direct target database access', () => {
  const source = [...files(`${root}app`), ...files(`${root}server`)].filter(p => /\.(ts|vue)$/.test(p)).map(p => readFileSync(p, 'utf8')).join('\n')
  assert.doesNotMatch(source, /(?:recipientAlias|recipientDetails|paymentLink|assetUrl)\s*:\s*['"][^'"]+['"]|(?:instructions|qr)\s*:\s*\{[^}]*https:\/\//)
  assert.doesNotMatch(source, /@instapay|instapay\.com|bank.verify|verify.transfer|from\s*['"][^'"]*shop-suit|SHOP_SUPABASE_SERVICE/)
  const control = readFileSync(`${root}app/composables/useManualTransfer.ts`, 'utf8')
  assert.match(control, /parseTransfer\(result.data.configuration\)/)
  assert.match(control, /command.value \|\|= transferCommand/)
  assert.match(control, /current !== generation/)
  assert.match(control, /useRecordAction/)
  const migration = readFileSync(`${root}supabase/migrations/20261007180000_manual_transfer_control.sql`, 'utf8')
  assert.doesNotMatch(migration, /insert into public\.(?:integration_settings|navigation_items)/)
  for (const value of ['before_state,after_state', 'targetAuditId', 'd.actor_user_id', "d.envelope->>'reason'", "outcome_value='success'", 'request_fingerprint']) assert.ok(migration.includes(value), value)
})
