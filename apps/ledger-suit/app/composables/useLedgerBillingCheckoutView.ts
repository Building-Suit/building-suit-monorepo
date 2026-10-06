import type { Database, Json } from '~~/types/database.types'
import type { MarketingPricingPlan } from '@building-suit/contracts'
import type { LaunchPlanKey } from '~/composables/useBilling'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerBillingCheckoutView(_values: {
  compact?: boolean
  surface?: 'checkout' | 'public' | 'display' | 'manage'
}, _emit: (event: string, ...args: unknown[]) => void) {
const _props = new Proxy(_values, { get: (target, key) => Reflect.get(target, key) ?? Reflect.get({compact: false,surface: 'checkout'}, key) })
const compact = computed(() => _props.compact)
const surface = computed(() => _props.surface ?? 'checkout')
const supabase = useSupabaseClient<Database>()
const { currentId, can } = useTenant()
const user = useSupabaseUser()
const manualOpen = ref(false)
const manualPlan = ref<LaunchPlanKey>()
watch([currentId, user], () => { manualOpen.value = false; manualPlan.value = undefined })
const { rows: usageRows } = usePlanUsage()
const { createCheckoutSession, accessState, subscription } = useBilling()
const { t, te, locale } = useI18n()
const interval = ref<'monthly' | 'yearly'>('monthly')
const pendingPlan = ref<LaunchPlanKey | null>(null)
const reviewingPlan = ref<LaunchPlanKey | null>(null)
const errorMessage = ref('')
const describeError = useErrorMessage()

type CatalogPlan = Database['public']['Functions']['subscription_plan_catalog']['Returns'][number]
type JsonObject = Record<string, Json | undefined>
interface PlanChangeImpact {
  current_plan_key: string
  current_interval: Database['public']['Enums']['billing_interval'] | null
  target_plan_key: string
  target_interval: Database['public']['Enums']['billing_interval']
  target_amount_minor: number
  change_direction: string
  provider_change_supported: boolean
  requires_manual_handoff: boolean
  would_block_new_activity: boolean
  audit_history_current_days: number | null
  audit_history_target_days: number
  audit_history_reduced: boolean
  quota_impacts: unknown
  feature_impacts: unknown
}
interface QuotaImpact {
  quota_key: string
  used_value: number
  current_limit_value: number | null
  target_limit_value: number | null
  is_over_target: boolean
  will_block_new_activity: boolean
}
interface FeatureImpact {
  feature_key: string
  current_enabled: boolean
  target_enabled: boolean
  will_gain: boolean
  will_lose: boolean
}

const { data: catalog, pending: catalogPending, error: catalogError, refresh } = useAsyncData(
  'launch-plan-catalog',
  async () => {
    const { data, error } = await supabase.rpc('subscription_plan_catalog')
    if (error) throw error
    return data
  },
)

// The RPC already exposes only active public plans in authoritative display
// order. Do not recreate a second client-side catalog allowlist here.
const plans = computed(() => catalog.value ?? [])
const planImpact = ref<PlanChangeImpact | null>(null)
const currentPlanKey = computed(() => usageRows.value[0]?.plan_key ?? null)
const currentPlanKind = computed(() => {
  if (currentPlanKey.value === null) return null
  if (currentPlanKey.value === 'trial') return 'trial'
  if (plans.value.some(plan => plan.plan_key === currentPlanKey.value && plan.is_purchasable)) return 'launch'
  if (currentPlanKey.value === 'ledger_suit' || currentPlanKey.value.startsWith('legacy_')) return 'compatibility'
  return 'unknown'
})
const trialPlanCurrent = computed(() => currentPlanKind.value === 'trial')
const launchPlanCurrent = computed(() => currentPlanKind.value === 'launch')
const compatibilityPlanCurrent = computed(() => currentPlanKind.value === 'compatibility')

function object(value: Json | undefined): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

function priceAmount(plan: CatalogPlan, billingInterval: 'monthly' | 'yearly'): number | null {
  const price = object(object(plan.prices)[billingInterval])
  return typeof price.amount_minor === 'number' ? price.amount_minor : null
}

function amount(plan: CatalogPlan): number | null {
  return priceAmount(plan, interval.value)
}

function yearlyOriginalAmount(plan: CatalogPlan): number | null {
  const monthly = priceAmount(plan, 'monthly')
  return monthly === null ? null : monthly * 12
}

function yearlyMonthlyAmount(plan: CatalogPlan): number | null {
  const yearly = priceAmount(plan, 'yearly')
  return yearly === null ? null : yearly / 12
}

function yearlyDiscount(plan: CatalogPlan): number | null {
  const original = yearlyOriginalAmount(plan)
  const yearly = priceAmount(plan, 'yearly')
  return original && yearly !== null ? Math.round((1 - yearly / original) * 100) : null
}

const annualDiscount = computed(() => {
  const discounts = plans.value
    .filter(plan => plan.is_purchasable)
    .map(yearlyDiscount)
    .filter((discount): discount is number => discount !== null)
  const unique = [...new Set(discounts)]
  return unique.length === 1 ? unique[0] : null
})

function planName(plan: CatalogPlan): string {
  const key = `billing.plans.${plan.plan_key}.name`
  return locale.value === 'ar' && te(key) ? t(key) : plan.name
}

function planDescription(plan: CatalogPlan): string {
  const key = `billing.plans.${plan.plan_key}.description`
  return locale.value === 'ar' && te(key) ? t(key) : plan.description
}

function planNameForKey(key: string): string {
  const plan = plans.value.find(candidate => candidate.plan_key === key)
  if (plan) return planName(plan)
  const translation = `billing.plans.${key}.name`
  return te(translation) ? t(translation) : key
}

function formatAmount(amountMinor: number): string {
  return new Intl.NumberFormat(locale.value === 'ar' ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100)
}

function formatDate(value: string | null | undefined): string {
  return value
    ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'long' }).format(new Date(value))
    : '—'
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(locale.value === 'ar' ? 'ar-EG' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(value)
}

