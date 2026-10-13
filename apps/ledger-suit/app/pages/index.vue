<script setup lang="ts">
import { useLedgerBillingCheckoutView } from '~/composables/useLedgerBillingCheckoutView'
definePageMeta({ layout: 'marketing' })

const { t } = useI18n()
useHead(() => ({
  title: `${t('landing.title')} · ${t('app.name')}`,
  meta: [{ name: 'description', content: t('landing.metaDescription') }],
}))

const features = [
  { icon: 'cash', key: 'cashflow' },
  { icon: 'ledger', key: 'ledger' },
  { icon: 'invoice', key: 'commitments' },
  { icon: 'automation', key: 'automation' },
  { icon: 'reports', key: 'reports' },
  { icon: 'team', key: 'team' },
]
const content = computed(() => ({
  eyebrow: t('landing.eyebrow'),
  heroTitle: t('landing.heroTitle'),
  heroBody: t('landing.heroBody'),
  createWorkspace: t('landing.createWorkspace'),
  explore: t('landing.explore'),
  trialNote: t('landing.trialNote'),
  featuresEyebrow: t('landing.featuresEyebrow'),
  featuresTitle: t('landing.featuresTitle'),
  featuresBody: t('landing.featuresBody'),
  workflowEyebrow: t('landing.workflowEyebrow'),
  workflowTitle: t('landing.workflowTitle'),
  pricingEyebrow: t('landing.pricingEyebrow'),
  pricingTitle: t('landing.pricingTitle'),
  pricingBody: t('landing.pricingBody'),
  features: features.map(item => ({ icon: item.icon, title: t(`landing.features.${item.key}.title`), body: t(`landing.features.${item.key}.body`) })),
  workflow: [1, 2, 3].map(step => ({ title: t(`landing.workflow.${step}.title`), body: t(`landing.workflow.${step}.body`) })),
}))
const pricing = reactive(useLedgerBillingCheckoutView({ surface: 'public' }))
const landingPreview = computed(() => ({ kind: 'dashboard' as const, label: t('landing.previewLabel'), title: t('landing.cashflowPreview'), periodLabel: '6 ' + t('landing.months'), metrics: ['cash', 'revenue', 'expenses', 'profit'].map((metric, index) => ({ label: t(`landing.metrics.${metric}`), value: ['EGP 482,400', 'EGP 96,800', 'EGP 51,200', 'EGP 45,600'][index]! })) }))
const landingPricing = computed(() => ({
  interval: pricing.interval, plans: pricing.pricingPlans,
  intervalOptions: [{ value: 'monthly', label: t('billing.monthly') }, { value: 'yearly', label: t('billing.yearly') }],
  copy: { cycleLabel: t('billing.billingCycle'), loading: t('billing.plans.loading'), empty: t('billing.plans.loadFailed'), retry: t('common.retry'), included: t('billing.plans.included'), notIncluded: t('billing.plans.notIncluded') },
  annualSaving: pricing.annualDiscount === null ? null : t('billing.plans.annualDiscount', { percent: pricing.annualDiscount }),
  loading: pricing.catalogPending, error: pricing.catalogError ? t('billing.plans.loadFailed') : null,
  columns: 4 as const, testId: 'plan-pricing-grid', sectionTestId: 'plan-pricing', noticeTestId: 'payment-method-branding', notice: t('billing.securePayments'),
}))
function chooseInterval(value: string) { if (value === 'monthly' || value === 'yearly') pricing.interval = value }
</script>
<template>
  <BsLandingPage :content="content" :preview="landingPreview" :pricing="landingPricing" @interval="chooseInterval" @retry="pricing.refresh" @action="pricing.choosePlan"/>
</template>
