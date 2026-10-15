import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
const suites = await Promise.all(['shop_partial_returns.sql', 'shop_tax_calculation.sql', 'shop_tax_issuance.sql', 'shop_commissions.sql', 'shop_service_materials.sql', 'shop_commission_corrections_locations.sql', 'shop_sale_receipts.sql'].map(name => readFile(new URL('../../apps/shop-suit/supabase/tests/' + name, import.meta.url), 'utf8')))
const result = spawnSync('docker', ['exec', '-i', 'supabase_db_building-suit-shop', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'], { input: suites.map(sql => `BEGIN;\n${sql}\nROLLBACK;`).join('\n'), encoding: 'utf8' })
if (result.status !== 0) { console.error(result.stderr || result.error); process.exitCode = 1 }
else console.log('Partial returns, tax, service, receipts and commission SQL regressions passed; fixtures rolled back')
