import { createHash } from 'node:crypto'
import { mkdir, writeFile, chmod } from 'node:fs/promises'
import { requireDisposable, validateExportShopId, sql, root } from './local-backend.mjs'

// Operator-assisted portability drill, not a browser export API or a backup.
// Keep the explicit allowlist: never export Auth, invitations, tokens, billing
// proofs, platform-admin records, or another tenant via catalog discovery.
const tables = [
  'shop_locations', 'clients', 'products', 'services', 'appointments',
  'invoices', 'payments', 'customer_payment_allocations',
  'customer_payment_adjustments', 'sale_receipts', 'sale_corrections',
  'cash_sessions', 'cash_drawer_events', 'inventory_movements', 'expenses',
]

try {
  requireDisposable()
  const shopId = validateExportShopId(process.env.SHOP_PILOT_EXPORT_SHOP_ID ?? '')
  const query = `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
    select jsonb_build_object(
      'shops', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.shops t where id = '${shopId}'),
      'invoice_items', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]')
        from public.invoice_items t join public.invoices i on i.id = t.invoice_id where i.shop_id = '${shopId}'),
      ${tables.map(table => `'${table}', (select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]') from public.${table} t where shop_id = '${shopId}')`).join(',\n')}
    );
    ROLLBACK;`
  const data = JSON.parse(sql(query))
  if (data.shops.length !== 1) throw new Error('Synthetic shop not found; no export written')
  const payload = JSON.stringify({ format: 'shop-pilot-portability-v1', shopId, exportedAt: new Date().toISOString(), data }, null, 2) + '\n'
  const directory = `${root}/.local/ss-pilot-001/exports`
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
  const filename = `${directory}/${shopId}-${Date.now()}.json`
  await writeFile(filename, payload, { mode: 0o600, flag: 'wx' })
  console.log(JSON.stringify({ export: 'written under .local/ss-pilot-001/exports',
    sha256: createHash('sha256').update(payload).digest('hex'),
    counts: Object.fromEntries(Object.entries(data).map(([table, rows]) => [table, rows.length])),
  }))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
