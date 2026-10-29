<script setup lang="ts">
import BsShopLandingJourney from '../organisms/BsShopLandingJourney.vue'
import BsWhatsNewSection from '../organisms/BsWhatsNewSection.vue'
import designTokens from '@building-suit/design-tokens'
import type { LandingContent } from '@building-suit/contracts'
import type { BsLandingJourney, BsLandingPreview, BsLandingPricing, BsLandingChangelog } from '../types/landingPresentation'

const props = withDefaults(defineProps<{
  content: LandingContent
  preview: BsLandingPreview
  journey?: BsLandingJourney
  changelog?: BsLandingChangelog
  pricing: BsLandingPricing
  signupPath?: string
}>(), { signupPath: '/signup', journey: undefined, changelog: undefined })

const emit = defineEmits<{
  interval: [value: string]
  variant: [planId: string, value: string]
  linkAction: [planId: string]
  action: [planId: string]
  secondaryAction: [planId: string]
  retry: []
  changelogRetry: []
  currency: [value: string]
}>()
const landingRoot = ref<HTMLElement | null>(null)
const { isLoading, loaderMounted, continueWithoutMotion } = useLandingMotion(landingRoot, Boolean(props.journey))

// Critical presentation is in the initial HTML head. The page cannot paint ahead of
// its loader while Vue, fonts or the motion chunk are still downloading.
const { deepStructureNavy, premiumGold, pearlWhite, cloudGray } = designTokens.color.brand
const loaderCss = `html[data-shop-landing-loading="true"] { background:var(--bs-color-brand-deep-structure-navy,${deepStructureNavy.value}); overflow:hidden; scrollbar-gutter:stable; }
html[data-shop-landing-loading="true"] body { overflow:hidden; }
html[data-shop-landing-loading="true"] body>* { visibility:hidden; }
html[data-shop-landing-loading="true"] .bs-landing-loader, html[data-shop-landing-loading="true"] .bs-landing-loader * { visibility:visible; }
.bs-landing-loader { position:fixed; inset:0; z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px; color:var(--bs-color-brand-pearl-white,${pearlWhite.value}); background:var(--bs-color-brand-deep-structure-navy,${deepStructureNavy.value}); outline:none; }
.bs-landing-loader__logo { width:240px; max-width:70vw; }
.bs-landing-loader__track { width:240px; max-width:60vw; height:2px; overflow:hidden; margin-top:34px; background:color-mix(in srgb,var(--bs-color-brand-premium-gold,${premiumGold.value}) 20%,transparent); }
.bs-landing-loader__track>span { display:block; width:36%; height:100%; background:var(--bs-color-brand-premium-gold,${premiumGold.value}); animation:bs-landing-loading 1.35s ease-in-out infinite; }
.bs-landing-loader>p { font-size:.85rem; line-height:1.7; margin:20px 0 24px; }
.bs-landing-loader>button { padding:10px 14px; border:0; background:transparent; color:var(--bs-color-brand-cloud-gray,${cloudGray.value}); font:inherit; font-size:.75rem; cursor:pointer; text-decoration:underline; text-underline-offset:5px; }
.bs-landing-loader>button:focus-visible { outline:2px solid var(--bs-color-brand-premium-gold,${premiumGold.value}); outline-offset:4px; }
.bs-landing-loader-leave-active { transition:opacity .28s ease-out; pointer-events:none; }
.bs-landing-loader-leave-to { opacity:0; }
:dir(rtl) .bs-landing-loader__track>span { animation-direction:reverse; }
@keyframes bs-landing-loading { from { transform:translateX(-110%); } to { transform:translateX(385%); } }
@media (prefers-reduced-motion:reduce) { .bs-landing-loader__track>span { animation:none; width:100%; opacity:.7; } .bs-landing-loader-leave-active { transition:none; } }`
const noScriptCss = `
html[data-shop-landing-loading="true"], html[data-shop-landing-loading="true"] body { overflow:auto!important; background:var(--bs-bg)!important; }
html[data-shop-landing-loading="true"] body>* { visibility:visible!important; }
html[data-shop-landing-loading="true"] .bs-landing-loader { display:none!important; }
`
useHead(() => ({
  htmlAttrs: { 'data-shop-landing-loading': props.journey && isLoading.value ? 'true' : 'false' },
  style: props.journey ? [{ key: 'shop-landing-loader-critical', innerHTML: loaderCss, tagPriority: 'critical' }] : [],
  link: props.journey ? [{ key: 'shop-landing-loader-logo', rel: 'preload', as: 'image', href: '/brand/shop-suit-wordmark-light.svg', fetchpriority: 'high' }] : [],
  noscript: props.journey ? [{ key: 'shop-landing-loader-no-script', innerHTML: `<style>${noScriptCss}</style>`, tagPosition: 'head' }] : [],
}))
</script>

