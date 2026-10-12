<script setup lang="ts">
import type { LandingContent } from '@building-suit/contracts'
import type { BsLandingPreview, BsLandingPricing } from '../types/landingPresentation'

withDefaults(defineProps<{ content: LandingContent; preview: BsLandingPreview; pricing: BsLandingPricing; signupPath?: string }>(), { signupPath: '/signup' })

const emit = defineEmits<{ interval: [value: string]; variant: [planId: string, value: string]; action: [planId: string]; secondaryAction: [planId: string]; retry: [] }>()
const landingRoot = ref<HTMLElement | null>(null)
useLandingMotion(landingRoot)
</script>

<template>
  <main ref="landingRoot" class="bs-landing">
    <BsLandingHero :eyebrow="content.eyebrow" :title="content.heroTitle" :body="content.heroBody" :primary-label="content.createWorkspace" :secondary-label="content.explore" :note="content.trialNote" :signup-path="signupPath"><BsProductPreview><BsDashboardPreview v-if="preview.kind === 'dashboard'" :label="preview.label" :title="preview.title" :period-label="preview.periodLabel" :metrics="preview.metrics"/><div v-else class="bs-product-feature-preview">
      <header class="bs-product-feature-preview__header"><BsText emphasis="semibold">{{ content.eyebrow }}</BsText><BsIcon name="user" :size="16"/></header>
      <div class="bs-product-feature-preview__body">
        <aside class="bs-product-feature-preview__navigation" aria-hidden="true"><BsInline v-for="feature in content.features" :key="feature.title" :wrap="false"><BsIcon :name="feature.icon" :size="16"/><BsText size="xs">{{ feature.title }}</BsText></BsInline></aside>
        <BsStack padding="md"><BsHeading :level="2" size="body">{{ content.featuresTitle }}</BsHeading><BsGrid :columns="2"><BsCard v-for="feature in content.features" :key="feature.title" padding="sm"><BsStack gap="sm"><BsIcon :name="feature.icon" :size="20"/><BsText size="xs" emphasis="semibold">{{ feature.title }}</BsText></BsStack></BsCard></BsGrid><BsText size="xs" tone="muted">{{ content.workflow[2]?.title }}</BsText></BsStack>
      </div>
    </div></BsProductPreview></BsLandingHero>
    <BsLandingSection id="features" :eyebrow="content.featuresEyebrow" :title="content.featuresTitle" :body="content.featuresBody"><BsFeatureGrid :features="content.features" /></BsLandingSection>
    <BsLandingSection id="workflow" :eyebrow="content.workflowEyebrow" :title="content.workflowTitle" tone="muted" layout="workflow"><BsWorkflowSteps :steps="content.workflow" /></BsLandingSection>
    <BsLandingSection id="pricing" :eyebrow="content.pricingEyebrow" :title="content.pricingTitle" :body="content.pricingBody"><BsBox :data-testid="pricing.sectionTestId"><BsMarketingPricing :plans="pricing.plans" :interval="pricing.interval" :interval-options="pricing.intervalOptions" :copy="pricing.copy" :annual-saving="pricing.annualSaving" :intro="pricing.intro" :loading="pricing.loading" :error="pricing.error" :columns="pricing.columns" :test-id="pricing.testId" @update:interval="emit('interval', $event)" @update:variant="(planId, value) => emit('variant', planId, value)" @action="emit('action', $event)" @secondary-action="emit('secondaryAction', $event)" @retry="emit('retry')"/><BsText v-if="pricing.notice" :data-testid="pricing.noticeTestId" role="note" size="sm" tone="muted">{{ pricing.notice }}</BsText></BsBox></BsLandingSection>
  </main>
</template>
