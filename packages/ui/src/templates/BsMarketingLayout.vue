<script setup lang="ts">
withDefaults(defineProps<{
  navigation: Array<{ to: string; label: string }>
  legalLinks: Array<{ to: string; label: string }>
  labels: { home: string; navigation: string; openApp: string; signIn: string; startTrial: string; close: string; open: string; footer: string; footerNavigation: string }
  product?: { name: string; assetPrefix?: string };
  privacySettingsLabel?: string; signedIn?: boolean; loginPath?: string; signupPath?: string; dashboardPath?: string
}>(), { privacySettingsLabel: undefined, product: undefined, signedIn: false, loginPath: '/login', signupPath: '/signup', dashboardPath: '/dashboard' })

const emit = defineEmits<{ privacySettings: [] }>()
const { hydrated, topSentinel, headerElevated } = useMarketingHeader()
</script>

<template>
  <div class="bs-marketing min-h-dvh bg-background text-fg" :data-hydrated="hydrated">
    <div ref="topSentinel" class="pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden="true" />
    <BsLandingTopHeader :navigation="navigation" :labels="labels" :signed-in="signedIn" :login-path="loginPath" :signup-path="signupPath" :dashboard-path="dashboardPath" :elevated="headerElevated"><template #logo><BsProductLogo v-if="product" :name="product.name" :asset-prefix="product.assetPrefix" size="marketing" /><slot v-else name="logo" /></template></BsLandingTopHeader>

    <slot />

    <BsLandingFooter :privacy-settings-label="privacySettingsLabel" @privacy-settings="emit('privacySettings')" :legal-links="legalLinks" :footer="labels.footer" :navigation-label="labels.footerNavigation"><template #logo><BsProductLogo v-if="product" :name="product.name" :asset-prefix="product.assetPrefix" size="marketing" /><slot v-else name="logo" /></template></BsLandingFooter>
  </div>
</template>
