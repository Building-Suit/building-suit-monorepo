<script setup lang="ts">
import type { LandingContent } from '@building-suit/contracts'

withDefaults(defineProps<{ content: LandingContent; signupPath?: string }>(), { signupPath: '/signup' })

const landingRoot = ref<HTMLElement | null>(null)
useLandingMotion(landingRoot)
</script>

<template>
  <main ref="landingRoot" class="bs-landing">
    <BsLandingHero :eyebrow="content.eyebrow" :title="content.heroTitle" :body="content.heroBody" :primary-label="content.createWorkspace" :secondary-label="content.explore" :note="content.trialNote" :signup-path="signupPath"><BsProductPreview><slot name="preview" /></BsProductPreview></BsLandingHero>
    <BsLandingSection id="features" :eyebrow="content.featuresEyebrow" :title="content.featuresTitle" :body="content.featuresBody"><BsFeatureGrid :features="content.features" /></BsLandingSection>
    <BsLandingSection id="workflow" :eyebrow="content.workflowEyebrow" :title="content.workflowTitle" tone="muted" layout="workflow"><BsWorkflowSteps :steps="content.workflow" /></BsLandingSection>
    <BsLandingSection id="pricing" :eyebrow="content.pricingEyebrow" :title="content.pricingTitle" :body="content.pricingBody"><slot name="pricing" /></BsLandingSection>
  </main>
</template>