function formatBytes(value: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const
  let amount = value
  let index = 0
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024
    index++
  }
  return `${formatNumber(amount)} ${t(`usage.units.${units[index]}`)}`
}

function formatQuota(quotaKey: string, value: number | null): string {
  if (value === null) return t('usage.unlimited')
  return quotaKey === 'max_storage_bytes' ? formatBytes(value) : formatNumber(value)
}

const quotaImpacts = computed<QuotaImpact[]>(() => {
  const value: unknown = planImpact.value?.quota_impacts
  return Array.isArray(value) ? value as QuotaImpact[] : []
})
const lostFeatures = computed<FeatureImpact[]>(() => {
  const value: unknown = planImpact.value?.feature_impacts
  return Array.isArray(value) ? (value as FeatureImpact[]).filter(feature => feature.will_lose) : []
})
const gainedFeatures = computed<FeatureImpact[]>(() => {
  const value: unknown = planImpact.value?.feature_impacts
  return Array.isArray(value) ? (value as FeatureImpact[]).filter(feature => feature.will_gain) : []
})
const auditHistoryIncreased = computed(() => planImpact.value?.audit_history_current_days !== null
  && planImpact.value?.audit_history_current_days !== undefined
  && planImpact.value.audit_history_target_days > planImpact.value.audit_history_current_days)

function featureName(key: string): string {
  const translationKey = key === 'multi_currency' ? 'multiCurrency' : key === 'priority_support' ? 'prioritySupport' : key
  return t(`billing.plans.features.${translationKey}`)
}

function limit(plan: CatalogPlan, key: string): number | null {
  const entitlement = object(object(plan.entitlements)[key])
  return typeof entitlement.limit_value === 'number' ? entitlement.limit_value : null
}

function included(plan: CatalogPlan, key: string): boolean {
  return object(object(plan.entitlements)[key]).is_enabled === true
}

function featureRows(plan: CatalogPlan) {
  if (plan.plan_key === 'scale') return []
  return [
    { key: 'members', included: true, text: t('billing.plans.features.members', { count: limit(plan, 'max_members') }) },
    { key: 'transactions', included: true, text: t('billing.plans.features.transactions', { count: limit(plan, 'max_monthly_transactions') }) },
    { key: 'reports', included: included(plan, 'core_reports'), text: t('billing.plans.features.reports') },
    { key: 'imports', included: included(plan, 'imports'), text: t('billing.plans.features.imports') },
    { key: 'multiCurrency', included: included(plan, 'multi_currency'), text: t('billing.plans.features.multiCurrency') },
  ]
}

