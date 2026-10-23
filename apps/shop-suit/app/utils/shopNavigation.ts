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
      { to: '/quotations', label: locale === 'ar' ? 'عروض الأسعار' : 'Quotations', icon: 'invoice' },
      { to: '/orders', label: locale === 'ar' ? 'أوامر العملاء' : 'Customer orders', icon: 'invoice' },
      { to: '/sales', label: t('sales.title'), icon: 'invoice' },
    ] },
    ...(businessModeSupportsProducts(mode) ? [{ key: 'stock', label: copy.inventory, links: [
      { to: '/products', label: copy.products, icon: 'ledger' },
      { to: '/inventory', label: copy.inventory, icon: 'wallet' },
      { to: '/purchases', label: copy.purchases, icon: 'cash' },
    ] }] : []),
    { key: 'manage', label: copy.manage, links: [
      { to: '/reports', label: copy.reports, icon: 'reports' },
      { to: '/trade-pricing', label: locale === 'ar' ? 'مجموعات وأسعار العملاء' : 'Customer groups & pricing', icon: 'user' },
      { to: '/offers', label: locale === 'ar' ? 'العروض والباقات' : 'Promos & offers', icon: 'basket' },
      { to: '/website-builder', label: locale === 'ar' ? 'منشئ الموقع' : 'Website builder', icon: 'monitor' },
      { to: '/catalog-import', label: copy.catalogSetup, icon: 'ledger' },
      ...(businessModeSupportsServices(mode) ? [{ to: '/services', label: copy.services, icon: 'invoice' }] : []),
      { to: '/expenses', label: copy.expenses, icon: 'cash' },
    ] },
  ]
}

export const SHOP_SETTINGS_SECTIONS = [
  'shop-profile', 'business-mode', 'locations', 'receipt-settings', 'cash-policy',
  'public-booking-settings', 'website-inquiries', 'website-catalog', 'website-profile',
  'website-address', 'currency-settings',
] as const

export function shopSettingsNavigation(isArabic: boolean, includeBilling: boolean) {
  const labels = isArabic
    ? ['ملف المتجر', 'طريقة تشغيل النشاط', 'فروع النشاط', 'إعدادات الإيصال', 'سياسة ورديات الخزنة', 'الحجز العام', 'استفسارات الموقع', 'الكتالوج العام', 'ملف المتجر العام', 'عنوان موقع المتجر', 'عملة النشاط']
    : ['Shop profile', 'Business operation mode', 'Business locations', 'Receipt settings', 'Cashier shift policy', 'Public booking', 'Website inquiries', 'Public catalog', 'Public shop profile', 'Shop website address', 'Business currency']
  const icons = ['store', 'settings', 'store', 'invoice', 'wallet', 'invoice', 'mail', 'ledger', 'store', 'monitor', 'cash']
  return [
    { to: '/website-builder', label: isArabic ? 'منشئ الموقع' : 'Website builder', icon: 'monitor' },
    ...SHOP_SETTINGS_SECTIONS.map((section, index) => ({ to: `/settings/${section}`, label: labels[index]!, icon: icons[index]! })),
    ...(includeBilling ? [{ to: '/billing', label: shopShellCopy(isArabic).billing, icon: 'wallet' }] : []),
  ]
}
