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
    <BsLandingHero :eyebrow="content.eyebrow" :title="content.heroTitle" :body="content.heroBody" :primary-label="content.createWorkspace" :secondary-label="content.explore" :note="content.trialNote" :signup-path="signupPath"><BsProductPreview><BsDashboardPreview v-if="preview.kind === 'dashboard'" :label="preview.label" :title="preview.title" :period-label="preview.periodLabel" :metrics="preview.metrics"/><BsStack v-else padding="md"><BsText emphasis="semibold">{{ content.eyebrow }}</BsText><BsStack><BsInline v-for="feature in content.features" :key="feature.title"><BsIcon :name="feature.icon" :size="15"/><BsText>{{ feature.title }}</BsText></BsInline></BsStack><BsInline justify="between"><BsBox><BsText tone="muted">{{ content.eyebrow }}</BsText><BsText emphasis="semibold">{{ content.featuresTitle }}</BsText></BsBox><BsIcon name="user" :size="16"/></BsInline><BsGrid :columns="2"><BsBox v-for="feature in content.features" :key="feature.title" as="article" surface="muted" padding="md"><BsIcon :name="feature.icon" :size="20"/><BsText size="xs" emphasis="semibold">{{ feature.title }}</BsText></BsBox></BsGrid><BsText tone="muted">{{ content.workflow[2]?.title }}</BsText></BsStack></BsProductPreview></BsLandingHero>
    <BsLandingSection id="features" :eyebrow="content.featuresEyebrow" :title="content.featuresTitle" :body="content.featuresBody"><BsFeatureGrid :features="content.features" /></BsLandingSection>
    <BsLandingSection id="workflow" :eyebrow="content.workflowEyebrow" :title="content.workflowTitle" tone="muted" layout="workflow"><BsWorkflowSteps :steps="content.workflow" /></BsLandingSection>
    <BsLandingSection id="pricing" :eyebrow="content.pricingEyebrow" :title="content.pricingTitle" :body="content.pricingBody"><BsBox :data-testid="pricing.sectionTestId"><BsMarketingPricing :plans="pricing.plans" :interval="pricing.interval" :interval-options="pricing.intervalOptions" :copy="pricing.copy" :annual-saving="pricing.annualSaving" :intro="pricing.intro" :loading="pricing.loading" :error="pricing.error" :columns="pricing.columns" :test-id="pricing.testId" @update:interval="emit('interval', $event)" @update:variant="(planId, value) => emit('variant', planId, value)" @action="emit('action', $event)" @secondary-action="emit('secondaryAction', $event)" @retry="emit('retry')"/><BsText v-if="pricing.notice" :data-testid="pricing.noticeTestId" role="note" size="sm" tone="muted">{{ pricing.notice }}</BsText></BsBox></BsLandingSection>
  </main>
</template>
