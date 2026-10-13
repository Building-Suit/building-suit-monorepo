import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Requires GitHub Actions')
assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted', 'No self-hosted or customer environment')
assert.equal(process.env.SHOP_XPAY_DISPOSABLE, '1', 'Explicit disposable payment job required')
const sql = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_xpay_payments.sql', import.meta.url), 'utf8')
const result = spawnSync('docker', ['exec', '-i', 'supabase_db_building-suit-shop', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
  input: `BEGIN;\n${sql}\nROLLBACK;`, encoding: 'utf8', timeout: 120000,
})
if (result.status !== 0) {
  // This job has only synthetic records, but never print CLI status or credentials.
  console.error(result.stderr.slice(-6000))
  process.exitCode = 1
} else console.log('Disposable XPay SQL authority, paid activation and replay fixtures passed and rolled back')
