import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
// Fixed local container: this runner cannot take a hosted connection/ref.
const args = ['exec', '-i', 'supabase_db_building-suit-shop', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
const suites = ['shop_crm_owner_bootstrap', 'shop_crm_product_catalog', 'shop_crm_inventory_adjustments', 'shop_crm_service_catalog', 'shop_crm_expense_ledger', 'shop_crm_supplier_purchases', 'shop_business_mode', 'shop_public_privileges', 'shop_safe_supported_commands']
for (const suite of suites) {
  const sql = await readFile(new URL(`../../apps/shop-suit/supabase/tests/${suite}.sql`, import.meta.url), 'utf8')
  const result = spawnSync('docker', args, { input: `BEGIN;\n${sql.replace(/\bshop_crm\b/g, 'public')}\nROLLBACK;`, encoding: 'utf8' })
  if (result.status !== 0) { console.error(`${suite}: failed\n${result.stderr || result.error}`); process.exit(1) }
  console.log(`${suite}: passed; fixtures rolled back`)
}
