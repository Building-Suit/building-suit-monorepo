import { readFile } from 'node:fs/promises'
import { requireDisposable, sql, suites as pilotSuites } from '../pilot/local-backend.mjs'

// The general-shop gate adds retail and supplier coverage to the service pilot.
// Use the existing guarded local executor: no reset, migration, or hosted URL.
const suites = [...new Set([
  'shop_crm_owner_bootstrap', 'shop_crm_product_catalog',
  'shop_crm_service_catalog', 'shop_crm_inventory_adjustments',
  ...pilotSuites, 'shop_customer_management', 'shop_supplier_payables_returns',
  'shop_catalog_import', 'shop_market_reconciliation',
])]

try {
  requireDisposable()
  for (const suite of suites) {
    const source = await readFile(new URL(`../../supabase/tests/${suite}.sql`, import.meta.url), 'utf8')
    try {
      sql(`BEGIN;\n${source.replace(/\bshop_crm\b/g, 'public')}\nROLLBACK;`)
    } catch (error) {
      throw new Error(`${suite}: ${error.message} Inspect this rollback-only fixture privately on the disposable local backend. No migration/reset was attempted.`, { cause: error })
    }
    console.log(`${suite}: passed; fixtures rolled back`)
  }
  console.log(`SS-MARKET-VAL-001: ${suites.length} SQL suites passed. Browser, concurrency, manual and commercial gates remain separate.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
