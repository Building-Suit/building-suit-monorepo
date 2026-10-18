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
// Match layout/session remounts to the committed route. Nuxt's deferred
// useRoute can still describe the old page when a new keyed layout mounts;
// changing Transition wrappers afterward can leave two page trees alive.
const router = useRouter()
// A keyed layout already owns page replacement. Nesting a default page
// transition inside it can retain an orphan page tree after session loss.
// Unkeyed auth layouts and explicit product transitions retain their motion.
const authRoute = computed(() => /^(?:\/auth(?:\/|$)|\/login\/?$|\/signup\/?$|\/sign-in\/?$|\/sign-up\/?$|\/recover\/?$|\/verify(?:-email)?\/?$)/.test(router.currentRoute.value.path))
const resolvedPageTransition = computed(() => props.pageTransition || (props.layoutKey === undefined && authRoute.value ? { name: 'bs-auth-route', mode: 'out-in' as const } : false))
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
