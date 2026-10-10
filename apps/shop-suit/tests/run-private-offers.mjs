import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

// Fixed disposable local Shop container; no hosted URL/ref input is accepted.
for (const suite of ['shop_super_admin_bridge', 'shop_private_offers']) {
  const sql = readFileSync(new URL(`../supabase/tests/${suite}.sql`, import.meta.url), 'utf8')
  const result = spawnSync('docker', [
    'exec', '-i', 'supabase_db_building-suit-shop', 'psql', '-U', 'postgres',
    '-d', 'postgres', '-v', 'ON_ERROR_STOP=1',
  ], { input: `BEGIN;\n${sql}\nROLLBACK;`, encoding: 'utf8' })
  if (result.status !== 0) {
    console.error(`${suite}: failed\n${result.stderr || result.error}`)
    process.exit(1)
  }
  console.log(`${suite}: passed; fixtures rolled back`)
}
