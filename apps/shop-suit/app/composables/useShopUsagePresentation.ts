import type { BsUsageItem } from '@building-suit/contracts'
import type { PlanResourceKey, PlanUsageResource } from '~/types/plans'
/** Shop owns thresholds and copy; the shared meter renders the resulting data. */
export function useShopUsagePresentation() {
  const { locale } = useI18n()
  const isArabic = computed(() => locale.value === 'ar')
  const labels = computed<Record<PlanResourceKey, string>>(() => isArabic.value ? {
    active_locations: 'الفروع النشطة', active_members: 'أعضاء الفريق',
    active_products: 'المنتجات النشطة', active_services: 'الخدمات النشطة',
    active_customers: 'العملاء النشطون', active_suppliers: 'الموردون النشطون',
  } : {
    active_locations: 'Active locations', active_members: 'Team members',
    active_products: 'Active products', active_services: 'Active services',
    active_customers: 'Active customers', active_suppliers: 'Active suppliers',
  })

  return (usage: PlanUsageResource): BsUsageItem => {
    const ratio = usage.limit == null || usage.limit <= 0
      ? 0 : Math.min(100, Math.round((usage.used / usage.limit) * 100))
    const state = usage.overLimit ? 'over' : usage.atLimit ? 'full' : ratio >= 80 ? 'near' : 'available'
    const status = isArabic.value
      ? { over: 'أعلى من الحد', full: 'اكتمل الحد', near: 'قريب من الحد', available: 'متاح' }[state]
      : { over: 'Over limit', full: 'Limit reached', near: 'Near limit', available: 'Available' }[state]
    const format = new Intl.NumberFormat(locale.value)
    const valueLabel = usage.unlimited
      ? `${format.format(usage.used)} · ${isArabic.value ? 'غير محدود' : 'Unlimited'}`
      : `${format.format(usage.used)} / ${format.format(usage.limit ?? 0)}`
    return { id: usage.resource, label: labels.value[usage.resource], used: usage.used,
      limit: usage.unlimited ? null : usage.limit, valueLabel, status,
      tone: state === 'available' ? 'neutral' : 'warning' }
  }
}
