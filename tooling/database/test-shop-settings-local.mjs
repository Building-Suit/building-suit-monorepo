import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
// Fixed disposable local target. Hosted URLs/refs/credentials are never accepted.
for (const suite of ['shop_profile_settings', 'shop_sale_receipts', 'shop_document_settings', 'shop_business_currency']) {
  const sql = await readFile(new URL(`../../apps/shop-suit/supabase/tests/${suite}.sql`, import.meta.url), 'utf8')
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_building-suit-shop', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: `BEGIN;\n${sql}\nROLLBACK;`, encoding: 'utf8' })
  if (result.status !== 0) { console.error(`${suite}: failed\n${result.stderr || result.error}`); process.exit(1) }
  console.log(`${suite}: passed; fixtures rolled back`)
}

if (process.env.ACCOUNT_PROVISION_DISPOSABLE === '1') {
  const result = spawnSync(process.execPath, [new URL('./test-shop-currency-concurrency.mjs', import.meta.url).pathname], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