const pricingPlans = computed<MarketingPricingPlan[]>(() => plans.value.map((plan) => {
  const currentAmount = amount(plan)
  const action = !plan.is_purchasable
    ? { label: t('billing.plans.comingSoon'), disabled: true }
    : surface.value === 'public'
      ? { label: t('landing.startTrial'), to: '/signup', variant: 'primary' as const }
      : surface.value === 'checkout'
        ? { label: pendingPlan.value === plan.plan_key ? t('billing.openingCheckout') : t('billing.plans.choose', { plan: planName(plan) }), pending: pendingPlan.value === plan.plan_key, disabled: Boolean(pendingPlan.value), variant: 'primary' as const }
        : surface.value === 'manage' && launchPlanCurrent.value
          ? { label: reviewingPlan.value === plan.plan_key ? t('billing.planChange.reviewing') : t('billing.planChange.review', { plan: planName(plan) }), pending: reviewingPlan.value === plan.plan_key, disabled: Boolean(reviewingPlan.value) }
          : undefined
  return {
    id: plan.plan_key,
    name: planName(plan),
    description: planDescription(plan),
    badge: plan.plan_key === 'starter' ? t('billing.plans.mostPopular') : !plan.is_purchasable ? t('billing.plans.comingSoon') : undefined,
    badgeTone: plan.plan_key === 'starter' ? 'featured' : 'muted',
    promoted: plan.plan_key === 'starter',
    unavailable: !plan.is_purchasable,
    originalPrice: interval.value === 'yearly' && currentAmount !== null ? t('billing.plans.price', { amount: formatAmount(yearlyOriginalAmount(plan) ?? 0) }) : undefined,
    discount: interval.value === 'yearly' && currentAmount !== null ? t('billing.plans.discount', { percent: yearlyDiscount(plan) }) : undefined,
    price: currentAmount === null ? undefined : t('billing.plans.price', { amount: formatAmount(currentAmount) }),
    priceNote: currentAmount === null ? undefined : interval.value === 'yearly'
      ? t('billing.plans.yearlyEquivalent', {
          monthlyPrice: t('billing.plans.price', { amount: formatAmount(yearlyMonthlyAmount(plan) ?? 0) }),
          yearlyPrice: t('billing.plans.price', { amount: formatAmount(currentAmount) }),
        })
      : t('billing.plans.perMonth'),
    pricingUnavailable: currentAmount === null ? t('billing.plans.pricingComingSoon') : undefined,
    features: featureRows(plan),
    featureFallback: featureRows(plan).length ? undefined : t('billing.plans.scale.preview'),
    action,
    secondaryAction: surface.value === 'checkout' && plan.is_purchasable && can('billing.manage')
      ? { label: t('billing.manual.choose') }
      : undefined,
  }
}))

function choosePlan(planKey: string) {
  const plan = plans.value.find(candidate => candidate.plan_key === planKey)
  if (!plan?.is_purchasable) return
  if (surface.value === 'checkout') void checkout(plan.plan_key as LaunchPlanKey)
  else if (surface.value === 'manage') void reviewChange(plan.plan_key as LaunchPlanKey)
}

function chooseManualPlan(planKey: string) {
  manualPlan.value = planKey as LaunchPlanKey
  manualOpen.value = true
}

async function checkout(planKey: LaunchPlanKey) {
  if (!currentId.value || pendingPlan.value) return
  pendingPlan.value = planKey
  errorMessage.value = ''
  try {
    const url = await createCheckoutSession(currentId.value, planKey, interval.value, t('billing.checkoutFailed'))
    window.location.assign(url)
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('billing.checkoutFailed')
  }
  finally {
    pendingPlan.value = null
  }
}

async function reviewChange(planKey: LaunchPlanKey) {
  if (!currentId.value || reviewingPlan.value) return
  reviewingPlan.value = planKey
  errorMessage.value = ''
  try {
    const { data, error } = await supabase.rpc('plan_change_impact', {
      p_organization_id: currentId.value,
      p_target_plan_key: planKey,
      p_target_interval: interval.value,
    }).single()
    if (error) throw error
    planImpact.value = data as PlanChangeImpact
  }
  catch (error) {
    errorMessage.value = describeError(error)
  }
  finally {
    reviewingPlan.value = null
  }
}
return { supabase, currentId, can, user, manualOpen, manualPlan, usageRows, createCheckoutSession, accessState, subscription, t, te, locale, interval, pendingPlan, reviewingPlan, errorMessage, describeError, catalog, catalogPending, catalogError, refresh, plans, planImpact, currentPlanKey, currentPlanKind, trialPlanCurrent, launchPlanCurrent, compatibilityPlanCurrent, object, priceAmount, amount, yearlyOriginalAmount, yearlyMonthlyAmount, yearlyDiscount, annualDiscount, planName, planDescription, planNameForKey, formatAmount, formatDate, formatNumber, formatBytes, formatQuota, quotaImpacts, lostFeatures, gainedFeatures, auditHistoryIncreased, featureName, limit, included, featureRows, pricingPlans, choosePlan, chooseManualPlan, checkout, reviewChange, compact, surface }
}
