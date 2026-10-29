<script setup lang="ts">
import { useLedgerBillingPresentation } from '~/composables/useLedgerBillingPresentation'
const { t, te, locale } = useI18n()
const { accessState, subscription } = useBilling()
const { rows: usageRows, catalog } = usePlanUsage()

useHead({ title: () => `${t('billing.title')} · ${t('app.name')}` })

function displayDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value)) : '—'
}

const renewalDate = computed(() => accessState.value === 'trialing'
  ? subscription.value?.trial_ends_at
  : subscription.value?.current_period_end)
const checkoutEnabled = computed(() => ['trialing', 'checkout_required', 'read_only'].includes(accessState.value))
const pricingSurface = computed(() => checkoutEnabled.value
  ? 'checkout' as const
  : ['active', 'grace_period'].includes(accessState.value)
    ? 'manage' as const
    : 'display' as const)
const currentPlanKey = computed(() => usageRows.value[0]?.plan_key ?? null)
const currentPlanName = computed(() => {
  const key = currentPlanKey.value
  if (!key) return t('billing.singlePlan')
  const translation = `billing.plans.${key}.name`
  const catalogName = catalog.value.find(plan => plan.plan_key === key)?.name
  return locale.value === 'ar' && te(translation) ? t(translation) : catalogName ?? (te(translation) ? t(translation) : key)
})

// Entitlement loading remains owned by the global middleware.
const billing = useLedgerBillingPresentation(reactive({ get surface() { return pricingSurface.value } }))
const billingView = computed(() => ({ ...billing.view.value,
  summary: [{ id: 'plan', label: t('billing.currentPlan'), value: currentPlanName.value, note: t(`billing.states.${accessState.value}`), status: accessState.value }],
  details: [{ label: t('billing.billingCycle'), value: subscription.value?.billing_interval ? t(`billing.${subscription.value.billing_interval}`) : '—' }, { label: t('billing.nextDate'), value: displayDate(renewalDate.value) }],
  providerNotice: subscription.value?.provider === 'paymob' ? t('billing.legacyPaymentNotice') : subscription.value?.provider === 'manual' ? t('billing.manual.managed') : '',
}))
</script>
<template>
  <BsBillingPage v-model:form="billing.form.value" :copy="billing.copy.value" :view="billingView" :manual="billing.manualView.value" :impact="billing.impact.value" @pricing-retry="billing.retry" @usage-retry="billing.usageRetry" @interval="billing.interval" @plan="billing.choose" @manual-plan="billing.chooseManual" @requests="billing.requests" @manual-close="billing.closeManual" @manual-refresh="billing.refreshManual" @manual-select="billing.select" @manual-file="billing.selectFile" @manual-submit="billing.submitManual" @manual-cancel="billing.cancelManual" @manual-download="billing.download" @open-subscription="billing.openSubscription" @impact-close="billing.closeImpact"/>
</template>