<template>
  <div class="bs-landing-shell">
    <!-- This is the first visible SSR content, and stays in place through hydration. -->
    <Transition name="bs-landing-loader">
      <div v-if="journey && isLoading" class="bs-landing-loader" data-landing-loader role="region" tabindex="-1" :aria-label="journey.loading.label">
        <BsProductLogo class="bs-landing-loader__logo" name="Shop Suit" asset-prefix="/brand/shop-suit" tone="light" />
        <div class="bs-landing-loader__track" aria-hidden="true"><span /></div>
        <p role="status">{{ journey.loading.label }}</p>
        <button v-if="loaderMounted" type="button" @click="continueWithoutMotion">{{ journey.loading.continue }}</button>
      </div>
    </Transition>
    <main ref="landingRoot" class="bs-landing" :aria-busy="loaderMounted && isLoading">
      <BsShopLandingJourney v-if="journey" :journey="journey" :signup-path="signupPath" :features="content.features" :features-title="content.featuresTitle" :features-body="content.featuresBody" />
      <BsLandingHero v-else :eyebrow="content.eyebrow" :title="content.heroTitle" :body="content.heroBody" :primary-label="content.createWorkspace" :secondary-label="content.explore" :note="content.trialNote" :signup-path="signupPath">
        <BsProductPreview>
          <BsDashboardPreview v-if="preview.kind === 'dashboard'" :label="preview.label" :title="preview.title" :period-label="preview.periodLabel" :metrics="preview.metrics"/>
          <div v-else class="bs-product-feature-preview">
            <header class="bs-product-feature-preview__header"><BsText emphasis="semibold">{{ content.eyebrow }}</BsText><BsIcon name="user" :size="16"/></header>
            <div class="bs-product-feature-preview__body"><aside class="bs-product-feature-preview__navigation" aria-hidden="true"><BsInline v-for="feature in content.features" :key="feature.title" :wrap="false"><BsIcon :name="feature.icon" :size="16"/><BsText size="xs">{{ feature.title }}</BsText></BsInline></aside>
              <BsStack padding="md"><BsHeading :level="2" size="body">{{ content.featuresTitle }}</BsHeading><BsGrid :columns="2"><BsCard v-for="feature in content.features" :key="feature.title" variant="flat" padding="sm"><BsStack gap="sm"><BsIcon :name="feature.icon" :size="20"/><BsText size="xs" emphasis="semibold">{{ feature.title }}</BsText></BsStack></BsCard></BsGrid><BsText size="xs" tone="muted">{{ content.workflow[2]?.title }}</BsText></BsStack>
            </div>
          </div>
        </BsProductPreview>
      </BsLandingHero>
      <BsLandingSection v-if="!journey" id="features" :eyebrow="content.featuresEyebrow" :title="content.featuresTitle" :body="content.featuresBody"><BsFeatureGrid :features="content.features" /></BsLandingSection>
      <BsLandingSection v-if="!journey" id="workflow" :eyebrow="content.workflowEyebrow" :title="content.workflowTitle" tone="muted" layout="workflow"><BsWorkflowSteps :steps="content.workflow" /></BsLandingSection>
      <BsLandingSection id="pricing" :eyebrow="content.pricingEyebrow" :title="content.pricingTitle" :body="content.pricingBody"><BsBox :data-testid="pricing.sectionTestId"><BsMarketingPricing :variant="pricing.variant" :plans="pricing.plans" :currency-selection="pricing.currencySelection" :interval="pricing.interval" :interval-options="pricing.intervalOptions" :copy="pricing.copy" :annual-saving="pricing.annualSaving" :intro="pricing.intro" :loading="pricing.loading" :error="pricing.error" :columns="pricing.columns" :test-id="pricing.testId" @update:currency="emit('currency', $event)" @update:interval="emit('interval', $event)" @update:variant="(planId, value) => emit('variant', planId, value)" @link-action="emit('linkAction', $event)" @action="emit('action', $event)" @secondary-action="emit('secondaryAction', $event)" @retry="emit('retry')"/><BsText v-if="pricing.notice" :data-testid="pricing.noticeTestId" role="note" size="sm" tone="muted">{{ pricing.notice }}</BsText></BsBox></BsLandingSection>
      <BsWhatsNewSection v-if="changelog" :content="changelog" @retry="emit('changelogRetry')" />
    </main>
  </div>
</template>
