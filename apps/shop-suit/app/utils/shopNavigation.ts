import { businessModeSupportsProducts, businessModeSupportsServices } from './businessMode'
import type { BusinessMode } from './businessMode'

// Canonical menu names and order for the shell and permission presentation.
export const shopShellCopy = (isArabic: boolean) => isArabic
  ? { dashboard: 'التقارير ونظرة عامة', daily: 'العمل اليومي', manage: 'إدارة النشاط', pos: 'نقطة البيع', cashShifts: 'ورديات الخزنة', invoices: 'الفواتير', products: 'المنتجات', catalogSetup: 'إعداد الكتالوج والاستيراد', services: 'الخدمات', appointments: 'التقويم والمواعيد', inventory: 'المخزون', purchases: 'المشتريات', expenses: 'المصروفات', settings: 'إعدادات النشاط', billing: 'الاشتراك والفوترة', team: 'الفريق', reports: 'التقارير', soon: 'قريبًا', shop: 'المتجر', location: 'الفرع', account: 'الحساب', logout: 'تسجيل الخروج', openMenu: 'فتح القائمة', collapseMenu: 'طي القائمة', closeMenu: 'إغلاق القائمة', loadFailed: 'تعذّر تحميل بيانات المتجر. حاول مرة أخرى.', retry: 'إعادة المحاولة', loading: 'جاري تحميل المتجر…', signOutFailed: 'تعذّر تسجيل الخروج. حاول مرة أخرى.' }
  : { dashboard: 'Reports & overview', daily: 'Daily work', manage: 'Business management', pos: 'Point of sale', cashShifts: 'Cashier shifts', invoices: 'Invoices', products: 'Products', catalogSetup: 'Catalog setup & import', services: 'Services', appointments: 'Calendar & appointments', inventory: 'Inventory', purchases: 'Purchases', expenses: 'Expenses', settings: 'Business settings', billing: 'Subscription & billing', team: 'Team', reports: 'Reports', soon: 'Soon', shop: 'Shop', location: 'Location', account: 'Account', logout: 'Sign out', openMenu: 'Open menu', collapseMenu: 'Collapse sidebar', closeMenu: 'Close menu', loadFailed: 'Unable to load shop data. Please try again.', retry: 'Retry', loading: 'Loading shop…', signOutFailed: 'Could not sign out. Please try again.' }

export function shopNavigation(mode: BusinessMode, locale: string, t: (key: string) => string) {
  const copy = shopShellCopy(locale === 'ar')
  return [
    { key: 'daily', label: copy.daily, links: [
      ...(businessModeSupportsServices(mode) ? [{ to: '/appointments', label: copy.appointments, icon: 'invoice' }] : []),
      { to: '/pos', label: copy.pos, icon: 'cash' },
      { to: '/customers', label: t('customers.title'), icon: 'user' },
      { to: '/team', label: copy.team, icon: 'user' },
      { to: '/service-materials', label: locale === 'ar' ? 'وصفات الخدمات' : 'Service recipes', icon: 'settings' },
      { to: '/eta', label: locale === 'ar' ? 'الربط بالضرائب' : 'ETA submission', icon: 'settings' },
      { to: '/taxes', label: locale === 'ar' ? 'الضرائب' : 'Taxes', icon: 'settings' },
      { to: '/commissions', label: locale === 'ar' ? 'العمولات' : 'Commissions', icon: 'wallet' },
      { to: '/cash-shifts', label: copy.cashShifts, icon: 'wallet' },
      { to: '/sales', label: t('sales.title'), icon: 'invoice' },
    ] },
    ...(businessModeSupportsProducts(mode) ? [{ key: 'stock', label: copy.inventory, links: [
      { to: '/products', label: copy.products, icon: 'ledger' },
      { to: '/inventory', label: copy.inventory, icon: 'wallet' },
      { to: '/purchases', label: copy.purchases, icon: 'cash' },
    ] }] : []),
    { key: 'manage', label: copy.manage, links: [
      { to: '/reports', label: copy.reports, icon: 'reports' },
      { to: '/catalog-import', label: copy.catalogSetup, icon: 'ledger' },
      ...(businessModeSupportsServices(mode) ? [{ to: '/services', label: copy.services, icon: 'invoice' }] : []),
      { to: '/expenses', label: copy.expenses, icon: 'cash' },
      { to: '/billing', label: copy.billing, icon: 'wallet' },
      { to: '/settings', label: copy.settings, icon: 'settings' },
    ] },
  ]
}
