<script setup lang="ts">
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
</script>

<template>
  <BsLandingPage :content="content">
    <template #preview>
      <div class="ls-hero-preview overflow-hidden rounded-modal border">
        <div class="flex items-center gap-2 border-b border-[var(--bs-border)] px-4 py-3 text-[.65rem] text-fg-muted">
          <span class="h-2 w-2 rounded-full bg-brand-gold" /><span class="h-2 w-2 rounded-full bg-[var(--bs-border-strong)]" /><span class="h-2 w-2 rounded-full bg-[var(--bs-border)]" />
          <span class="ms-auto font-semibold uppercase tracking-[.12em]">{{ t('landing.previewLabel') }}</span>
        </div>
        <div class="grid min-h-[29rem] sm:grid-cols-[8.5rem_1fr]">
          <div class="hidden border-e border-[var(--bs-border)] p-4 sm:block">
            <div class="h-8 w-24 rounded-control bg-[var(--bs-border)]" />
            <div class="mt-8 space-y-3" aria-hidden="true">
              <span v-for="width in ['88%','72%','82%','60%','76%']" :key="width" class="block h-2 rounded-full bg-[var(--bs-border)]" :style="{ width }" />
            </div>
          </div>
          <div class="min-w-0 p-4 sm:p-5">
            <div class="mb-5 flex items-end justify-between gap-3">
              <div><p class="text-xs text-fg-muted">{{ t('landing.previewLabel') }}</p><p class="mt-1 text-base font-bold">{{ t('landing.cashflowPreview') }}</p></div>
              <span class="text-[.65rem] text-fg-muted">6 {{ t('landing.months') }}</span>
            </div>
            <div class="grid grid-cols-2 gap-px overflow-hidden rounded-control border border-[var(--bs-border)] bg-[var(--bs-border)]">
              <div v-for="metric in ['cash','revenue','expenses','profit']" :key="metric" class="bg-surface-muted p-3 sm:p-4">
                <p class="text-[.65rem] text-fg-muted">{{ t(`landing.metrics.${metric}`) }}</p>
                <p class="mt-2 text-sm font-bold tabular-nums sm:text-base" dir="ltr">{{ metric === 'cash' ? 'EGP 482,400' : metric === 'revenue' ? 'EGP 96,800' : metric === 'expenses' ? 'EGP 51,200' : 'EGP 45,600' }}</p>
              </div>
            </div>
            <div class="mt-4 border-t border-[var(--bs-border)] pt-5">
              <div class="flex h-32 items-end gap-2" aria-hidden="true">
                <div v-for="height in [42, 68, 52, 84, 73, 96]" :key="height" class="flex h-full flex-1 items-end gap-1"><span class="w-1/2 rounded-t-sm bg-brand-gold" :style="{ height: `${height}%` }" /><span class="w-1/2 rounded-t-sm bg-[var(--bs-border-strong)]" :style="{ height: `${Math.max(24, height - 25)}%` }" /></div>
              </div>
              <div class="mt-3 flex justify-between" aria-hidden="true"><span v-for="month in 6" :key="month" class="h-1 w-1 rounded-full bg-[var(--bs-border-strong)]" /></div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #pricing><BillingCheckout surface="public" /></template>
  </BsLandingPage>
</template>
