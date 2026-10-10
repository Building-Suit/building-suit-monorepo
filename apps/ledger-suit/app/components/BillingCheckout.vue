<script setup lang="ts">
import type { Database, Json } from '~~/types/database.types'
import type { MarketingPricingPlan } from '@building-suit/contracts'
import type { LaunchPlanKey } from '~/composables/useBilling'

const { compact = false, surface = 'checkout' } = defineProps<{
  compact?: boolean
  surface?: 'checkout' | 'public' | 'display' | 'manage'
}>()
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

const { data: catalog, pending: catalogPending, error: catalogError, refresh } = await useAsyncData(
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
    : surface === 'public'
      ? { label: t('landing.startTrial'), to: '/signup', variant: 'primary' as const }
      : surface === 'checkout'
        ? { label: pendingPlan.value === plan.plan_key ? t('billing.openingCheckout') : t('billing.plans.choose', { plan: planName(plan) }), pending: pendingPlan.value === plan.plan_key, disabled: Boolean(pendingPlan.value), variant: 'primary' as const }
        : surface === 'manage' && launchPlanCurrent.value
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
    secondaryAction: surface === 'checkout' && plan.is_purchasable && can('billing.manage')
      ? { label: t('billing.manual.choose') }
      : undefined,
  }
}))

function choosePlan(planKey: string) {
  const plan = plans.value.find(candidate => candidate.plan_key === planKey)
  if (!plan?.is_purchasable) return
  if (surface === 'checkout') void checkout(plan.plan_key as LaunchPlanKey)
  else if (surface === 'manage') void reviewChange(plan.plan_key as LaunchPlanKey)
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

</script>

<template>
  <div :class="compact ? 'space-y-5' : 'space-y-8'" data-testid="plan-pricing">
    <section
      v-if="trialPlanCurrent && surface === 'checkout'"
      class="rounded-card border border-primary/40 bg-primary/5 p-5 text-start"
      data-testid="trial-summary"
    >
      <template v-if="accessState === 'trialing'">
        <h2 class="text-lg font-black">{{ t('billing.trial.activeTitle') }}</h2>
        <p class="mt-2 text-sm">{{ t('billing.trial.activeBenefits') }}</p>
        <p class="mt-2 text-sm text-fg-muted">{{ t('billing.trial.endsOn', { date: formatDate(subscription?.trial_ends_at) }) }}</p>
        <p class="mt-2 text-sm text-fg-muted">{{ t('billing.trial.optionalConversion') }}</p>
      </template>
      <template v-else-if="accessState === 'read_only'">
        <h2 class="text-lg font-black">{{ t('billing.trial.expiredTitle') }}</h2>
        <p class="mt-2 text-sm">{{ t('billing.trial.expiredBody', { date: formatDate(subscription?.trial_ends_at) }) }}</p>
        <p class="mt-2 text-sm font-semibold">{{ t('billing.trial.resumeWrites') }}</p>
      </template>
    </section>

    <BsButton v-if="['checkout', 'manage', 'display'].includes(surface) && can('billing.manage')" type="button" class="ls-btn" @click="manualPlan = undefined; manualOpen = true">{{ t('billing.manual.requests') }}</BsButton>
    <ManualPaymentCheckout v-if="manualOpen" :key="`${currentId}:${user?.id}`" :plan="manualPlan" :interval="interval" @close="manualOpen = false" />

    <BsMarketingPricing
      :interval="interval"
      :plans="pricingPlans"
      test-id="plan-pricing-grid"
      :interval-options="[{ value: 'monthly', label: t('billing.monthly') }, { value: 'yearly', label: t('billing.yearly') }]"
      :copy="{ cycleLabel: t('billing.billingCycle'), loading: t('billing.plans.loading'), empty: t('billing.plans.loadFailed'), retry: t('common.retry'), included: t('billing.plans.included'), notIncluded: t('billing.plans.notIncluded') }"
      :annual-saving="annualDiscount === null ? null : t('billing.plans.annualDiscount', { percent: annualDiscount })"
      :loading="catalogPending"
      :error="catalogError ? t('billing.plans.loadFailed') : null"
      @update:interval="value => { if (value === 'monthly' || value === 'yearly') interval = value }"
      @retry="refresh"
      @action="choosePlan"
      @secondary-action="chooseManualPlan"
    />

    <section
      v-if="surface === 'checkout'"
      class="ls-card-muted p-4 text-center text-sm leading-6 text-fg-muted"
      data-testid="checkout-policy-review"
      role="note"
    >
      <i18n-t keypath="billing.policyReview" tag="p" scope="global">
        <template #terms>
          <NuxtLink to="/terms" target="_blank" rel="noopener" class="font-semibold text-link underline underline-offset-4">{{ t('marketing.terms') }}</NuxtLink>
        </template>
        <template #refund>
          <NuxtLink to="/refund-cancellation" target="_blank" rel="noopener" class="font-semibold text-link underline underline-offset-4">{{ t('marketing.refundCancellation') }}</NuxtLink>
        </template>
        <template #privacy>
          <NuxtLink to="/privacy" target="_blank" rel="noopener" class="font-semibold text-link underline underline-offset-4">{{ t('marketing.privacy') }}</NuxtLink>
        </template>
      </i18n-t>
    </section>

    <section
      v-if="surface === 'checkout' || surface === 'public'"
      class="text-center text-xs font-semibold text-fg-muted"
      data-testid="payment-method-branding"
      role="note"
    >
      {{ t('billing.securePayments') }}
    </section>

    <p v-if="surface === 'checkout'" class="text-center text-xs text-fg-muted">{{ t('billing.paymentRequired') }}</p>
    <p v-if="surface === 'manage' && compatibilityPlanCurrent" class="rounded-card border border-[var(--bs-border-strong)] p-4 text-sm text-fg-muted" role="note">{{ t('billing.planChange.legacyGrandfathered') }}</p>
    <p v-if="errorMessage" class="ls-error" role="alert">{{ errorMessage }}</p>
      <BsDialog v-if="planImpact" :visible="true" :title="t('billing.planChange.title')" :aria-label="t('billing.planChange.title')" :show-header="false" size="md" @update:visible="value => { if (!value) planImpact = null }"><template #default="{ close: dismiss }">
<section class="ls-card max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6" data-testid="plan-change-impact">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 id="plan-change-title" class="text-xl font-black">{{ t('billing.planChange.title') }}</h2>
              <p class="mt-1 text-sm text-fg-muted">{{ t('billing.planChange.summary', {
                current: planNameForKey(planImpact.current_plan_key),
                target: planNameForKey(planImpact.target_plan_key),
              }) }}</p>
            </div>
            <BsButton variant="icon" type="button"  :aria-label="t('common.close')" @click="dismiss"><BsIcon name="close" :size="20" /></BsButton>
          </div>

          <div class="mt-5 rounded-card bg-surface-muted p-4 text-sm">
            <p class="font-bold">{{ t('billing.planChange.noDeletion') }}</p>
            <p class="mt-1 text-fg-muted">{{ t('billing.planChange.targetPrice', {
              price: t('billing.plans.price', { amount: formatAmount(planImpact.target_amount_minor) }),
              interval: t(`billing.${planImpact.target_interval}`),
            }) }}</p>
          </div>

          <h3 class="mt-6 font-bold">{{ t('billing.planChange.capacityTitle') }}</h3>
          <ul class="mt-3 grid gap-2 sm:grid-cols-2">
            <li v-for="quota in quotaImpacts" :key="quota.quota_key" class="rounded-card border border-[var(--bs-border)] p-3 text-sm" :data-impact-quota="quota.quota_key">
              <div class="flex items-start justify-between gap-3">
                <span class="font-semibold">{{ t(`usage.quotas.${quota.quota_key}`) }}</span>
                <span v-if="quota.will_block_new_activity" class="text-xs font-bold text-[var(--bs-status-danger)]">{{ t('billing.planChange.blocked') }}</span>
                <span v-else class="text-xs font-bold text-[var(--bs-status-success)]">{{ t('billing.planChange.available') }}</span>
              </div>
              <p class="mt-1 text-fg-muted">{{ t('billing.planChange.usageLimit', {
                used: formatQuota(quota.quota_key, quota.used_value),
                limit: formatQuota(quota.quota_key, quota.target_limit_value),
              }) }}</p>
            </li>
          </ul>

          <div v-if="gainedFeatures.length || auditHistoryIncreased" class="mt-6">
            <h3 class="font-bold">{{ t('billing.planChange.gainedTitle') }}</h3>
            <ul class="mt-2 list-disc space-y-1 ps-5 text-sm text-[var(--bs-status-success)]">
              <li v-for="feature in gainedFeatures" :key="feature.feature_key">{{ featureName(feature.feature_key) }}</li>
              <li v-if="auditHistoryIncreased">{{ t('billing.planChange.auditHistoryIncreased', { days: formatNumber(planImpact.audit_history_target_days) }) }}</li>
            </ul>
          </div>

          <div v-if="lostFeatures.length || planImpact.audit_history_reduced" class="mt-6">
            <h3 class="font-bold">{{ t('billing.planChange.lostTitle') }}</h3>
            <ul class="mt-2 list-disc space-y-1 ps-5 text-sm text-fg-muted">
              <li v-for="feature in lostFeatures" :key="feature.feature_key">{{ featureName(feature.feature_key) }}</li>
              <li v-if="planImpact.audit_history_reduced">{{ t('billing.planChange.auditHistoryReduced', { days: formatNumber(planImpact.audit_history_target_days) }) }}</li>
            </ul>
          </div>

          <div v-if="planImpact.requires_manual_handoff" class="mt-6 rounded-card border border-[var(--bs-border-strong)] p-4 text-sm" role="note">
            <p class="font-bold">{{ t('billing.planChange.handoffTitle') }}</p>
            <p class="mt-1 text-fg-muted">{{ t('billing.planChange.handoffBody') }}</p>
          </div>
          <p v-else class="mt-6 text-sm text-fg-muted">{{ t('billing.planChange.noChange') }}</p>

          <div class="mt-6 flex justify-end">
            <BsButton type="button" class="ls-btn ls-btn-primary" @click="dismiss">{{ t('common.close') }}</BsButton>
          </div>
        </section>
</template></BsDialog>
  </div>
</template>
