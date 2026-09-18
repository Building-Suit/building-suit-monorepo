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
            <div class="ls-card ls-hero-preview overflow-hidden p-3 shadow-overlay">
              <div class="flex items-center gap-2 border-b border-[var(--bs-border)] px-3 pb-3 text-xs text-fg-muted">
                <span class="h-2.5 w-2.5 rounded-full bg-fg" /><span class="h-2.5 w-2.5 rounded-full bg-[var(--bs-border-strong)]" /><span class="h-2.5 w-2.5 rounded-full bg-[var(--bs-border)]" />
                <span class="ms-auto">{{ t('landing.previewLabel') }}</span>
              </div>
              <div class="grid gap-3 p-3 sm:grid-cols-2">
                <div v-for="metric in ['cash','revenue','expenses','profit']" :key="metric" class="rounded-card border border-[var(--bs-border)] bg-surface-muted p-4">
                  <p class="text-xs text-fg-muted">{{ t(`landing.metrics.${metric}`) }}</p>
                  <p class="mt-2 text-2xl font-black" dir="ltr">{{ metric === 'cash' ? 'EGP 482,400' : metric === 'revenue' ? 'EGP 96,800' : metric === 'expenses' ? 'EGP 51,200' : 'EGP 45,600' }}</p>
                </div>
              </div>
              <div class="mx-3 mb-3 rounded-card border border-[var(--bs-border)] p-4">
                <div class="mb-6 flex items-center justify-between"><span class="font-bold">{{ t('landing.cashflowPreview') }}</span><span class="text-xs text-fg-muted">6 {{ t('landing.months') }}</span></div>
                <div class="flex h-32 items-end gap-3" aria-hidden="true">
                  <div v-for="height in [42, 68, 52, 84, 73, 96]" :key="height" class="flex flex-1 items-end gap-1"><span class="w-1/2 rounded-t-sm bg-fg" :style="{ height: `${height}%` }" /><span class="w-1/2 rounded-t-sm bg-[var(--bs-border-strong)]" :style="{ height: `${Math.max(24, height - 25)}%` }" /></div>
                </div>
              </div>
            </div>
    </template>
    <template #pricing><BillingCheckout surface="public" /></template>
  </BsLandingPage>
</template>
