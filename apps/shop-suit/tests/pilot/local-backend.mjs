import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const root = fileURLToPath(new URL('../../../../', import.meta.url))
export const container = 'supabase_db_building-suit-shop'
export const apiUrl = 'http://127.0.0.1:61321'

export function requireDisposable() {
  if (process.env.SHOP_PILOT_DISPOSABLE !== '1') {
    throw new Error('Set SHOP_PILOT_DISPOSABLE=1 only for the synthetic, disposable local Shop backend. No hosted target is supported.')
  }
}

export function validateExportShopId(shopId) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(shopId)) throw new Error('SHOP_PILOT_EXPORT_SHOP_ID must identify one synthetic local shop')
  return shopId
}

export function localCommand(command, args, input) {
  const result = spawnSync(command, args, {
    cwd: root, input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, DOCKER_HOST: 'unix:///var/run/docker.sock', DOCKER_CONTEXT: 'default' },
  })
  // Never echo command input, environment, or provider output: it can include
  // passwords, JWTs, SQL fixtures, or local status credentials.
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.error?.code ?? 'unknown'}); check local tooling/access privately.`)
  return result.stdout.trim()
}

export function sql(statement, database = 'postgres', role = 'postgres') {
  requireDisposable()
  if (database !== 'postgres' && !/^ss_pilot_restore_[a-f0-9]{32}$/.test(database)) throw new Error('Invalid disposable database name')
  if (!['postgres', 'supabase_admin'].includes(role)) throw new Error('Invalid local database role')
  return localCommand('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', role, '-d', database, '-v', 'ON_ERROR_STOP=1'], statement)
}

export function localStatus() {
  requireDisposable()
  const status = JSON.parse(localCommand('pnpm', ['exec', 'supabase', '--workdir', 'apps/shop-suit', 'status', '-o', 'json']))
  if (status.API_URL !== apiUrl || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
    throw new Error('Expected the fixed local Shop API and local credentials; refusing another backend')
  }
  return status
}

// Receipts/reports are deliberately included; they are not in the older default
// runner. Every fixture executes as its own rollback-only transaction.
export const suites = [
  'shop_business_mode', 'shop_public_privileges', 'shop_safe_supported_commands',
  'shop_locations', 'shop_team_management', 'shop_barber_service_scheduling',
  'shop_appointments', 'shop_sale_issuance', 'shop_customer_payments',
  'shop_crm_supplier_purchases', 'shop_crm_expense_ledger',
  'shop_stock_counts_corrections', 'shop_pos_checkout', 'shop_cash_shifts',
  'shop_sale_receipts', 'shop_sale_corrections', 'shop_operating_reports',
  'shop_billing', 'shop_platform_admin',
]
