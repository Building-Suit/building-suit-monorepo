<script setup lang="ts">
import type { PageMeta } from '#app'
import type { PrivacyPresentation } from '@building-suit/ux'
const props = withDefaults(defineProps<{
  privacy?: PrivacyPresentation
  renderPage?: boolean
  layout?: 'default' | 'landing' | 'platform-admin' | 'auth' | false
  layoutKey?: string
  pageKey?: string
  pageTransition?: false | { name?: string; mode?: 'in-out' | 'out-in' | 'default' }
  announcer?: boolean
  toastHost?: boolean
  confirmHost?: boolean
}>(), {
  privacy: undefined, renderPage: true, layout: undefined, layoutKey: undefined, pageKey: undefined, pageTransition: false,
  announcer: false, toastHost: false, confirmHost: true,
})
const route = useRoute()
// Only auth routes receive the glass route transition by default. Existing
// products with explicit page transitions (such as Ledger) retain theirs.
const authRoute = computed(() => /^(?:\/auth(?:\/|$)|\/login\/?$|\/signup\/?$|\/sign-in\/?$|\/sign-up\/?$|\/recover\/?$|\/verify(?:-email)?\/?$)/.test(route.path))
const resolvedPageTransition = computed(() => props.pageTransition || (authRoute.value ? { name: 'bs-auth-route', mode: 'out-in' as const } : false))
function nativeLayoutName() { return props.layout as PageMeta['layout'] }
function scopedPageKey(currentRoute: { path: string }) { return `${currentRoute.path}:${props.pageKey}` }
</script>
<template>
  <div class="bs-app-root">
    <NuxtRouteAnnouncer v-if="announcer" />
    <NuxtLayout v-if="renderPage" :key="layoutKey" :name="nativeLayoutName()"><NuxtPage :page-key="pageKey === undefined ? undefined : scopedPageKey" :transition="resolvedPageTransition" /></NuxtLayout>
    <BsSectionSkeleton v-else :rows="3" />
    <BsToastHost v-if="toastHost" />
    <BsConfirmHost v-if="confirmHost" />
    <BsPrivacyConsent v-if="privacy" :model="privacy" />
  </div>
</template>
