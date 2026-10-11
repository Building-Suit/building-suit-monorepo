import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
function sources(dir) {
  return readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sources(`${dir}/${entry.name}`) : /\.(ts|vue|mjs)$/.test(entry.name) ? [`${dir}/${entry.name}`] : [])
}
test('Admin sources never import target app code or embed target connection values', () => {
  for (const path of [...sources('server'), ...sources('app')]) {
    const source = read(path)
    assert.doesNotMatch(source, /(?:from\s*|import\s*\(|require\s*\()["'][^"']*(?:shop-suit|apps\/)/, path)
    assert.doesNotMatch(source, /https:\/\/[a-z]{20}\.supabase\.co|sb_secret_[a-zA-Z0-9]+/, path)
    assert.doesNotMatch(source, /SHOP_SUPER_ADMIN_BRIDGE_KEYS|vault\.decrypted_secrets/, path)
  }
  for (const path of sources('app')) assert.doesNotMatch(read(path), /serverSupabaseServiceRole|adapter-signing|secretReferenceId/)
})
test('database signer binds immutable authorized dispatch; Vault is private and signer is server-only', () => {
  const sql = read('supabase/migrations/20261007070000_shop_adapter_dispatch.sql')
  assert.match(sql, /assert_platform_owner\(\)/)
  assert.match(sql, /super_admin_private\.adapter_configuration/)
  assert.match(sql, /vault\.decrypted_secrets/)
  assert.match(sql, /revoke all on function super_admin_private\.adapter_configuration/)
  assert.match(sql, /grant execute on function public\.super_admin_adapter_enqueue\(jsonb\) to authenticated/)
  assert.match(sql, /grant execute on function public\.super_admin_adapter_claim\(uuid\), public\.super_admin_adapter_complete\(uuid,jsonb\) to service_role/)
  assert.match(sql, /for i in 1\.\.43 loop/)
  assert.match(sql, /response_value->>'requestDigest' is distinct from d\.body_digest/)
  assert.match(sql, /verification_outcome<>'verified'/)
  assert.match(sql, /target_kind is distinct from source_kind/)
  assert.match(sql, /IDEMPOTENCY_KEY_REUSED/)
  assert.doesNotMatch(sql, /https:\/\/[a-z]{20}\.supabase\.co|sb_secret_/)
})
test('browser endpoint verifies Admin auth and returns only normalized safe errors', () => {
  const source = read('server/api/adapters/shop.post.ts')
  assert.match(source, /authorizeAdmin\(client\)/)
  assert.match(source, /private, no-store/)
  assert.match(source, /data: \{ code, requestId, correlationId \}/)
  assert.doesNotMatch(source, /statusMessage: error\.|data: error|console\./)
  assert.match(read('server/utils/adapter-transport.ts'), /rejectUnauthorized: true/)
  assert.match(read('server/utils/adapter-transport.ts'), /lookup: .*callback\(null, addresses/)
})
