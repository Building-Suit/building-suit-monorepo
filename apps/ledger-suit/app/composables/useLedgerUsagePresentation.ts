import type { BsUsageItem } from '@building-suit/contracts'
import type { QuotaKey } from '~/composables/usePlanUsage'

/** Plan thresholds, units and upgrade guidance remain Ledger policy. */
export function useLedgerUsagePresentation() {
  const { t, te, locale } = useI18n()
  const { rowFor, nextPlanFor, refresh, loading, loadError } = usePlanUsage()
  const keys: QuotaKey[] = ['max_members', 'max_monthly_transactions', 'max_storage_bytes', 'max_accounts', 'max_counterparties', 'max_recurring_rules', 'max_custom_roles']
  function planName(key: string, fallback: string) {
    const translation = `billing.plans.${key}.name`
    return te(translation) ? t(translation) : fallback
  }
  function value(amount: number | null, key: QuotaKey) {
    if (amount === null) return t('usage.unlimited')
    const number = (n: number) => new Intl.NumberFormat(locale.value === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 1 }).format(n)
    if (key !== 'max_storage_bytes') return number(amount)
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = amount
    let index = 0
    while (size >= 1024 && index < units.length - 1) { size /= 1024; index++ }
    return `${number(size)} ${t(`usage.units.${units[index]}`)}`
  }
  function item(key: QuotaKey): BsUsageItem | null {
    const row = rowFor(key)
    if (!row) return null
    const next = nextPlanFor(key)
    const percent = row.is_unlimited ? 0 : !row.limit_value ? row.is_at_limit ? 100 : 0 : row.used_value / row.limit_value * 100
    const state = percent >= 100 ? 'reached' : percent >= 95 ? 'critical' : percent >= 80 ? 'warning' : 'normal'
    const allowance = next ? t('usage.nextAllowance', { plan: planName(next.key, next.name), allowance: value(next.limit, key) }) : ''
    const price = next?.monthlyPriceMinor !== null && next?.monthlyPriceMinor !== undefined
      ? t('usage.nextPrice', { price: new Intl.NumberFormat(locale.value === 'ar' ? 'ar-EG' : 'en-US', { style: 'currency', currency: 'EGP', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(next.monthlyPriceMinor / 100) }) : ''
    return {
      id: key, label: t(`usage.quotas.${key}`),
      description: t('usage.currentPlan', { plan: planName(row.plan_key, row.plan_key) }),
      used: row.used_value, limit: row.is_unlimited ? null : row.limit_value,
      valueLabel: row.is_unlimited ? t('usage.unlimited') : t('usage.value', { used: value(row.used_value, key), limit: value(row.limit_value, key) }),
      status: row.is_unlimited ? undefined : t(`usage.states.${state}`),
      tone: state === 'reached' ? 'danger' : state === 'critical' || state === 'warning' ? 'warning' : 'neutral',
      nextAllowance: [allowance, price].filter(Boolean).join(' · ') || undefined,
      ...(next ? { action: { to: '/billing#plans', label: t('usage.viewPlans') } } : {}),
    }
  }
  const items = computed(() => keys.map(item).filter((entry): entry is BsUsageItem => entry !== null))
  onMounted(() => void refresh())
  return reactive({ item, items, refresh, loading, loadError })
}
