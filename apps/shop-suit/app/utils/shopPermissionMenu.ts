import { shopNavigation } from './shopNavigation'

// Presentation only: these are existing backend keys, never route capabilities.
// A shared grant appears on each page that uses it; toggling any occurrence edits
// the same key through the shared UX controller. No new authority is introduced.
export const SHOP_PAGE_PERMISSIONS: Record<string, readonly string[]> = {
  '/appointments': ['appointments.view', 'appointments.manage', 'appointments.schedule.manage'],
  '/pos': ['sales.issue', 'payments.receive', 'discounts.manage'],
  '/customers': ['clients.view', 'clients.manage', 'payments.view', 'payments.receive', 'payments.reverse', 'payments.refund'],
  '/team': ['team.view', 'team.manage', 'team.permissions.manage', 'team.audit.view'],
  '/service-materials': ['team.manage', 'sales.manage'],
  '/eta': ['settings.manage', 'sales.manage'],
  '/taxes': ['settings.manage'],
  '/commissions': ['team.manage', 'sales.manage'],
  '/cash-shifts': ['cash_shifts.use', 'cash_shifts.manage', 'cash_shifts.adjust'],
  '/quotations': ['sales.view', 'sales.manage', 'sales.issue'],
  '/orders': ['sales.view', 'sales.manage', 'sales.issue'],
  '/sales': ['sales.view', 'sales.manage', 'sales.issue', 'payments.view', 'payments.receive', 'payments.reverse', 'payments.refund'],
  '/products': ['products.view', 'products.manage'],
  '/inventory': ['inventory.view', 'inventory.manage', 'inventory.adjust'],
  '/purchase-orders': ['vendors.view', 'vendor_invoices.view', 'vendor_invoices.manage', 'products.view'],
  '/purchases': ['vendors.view', 'vendors.manage', 'vendor_invoices.view', 'vendor_invoices.manage', 'supplier_payments.record', 'supplier_payments.reverse', 'supplier_credits.manage', 'purchase_returns.manage'],
  '/reports': ['reports.view', 'reports.cost_profit.view'],
  '/trade-pricing': ['clients.view', 'clients.manage', 'products.manage'],
  '/offers': ['sales.manage', 'settings.manage'],
  '/website-builder': ['settings.manage'],
  '/catalog-import': ['products.view', 'products.manage', 'services.view', 'services.manage', 'clients.manage', 'vendors.manage', 'reports.view'],
  '/services': ['services.view', 'services.manage'],
  '/expenses': ['expenses.view', 'expenses.manage'],
  // Billing is owner-only, with no assignable permission. Keep the menu entry in
  // the canonical mapping without manufacturing a grant or weakening that rule.
  '/billing': [],
  '/settings': ['settings.manage'],
}

export function shopPermissionMenu(
  keys: readonly string[], grantableKeys: readonly string[], locale: string,
  t: (key: string) => string, label: (key: string) => string,
) {
  const available = new Set(keys)
  const grantable = new Set(grantableKeys)
  const assigned = new Set<string>()
  // Show the complete permission catalog even when this shop's business mode
  // hides navigation. Changing modes must never silently discard saved grants.
  const rows = shopNavigation('mixed', locale, t).flatMap(group => group.links.flatMap(page =>
    (SHOP_PAGE_PERMISSIONS[page.to] ?? []).filter(key => available.has(key)).map(key => {
      assigned.add(key)
      return { key, label: label(key), disabled: !grantable.has(key), section: page.to, sectionLabel: `${group.label} / ${page.label}` }
    }),
  ))
  // Retain legacy and future backend capabilities rather than losing them when
  // the backend catalog grows before its menu mapping is updated.
  return [...rows, ...[...available].filter(key => !assigned.has(key)).map(key => ({
    key, label: label(key), disabled: !grantable.has(key), section: 'additional',
    sectionLabel: locale === 'ar' ? 'صلاحيات إضافية ومشتركة' : 'Additional & shared capabilities',
  }))]
}
