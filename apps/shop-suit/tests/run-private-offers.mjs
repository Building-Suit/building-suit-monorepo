import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

// Only the standard local backend or this isolated dependency-test database.
const container = process.env.SHOP_PRIVATE_OFFER_TEST_CONTAINER || 'supabase_db_building-suit-shop'
if (!['supabase_db_building-suit-shop', 'supabase_db_building-suit-shop-sas-contract'].includes(container)) throw new Error('Unapproved private-offer test target')
for (const suite of ['shop_super_admin_bridge', 'shop_private_offers']) {
  const sql = readFileSync(new URL(`../supabase/tests/${suite}.sql`, import.meta.url), 'utf8')
  const result = spawnSync('docker', [
    'exec', '-i', container, 'psql', '-U', 'postgres',
    '-d', 'postgres', '-v', 'ON_ERROR_STOP=1',
  ], { input: `BEGIN;\n${sql}\nROLLBACK;`, encoding: 'utf8' })
  if (result.status !== 0) {
    console.error(`${suite}: failed\n${result.stderr || result.error}`)
    process.exit(1)
  }
  console.log(`${suite}: passed; fixtures rolled back`)
}
